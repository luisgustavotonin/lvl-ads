import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Transforma resultado de UM job e salva na tabela correta:
 *   - insights        → MetaAdInsights       (1 linha por ad+dia)
 *   - platform        → MetaAdByPlatform     (1 linha por ad+dia+publisher_platform)
 *   - device          → MetaAdByDevice       (1 linha por ad+dia+impression_device)
 *   - demographics    → MetaAdByDemographic  (1 linha por ad+dia+age+gender)
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const { job_id } = body;
        let { run_id, unit_id, account_id } = body;

        if (!job_id) {
            return Response.json({ ok: false, error: 'job_id é obrigatório' }, { status: 400 });
        }

        // ─── Buscar resultado do job ──────────────────────────────────────────
        const results = await base44.asServiceRole.entities.MetaJobsResults.filter({ job_id });
        if (results.length === 0) {
            return Response.json({ ok: false, error: 'Resultado de job não encontrado' }, { status: 404 });
        }
        const result = results[0];
        unit_id = unit_id || result.unit_id;
        account_id = account_id || result.account_id;

        // ─── Buscar metadados do job na fila ─────────────────────────────────
        const queueJobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });
        const queueJob = queueJobs?.[0];
        run_id = run_id || queueJob?.run_id;

        if (!run_id) {
            return Response.json({ ok: false, error: 'run_id não encontrado para este job' }, { status: 400 });
        }

        const jobType  = queueJob?.job_type  || 'insights';
        const breakdown = queueJob?.breakdown || '';

        const data = result.result_json?.data || [];
        if (!Array.isArray(data) || data.length === 0) {
            return Response.json({ ok: false, error: 'Nenhum dado para processar' }, { status: 400 });
        }

        console.log(`📦 job_type=${jobType} breakdown=${breakdown} rows=${data.length}`);

        // ─── Helpers ──────────────────────────────────────────────────────────
        const normDate = (raw) => {
            const m = String(raw || '').match(/^(\d{4}-\d{2}-\d{2})/);
            return m ? m[1] : null;
        };

        const getAction = (actions, type) => {
            if (!Array.isArray(actions)) return 0;
            const a = actions.find(a => a.action_type === type);
            return a ? parseFloat(a.value) || 0 : 0;
        };

        const now = new Date().toISOString();
        let upserted = 0;
        let skipped = 0;

        // ─── Detectar tipo de job ─────────────────────────────────────────────
        const isInsights     = jobType === 'insights' && !breakdown;
        const isPlatform     = jobType === 'platform' || breakdown === 'publisher_platform';
        const isDevice       = jobType === 'device'   || breakdown === 'impression_device';
        const isDemographics = jobType === 'demographics' || breakdown === 'age,gender' || breakdown === 'age' || breakdown === 'gender';

        // ═════════════════════════════════════════════════════════════════════
        // INSIGHTS — 1 linha por ad+dia (agregar pois pode vir com breakdown)
        // ═════════════════════════════════════════════════════════════════════
        if (isInsights) {
            const agg = {};

            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                if (!date || !ad_id) { skipped++; continue; }

                const key = `${ad_id}::${date}`;
                if (!agg[key]) {
                    agg[key] = {
                        ad_id, date,
                        ad_name: row.ad_name || ad_id,
                        ad_effective_status: row.ad_effective_status || 'UNKNOWN',
                        creative_id: row.creative_id || '',
                        creative_thumbnail_url: row.thumbnail_url || row.creative_thumbnail_url || '',
                        campaign_id: row.campaign_id || '',
                        campaign_name: row.campaign_name || '',
                        adset_id: row.adset_id || '',
                        adset_name: row.adset_name || '',
                        spend: 0, impressions: 0, reach: 0, clicks: 0, link_clicks: 0,
                        wa_conversations_started_7d: 0, wa_total_messaging_connection: 0, wa_messaging_first_reply: 0,
                    };
                }

                const a = agg[key];
                a.spend       += parseFloat(row.spend) || 0;
                a.impressions += parseInt(row.impressions) || 0;
                a.reach       += parseInt(row.reach) || 0;
                a.clicks      += parseInt(row.clicks) || 0;
                a.link_clicks += parseInt(row.inline_link_clicks || row.link_clicks) || 0;
                a.wa_conversations_started_7d   += getAction(row.actions, 'onsite_conversion.messaging_conversation_started_7d') || parseInt(row.wa_conversations_started_7d) || 0;
                a.wa_total_messaging_connection += getAction(row.actions, 'onsite_conversion.total_messaging_connection') || parseInt(row.wa_total_messaging_connection) || 0;
                a.wa_messaging_first_reply      += getAction(row.actions, 'onsite_conversion.messaging_first_reply') || parseInt(row.wa_messaging_first_reply) || 0;
            }

            for (const key of Object.keys(agg)) {
                const a = agg[key];
                const frequency         = a.reach > 0 ? a.impressions / a.reach : 0;
                const ctr_link          = a.impressions > 0 ? a.link_clicks / a.impressions : 0;
                const cpc_link          = a.link_clicks > 0 ? a.spend / a.link_clicks : 0;
                const cpm               = a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0;
                const cost_per_conversation  = a.wa_conversations_started_7d > 0 ? a.spend / a.wa_conversations_started_7d : 0;
                const cost_per_total_contact = a.wa_total_messaging_connection > 0 ? a.spend / a.wa_total_messaging_connection : 0;
                const cost_per_first_reply   = a.wa_messaging_first_reply > 0 ? a.spend / a.wa_messaging_first_reply : 0;

                const record = {
                    run_id, job_id, unit_id, account_id, platform: 'META',
                    date: a.date, ad_id: a.ad_id, ad_name: a.ad_name,
                    ad_effective_status: a.ad_effective_status,
                    creative_id: a.creative_id, creative_thumbnail_url: a.creative_thumbnail_url,
                    campaign_id: a.campaign_id, campaign_name: a.campaign_name,
                    adset_id: a.adset_id, adset_name: a.adset_name,
                    spend: a.spend, impressions: a.impressions, reach: a.reach, frequency,
                    clicks: a.clicks, link_clicks: a.link_clicks, ctr_link, cpc_link, cpm,
                    wa_conversations_started_7d: a.wa_conversations_started_7d,
                    wa_total_messaging_connection: a.wa_total_messaging_connection,
                    wa_messaging_first_reply: a.wa_messaging_first_reply,
                    cost_per_conversation, cost_per_total_contact, cost_per_first_reply,
                    imported_at_utc: now
                };

                const existing = await base44.asServiceRole.entities.MetaAdInsights.filter({
                    run_id, job_id, ad_id: a.ad_id, date: a.date, unit_id
                });
                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaAdInsights.update(existing[0].id, record);
                } else {
                    await base44.asServiceRole.entities.MetaAdInsights.create(record);
                }
                upserted++;
            }
        }

        // ═════════════════════════════════════════════════════════════════════
        // PLATFORM — 1 linha por ad+dia+publisher_platform
        // ═════════════════════════════════════════════════════════════════════
        else if (isPlatform) {
            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                const publisher_platform = (row.publisher_platform || '').toLowerCase();
                if (!date || !ad_id || !publisher_platform) { skipped++; continue; }

                const impressions = parseInt(row.impressions) || 0;
                const reach       = parseInt(row.reach) || 0;
                const clicks      = parseInt(row.clicks) || 0;
                const link_clicks = parseInt(row.inline_link_clicks || row.link_clicks) || 0;
                const spend       = parseFloat(row.spend) || 0;
                const ctr_link    = impressions > 0 ? link_clicks / impressions : 0;
                const cpc_link    = link_clicks > 0 ? spend / link_clicks : 0;
                const cpm         = impressions > 0 ? (spend / impressions) * 1000 : 0;

                const record = {
                    run_id, job_id, unit_id, account_id,
                    date, ad_id,
                    ad_name: row.ad_name || ad_id,
                    adset_id: row.adset_id || '', adset_name: row.adset_name || '',
                    campaign_id: row.campaign_id || '', campaign_name: row.campaign_name || '',
                    publisher_platform, spend, impressions, reach, clicks, link_clicks,
                    ctr_link, cpc_link, cpm,
                    imported_at_utc: now
                };

                const existing = await base44.asServiceRole.entities.MetaAdByPlatform.filter({
                    run_id, job_id, ad_id, date, unit_id, publisher_platform
                });
                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaAdByPlatform.update(existing[0].id, record);
                } else {
                    await base44.asServiceRole.entities.MetaAdByPlatform.create(record);
                }
                upserted++;
            }
        }

        // ═════════════════════════════════════════════════════════════════════
        // DEVICE — 1 linha por ad+dia+impression_device
        // ═════════════════════════════════════════════════════════════════════
        else if (isDevice) {
            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                const impression_device = (row.impression_device || '').toLowerCase();
                if (!date || !ad_id || !impression_device) { skipped++; continue; }

                const impressions = parseInt(row.impressions) || 0;
                const reach       = parseInt(row.reach) || 0;
                const clicks      = parseInt(row.clicks) || 0;
                const link_clicks = parseInt(row.inline_link_clicks || row.link_clicks) || 0;
                const spend       = parseFloat(row.spend) || 0;
                const ctr_link    = impressions > 0 ? link_clicks / impressions : 0;
                const cpc_link    = link_clicks > 0 ? spend / link_clicks : 0;
                const cpm         = impressions > 0 ? (spend / impressions) * 1000 : 0;

                const record = {
                    run_id, job_id, unit_id, account_id,
                    date, ad_id,
                    ad_name: row.ad_name || ad_id,
                    adset_id: row.adset_id || '', adset_name: row.adset_name || '',
                    campaign_id: row.campaign_id || '', campaign_name: row.campaign_name || '',
                    impression_device, spend, impressions, reach, clicks, link_clicks,
                    ctr_link, cpc_link, cpm,
                    imported_at_utc: now
                };

                const existing = await base44.asServiceRole.entities.MetaAdByDevice.filter({
                    run_id, job_id, ad_id, date, unit_id, impression_device
                });
                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaAdByDevice.update(existing[0].id, record);
                } else {
                    await base44.asServiceRole.entities.MetaAdByDevice.create(record);
                }
                upserted++;
            }
        }

        // ═════════════════════════════════════════════════════════════════════
        // DEMOGRAPHICS — 1 linha por ad+dia+age+gender
        // ═════════════════════════════════════════════════════════════════════
        else if (isDemographics) {
            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                const age    = row.age    || 'unknown';
                const gender = (row.gender || 'unknown').toLowerCase();
                if (!date || !ad_id) { skipped++; continue; }

                const impressions = parseInt(row.impressions) || 0;
                const reach       = parseInt(row.reach) || 0;
                const clicks      = parseInt(row.clicks) || 0;
                const spend       = parseFloat(row.spend) || 0;

                const record = {
                    run_id, job_id, unit_id, account_id,
                    date, ad_id,
                    ad_name: row.ad_name || ad_id,
                    adset_id: row.adset_id || '', adset_name: row.adset_name || '',
                    campaign_id: row.campaign_id || '', campaign_name: row.campaign_name || '',
                    age, gender, spend, impressions, reach, clicks,
                    imported_at_utc: now
                };

                const existing = await base44.asServiceRole.entities.MetaAdByDemographic.filter({
                    run_id, job_id, ad_id, date, unit_id, age, gender
                });
                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaAdByDemographic.update(existing[0].id, record);
                } else {
                    await base44.asServiceRole.entities.MetaAdByDemographic.create(record);
                }
                upserted++;
            }
        }

        else {
            console.warn(`⚠️ Tipo de job não reconhecido: job_type=${jobType} breakdown=${breakdown}`);
        }

        // ─── Atualizar Run ────────────────────────────────────────────────────
        const runs = await base44.asServiceRole.entities.Run.filter({ run_id, unit_id });
        if (runs.length > 0) {
            await base44.asServiceRole.entities.Run.update(runs[0].id, {
                status: 'success',
                total_records: (runs[0].total_records || 0) + upserted,
                finished_at_utc: now
            });
        }

        console.log(`✅ ${upserted} registros salvos (${skipped} ignorados) | job_type=${jobType} | run_id=${run_id}`);

        return Response.json({ ok: true, job_id, run_id, job_type: jobType, breakdown, records_upserted: upserted, records_skipped: skipped });

    } catch (error) {
        console.error('❌ Erro:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
});