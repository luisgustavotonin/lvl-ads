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

        let upserted = 0;
        let skipped = 0;

        for (const row of data) {
            const rawDate = row.date || row.date_start || row.day;
            const ad_id = row.ad_id;

            if (!rawDate || !ad_id) {
                skipped++;
                continue;
            }

            // Normalizar data para YYYY-MM-DD
            const dateMatch = String(rawDate).match(/^(\d{4}-\d{2}-\d{2})/);
            if (!dateMatch) {
                console.warn(`⚠️ Data inválida: ${rawDate}`);
                skipped++;
                continue;
            }
            const date = dateMatch[1];

            const record = {
                run_id,                                                             // ✅ OBRIGATÓRIO
                job_id,
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

            // ✅ UPSERT por (run_id + ad_id + date)
            const existing = await base44.asServiceRole.entities.MetaAdDaily.filter({
                run_id,
                ad_id,
                date,
                unit_id
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