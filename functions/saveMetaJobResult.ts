import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        let rawPayload = await req.json();

        // N8n pode enviar array ou objeto
        if (Array.isArray(rawPayload)) {
            if (rawPayload.length === 0) {
                return Response.json({ ok: false, error: { message: 'Payload array vazio', code: 'EMPTY_ARRAY' } }, { status: 400 });
            }
            rawPayload = rawPayload[0];
        }

        const { job_id, unit_id, account_id, result_json, row_count, payload_hash } = rawPayload;
        let { run_id } = rawPayload;

        if (!job_id || !unit_id || !account_id || !result_json) {
            return Response.json({
                ok: false,
                error: { message: 'job_id, unit_id, account_id e result_json são obrigatórios', code: 'MISSING_PARAMS' }
            }, { status: 400 });
        }

        // ✅ Se run_id não veio no payload, buscar no MetaJobsQueue via job_id
        if (!run_id) {
            const queueJobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });
            run_id = queueJobs?.[0]?.run_id ?? null;
        }

        if (!run_id) {
            return Response.json({
                ok: false,
                error: { message: 'run_id não encontrado: envie run_id no payload ou garanta que o job na fila tenha run_id', code: 'MISSING_RUN_ID' }
            }, { status: 400 });
        }

        // Normalizar result_json
        let normalizedResultJson;
        if (typeof result_json === 'string') {
            try {
                normalizedResultJson = JSON.parse(result_json);
            } catch (e) {
                return Response.json({ ok: false, error: { message: 'result_json inválido', code: 'INVALID_JSON', details: e.message } }, { status: 400 });
            }
        } else if (typeof result_json === 'object' && result_json !== null) {
            normalizedResultJson = result_json;
        } else {
            return Response.json({ ok: false, error: { message: 'result_json deve ser objeto ou string JSON', code: 'INVALID_JSON_TYPE' } }, { status: 400 });
        }

        // Normalizar row_count
        let normalizedRowCount = 0;
        if (typeof row_count === 'number') {
            normalizedRowCount = row_count;
        } else if (typeof row_count === 'string') {
            const parsed = Number(row_count);
            if (!isNaN(parsed)) normalizedRowCount = parsed;
        }
        if (normalizedRowCount === 0 && Array.isArray(normalizedResultJson.data)) {
            normalizedRowCount = normalizedResultJson.data.length;
        }

        const resultJsonString = JSON.stringify(normalizedResultJson);
        const bytes = new TextEncoder().encode(resultJsonString).length;

        // Salvar/atualizar em MetaJobsResults
        const existing = await base44.asServiceRole.entities.MetaJobsResults.filter({ job_id });
        let savedRecord;
        let isUpdate = false;

        if (existing.length > 0) {
            savedRecord = await base44.asServiceRole.entities.MetaJobsResults.update(existing[0].id, {
                result_json: normalizedResultJson,
                row_count: normalizedRowCount,
                payload_hash: payload_hash || null
            });
            isUpdate = true;
        } else {
            savedRecord = await base44.asServiceRole.entities.MetaJobsResults.create({
                job_id,
                unit_id,
                account_id,
                result_json: normalizedResultJson,
                row_count: normalizedRowCount,
                payload_hash: payload_hash || null
            });
        }

        if (!savedRecord || !savedRecord.id) {
            return Response.json({ ok: false, error: 'Falha ao salvar no banco' }, { status: 500 });
        }

        console.log(`✅ Result ${isUpdate ? 'updated' : 'saved'} for job: ${job_id}, run_id: ${run_id}, rows: ${normalizedRowCount}`);

        // Transformar para MetaAdDaily (passando run_id explicitamente)
        try {
            await base44.asServiceRole.functions.invoke('transformJobResultsToAdDaily', { job_id, run_id, unit_id, account_id });
            console.log(`✅ transformJobResultsToAdDaily invocado para job: ${job_id}`);
        } catch (transformError) {
            console.error(`❌ Falha ao transformar para MetaAdDaily:`, transformError.message);
        }

        return Response.json({
            ok: true,
            saved: true,
            job_id,
            run_id,
            row_count: normalizedRowCount,
            bytes,
            stored_at: new Date().toISOString(),
            operation: isUpdate ? 'update' : 'insert'
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        return Response.json({ ok: false, saved: false, error: error.message }, { status: 500 });
    }
});