import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Consolida dados de staging para tabela final
 * Junta insights, ads e creative dimensions
 * Processa um período específico para uma unidade
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { job_id, unit_id, date_start, date_end } = await req.json();

        if (!unit_id || !date_start || !date_end) {
            return Response.json({ 
                error: 'unit_id, date_start e date_end são obrigatórios' 
            }, { status: 400 });
        }

        console.log(`🔄 Consolidando métricas - Unit: ${unit_id}, Período: ${date_start} a ${date_end}`);

        // 1. Buscar todos insights staging do período
        const insights = await base44.asServiceRole.entities.MetaInsightsStaging.filter({
            unit_id: unit_id
        });

        const insightsInRange = insights.filter(i => 
            i.day >= date_start && i.day <= date_end
        );

        console.log(`📊 ${insightsInRange.length} registros de insights encontrados`);

        // 2. Agrupar por ad_id + day (consolidar módulos)
        const grouped = {};
        
        for (const insight of insightsInRange) {
            const key = `${insight.ad_id}_${insight.day}`;
            
            if (!grouped[key]) {
                grouped[key] = {
                    ad_id: insight.ad_id,
                    day: insight.day,
                    spend: 0,
                    impressions: 0,
                    reach: 0,
                    clicks: 0,
                    modules: {}
                };
            }

            // Somar métricas do módulo core
            if (insight.module === 'core') {
                grouped[key].spend += insight.spend || 0;
                grouped[key].impressions += insight.impressions || 0;
                grouped[key].reach += insight.reach || 0;
                grouped[key].clicks += insight.clicks || 0;
            }

            // Armazenar dados dos módulos
            grouped[key].modules[insight.module] = {
                breakdown_key: insight.breakdown_key,
                breakdown_value: insight.breakdown_value,
                metrics: {
                    spend: insight.spend,
                    impressions: insight.impressions,
                    reach: insight.reach,
                    clicks: insight.clicks
                }
            };
        }

        // 3. Buscar dimensões de ads
        const ads = await base44.asServiceRole.entities.MetaAdsDim.filter({
            unit_id: unit_id
        });

        const adsMap = {};
        ads.forEach(ad => {
            adsMap[ad.ad_id] = ad;
        });

        // 4. Buscar dimensões de creative
        const creatives = await base44.asServiceRole.entities.MetaCreativeDim.list();
        const creativesMap = {};
        creatives.forEach(c => {
            creativesMap[c.creative_id] = c;
        });

        // 5. Consolidar e salvar na tabela final (MetaAdDaily)
        let recordsProcessed = 0;

        for (const key in grouped) {
            const consolidated = grouped[key];
            const adDim = adsMap[consolidated.ad_id];
            
            if (!adDim) {
                console.warn(`⚠️ Ad dimension não encontrada para ad_id: ${consolidated.ad_id}`);
                continue;
            }

            const creativeDim = creativesMap[adDim.creative_id];

            // Calcular métricas derivadas
            const frequency = consolidated.reach > 0 
                ? consolidated.impressions / consolidated.reach 
                : 0;
            const cpm = consolidated.impressions > 0 
                ? (consolidated.spend / consolidated.impressions) * 1000 
                : 0;
            const cpc = consolidated.clicks > 0 
                ? consolidated.spend / consolidated.clicks 
                : 0;
            const ctr = consolidated.impressions > 0 
                ? (consolidated.clicks / consolidated.impressions) * 100 
                : 0;

            const finalRecord = {
                unit_id: unit_id,
                account_id: adDim.account_id,
                date: consolidated.day,
                ad_id: consolidated.ad_id,
                ad_name: adDim.ad_name,
                ad_effective_status: adDim.ad_status,
                creative_id: adDim.creative_id,
                creative_thumbnail_url: creativeDim?.thumbnail_url || '',
                adset_id: adDim.adset_id,
                adset_name: adDim.adset_name,
                campaign_id: adDim.campaign_id,
                campaign_name: adDim.campaign_name,
                spend: consolidated.spend,
                impressions: consolidated.impressions,
                reach: consolidated.reach,
                frequency: frequency,
                clicks: consolidated.clicks,
                link_clicks: 0, // TODO: Extrair de actions
                ctr_link: ctr,
                cpc_link: cpc,
                cpm: cpm,
                demographics_json: consolidated.modules.age || {},
                placement_json: consolidated.modules.platform || {},
                devices_json: consolidated.modules.device || {},
                run_id: job_id || ''
            };

            // UPSERT na tabela final
            const existing = await base44.asServiceRole.entities.MetaAdDaily.filter({
                unit_id: unit_id,
                ad_id: consolidated.ad_id,
                date: consolidated.day
            });

            if (existing.length > 0) {
                await base44.asServiceRole.entities.MetaAdDaily.update(
                    existing[0].id,
                    finalRecord
                );
            } else {
                await base44.asServiceRole.entities.MetaAdDaily.create(finalRecord);
            }

            recordsProcessed++;
        }

        console.log(`✅ Consolidação concluída: ${recordsProcessed} registros`);

        return Response.json({
            ok: true,
            job_id,
            records_processed: recordsProcessed
        });

    } catch (error) {
        console.error('❌ Erro na consolidação:', error);
        return Response.json({ 
            ok: false,
            error: error.message 
        }, { status: 500 });
    }
});