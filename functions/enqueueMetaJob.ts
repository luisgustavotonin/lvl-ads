import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHash } from 'node:crypto';

// Variável global para agrupar jobs do mesmo batch
let currentBatchId = null;
let batchJobs = [];
let batchTimer = null;

async function registerDebugJob(base44, payload) {
    try {
        // Detectar batch_id ou run_id do payload
        const runId = payload.run_id || payload.batch_id || 'unknown_' + Date.now();
        const jobKey = `${payload.unit_id}|${payload.account_id}|${payload.since || 'none'}|${payload.until || 'none'}|${payload.job_type}|${payload.breakdown || ''}`;
        
        // Se é um novo batch, criar novo run
        if (currentBatchId !== runId) {
            // Se tinha batch anterior, finalizar
            if (currentBatchId && batchJobs.length > 0) {
                await flushDebugBatch(base44);
            }
            
            currentBatchId = runId;
            batchJobs = [];
        }

        // Adicionar job ao batch atual
        batchJobs.push({
            job_id_sent: payload.job_id,
            job_type: payload.job_type,
            breakdown: payload.breakdown || null,
            since: payload.since,
            until: payload.until,
            unit_id: payload.unit_id,
            account_id: payload.account_id,
            job_key: jobKey
        });

        // Resetar timer - aguarda 2s sem novos jobs para finalizar batch
        if (batchTimer) clearTimeout(batchTimer);
        batchTimer = setTimeout(async () => {
            await flushDebugBatch(base44);
        }, 2000);

    } catch (error) {
        console.error('⚠️ Erro ao registrar debug:', error);
    }
}

async function flushDebugBatch(base44) {
    try {
        if (batchJobs.length === 0) return;

        const payloadHash = createHash('md5')
            .update(JSON.stringify(batchJobs))
            .digest('hex');

        const firstJob = batchJobs[0];

        // Criar ou atualizar run
        const existingRuns = await base44.asServiceRole.entities.MetaEnqueueRuns.filter({ run_id: currentBatchId });
        
        if (existingRuns.length > 0) {
            await base44.asServiceRole.entities.MetaEnqueueRuns.update(existingRuns[0].id, {
                received_jobs_count: batchJobs.length
            });
        } else {
            await base44.asServiceRole.entities.MetaEnqueueRuns.create({
                run_id: currentBatchId,
                source: 'n8n_dispatcher',
                received_at: new Date().toISOString(),
                unit_id: firstJob.unit_id,
                account_id: firstJob.account_id,
                payload_hash: payloadHash,
                expected_jobs: batchJobs.length,
                received_jobs_count: batchJobs.length,
                raw_payload_json: { jobs: batchJobs }
            });
        }

        // Criar items
        for (const job of batchJobs) {
            const existing = await base44.asServiceRole.entities.MetaEnqueueRunItems.filter({ job_key: job.job_key });
            const isDuplicate = existing.length > 0;

            await base44.asServiceRole.entities.MetaEnqueueRunItems.create({
                run_id: currentBatchId,
                job_key: job.job_key,
                job_type: job.job_type,
                breakdown: job.breakdown,
                since: job.since,
                until: job.until,
                unit_id: job.unit_id,
                account_id: job.account_id,
                job_id_sent: job.job_id_sent,
                is_duplicate: isDuplicate
            });
        }

        console.log(`🟣 Debug registrado: run_id=${currentBatchId}, jobs=${batchJobs.length}`);
        
        currentBatchId = null;
        batchJobs = [];
        batchTimer = null;

    } catch (error) {
        console.error('❌ Erro ao finalizar batch debug:', error);
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        
        console.log('🟢 ========== N8N CHAMOU enqueueMetaJob ==========');
        console.log('🟢 Job Type:', payload.job_type);
        console.log('🟢 Breakdown:', payload.breakdown || 'NENHUM');
        console.log('🟢 Date Mode:', payload.date_mode);
        console.log('🟢 Payload COMPLETO:', JSON.stringify(payload, null, 2));
        console.log('🟢 ================================================');

        // Validar campos obrigatórios
        const required = ['job_id', 'unit_id', 'account_id', 'access_token', 'job_type', 'date_mode'];
        for (const field of required) {
            if (!payload[field]) {
                return Response.json({ 
                    success: false, 
                    error: `Campo obrigatório ausente: ${field}` 
                }, { status: 400 });
            }
        }

        // Validar date_mode e datas
        const validDateModes = ['TODAY', 'TODAY_AND_YESTERDAY', 'YESTERDAY', 'LAST_7D', 'LAST_14D', 'LAST_28D', 'LAST_30D', 'CUSTOM'];
        if (!validDateModes.includes(payload.date_mode)) {
            return Response.json({ 
                success: false, 
                error: `date_mode inválido. Use: ${validDateModes.join(', ')}` 
            }, { status: 400 });
        }

        // Se for CUSTOM, validar since/until
        if (payload.date_mode === 'CUSTOM') {
            if (!payload.since || !payload.until) {
                return Response.json({ 
                    success: false, 
                    error: 'Para date_mode CUSTOM, since e until são obrigatórios' 
                }, { status: 400 });
            }
        }

        const queueKey = `${payload.unit_id}_${payload.job_type}_${payload.breakdown || 'default'}`;

        // CRÍTICO: Salvar payload EXATAMENTE como recebido
        const jobData = {
            job_id: payload.job_id,
            status: 'queued',
            queue_key: queueKey,
            unit_id: payload.unit_id,
            account_id: payload.account_id,
            access_token: payload.access_token,
            job_type: payload.job_type,
            breakdown: payload.breakdown || null,
            timezone: payload.timezone || 'America/Sao_Paulo',
            date_mode: payload.date_mode,
            since: payload.since || null,
            until: payload.until || null,
            attempt: 0,
            payload_json: payload
        };

        const job = await base44.asServiceRole.entities.MetaJobsQueue.create(jobData);

        console.log(`✅ Job enfileirado: ${job.job_id} | date_mode=${job.date_mode} | since=${job.since} | until=${job.until}`);

        // 🟣 REGISTRAR NO DEBUG
        await registerDebugJob(base44, payload);

        return Response.json({
            success: true,
            message: 'Job enfileirado com sucesso',
            job_id: job.job_id,
            queue_key: job.queue_key,
            status: job.status,
            date_mode: job.date_mode,
            since: job.since,
            until: job.until
        });

    } catch (error) {
        console.error('❌ Erro ao enfileirar job:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});