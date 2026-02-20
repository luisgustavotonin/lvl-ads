import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Gerar hash do payload para idempotência
const generatePayloadHash = async (data) => {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(data)));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        let rawPayload = await req.json();

        if (typeof rawPayload === 'string') {
            try { rawPayload = JSON.parse(rawPayload); } catch(e) {}
        }
        if (Array.isArray(rawPayload)) {
            if (rawPayload.length === 0) return Response.json({ ok: false, error: 'Payload array vazio' }, { status: 400 });
            rawPayload = rawPayload[0];
        }
        if (typeof rawPayload === 'string') {
            try { rawPayload = JSON.parse(rawPayload); } catch(e) {}
        }
        if (rawPayload.body && typeof rawPayload.body === 'object') rawPayload = rawPayload.body;
        else if (rawPayload.json && typeof rawPayload.json === 'object') rawPayload = rawPayload.json;

        const { run_id, unit_id, account_id, result_json, row_count } = rawPayload;
        const job_id = rawPayload.job_id || null;

        if (!run_id || !unit_id || !account_id || !result_json) {
            return Response.json({
                ok: false,
                error: 'run_id, unit_id, account_id e result_json são obrigatórios',
                debug_keys: Object.keys(rawPayload),
                debug_sample: JSON.stringify(rawPayload).substring(0, 300)
            }, { status: 400 });
        }

        let normalizedResultJson;
        if (typeof result_json === 'string') {
            try { normalizedResultJson = JSON.parse(result_json); }
            catch (e) { return Response.json({ ok: false, error: 'result_json inválido' }, { status: 400 }); }
        } else {
            normalizedResultJson = result_json;
        }

        const data = normalizedResultJson.data || [];
        if (!Array.isArray(data) || data.length === 0) {
            // Dados vazios — só atualiza o Run para success e retorna ok
            const runs = await base44.asServiceRole.entities.Run.filter({ run_id, unit_id });
            if (runs.length > 0) {
                await base44.asServiceRole.entities.Run.update(runs[0].id, {
                    status: 'success',
                    total_records: 0,
                    finished_at_utc: new Date().toISOString()
                });
            }
            return Response.json({ ok: true, run_id, records_processed: 0, message: 'Sem dados para processar' });
        }

        // ─── Detectar tipo de job ─────────────────────────────────────────────
        // 1) Tenta pelo job_type vindo no payload
        // 2) Se não, busca na MetaJobsQueue pelo job_id
        // 3) Se não, tenta inferir pelo job_id string
        let jobType = rawPayload.job_type || '';
        let breakdown = rawPayload.breakdown || '';
        const jobIdStr = String(job_id || '').toLowerCase();

        if (!jobType && job_id) {
            const queueJobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });
            if (queueJobs.length > 0) {
                jobType = queueJobs[0].job_type || '';
                breakdown = queueJobs[0].breakdown || breakdown;
            }
        }

        // Fallback: inferir pelo nome do job_id
        if (!jobType && jobIdStr) {
            if (jobIdStr.includes('insights_platform')) jobType = 'insights_platform';
            else if (jobIdStr.includes('insights_device')) jobType = 'insights_device';
            else if (jobIdStr.includes('insights_demographics')) jobType = 'insights_demographics';
            else if (jobIdStr.includes('creatives_basic')) jobType = 'creatives_basic';
            else if (jobIdStr.includes('insights_basic') || jobIdStr.includes('insights')) jobType = 'insights_basic';
        }

        const isPlatform     = jobType === 'insights_platform' || breakdown === 'publisher_platform' || jobIdStr.includes('insights_platform');
        const isDevice       = jobType === 'insights_device'   || breakdown === 'impression_device'  || jobIdStr.includes('insights_device');
        const isDemographics = jobType === 'insights_demographics' || breakdown === 'age,gender'     || jobIdStr.includes('insights_demographics');
        const isCreativesBasic = jobType === 'creatives_basic' || jobIdStr.includes('creatives_basic');
        const isInsights     = !isPlatform && !isDevice && !isDemographics && !isCreativesBasic;

        console.log(`🔵 receiveN8nData | run_id=${run_id} | job_id=${job_id} | jobType=${jobType} | rows=${data.length} | route: isPlatform=${isPlatform} isDevice=${isDevice} isDemographics=${isDemographics} isCreativesBasic=${isCreativesBasic} isInsights=${isInsights}`);

        const now = new Date().toISOString();
        let upsertCount = 0;
        
        // Gerar hash do payload completo para idempotência
        const payloadHash = await generatePayloadHash(normalizedResultJson);

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

        // ═════════════════════════════════════════════════════════════════════
        // INSIGHTS BASIC → MetaAdInsights
        // ═════════════════════════════════════════════════════════════════════
        if (isInsights) {
            const agg = {};
            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                if (!date || !ad_id) continue;
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
                a.wa_conversations_started_7d   += getAction(row.actions, 'onsite_conversion.messaging_conversation_started_7d');
                a.wa_total_messaging_connection += getAction(row.actions, 'onsite_conversion.total_messaging_connection');
                a.wa_messaging_first_reply      += getAction(row.actions, 'onsite_conversion.messaging_first_reply');
            }

            for (const key of Object.keys(agg)) {
                const a = agg[key];
                const frequency    = a.reach > 0 ? a.impressions / a.reach : 0;
                const ctr_link     = a.impressions > 0 ? a.link_clicks / a.impressions : 0;
                const cpc_link     = a.link_clicks > 0 ? a.spend / a.link_clicks : 0;
                const cpm          = a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0;
                const cost_per_conversation  = a.wa_conversations_started_7d > 0 ? a.spend / a.wa_conversations_started_7d : 0;
                const cost_per_total_contact = a.wa_total_messaging_connection > 0 ? a.spend / a.wa_total_messaging_connection : 0;
                const cost_per_first_reply   = a.wa_messaging_first_reply > 0 ? a.spend / a.wa_messaging_first_reply : 0;

                const record = {
                    run_id, job_id: job_id || run_id, unit_id, account_id,
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
                    unit_id, account_id, ad_id: a.ad_id, date: a.date
                });
                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaAdInsights.update(existing[0].id, record);
                } else {
                    await base44.asServiceRole.entities.MetaAdInsights.create(record);
                }
                upsertCount++;
            }
        }

        // ═════════════════════════════════════════════════════════════════════
        // PLATFORM → MetaAdByPlatform
        // ═════════════════════════════════════════════════════════════════════
        else if (isPlatform) {
            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                const publisher_platform = (row.publisher_platform || '').toLowerCase();
                if (!date || !ad_id || !publisher_platform) continue;

                const impressions = parseInt(row.impressions) || 0;
                const reach       = parseInt(row.reach) || 0;
                const clicks      = parseInt(row.clicks) || 0;
                const link_clicks = parseInt(row.inline_link_clicks || row.link_clicks) || 0;
                const spend       = parseFloat(row.spend) || 0;

                const record = {
                    run_id, job_id: job_id || run_id, unit_id, account_id,
                    date, ad_id, ad_name: row.ad_name || ad_id,
                    adset_id: row.adset_id || '', adset_name: row.adset_name || '',
                    campaign_id: row.campaign_id || '', campaign_name: row.campaign_name || '',
                    publisher_platform, spend, impressions, reach, clicks, link_clicks,
                    ctr_link: impressions > 0 ? link_clicks / impressions : 0,
                    cpc_link: link_clicks > 0 ? spend / link_clicks : 0,
                    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
                    imported_at_utc: now
                };

                const existing = await base44.asServiceRole.entities.MetaAdByPlatform.filter({ 
                    unit_id, account_id, ad_id, date, publisher_platform
                });
                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaAdByPlatform.update(existing[0].id, record);
                } else {
                    await base44.asServiceRole.entities.MetaAdByPlatform.create(record);
                }
                upsertCount++;
            }
        }

        // ═════════════════════════════════════════════════════════════════════
        // DEVICE → MetaAdByDevice
        // ═════════════════════════════════════════════════════════════════════
        else if (isDevice) {
            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                const impression_device = (row.impression_device || '').toLowerCase();
                if (!date || !ad_id || !impression_device) continue;

                const impressions = parseInt(row.impressions) || 0;
                const reach       = parseInt(row.reach) || 0;
                const clicks      = parseInt(row.clicks) || 0;
                const link_clicks = parseInt(row.inline_link_clicks || row.link_clicks) || 0;
                const spend       = parseFloat(row.spend) || 0;

                const record = {
                    run_id, job_id: job_id || run_id, unit_id, account_id,
                    date, ad_id, ad_name: row.ad_name || ad_id,
                    adset_id: row.adset_id || '', adset_name: row.adset_name || '',
                    campaign_id: row.campaign_id || '', campaign_name: row.campaign_name || '',
                    impression_device, spend, impressions, reach, clicks, link_clicks,
                    ctr_link: impressions > 0 ? link_clicks / impressions : 0,
                    cpc_link: link_clicks > 0 ? spend / link_clicks : 0,
                    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
                    imported_at_utc: now
                };

                const existing = await base44.asServiceRole.entities.MetaAdByDevice.filter({ 
                    unit_id, account_id, ad_id, date, impression_device
                });
                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaAdByDevice.update(existing[0].id, record);
                } else {
                    await base44.asServiceRole.entities.MetaAdByDevice.create(record);
                }
                upsertCount++;
            }
        }

        // ═════════════════════════════════════════════════════════════════════
        // DEMOGRAPHICS → MetaAdByDemographic
        // ═════════════════════════════════════════════════════════════════════
        else if (isDemographics) {
            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                const age    = row.age    || 'unknown';
                const gender = (row.gender || 'unknown').toLowerCase();
                if (!date || !ad_id) continue;

                const record = {
                    run_id, job_id: job_id || run_id, unit_id, account_id,
                    date, ad_id, ad_name: row.ad_name || ad_id,
                    adset_id: row.adset_id || '', adset_name: row.adset_name || '',
                    campaign_id: row.campaign_id || '', campaign_name: row.campaign_name || '',
                    age, gender,
                    spend: parseFloat(row.spend) || 0,
                    impressions: parseInt(row.impressions) || 0,
                    reach: parseInt(row.reach) || 0,
                    clicks: parseInt(row.clicks) || 0,
                    imported_at_utc: now
                };

                const existing = await base44.asServiceRole.entities.MetaAdByDemographic.filter({ 
                    unit_id, account_id, ad_id, date, age, gender,
                    job_id: job_id || run_id
                });
                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaAdByDemographic.update(existing[0].id, record);
                } else {
                    await base44.asServiceRole.entities.MetaAdByDemographic.create(record);
                }
                upsertCount++;
            }
        }

        // ═════════════════════════════════════════════════════════════════════
        // CREATIVES BASIC → MetaAdsDim
        // ═════════════════════════════════════════════════════════════════════
        else if (isCreativesBasic) {
            for (const row of data) {
                const ad_id = row.id || row.ad_id;
                if (!ad_id) continue;

                const record = {
                    unit_id, account_id, ad_id,
                    ad_name: row.name || row.ad_name || ad_id,
                    ad_status: row.effective_status || row.ad_status || '',
                    campaign_id: row.campaign?.id || row.campaign_id || '',
                    campaign_name: row.campaign?.name || row.campaign_name || '',
                    adset_id: row.adset?.id || row.adset_id || '',
                    adset_name: row.adset?.name || row.adset_name || '',
                    creative_id: row.creative?.id || row.creative_id || '',
                    last_updated: now
                };

                // Para creatives, usar unit_id + ad_id como chave única
                const existing = await base44.asServiceRole.entities.MetaAdsDim.filter({ 
                    unit_id, account_id, ad_id
                });
                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaAdsDim.update(existing[0].id, record);
                } else {
                    await base44.asServiceRole.entities.MetaAdsDim.create(record);
                }
                upsertCount++;
            }
        }

        console.log(`✅ Salvos: ${upsertCount} registros | route: ${isPlatform ? 'platform' : isDevice ? 'device' : isDemographics ? 'demographics' : isCreativesBasic ? 'creatives_basic' : 'insights'}`);

        // ─── Atualizar Run ────────────────────────────────────────────────────
        const runs = await base44.asServiceRole.entities.Run.filter({ run_id, unit_id });
        if (runs.length > 0) {
            await base44.asServiceRole.entities.Run.update(runs[0].id, {
                status: 'success',
                total_records: (runs[0].total_records || 0) + upsertCount,
                finished_at_utc: now
            });
        }

        return Response.json({ ok: true, run_id, job_id, records_processed: upsertCount, stored_at: now });

    } catch (error) {
        console.error('❌ Erro em receiveN8nData:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
});