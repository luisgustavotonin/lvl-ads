import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Transforma resultados de MÚLTIPLOS jobs (insights, platform, device, demographics)
 * em 1 linha por ad+dia na tabela MetaAdDaily com colunas separadas por breakdown.
 * 
 * Espera receber: run_id (para processar todos os jobs do run de uma vez)
 * OU job_id (para processar um único job)
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        let { job_id, run_id, unit_id, account_id } = body;

        if (!job_id && !run_id) {
            return Response.json({ ok: false, error: 'job_id ou run_id é obrigatório' }, { status: 400 });
        }

        // ─── Helpers ──────────────────────────────────────────────────────────
        const getAction = (actions, type) => {
            if (!Array.isArray(actions)) return 0;
            const a = actions.find(a => a.action_type === type);
            return a ? parseFloat(a.value) || 0 : 0;
        };

        const normDate = (rawDate) => {
            const m = String(rawDate || '').match(/^(\d{4}-\d{2}-\d{2})/);
            return m ? m[1] : null;
        };

        // ─── Buscar todos os jobs do run (ou só o job_id informado) ──────────
        let jobResults = [];
        if (run_id) {
            // Pegar todos os MetaJobsResults cujo run_id bate (via queue)
            const queueJobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ run_id }, null, 200);
            const jobIds = queueJobs.map(j => j.job_id);
            if (jobIds.length === 0) {
                return Response.json({ ok: false, error: 'Nenhum job encontrado para este run_id' }, { status: 404 });
            }
            for (const jid of jobIds) {
                const res = await base44.asServiceRole.entities.MetaJobsResults.filter({ job_id: jid });
                if (res.length > 0) jobResults.push({ job: queueJobs.find(j => j.job_id === jid), result: res[0] });
            }
        } else {
            // Modo single job
            const res = await base44.asServiceRole.entities.MetaJobsResults.filter({ job_id });
            if (res.length === 0) return Response.json({ ok: false, error: 'Resultado de job não encontrado' }, { status: 404 });
            if (!run_id) {
                const queueJobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });
                run_id = queueJobs?.[0]?.run_id ?? null;
                unit_id = unit_id || queueJobs?.[0]?.unit_id;
                account_id = account_id || queueJobs?.[0]?.account_id;
                jobResults.push({ job: queueJobs[0], result: res[0] });
            }
        }

        if (jobResults.length === 0) {
            return Response.json({ ok: false, error: 'Nenhum resultado de job encontrado' }, { status: 404 });
        }

        // Garantir unit_id e account_id
        unit_id = unit_id || jobResults[0]?.result?.unit_id;
        account_id = account_id || jobResults[0]?.result?.account_id;
        run_id = run_id || jobResults[0]?.job?.run_id;

        // ─── Mapa principal: key = `${ad_id}::${date}` ───────────────────────
        const adDayMap = {};

        const ensureKey = (ad_id, date, row) => {
            const key = `${ad_id}::${date}`;
            if (!adDayMap[key]) {
                adDayMap[key] = {
                    ad_id,
                    date,
                    ad_name: '',
                    ad_effective_status: 'UNKNOWN',
                    creative_id: '',
                    creative_thumbnail_url: '',
                    campaign_id: '',
                    campaign_name: '',
                    adset_id: '',
                    adset_name: '',
                    // Totais (do job insights)
                    spend: 0, impressions: 0, reach: 0, clicks: 0, link_clicks: 0,
                    wa_conversations_started_7d: 0, wa_total_messaging_connection: 0, wa_messaging_first_reply: 0,
                    // Platform
                    facebook_impressions: 0, facebook_reach: 0, facebook_clicks: 0, facebook_spend: 0,
                    instagram_impressions: 0, instagram_reach: 0, instagram_clicks: 0, instagram_spend: 0,
                    audience_network_impressions: 0, audience_network_reach: 0, audience_network_clicks: 0, audience_network_spend: 0,
                    messenger_impressions: 0, messenger_reach: 0, messenger_clicks: 0, messenger_spend: 0,
                    // Device
                    android_impressions: 0, android_reach: 0, android_clicks: 0, android_spend: 0,
                    iphone_impressions: 0, iphone_reach: 0, iphone_clicks: 0, iphone_spend: 0,
                    ipad_impressions: 0, ipad_reach: 0, ipad_clicks: 0, ipad_spend: 0,
                    desktop_impressions: 0, desktop_reach: 0, desktop_clicks: 0, desktop_spend: 0,
                    // Demographics - age
                    age_13_17_impressions: 0, age_18_24_impressions: 0, age_25_34_impressions: 0,
                    age_35_44_impressions: 0, age_45_54_impressions: 0, age_55_64_impressions: 0, age_65_plus_impressions: 0,
                    age_13_17_reach: 0, age_18_24_reach: 0, age_25_34_reach: 0,
                    age_35_44_reach: 0, age_45_54_reach: 0, age_55_64_reach: 0, age_65_plus_reach: 0,
                    // Demographics - gender
                    male_impressions: 0, male_reach: 0, male_spend: 0,
                    female_impressions: 0, female_reach: 0, female_spend: 0,
                    unknown_gender_impressions: 0, unknown_gender_reach: 0,
                };
            }
            // Preencher metadados do anúncio se ainda não preenchidos
            const rec = adDayMap[key];
            if (!rec.ad_name && row) {
                rec.ad_name = row.ad_name || ad_id;
                rec.ad_effective_status = row.ad_effective_status || 'UNKNOWN';
                rec.creative_id = row.creative_id || '';
                rec.creative_thumbnail_url = row.thumbnail_url || row.creative_thumbnail_url || '';
                rec.campaign_id = row.campaign_id || '';
                rec.campaign_name = row.campaign_name || '';
                rec.adset_id = row.adset_id || '';
                rec.adset_name = row.adset_name || '';
            }
            return key;
        };

        // ─── Processar cada job pelo tipo ─────────────────────────────────────
        for (const { job, result } of jobResults) {
            const data = result.result_json?.data || [];
            const jobType = job?.job_type || 'insights';
            const breakdown = job?.breakdown || '';

            console.log(`📦 Processando job_type=${jobType} breakdown=${breakdown} rows=${data.length}`);

            for (const row of data) {
                const date = normDate(row.date || row.date_start || row.day);
                const ad_id = row.ad_id;
                if (!date || !ad_id) continue;

                const key = ensureKey(ad_id, date, row);
                const rec = adDayMap[key];

                if (jobType === 'insights' && !breakdown) {
                    // ─ Job de insights sem breakdown: totais ─
                    rec.spend       += parseFloat(row.spend) || 0;
                    rec.impressions += parseInt(row.impressions) || 0;
                    rec.reach       += parseInt(row.reach) || 0;
                    rec.clicks      += parseInt(row.clicks) || 0;
                    rec.link_clicks += parseInt(row.inline_link_clicks || row.link_clicks) || 0;
                    rec.wa_conversations_started_7d   += getAction(row.actions, 'onsite_conversion.messaging_conversation_started_7d') || parseInt(row.wa_conversations_started_7d) || 0;
                    rec.wa_total_messaging_connection += getAction(row.actions, 'onsite_conversion.total_messaging_connection') || parseInt(row.wa_total_messaging_connection) || 0;
                    rec.wa_messaging_first_reply      += getAction(row.actions, 'onsite_conversion.messaging_first_reply') || parseInt(row.wa_messaging_first_reply) || 0;

                } else if (breakdown === 'publisher_platform' || jobType === 'platform') {
                    // ─ Breakdown por plataforma ─
                    const platform = (row.publisher_platform || '').toLowerCase().replace(/\s/g, '_');
                    const imp = parseInt(row.impressions) || 0;
                    const rch = parseInt(row.reach) || 0;
                    const clk = parseInt(row.clicks) || 0;
                    const spd = parseFloat(row.spend) || 0;

                    if (platform === 'facebook') {
                        rec.facebook_impressions += imp; rec.facebook_reach += rch;
                        rec.facebook_clicks += clk; rec.facebook_spend += spd;
                    } else if (platform === 'instagram') {
                        rec.instagram_impressions += imp; rec.instagram_reach += rch;
                        rec.instagram_clicks += clk; rec.instagram_spend += spd;
                    } else if (platform === 'audience_network') {
                        rec.audience_network_impressions += imp; rec.audience_network_reach += rch;
                        rec.audience_network_clicks += clk; rec.audience_network_spend += spd;
                    } else if (platform === 'messenger') {
                        rec.messenger_impressions += imp; rec.messenger_reach += rch;
                        rec.messenger_clicks += clk; rec.messenger_spend += spd;
                    }

                } else if (breakdown === 'impression_device' || jobType === 'device') {
                    // ─ Breakdown por device ─
                    const device = (row.impression_device || '').toLowerCase().replace(/\s/g, '_');
                    const imp = parseInt(row.impressions) || 0;
                    const rch = parseInt(row.reach) || 0;
                    const clk = parseInt(row.clicks) || 0;
                    const spd = parseFloat(row.spend) || 0;

                    if (device === 'android_smartphone' || device === 'android') {
                        rec.android_impressions += imp; rec.android_reach += rch;
                        rec.android_clicks += clk; rec.android_spend += spd;
                    } else if (device === 'iphone') {
                        rec.iphone_impressions += imp; rec.iphone_reach += rch;
                        rec.iphone_clicks += clk; rec.iphone_spend += spd;
                    } else if (device === 'ipad') {
                        rec.ipad_impressions += imp; rec.ipad_reach += rch;
                        rec.ipad_clicks += clk; rec.ipad_spend += spd;
                    } else if (device === 'desktop') {
                        rec.desktop_impressions += imp; rec.desktop_reach += rch;
                        rec.desktop_clicks += clk; rec.desktop_spend += spd;
                    }

                } else if (breakdown === 'age,gender' || breakdown === 'age' || breakdown === 'gender' || jobType === 'demographics') {
                    // ─ Breakdown por age/gender ─
                    const age = (row.age || '').toLowerCase().replace(/\+/g, '_plus').replace(/-/g, '_');
                    const gender = (row.gender || '').toLowerCase();
                    const imp = parseInt(row.impressions) || 0;
                    const rch = parseInt(row.reach) || 0;
                    const spd = parseFloat(row.spend) || 0;

                    // Age
                    const ageKey = `age_${age}_impressions`;
                    const ageReachKey = `age_${age}_reach`;
                    if (ageKey in rec) rec[ageKey] += imp;
                    if (ageReachKey in rec) rec[ageReachKey] += rch;

                    // Gender
                    if (gender === 'male') {
                        rec.male_impressions += imp; rec.male_reach += rch; rec.male_spend += spd;
                    } else if (gender === 'female') {
                        rec.female_impressions += imp; rec.female_reach += rch; rec.female_spend += spd;
                    } else if (gender === 'unknown') {
                        rec.unknown_gender_impressions += imp; rec.unknown_gender_reach += rch;
                    }
                }
            }
        }

        console.log(`📊 ${Object.keys(adDayMap).length} registros únicos (ad+date) para salvar`);

        // ─── Salvar/atualizar cada registro ──────────────────────────────────
        let upserted = 0;
        const now = new Date().toISOString();

        for (const key of Object.keys(adDayMap)) {
            const rec = adDayMap[key];

            // Calcular métricas derivadas
            const frequency         = rec.reach > 0 ? rec.impressions / rec.reach : 0;
            const ctr_link          = rec.impressions > 0 ? rec.link_clicks / rec.impressions : 0;
            const cpc_link          = rec.link_clicks > 0 ? rec.spend / rec.link_clicks : 0;
            const cpm               = rec.impressions > 0 ? (rec.spend / rec.impressions) * 1000 : 0;
            const cost_per_conversation  = rec.wa_conversations_started_7d > 0 ? rec.spend / rec.wa_conversations_started_7d : 0;
            const cost_per_total_contact = rec.wa_total_messaging_connection > 0 ? rec.spend / rec.wa_total_messaging_connection : 0;
            const cost_per_first_reply   = rec.wa_messaging_first_reply > 0 ? rec.spend / rec.wa_messaging_first_reply : 0;

            const record = {
                run_id, job_id: job_id || run_id, unit_id, account_id, platform: 'META',
                date: rec.date, ad_id: rec.ad_id, ad_name: rec.ad_name,
                ad_effective_status: rec.ad_effective_status,
                creative_id: rec.creative_id, creative_thumbnail_url: rec.creative_thumbnail_url,
                campaign_id: rec.campaign_id, campaign_name: rec.campaign_name,
                adset_id: rec.adset_id, adset_name: rec.adset_name,
                spend: rec.spend, impressions: rec.impressions, reach: rec.reach,
                frequency, clicks: rec.clicks, link_clicks: rec.link_clicks,
                ctr_link, cpc_link, cpm,
                wa_conversations_started_7d: rec.wa_conversations_started_7d,
                wa_total_messaging_connection: rec.wa_total_messaging_connection,
                wa_messaging_first_reply: rec.wa_messaging_first_reply,
                cost_per_conversation, cost_per_total_contact, cost_per_first_reply,
                // Platform
                facebook_impressions: rec.facebook_impressions, facebook_reach: rec.facebook_reach,
                facebook_clicks: rec.facebook_clicks, facebook_spend: rec.facebook_spend,
                instagram_impressions: rec.instagram_impressions, instagram_reach: rec.instagram_reach,
                instagram_clicks: rec.instagram_clicks, instagram_spend: rec.instagram_spend,
                audience_network_impressions: rec.audience_network_impressions,
                audience_network_reach: rec.audience_network_reach,
                audience_network_clicks: rec.audience_network_clicks,
                audience_network_spend: rec.audience_network_spend,
                messenger_impressions: rec.messenger_impressions, messenger_reach: rec.messenger_reach,
                messenger_clicks: rec.messenger_clicks, messenger_spend: rec.messenger_spend,
                // Device
                android_impressions: rec.android_impressions, android_reach: rec.android_reach,
                android_clicks: rec.android_clicks, android_spend: rec.android_spend,
                iphone_impressions: rec.iphone_impressions, iphone_reach: rec.iphone_reach,
                iphone_clicks: rec.iphone_clicks, iphone_spend: rec.iphone_spend,
                ipad_impressions: rec.ipad_impressions, ipad_reach: rec.ipad_reach,
                ipad_clicks: rec.ipad_clicks, ipad_spend: rec.ipad_spend,
                desktop_impressions: rec.desktop_impressions, desktop_reach: rec.desktop_reach,
                desktop_clicks: rec.desktop_clicks, desktop_spend: rec.desktop_spend,
                // Demographics age
                age_13_17_impressions: rec.age_13_17_impressions, age_18_24_impressions: rec.age_18_24_impressions,
                age_25_34_impressions: rec.age_25_34_impressions, age_35_44_impressions: rec.age_35_44_impressions,
                age_45_54_impressions: rec.age_45_54_impressions, age_55_64_impressions: rec.age_55_64_impressions,
                age_65_plus_impressions: rec.age_65_plus_impressions,
                age_13_17_reach: rec.age_13_17_reach, age_18_24_reach: rec.age_18_24_reach,
                age_25_34_reach: rec.age_25_34_reach, age_35_44_reach: rec.age_35_44_reach,
                age_45_54_reach: rec.age_45_54_reach, age_55_64_reach: rec.age_55_64_reach,
                age_65_plus_reach: rec.age_65_plus_reach,
                // Demographics gender
                male_impressions: rec.male_impressions, male_reach: rec.male_reach, male_spend: rec.male_spend,
                female_impressions: rec.female_impressions, female_reach: rec.female_reach, female_spend: rec.female_spend,
                unknown_gender_impressions: rec.unknown_gender_impressions, unknown_gender_reach: rec.unknown_gender_reach,
                imported_at_utc: now
            };

            // UPSERT por (run_id + ad_id + date + unit_id)
            const existing = await base44.asServiceRole.entities.MetaAdDaily.filter({
                run_id, ad_id: rec.ad_id, date: rec.date, unit_id
            });

            if (existing.length > 0) {
                await base44.asServiceRole.entities.MetaAdDaily.update(existing[0].id, record);
            } else {
                await base44.asServiceRole.entities.MetaAdDaily.create(record);
            }

            upserted++;
        }

        // ─── Atualizar Run ────────────────────────────────────────────────────
        const runs = await base44.asServiceRole.entities.Run.filter({ run_id, unit_id });
        if (runs.length > 0) {
            await base44.asServiceRole.entities.Run.update(runs[0].id, {
                status: 'success',
                total_records: upserted,
                finished_at_utc: now
            });
        }

        console.log(`✅ ${upserted} registros upserted em MetaAdDaily | run_id: ${run_id}`);

        return Response.json({ ok: true, run_id, records_upserted: upserted });

    } catch (error) {
        console.error('❌ Erro ao transformar dados:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
});