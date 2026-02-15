import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { job_id } = await req.json();

        if (!job_id) {
            return Response.json({ 
                ok: false, 
                error: 'job_id é obrigatório' 
            }, { status: 400 });
        }

        // Buscar o resultado do job
        const results = await base44.asServiceRole.entities.MetaJobsResults.filter({ job_id });
        
        if (results.length === 0) {
            return Response.json({ 
                ok: false, 
                error: 'Job não encontrado' 
            }, { status: 404 });
        }

        const result = results[0];
        const data = result.result_json?.data || [];

        if (!Array.isArray(data) || data.length === 0) {
            return Response.json({ 
                ok: false, 
                error: 'Nenhum dado para processar' 
            }, { status: 400 });
        }

        // Transformar cada linha em registro MetaAdDaily
        const recordsToInsert = [];
        
        for (const row of data) {
            // Normalizar os campos - pode vir com diferentes nomes
            const record = {
                unit_id: result.unit_id,
                account_id: result.account_id,
                date: row.date || row.date_start || row.day,
                campaign_id: row.campaign_id,
                campaign_name: row.campaign_name,
                adset_id: row.adset_id,
                adset_name: row.adset_name,
                ad_id: row.ad_id,
                ad_name: row.ad_name,
                spend: parseFloat(row.spend) || 0,
                impressions: parseInt(row.impressions) || 0,
                reach: parseInt(row.reach) || 0,
                clicks: parseInt(row.clicks) || 0,
                link_clicks: parseInt(row.link_clicks || row.inline_link_clicks) || 0,
                wa_conversations_started_7d: parseInt(row.wa_conversations_started_7d || row.conversations) || 0,
                wa_total_messaging_connection: parseInt(row.wa_total_messaging_connection || row.total_contact) || 0,
                wa_messaging_first_reply: parseInt(row.wa_messaging_first_reply || row.first_reply) || 0,
                frequency: parseFloat(row.frequency) || 0,
                cpc: parseFloat(row.cpc) || 0,
                cpm: parseFloat(row.cpm) || 0,
                ctr: parseFloat(row.ctr) || 0,
                thumbnail_url: row.thumbnail_url || null,
            };

            // Validar campos obrigatórios
            if (!record.date || !record.ad_id) {
                console.warn(`⚠️ Registro ignorado: faltam campos obrigatórios`, row);
                continue;
            }

            recordsToInsert.push(record);
        }

        if (recordsToInsert.length === 0) {
            return Response.json({ 
                ok: false, 
                error: 'Nenhum registro válido para inserir' 
            }, { status: 400 });
        }

        // Inserir em lote no MetaAdDaily
        const inserted = await base44.asServiceRole.entities.MetaAdDaily.bulkCreate(recordsToInsert);

        console.log(`✅ Transformados ${inserted.length} registros para MetaAdDaily`);

        return Response.json({ 
            ok: true,
            job_id: job_id,
            records_processed: data.length,
            records_inserted: inserted.length,
            records_skipped: data.length - inserted.length
        });

    } catch (error) {
        console.error('❌ Erro ao transformar dados:', error);
        return Response.json({ 
            ok: false,
            error: error.message,
            error_details: error.stack 
        }, { status: 500 });
    }
});