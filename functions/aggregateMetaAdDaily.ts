import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { unit_id, date_from, date_to } = await req.json();

        console.log('🔄 Agregando dados MetaAdDaily → MetricsDaily');

        // Buscar todos os registros de MetaAdDaily
        const filters = {};
        if (unit_id) filters.unit_id = unit_id;
        
        const allAds = await base44.asServiceRole.entities.MetaAdDaily.filter(filters);
        
        console.log(`📊 Total de anúncios encontrados: ${allAds.length}`);

        // Filtrar por período se especificado
        let adsToProcess = allAds;
        if (date_from || date_to) {
            adsToProcess = allAds.filter(ad => {
                const adDate = new Date(ad.date);
                if (date_from && adDate < new Date(date_from)) return false;
                if (date_to && adDate > new Date(date_to)) return false;
                return true;
            });
        }

        console.log(`📊 Anúncios a processar: ${adsToProcess.length}`);

        // Agrupar por (unit_id, date)
        const grouped = {};
        
        for (const ad of adsToProcess) {
            const key = `${ad.unit_id}_${ad.date}`;
            
            if (!grouped[key]) {
                grouped[key] = {
                    unit_id: ad.unit_id,
                    platform_id: 'META',
                    date: ad.date,
                    spend: 0,
                    impressions: 0,
                    reach: 0,
                    clicks: 0,
                    link_clicks: 0,
                    whatsapp_conversations_started: 0,
                    whatsapp_contacts: 0,
                    whatsapp_new_contacts: 0,
                    cost_per_whatsapp_conversation: 0,
                    cost_per_whatsapp_contact: 0,
                    cost_per_whatsapp_new_contact: 0,
                    ctr: 0,
                    cpc: 0,
                    cpm: 0,
                };
            }

            // Somar métricas
            grouped[key].spend += ad.spend || 0;
            grouped[key].impressions += ad.impressions || 0;
            grouped[key].reach += ad.reach || 0;
            grouped[key].clicks += ad.clicks || 0;
            grouped[key].link_clicks += ad.link_clicks || 0;
            grouped[key].whatsapp_conversations_started += ad.wa_conversations_started_7d || 0;
            grouped[key].whatsapp_contacts += ad.wa_total_messaging_connection || 0;
            grouped[key].whatsapp_new_contacts += ad.wa_messaging_first_reply || 0;
        }

        // Calcular métricas derivadas e fazer UPSERT
        let created = 0;
        let updated = 0;

        for (const key in grouped) {
            const metric = grouped[key];

            // Calcular métricas derivadas
            if (metric.impressions > 0) {
                metric.ctr = (metric.clicks / metric.impressions) * 100;
                metric.cpm = (metric.spend / metric.impressions) * 1000;
            }
            if (metric.clicks > 0) {
                metric.cpc = metric.spend / metric.clicks;
            }
            if (metric.whatsapp_conversations_started > 0) {
                metric.cost_per_whatsapp_conversation = metric.spend / metric.whatsapp_conversations_started;
            }
            if (metric.whatsapp_contacts > 0) {
                metric.cost_per_whatsapp_contact = metric.spend / metric.whatsapp_contacts;
            }
            if (metric.whatsapp_new_contacts > 0) {
                metric.cost_per_whatsapp_new_contact = metric.spend / metric.whatsapp_new_contacts;
            }

            // Buscar registro existente
            const existing = await base44.asServiceRole.entities.MetricsDaily.filter({
                unit_id: metric.unit_id,
                platform_id: metric.platform_id,
                date: metric.date
            });

            if (existing.length > 0) {
                // UPDATE
                await base44.asServiceRole.entities.MetricsDaily.update(existing[0].id, metric);
                updated++;
                console.log(`✅ Updated: ${metric.unit_id} / ${metric.date}`);
            } else {
                // CREATE
                await base44.asServiceRole.entities.MetricsDaily.create(metric);
                created++;
                console.log(`✅ Created: ${metric.unit_id} / ${metric.date}`);
            }
        }

        return Response.json({
            success: true,
            message: 'Agregação concluída',
            stats: {
                ads_processed: adsToProcess.length,
                daily_metrics_created: created,
                daily_metrics_updated: updated,
                total_daily_metrics: created + updated
            }
        });

    } catch (error) {
        console.error('❌ Erro ao agregar dados:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});