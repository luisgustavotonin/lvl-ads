import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BULK_SIZE = 200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function saveBulk(entity, rows) {
    if (!rows?.length) return 0;
    const map = new Map();
    for (const r of rows) {
        if (r?.unique_key) map.set(r.unique_key, r);
    }
    const deduped = Array.from(map.values());
    let written = 0;
    for (let i = 0; i < deduped.length; i += BULK_SIZE) {
        const chunk = deduped.slice(i, i + BULK_SIZE);
        try {
            await entity.bulkCreate(chunk);
            written += chunk.length;
        } catch (e) {
            console.warn(`⚠️ bulkCreate falhou, tentando individual: ${e.message}`);
            for (const row of chunk) {
                try {
                    await entity.create(row);
                    written++;
                } catch (e2) {
                    const msg = String(e2?.message || '').toLowerCase();
                    if (!msg.includes('unique') && !msg.includes('duplicate') && !msg.includes('already')) {
                        console.error('create falhou:', e2.message);
                    }
                }
            }
        }
        if (i + BULK_SIZE < deduped.length) await sleep(30);
    }
    return written;
}

const normDate = (raw) => {
    const m = String(raw || '').match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
};

const getAction = (actions, type) => {
    if (!Array.isArray(actions)) return 0;
    const a = actions.find(a => a.action_type === type);
    return a ? parseFloat(a.value) || 0 : 0;
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const { job_id } = body;
        let { run_id, unit_id, account_id } = body;

        if (!job_id) return Response.json({ ok: false, error: 'job_id é obrigatório' }, { status: 400 });

        // Buscar metadados em paralelo
        const [results, queueJobs] = await Promise.all([
            base44.asServiceRole.entities.MetaJobsResults.filter({ job_id }),
            base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id })
        ]);

        if (!results.length) return Response.json({ ok: false, error: 'Resultado de job não encontrado' }, { status: 404 });

        const result = results[0];
        unit_id = unit_id || result.unit_id;
        account_id = account_id || result.account_id;
        const queueJob = queueJobs?.[0];
        run_id = run_id || queueJob?.run_id;

        if (!run_id) return Response.json({ ok: false, error: 'run_id não encontrado' }, { status: 400 });

        const jobType  = queueJob?.job_type  || 'insights';
        const breakdown = queueJob?.breakdown || '';

        const data = result.result_json?.data || [];
        if (!Array.isArray(data) || data.length === 0) {
            console.log(`ℹ️ Sem dados para processar. job=${job_id}`);
            return Response.json({ ok: true, job_id, records_upserted: 0, records_skipped: 0 });
        }

        console.log(`📦 job_type=${jobType} breakdown=${breakdown} rows=${data.length}`);

        const now = new Date().toISOString();
        let upserted = 0;
        let skipped = 0;

        const isInsights     = jobType === 'insights' || jobType === 'insights_basic';
        const isPlatform     = jobType === 'platform' || jobType === 'insights_platform' || breakdown === 'publisher_platform';
        const isDevice       = jobType === 'device'   || jobType === 'insights_device'   || breakdown === 'impression_device';
        const isDemographics = jobType === 'demographics' || jobType === 'insights_demographics' || breakdown === 'age,gender' || breakdown === 'age' || breakdown === 'gender';
        const isCreativesBasic = jobType === 'creatives_basic';

        // ── Fase 1: processar todos os dados em memória ──
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
                        campaign_id: row.campaign_id || '', campaign_name: row.campaign_name || '',
                        adset_id: row.adset_id || '', adset_name: row.adset_name || '',
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

            const records = Object.values(agg).map((a) => ({
                unique_key: `${run_id}::${job_id}::${a.ad_id}::${a.date}`,
                run_id, job_id, unit_id, account_id, platform: 'META',
                date: a.date, ad_id: a.ad_id, ad_name: a.ad_name,
                ad_effective_status: a.ad_effective_status,
                creative_id: a.creative_id, creative_thumbnail_url: a.creative_thumbnail_url,
                campaign_id: a.campaign_id, campaign_name: a.campaign_name,
                adset_id: a.adset_id, adset_name: a.adset_name,
                spend: a.spend, impressions: a.impressions, reach: a.reach,
                frequency: a.reach > 0 ? a.impressions / a.reach : 0,
                clicks: a.clicks, link_clicks: a.link_clicks,
                ctr_link: a.impressions > 0 ? a.link_clicks / a.impressions : 0,
                cpc_link: a.link_clicks > 0 ? a.spend / a.link_clicks : 0,
                cpm: a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0,
                wa_conversations_started_7d: a.wa_conversations_started_7d,
                wa_total_messaging_connection: a.wa_total_messaging_connection,
                wa_messaging_first_reply: a.wa_messaging_first_reply,
                cost_per_conversation: a.wa_conversations_started_7d > 0 ? a.spend / a.wa_conversations_started_7d : 0,
                cost_per_total_contact: a.wa_total_messaging_connection > 0 ? a.spend / a.wa_total_messaging_connection : 0,
                cost_per_first_reply: a.wa_messaging_first_reply > 0 ? a.spend / a.wa_messaging_first_reply : 0,
                imported_at_utc: now
            }));

            // ── Fase 2: salvar em bulk ──
            upserted = await saveBulk(base44.asServiceRole.entities.MetaAdInsights, records);
        }

        else if (isPlatform) {
            const records = [];
            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                const publisher_platform = (row.publisher_platform || '').toLowerCase();
                if (!date || !ad_id || !publisher_platform) { skipped++; continue; }
                const impressions = parseInt(row.impressions) || 0;
                const link_clicks = parseInt(row.inline_link_clicks || row.link_clicks) || 0;
                const spend = parseFloat(row.spend) || 0;
                records.push({
                    unique_key: `${run_id}::${job_id}::${ad_id}::${date}::${publisher_platform}`,
                    run_id, job_id, unit_id, account_id, date, ad_id,
                    ad_name: row.ad_name || ad_id,
                    adset_id: row.adset_id || '', adset_name: row.adset_name || '',
                    campaign_id: row.campaign_id || '', campaign_name: row.campaign_name || '',
                    publisher_platform, spend,
                    impressions, reach: parseInt(row.reach) || 0,
                    clicks: parseInt(row.clicks) || 0, link_clicks,
                    ctr_link: impressions > 0 ? link_clicks / impressions : 0,
                    cpc_link: link_clicks > 0 ? spend / link_clicks : 0,
                    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
                    imported_at_utc: now
                });
            }
            upserted = await saveBulk(base44.asServiceRole.entities.MetaAdByPlatform, records);
        }

        else if (isDevice) {
            const records = [];
            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                const impression_device = (row.impression_device || '').toLowerCase();
                if (!date || !ad_id || !impression_device) { skipped++; continue; }
                const impressions = parseInt(row.impressions) || 0;
                const link_clicks = parseInt(row.inline_link_clicks || row.link_clicks) || 0;
                const spend = parseFloat(row.spend) || 0;
                records.push({
                    unique_key: `${run_id}::${job_id}::${ad_id}::${date}::${impression_device}`,
                    run_id, job_id, unit_id, account_id, date, ad_id,
                    ad_name: row.ad_name || ad_id,
                    adset_id: row.adset_id || '', adset_name: row.adset_name || '',
                    campaign_id: row.campaign_id || '', campaign_name: row.campaign_name || '',
                    impression_device, spend,
                    impressions, reach: parseInt(row.reach) || 0,
                    clicks: parseInt(row.clicks) || 0, link_clicks,
                    ctr_link: impressions > 0 ? link_clicks / impressions : 0,
                    cpc_link: link_clicks > 0 ? spend / link_clicks : 0,
                    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
                    imported_at_utc: now
                });
            }
            upserted = await saveBulk(base44.asServiceRole.entities.MetaAdByDevice, records);
        }

        else if (isDemographics) {
            const records = [];
            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                if (!date || !ad_id) { skipped++; continue; }
                records.push({
                    unique_key: `${run_id}::${job_id}::${ad_id}::${date}::${row.age || 'unk'}::${row.gender || 'unk'}`,
                    run_id, job_id, unit_id, account_id, date, ad_id,
                    ad_name: row.ad_name || ad_id,
                    adset_id: row.adset_id || '', adset_name: row.adset_name || '',
                    campaign_id: row.campaign_id || '', campaign_name: row.campaign_name || '',
                    age: row.age || 'unknown',
                    gender: (row.gender || 'unknown').toLowerCase(),
                    spend: parseFloat(row.spend) || 0,
                    impressions: parseInt(row.impressions) || 0,
                    reach: parseInt(row.reach) || 0,
                    clicks: parseInt(row.clicks) || 0,
                    imported_at_utc: now
                });
            }
            upserted = await saveBulk(base44.asServiceRole.entities.MetaAdByDemographic, records);
        }

        else if (isCreativesBasic) {
            const records = [];
            for (const row of data) {
                const ad_id = row.id || row.ad_id;
                if (!ad_id) { skipped++; continue; }
                records.push({
                    unique_key: `${unit_id}::${ad_id}`,
                    unit_id, account_id, ad_id,
                    ad_name: row.name || row.ad_name || ad_id,
                    ad_status: row.effective_status || row.ad_status || '',
                    campaign_id: row.campaign?.id || row.campaign_id || '',
                    campaign_name: row.campaign?.name || row.campaign_name || '',
                    adset_id: row.adset?.id || row.adset_id || '',
                    adset_name: row.adset?.name || row.adset_name || '',
                    creative_id: row.creative?.id || row.creative_id || '',
                    last_updated: now
                });
            }
            upserted = await saveBulk(base44.asServiceRole.entities.MetaAdsDim, records);
        }

        else {
            console.warn(`⚠️ Tipo de job não reconhecido: job_type=${jobType} breakdown=${breakdown}`);
        }

        // Atualizar Run (sem bloquear o retorno)
        base44.asServiceRole.entities.Run.filter({ run_id, unit_id })
            .then(runs => {
                if (runs.length > 0) {
                    return base44.asServiceRole.entities.Run.update(runs[0].id, {
                        status: 'success',
                        total_records: (runs[0].total_records || 0) + upserted,
                        finished_at_utc: now
                    });
                }
            })
            .catch(e => console.warn('Run update falhou:', e.message));

        console.log(`✅ ${upserted} salvos (${skipped} ignorados) | job_type=${jobType} | run_id=${run_id}`);
        return Response.json({ ok: true, job_id, run_id, job_type: jobType, breakdown, records_upserted: upserted, records_skipped: skipped });

    } catch (error) {
        console.error('❌ Erro:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
});