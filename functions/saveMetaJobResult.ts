import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const { job_id, unit_id, account_id, result_json, row_count, payload_hash } = payload;

        if (!job_id || !unit_id || !account_id || !result_json) {
            return Response.json({ 
                ok: false, 
                error: { message: 'job_id, unit_id, account_id e result_json são obrigatórios', code: 'MISSING_PARAMS' } 
            }, { status: 400 });
        }

        // ============================================
        // 1) Normalizar result_json
        // ============================================
        let normalizedResultJson;
        
        if (typeof result_json === 'string') {
            // Caso B: String JSON -> parsear
            try {
                normalizedResultJson = JSON.parse(result_json);
            } catch (e) {
                return Response.json({ 
                    ok: false, 
                    error: { 
                        message: 'result_json inválido: string fornecida não é um JSON válido',
                        code: 'INVALID_JSON',
                        details: e.message
                    } 
                }, { status: 400 });
            }
        } else if (typeof result_json === 'object' && result_json !== null) {
            // Caso A: Já é objeto -> usar diretamente
            normalizedResultJson = result_json;
        } else {
            return Response.json({ 
                ok: false, 
                error: { 
                    message: 'result_json deve ser um objeto JSON ou string JSON válida',
                    code: 'INVALID_JSON_TYPE'
                } 
            }, { status: 400 });
        }

        // ============================================
        // 2) Normalizar row_count
        // ============================================
        let normalizedRowCount = 0;

        if (row_count !== undefined && row_count !== null) {
            if (typeof row_count === 'number') {
                normalizedRowCount = row_count;
            } else if (typeof row_count === 'string') {
                const parsed = Number(row_count);
                if (!isNaN(parsed)) {
                    normalizedRowCount = parsed;
                }
            }
        }

        // Se não conseguiu normalizar, calcular do result_json.data
        if (normalizedRowCount === 0 && normalizedResultJson.data && Array.isArray(normalizedResultJson.data)) {
            normalizedRowCount = normalizedResultJson.data.length;
        }

        // ============================================
        // 3) Salvar no banco
        // ============================================
        // O campo result_json na tabela é do tipo "object" (JSON nativo)
        // então salvamos o objeto normalizado diretamente
        
        const existing = await base44.asServiceRole.entities.MetaJobsResults.filter({ job_id });

        if (existing.length > 0) {
            // Atualizar resultado existente
            await base44.asServiceRole.entities.MetaJobsResults.update(existing[0].id, {
                result_json: normalizedResultJson,
                row_count: normalizedRowCount,
                payload_hash: payload_hash || null
            });

            console.log(`🔄 Result updated for job: ${job_id}, rows: ${normalizedRowCount}`);
        } else {
            // Criar novo resultado
            await base44.asServiceRole.entities.MetaJobsResults.create({
                job_id,
                unit_id,
                account_id,
                result_json: normalizedResultJson,
                row_count: normalizedRowCount,
                payload_hash: payload_hash || null
            });

            console.log(`✅ Result saved for job: ${job_id}, rows: ${normalizedRowCount}`);
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