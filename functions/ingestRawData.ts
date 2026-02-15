import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHash } from 'node:crypto';

/**
 * INGESTÃO RAW OBRIGATÓRIA
 * Salva TUDO que chegar, schema dinâmico
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const receivedAt = new Date().toISOString();

        const { 
            unit_id, 
            platform,
            run_id,
            job_id,
            job_type,
            data,
            source = 'n8n'
        } = await req.json();

        // Validação
        if (!unit_id || !platform || !run_id || !job_id || !job_type || !data) {
            return Response.json({ 
                error: 'Campos obrigatórios: unit_id, platform, run_id, job_id, job_type, data' 
            }, { status: 400 });
        }

        console.log(`📥 Ingestão RAW: ${job_type} | RUN: ${run_id.substring(0,8)} | JOB: ${job_id.substring(0,8)}`);

        // Normalizar data para array
        const records = Array.isArray(data) ? data : [data];
        
        console.log(`📊 ${records.length} registros recebidos`);

        const savedEvents = [];
        const errors = [];

        // Salvar cada registro como RawEvent
        for (let i = 0; i < records.length; i++) {
            try {
                const record = records[i];
                const event_id = crypto.randomUUID();
                
                // Hash para deduplicação
                const payloadStr = JSON.stringify(record);
                const payload_hash = createHash('md5').update(payloadStr).digest('hex');

                // Verificar duplicação (opcional)
                const existing = await base44.asServiceRole.entities.RawEvent.filter({
                    payload_hash,
                    job_id,
                    unit_id
                }, null, 1);

                if (existing.length > 0) {
                    console.log(`⏭️ Registro ${i} duplicado, pulando...`);
                    continue;
                }

                // Salvar RAW
                await base44.asServiceRole.entities.RawEvent.create({
                    event_id,
                    received_at_utc: receivedAt,
                    unit_id,
                    platform,
                    run_id,
                    job_id,
                    job_type,
                    payload: record,
                    payload_hash,
                    source,
                    row_index: i
                });

                savedEvents.push(event_id);

                // Atualizar schema registry (async, não bloqueia)
                updateSchemaRegistry(base44, job_type, record).catch(err => 
                    console.warn('Schema registry update failed:', err.message)
                );

            } catch (error) {
                console.error(`❌ Erro ao salvar registro ${i}:`, error);
                errors.push({ index: i, error: error.message });
            }
        }

        const savedCount = savedEvents.length;
        console.log(`✅ ${savedCount} eventos RAW salvos`);

        // Atualizar contadores do JOB
        try {
            const jobs = await base44.asServiceRole.entities.Job.filter({ job_id, unit_id });
            if (jobs.length > 0) {
                const job = jobs[0];
                await base44.asServiceRole.entities.Job.update(job.id, {
                    records_processed: savedCount,
                    status: savedCount > 0 ? 'success' : 'failed',
                    error_message: savedCount === 0 ? 'Nenhum registro foi salvo' : null,
                    finished_at_utc: new Date().toISOString()
                });

                // Atualizar RUN
                const runs = await base44.asServiceRole.entities.Run.filter({ run_id, unit_id });
                if (runs.length > 0) {
                    const run = runs[0];
                    await base44.asServiceRole.entities.Run.update(run.id, {
                        total_records: (run.total_records || 0) + savedCount,
                        completed_jobs: (run.completed_jobs || 0) + 1,
                        status: 'success'
                    });
                }
            }
        } catch (error) {
            console.warn('⚠️ Erro ao atualizar contadores:', error);
        }

        return Response.json({
            success: true,
            saved_count: savedCount,
            total_received: records.length,
            event_ids: savedEvents,
            errors: errors.length > 0 ? errors : null
        });

    } catch (error) {
        console.error('❌ Erro na ingestão:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});

// Função auxiliar para atualizar schema registry
async function updateSchemaRegistry(base44, job_type, payload) {
    const now = new Date().toISOString();
    
    // Extrair campos do payload (top-level apenas por enquanto)
    for (const [key, value] of Object.entries(payload)) {
        try {
            const field_path = key;
            const data_type = detectType(value);
            const example_value = String(value).substring(0, 100);

            // Verificar se já existe
            const existing = await base44.asServiceRole.entities.SchemaRegistry.filter({
                job_type,
                field_path
            }, null, 1);

            if (existing.length > 0) {
                // Atualizar
                const reg = existing[0];
                await base44.asServiceRole.entities.SchemaRegistry.update(reg.id, {
                    last_seen_at: now,
                    occurrence_count: (reg.occurrence_count || 0) + 1
                });
            } else {
                // Criar
                await base44.asServiceRole.entities.SchemaRegistry.create({
                    job_type,
                    field_path,
                    data_type,
                    first_seen_at: now,
                    last_seen_at: now,
                    example_value,
                    occurrence_count: 1
                });
            }
        } catch (error) {
            console.warn(`Schema registry error for field ${key}:`, error.message);
        }
    }
}

function detectType(value) {
    if (value === null || value === undefined) return 'string';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'json';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') {
        // Detectar data
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
        return 'string';
    }
    return 'string';
}