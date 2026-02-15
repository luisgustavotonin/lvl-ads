import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const { job_id, unit_id, account_id, result_json, row_count = 0, payload_hash } = payload;

        if (!job_id || !unit_id || !account_id || !result_json) {
            return Response.json({ 
                ok: false, 
                error: { message: 'job_id, unit_id, account_id e result_json são obrigatórios', code: 'MISSING_PARAMS' } 
            }, { status: 400 });
        }

        // Garantir que result_json seja um objeto (aceita string ou objeto)
        let parsedResultJson = result_json;
        if (typeof result_json === 'string') {
            try {
                parsedResultJson = JSON.parse(result_json);
            } catch (e) {
                // Se não conseguir parsear, tenta usar como está
                parsedResultJson = { raw: result_json };
            }
        } else if (typeof result_json !== 'object') {
            parsedResultJson = { data: result_json };
        }

        // Parse row_count (aceita string ou number)
        const parsedRowCount = typeof row_count === 'string' ? (parseInt(row_count, 10) || 0) : (row_count || 0);

        // Verificar se já existe resultado para esse job
        const existing = await base44.asServiceRole.entities.MetaJobsResults.filter({ job_id });

        if (existing.length > 0) {
            // Atualizar resultado existente
            await base44.asServiceRole.entities.MetaJobsResults.update(existing[0].id, {
                result_json: parsedResultJson,
                row_count: parsedRowCount,
                payload_hash
            });

            console.log(`🔄 Result updated for job: ${job_id}`);
        } else {
            // Criar novo resultado
            await base44.asServiceRole.entities.MetaJobsResults.create({
                job_id,
                unit_id,
                account_id,
                result_json: parsedResultJson,
                row_count: parsedRowCount,
                payload_hash
            });

            console.log(`✅ Result saved for job: ${job_id}`);
        }

        return Response.json({ ok: true });

    } catch (error) {
        console.error('❌ Erro ao salvar resultado:', error);
        return Response.json({ 
            ok: false, 
            error: { 
                message: error.message, 
                code: 'SAVE_RESULT_ERROR',
                details: error.stack 
            } 
        }, { status: 500 });
    }
});