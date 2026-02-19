import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const { job_id } = body;
        let { run_id, unit_id, account_id } = body;

        if (!job_id) {
            return Response.json({ ok: false, error: 'job_id é obrigatório' }, { status: 400 });
        }

        // Buscar resultado do job
        const results = await base44.asServiceRole.entities.MetaJobsResults.filter({ job_id });
        if (results.length === 0) {
            return Response.json({ ok: false, error: 'Resultado de job não encontrado' }, { status: 404 });
        }

        const result = results[0];
        unit_id = unit_id || result.unit_id;
        account_id = account_id || result.account_id;

        // Se run_id não veio, buscar no MetaJobsQueue
        if (!run_id) {
            const queueJobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });
            run_id = queueJobs?.[0]?.run_id ?? null;
        }

        if (!run_id) {
            return Response.json({ ok: false, error: 'run_id não encontrado para este job' }, { status: 400 });
        }

        const data = result.result_json?.data || [];
        if (!Array.isArray(data) || data.length === 0) {
            return Response.json({ ok: false, error: 'Nenhum dado para processar' }, { status: 400 });
        }

        // ─── Helpers para extrair de arrays actions ───────────────────────────
        const getAction = (actions, type) => {
            if (!Array.isArray(actions)) return 0;
            const a = actions.find(a => a.action_type === type);
            return a ? parseFloat(a.value) || 0 : 0;
        };

        // ─── PASSO 1: Agregar por ad_id + date ────────────────────────────────
        // O Meta retorna linhas quebradas por breakdown (device, placement, etc.)
        // Se não agregarmos, os valores ficam multiplicados pelo número de breakdowns
        const aggregated = {};

        let skipped = 0;

        for (const row of data) {
            const rawDate = row.date || row.date_start || row.day;
            const ad_id = row.ad_id;

            if (!rawDate || !ad_id) { skipped++; continue; }

            const dateMatch = String(rawDate).match(/^(\d{4}-\d{2}-\d{2})/);
            if (!dateMatch) { console.warn(`⚠️ Data inválida: ${rawDate}`); skipped++; continue; }
            const date = dateMatch[1];

            const key = `${ad_id}::${date}`;

            if (!aggregated[key]) {
                aggregated[key] = {
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

            agg.wa_conversations_started_7d   += getAction(row.actions, 'onsite_conversion.messaging_conversation_started_7d')
                                                || parseInt(row.wa_conversations_started_7d || row.conversations) || 0;
            agg.wa_total_messaging_connection += getAction(row.actions, 'onsite_conversion.total_messaging_connection')
                                                || parseInt(row.wa_total_messaging_connection || row.total_contact) || 0;
            agg.wa_messaging_first_reply      += getAction(row.actions, 'onsite_conversion.messaging_first_reply')
                                                || parseInt(row.wa_messaging_first_reply || row.first_reply) || 0;
        }

        console.log(`📊 Agregado: ${Object.keys(aggregated).length} registros únicos (ad+date), ${data.length} linhas brutas`);

        // ─── PASSO 2: Calcular métricas derivadas e salvar ────────────────────
        let upserted = 0;
        const now = new Date().toISOString();

        for (const key of Object.keys(aggregated)) {
            const agg = aggregated[key];

            const frequency         = agg.reach > 0 ? agg.impressions / agg.reach : 0;
            const ctr_link          = agg.impressions > 0 ? agg.link_clicks / agg.impressions : 0;
            const cpc_link          = agg.link_clicks > 0 ? agg.spend / agg.link_clicks : 0;
            const cpm               = agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0;
            const cost_per_conversation  = agg.wa_conversations_started_7d > 0 ? agg.spend / agg.wa_conversations_started_7d : 0;
            const cost_per_total_contact = agg.wa_total_messaging_connection > 0 ? agg.spend / agg.wa_total_messaging_connection : 0;
            const cost_per_first_reply   = agg.wa_messaging_first_reply > 0 ? agg.spend / agg.wa_messaging_first_reply : 0;

            const record = {
                run_id,
                job_id,
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

            // UPSERT por (run_id + ad_id + date + unit_id)
            const existing = await base44.asServiceRole.entities.MetaAdDaily.filter({
                run_id, ad_id: agg.ad_id, date: agg.date, unit_id
            });

            if (existing.length > 0) {
                await base44.asServiceRole.entities.MetaAdDaily.update(existing[0].id, record);
            } else {
                await base44.asServiceRole.entities.MetaAdDaily.create(record);
            }

            upserted++;
        }

        // ✅ Atualizar Run com status e total de registros
        const runs = await base44.asServiceRole.entities.Run.filter({ run_id, unit_id });
        if (runs.length > 0) {
            await base44.asServiceRole.entities.Run.update(runs[0].id, {
                status: 'success',
                total_records: upserted,
                finished_at_utc: new Date().toISOString()
            });
        }

        console.log(`✅ ${upserted} registros upserted em MetaAdDaily (${skipped} ignorados) | run_id: ${run_id}`);

        return Response.json({
            ok: true,
            job_id,
            run_id,
            records_processed: data.length,
            records_upserted: upserted,
            records_skipped: skipped
        });

    } catch (error) {
        console.error('❌ Erro ao transformar dados:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
});