import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ENDPOINT ÚNICO para receber dados do N8N
 * POST /functions/receiveN8nData
 * 
 * Recebe: run_id, unit_id, account_id, result_json, row_count
 * Faz: Salva em MetaJobsResults + transforma em MetaAdDaily + atualiza Run
 * Retorna: { ok: true, run_id, records_processed }
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        let rawPayload = await req.json();

        // N8N pode enviar array ou objeto
        if (Array.isArray(rawPayload)) {
            if (rawPayload.length === 0) {
                return Response.json({ 
                    ok: false, 
                    error: 'Payload array vazio' 
                }, { status: 400 });
            }
            rawPayload = rawPayload[0];
        }

        const { run_id, unit_id, account_id, result_json, row_count } = rawPayload;

        // Validar campos obrigatórios
        if (!run_id || !unit_id || !account_id || !result_json) {
            return Response.json({
                ok: false,
                error: 'run_id, unit_id, account_id e result_json são obrigatórios'
            }, { status: 400 });
        }

        console.log(`🔵 ========== receiveN8nData ==========`);
        console.log(`📥 run_id: ${run_id}`);
        console.log(`📥 unit_id: ${unit_id}`);
        console.log(`📥 account_id: ${account_id}`);
        console.log(`📥 row_count: ${row_count}`);

        // Normalizar result_json
        let normalizedResultJson;
        if (typeof result_json === 'string') {
            try {
                normalizedResultJson = JSON.parse(result_json);
            } catch (e) {
                return Response.json({ 
                    ok: false, 
                    error: 'result_json inválido' 
                }, { status: 400 });
            }
        } else if (typeof result_json === 'object' && result_json !== null) {
            normalizedResultJson = result_json;
        } else {
            return Response.json({ 
                ok: false, 
                error: 'result_json deve ser objeto ou string JSON' 
            }, { status: 400 });
        }

        const data = normalizedResultJson.data || [];
        if (!Array.isArray(data)) {
            return Response.json({ 
                ok: false, 
                error: 'result_json.data deve ser um array' 
            }, { status: 400 });
        }

        const normalizedRowCount = row_count || data.length || 0;

        console.log(`📊 Total de registros: ${data.length}`);

        // ✅ PASSO 1: Buscar ou criar MetaJobsResults
        const resultJsonString = JSON.stringify(normalizedResultJson);
        let savedResult;

        const existing = await base44.asServiceRole.entities.MetaJobsResults.filter({ run_id });
        if (existing.length > 0) {
            // Atualizar se já existe
            savedResult = await base44.asServiceRole.entities.MetaJobsResults.update(existing[0].id, {
                result_json: normalizedResultJson,
                row_count: normalizedRowCount
            });
            console.log(`✅ MetaJobsResults ATUALIZADO: ${existing[0].id}`);
        } else {
            // Criar novo
            savedResult = await base44.asServiceRole.entities.MetaJobsResults.create({
                run_id,
                unit_id,
                account_id,
                result_json: normalizedResultJson,
                row_count: normalizedRowCount
            });
            console.log(`✅ MetaJobsResults CRIADO: ${savedResult.id}`);
        }

        // ✅ PASSO 2: Transformar e salvar em MetaAdDaily
        let upsertCount = 0;
        let skipCount = 0;

        for (const row of data) {
            const rawDate = row.date || row.date_start || row.day;
            const ad_id = row.ad_id;

            if (!rawDate || !ad_id) {
                skipCount++;
                continue;
            }

            // Normalizar data para YYYY-MM-DD
            const dateMatch = String(rawDate).match(/^(\d{4}-\d{2}-\d{2})/);
            if (!dateMatch) {
                console.warn(`⚠️ Data inválida: ${rawDate}`);
                skipCount++;
                continue;
            }
            const date = dateMatch[1];

            const record = {
                run_id,                                              // ✅ ESSENCIAL
                unit_id,
                account_id,
                platform: 'META',
                date,
                ad_id,
                ad_name: row.ad_name || ad_id,
                ad_effective_status: row.ad_effective_status || 'UNKNOWN',
                creative_id: row.creative_id || '',
                creative_thumbnail_url: row.thumbnail_url || row.creative_thumbnail_url || '',
                campaign_id: row.campaign_id || '',
                campaign_name: row.campaign_name || '',
                adset_id: row.adset_id || '',
                adset_name: row.adset_name || '',
                spend: parseFloat(row.spend) || 0,
                impressions: parseInt(row.impressions) || 0,
                reach: parseInt(row.reach) || 0,
                frequency: parseFloat(row.frequency) || 0,
                clicks: parseInt(row.clicks) || 0,
                link_clicks: parseInt(row.link_clicks || row.inline_link_clicks) || 0,
                ctr_link: parseFloat(row.ctr_link || row.ctr) || 0,
                cpc_link: parseFloat(row.cpc_link || row.cpc) || 0,
                cpm: parseFloat(row.cpm) || 0,
                wa_conversations_started_7d: parseInt(row.wa_conversations_started_7d || row.conversations) || 0,
                wa_total_messaging_connection: parseInt(row.wa_total_messaging_connection || row.total_contact) || 0,
                wa_messaging_first_reply: parseInt(row.wa_messaging_first_reply || row.first_reply) || 0,
                cost_per_conversation: parseFloat(row.cost_per_conversation) || 0,
                cost_per_total_contact: parseFloat(row.cost_per_total_contact) || 0,
                cost_per_first_reply: parseFloat(row.cost_per_first_reply) || 0,
                imported_at_utc: new Date().toISOString()
            };

            // UPSERT por (run_id + ad_id + date)
            const existingRecords = await base44.asServiceRole.entities.MetaAdDaily.filter({
                run_id,
                ad_id,
                date,
                unit_id
            });

            if (existingRecords.length > 0) {
                await base44.asServiceRole.entities.MetaAdDaily.update(existingRecords[0].id, record);
            } else {
                await base44.asServiceRole.entities.MetaAdDaily.create(record);
            }

            upsertCount++;
        }

        console.log(`✅ MetaAdDaily: ${upsertCount} upserted, ${skipCount} skipped`);

        // ✅ PASSO 3: Atualizar Run com status success
        const runs = await base44.asServiceRole.entities.Run.filter({ run_id, unit_id });
        if (runs.length > 0) {
            await base44.asServiceRole.entities.Run.update(runs[0].id, {
                status: 'success',
                total_records: upsertCount,
                finished_at_utc: new Date().toISOString()
            });
            console.log(`✅ Run atualizado: status=success, records=${upsertCount}`);
        } else {
            console.warn(`⚠️ Run não encontrado: ${run_id}`);
        }

        console.log(`🔵 =====================================`);

        return Response.json({
            ok: true,
            run_id,
            unit_id,
            records_processed: upsertCount,
            records_skipped: skipCount,
            stored_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro em receiveN8nData:', error);
        return Response.json({ 
            ok: false, 
            error: error.message 
        }, { status: 500 });
    }
});