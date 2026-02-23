import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        let rawPayload = await req.json();

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

        // Normalizar result_json
        let normalizedResultJson;
        if (typeof result_json === 'string') {
            try { normalizedResultJson = JSON.parse(result_json); }
            catch (e) { return Response.json({ ok: false, error: { message: 'result_json inválido', code: 'INVALID_JSON' } }, { status: 400 }); }
        } else if (typeof result_json === 'object' && result_json !== null) {
            normalizedResultJson = result_json;
        } else {
            return Response.json({ ok: false, error: { message: 'result_json deve ser objeto ou string JSON', code: 'INVALID_JSON_TYPE' } }, { status: 400 });
        }

        // Normalizar row_count
        let normalizedRowCount = typeof row_count === 'number' ? row_count : (Number(row_count) || 0);
        if (normalizedRowCount === 0 && Array.isArray(normalizedResultJson.data)) {
            normalizedRowCount = normalizedResultJson.data.length;
        }

        // Buscar run_id e salvar resultado em paralelo
        const [queueJobs, existingResults] = await Promise.all([
            run_id ? Promise.resolve([]) : base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id }),
            base44.asServiceRole.entities.MetaJobsResults.filter({ job_id })
        ]);

        if (!run_id) {
            run_id = queueJobs?.[0]?.run_id ?? null;
        }

        if (!run_id) {
            return Response.json({
                ok: false,
                error: { message: 'run_id não encontrado', code: 'MISSING_RUN_ID' }
            }, { status: 400 });
        }

        // Salvar resultado
        let savedRecord;
        if (existingResults.length > 0) {
            savedRecord = await base44.asServiceRole.entities.MetaJobsResults.update(existingResults[0].id, {
                result_json: normalizedResultJson,
                row_count: normalizedRowCount,
                payload_hash: payload_hash || null
            });
        } else {
            savedRecord = await base44.asServiceRole.entities.MetaJobsResults.create({
                job_id, unit_id, account_id,
                result_json: normalizedResultJson,
                row_count: normalizedRowCount,
                payload_hash: payload_hash || null
            });
        }

        if (!savedRecord?.id) {
            return Response.json({ ok: false, error: 'Falha ao salvar no banco' }, { status: 500 });
        }

        const bytes = new TextEncoder().encode(JSON.stringify(normalizedResultJson)).length;
        console.log(`✅ Result saved for job: ${job_id}, run_id: ${run_id}, rows: ${normalizedRowCount}`);

        // ✅ FIRE AND FORGET — não bloqueia, não dá timeout
        base44.functions.invoke('transformJobResultsToAdDaily', { job_id, run_id, unit_id, account_id })
            .catch(e => console.warn(`⚠️ Transform assíncrono falhou: ${e.message}`));

        return Response.json({
            ok: true,
            saved: true,
            job_id,
            run_id,
            row_count: normalizedRowCount,
            bytes,
            stored_at: new Date().toISOString(),
            operation: existingResults.length > 0 ? 'update' : 'insert'
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        return Response.json({ ok: false, saved: false, error: error.message }, { status: 500 });
    }
});