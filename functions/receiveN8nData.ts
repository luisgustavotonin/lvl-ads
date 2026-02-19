import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ENDPOINT ÚNICO para receber dados do N8N
 * POST /functions/receiveN8nData
 * 
 * Recebe: run_id, unit_id, account_id, result_json.data[], row_count
 * Faz: Agrega por ad_id+date → salva em MetaAdDaily → atualiza Run para success
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        let rawPayload = await req.json();

        // N8N pode enviar array ou objeto
        if (Array.isArray(rawPayload)) {
            if (rawPayload.length === 0) {
                return Response.json({ ok: false, error: 'Payload array vazio' }, { status: 400 });
            }
            rawPayload = rawPayload[0];
        }

        const { run_id, unit_id, account_id, result_json, row_count } = rawPayload;

        if (!run_id || !unit_id || !account_id || !result_json) {
            return Response.json({
                ok: false,
                error: 'run_id, unit_id, account_id e result_json são obrigatórios'
            }, { status: 400 });
        }

        // Normalizar result_json
        let normalizedResultJson;
        if (typeof result_json === 'string') {
            try { normalizedResultJson = JSON.parse(result_json); }
            catch (e) { return Response.json({ ok: false, error: 'result_json inválido' }, { status: 400 }); }
        } else {
            normalizedResultJson = result_json;
        }

        const data = normalizedResultJson.data || [];
        if (!Array.isArray(data) || data.length === 0) {
            return Response.json({ ok: false, error: 'result_json.data deve ser um array não vazio' }, { status: 400 });
        }

        console.log(`🔵 receiveN8nData | run_id: ${run_id} | unit_id: ${unit_id} | rows: ${data.length}`);

        // ─── Helpers para extrair do array actions ────────────────────────────
        const getAction = (actions, type) => {
            if (!Array.isArray(actions)) return 0;
            const a = actions.find(a => a.action_type === type);
            return a ? parseFloat(a.value) || 0 : 0;
        };

        const getCost = (costPerAction, type) => {
            if (!Array.isArray(costPerAction)) return 0;
            const c = costPerAction.find(c => c.action_type === type);
            return c ? parseFloat(c.value) || 0 : 0;
        };

        // ─── PASSO 1: Agregar linhas por ad_id + date ─────────────────────────
        // Meta retorna breakdown por impression_device (android, iphone, etc.)
        // Precisamos somar métricas de cada device para obter o total por ad+dia
        const aggregated = {};

        for (const row of data) {
            const rawDate = row.date || row.date_start || row.day;
            const ad_id = row.ad_id;

            if (!rawDate || !ad_id) continue;

            const dateMatch = String(rawDate).match(/^(\d{4}-\d{2}-\d{2})/);
            if (!dateMatch) { console.warn(`⚠️ Data inválida: ${rawDate}`); continue; }
            const date = dateMatch[1];

            const key = `${ad_id}::${date}`;

            if (!aggregated[key]) {
                aggregated[key] = {
                    // Campos de identificação (do primeiro row)
                    ad_id,
                    ad_name: row.ad_name || ad_id,
                    ad_effective_status: row.ad_effective_status || 'UNKNOWN',
                    creative_id: row.creative_id || '',
                    creative_thumbnail_url: row.thumbnail_url || row.creative_thumbnail_url || '',
                    campaign_id: row.campaign_id || '',
                    campaign_name: row.campaign_name || '',
                    adset_id: row.adset_id || '',
                    adset_name: row.adset_name || '',
                    date,
                    // Métricas somáveis (iniciam em 0)
                    spend: 0,
                    impressions: 0,
                    reach: 0,
                    clicks: 0,
                    link_clicks: 0,
                    wa_conversations_started_7d: 0,
                    wa_total_messaging_connection: 0,
                    wa_messaging_first_reply: 0,
                };
            }

            const agg = aggregated[key];
            agg.spend       += parseFloat(row.spend) || 0;
            agg.impressions += parseInt(row.impressions) || 0;
            agg.reach       += parseInt(row.reach) || 0;
            agg.clicks      += parseInt(row.clicks) || 0;
            agg.link_clicks += parseInt(row.inline_link_clicks || row.link_clicks) || 0;

            // WA metrics: extrair dos arrays actions / cost_per_action_type
            agg.wa_conversations_started_7d  += getAction(row.actions, 'onsite_conversion.messaging_conversation_started_7d');
            agg.wa_total_messaging_connection += getAction(row.actions, 'onsite_conversion.total_messaging_connection');
            agg.wa_messaging_first_reply      += getAction(row.actions, 'onsite_conversion.messaging_first_reply');
        }

        console.log(`📊 Agregado: ${Object.keys(aggregated).length} registros únicos (ad+date)`);

        // ─── PASSO 2: Calcular métricas derivadas e salvar em MetaAdDaily ─────
        const now = new Date().toISOString();
        let upsertCount = 0;
        let skipCount = 0;

        for (const key of Object.keys(aggregated)) {
            const agg = aggregated[key];

            // Calcular métricas derivadas após agregação
            const frequency         = agg.reach > 0 ? agg.impressions / agg.reach : 0;
            const ctr_link          = agg.impressions > 0 ? agg.link_clicks / agg.impressions : 0;
            const cpc_link          = agg.link_clicks > 0 ? agg.spend / agg.link_clicks : 0;
            const cpm               = agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0;
            const cost_per_conversation  = agg.wa_conversations_started_7d > 0 ? agg.spend / agg.wa_conversations_started_7d : 0;
            const cost_per_total_contact = agg.wa_total_messaging_connection > 0 ? agg.spend / agg.wa_total_messaging_connection : 0;
            const cost_per_first_reply   = agg.wa_messaging_first_reply > 0 ? agg.spend / agg.wa_messaging_first_reply : 0;

            const record = {
                run_id,
                job_id: run_id,   // ✅ sem MetaJobsQueue, usa run_id como job_id
                unit_id,
                account_id,
                platform: 'META',
                date: agg.date,
                ad_id: agg.ad_id,
                ad_name: agg.ad_name,
                ad_effective_status: agg.ad_effective_status,
                creative_id: agg.creative_id,
                creative_thumbnail_url: agg.creative_thumbnail_url,
                campaign_id: agg.campaign_id,
                campaign_name: agg.campaign_name,
                adset_id: agg.adset_id,
                adset_name: agg.adset_name,
                spend: agg.spend,
                impressions: agg.impressions,
                reach: agg.reach,
                frequency,
                clicks: agg.clicks,
                link_clicks: agg.link_clicks,
                ctr_link,
                cpc_link,
                cpm,
                wa_conversations_started_7d: agg.wa_conversations_started_7d,
                wa_total_messaging_connection: agg.wa_total_messaging_connection,
                wa_messaging_first_reply: agg.wa_messaging_first_reply,
                cost_per_conversation,
                cost_per_total_contact,
                cost_per_first_reply,
                imported_at_utc: now
            };

            // UPSERT por run_id + ad_id + date + unit_id
            const existing = await base44.asServiceRole.entities.MetaAdDaily.filter({
                run_id, ad_id: agg.ad_id, date: agg.date, unit_id
            });

            if (existing.length > 0) {
                await base44.asServiceRole.entities.MetaAdDaily.update(existing[0].id, record);
            } else {
                await base44.asServiceRole.entities.MetaAdDaily.create(record);
            }

            upsertCount++;
        }

        console.log(`✅ MetaAdDaily: ${upsertCount} upserted, ${skipCount} skipped`);

        // ─── PASSO 3: Atualizar Run para success ──────────────────────────────
        const runs = await base44.asServiceRole.entities.Run.filter({ run_id, unit_id });
        if (runs.length > 0) {
            await base44.asServiceRole.entities.Run.update(runs[0].id, {
                status: 'success',
                total_records: upsertCount,
                finished_at_utc: now
            });
            console.log(`✅ Run atualizado: status=success, records=${upsertCount}`);
        } else {
            console.warn(`⚠️ Run não encontrado para run_id: ${run_id}`);
        }

        return Response.json({
            ok: true,
            run_id,
            unit_id,
            records_raw: data.length,
            records_processed: upsertCount,
            stored_at: now
        });

    } catch (error) {
        console.error('❌ Erro em receiveN8nData:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
});