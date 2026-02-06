import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    let webhookLogId = null;
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse JSON body
        const body = await req.json();
        const { data, secret_token, integration_id, data_type = 'metrics' } = body;
        
        // 🐛 LOG INICIAL - Salvar webhook recebido
        const webhookLog = await base44.asServiceRole.entities.WebhookLog.create({
            integration_id: integration_id || 'unknown',
            source: 'n8n',
            status: 'success',
            payload_received: body,
            records_processed: { days: 0, metrics: 0, entities: 0 }
        });
        webhookLogId = webhookLog.id;
        
        console.log('🔔 WEBHOOK RECEBIDO:', JSON.stringify({
            integration_id,
            data_type,
            has_data: !!data,
            data_length: Array.isArray(data) ? data.length : 'not_array',
            has_secret: !!secret_token,
            body_keys: Object.keys(body)
        }, null, 2));

        if (!data || !integration_id) {
            const errorMsg = 'data e integration_id são obrigatórios';
            await base44.asServiceRole.entities.WebhookLog.update(webhookLogId, {
                status: 'error',
                error_message: errorMsg
            });
            return Response.json({ 
                success: false, 
                error: errorMsg 
            }, { status: 400 });
        }

        // Buscar integração para validar o secret token
        const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
        
        if (!integration) {
            const errorMsg = 'Integração não encontrada';
            await base44.asServiceRole.entities.WebhookLog.update(webhookLogId, {
                status: 'error',
                error_message: errorMsg
            });
            return Response.json({ 
                success: false, 
                error: errorMsg 
            }, { status: 404 });
        }

        // Validar secret token
        const expectedToken = integration.settings?.n8n_secret_token;
        if (!expectedToken || secret_token !== expectedToken) {
            const errorMsg = 'Token de segurança inválido';
            await base44.asServiceRole.entities.WebhookLog.update(webhookLogId, {
                status: 'error',
                error_message: errorMsg
            });
            return Response.json({ 
                success: false, 
                error: errorMsg 
            }, { status: 403 });
        }

        // Processar os dados recebidos
        console.log('📦 Total de itens recebidos:', data.length);
        console.log('📦 Tipo de dados:', data_type);
        console.log('📦 Primeiro item (amostra):', JSON.stringify(data[0], null, 2));
        
        let processedDays = 0;
        let totalMetrics = 0;
        let totalEntities = 0;
        let totalCreatives = 0;

        // Processar baseado no tipo de dados
        if (data_type === 'insights' || data_type === 'metrics') {
            // Processar dados brutos de insights do Meta (formato da API)
            for (const insight of data) {
                const date = insight.date_start;
                
                if (!date) {
                    console.warn('⚠️ Insight sem "date_start", pulando:', insight);
                    continue;
                }

                // Extrair métricas agregadas do dia
                const existingDaily = await base44.asServiceRole.entities.MetricsDaily.filter({
                    unit_id: integration.unit_id,
                    platform_id: integration.platform_id,
                    date: date
                });

                let dailyMetrics = existingDaily.length > 0 ? existingDaily[0] : {
                    unit_id: integration.unit_id,
                    platform_id: integration.platform_id,
                    date: date,
                    currency: 'BRL',
                    spend: 0,
                    impressions: 0,
                    reach: 0,
                    clicks: 0,
                    link_clicks: 0,
                    ctr: 0,
                    cpc: 0,
                    cpm: 0,
                    conversions: 0,
                    conversion_value: 0,
                    messages: 0,
                    leads: 0,
                    purchases: 0,
                    extras: {}
                };

                // Somar métricas do insight
                dailyMetrics.spend += parseFloat(insight.spend || 0);
                dailyMetrics.impressions += parseInt(insight.impressions || 0);
                dailyMetrics.reach = Math.max(dailyMetrics.reach, parseInt(insight.reach || 0));
                dailyMetrics.clicks += parseInt(insight.clicks || 0);
                dailyMetrics.link_clicks += parseInt(insight.inline_link_clicks || 0);

                // Salvar ações do Meta no extras
                if (insight.actions) {
                    for (const action of insight.actions) {
                        if (action.action_type === 'onsite_conversion.total_messaging_connection') {
                            dailyMetrics.messages += parseInt(action.value || 0);
                        }
                        if (action.action_type.includes('lead')) {
                            dailyMetrics.leads += parseInt(action.value || 0);
                        }
                        if (action.action_type.includes('purchase')) {
                            dailyMetrics.purchases += parseInt(action.value || 0);
                        }
                    }
                }

                // Calcular médias
                if (dailyMetrics.impressions > 0) {
                    dailyMetrics.cpm = (dailyMetrics.spend / dailyMetrics.impressions) * 1000;
                    dailyMetrics.ctr = (dailyMetrics.clicks / dailyMetrics.impressions) * 100;
                }
                if (dailyMetrics.clicks > 0) {
                    dailyMetrics.cpc = dailyMetrics.spend / dailyMetrics.clicks;
                }

                // Upsert métrica diária
                if (existingDaily.length > 0) {
                    await base44.asServiceRole.entities.MetricsDaily.update(existingDaily[0].id, dailyMetrics);
                } else {
                    await base44.asServiceRole.entities.MetricsDaily.create(dailyMetrics);
                }
                totalMetrics++;

                // Salvar dados de campanha
                if (insight.campaign_id) {
                    const campaignRecord = {
                        unit_id: integration.unit_id,
                        platform_id: integration.platform_id,
                        date: date,
                        entity_level: 'campaign',
                        entity_id: insight.campaign_id,
                        entity_name: insight.campaign_name || 'Unknown Campaign',
                        status: 'active',
                        spend: parseFloat(insight.spend || 0),
                        impressions: parseInt(insight.impressions || 0),
                        clicks: parseInt(insight.clicks || 0),
                        results: parseInt(insight.inline_link_clicks || 0),
                        cpr: parseFloat(insight.cost_per_inline_link_click || 0),
                        extras: {
                            objective: insight.objective,
                            buying_type: insight.buying_type,
                            actions: insight.actions || [],
                            cost_per_action_type: insight.cost_per_action_type || []
                        }
                    };

                    const existingCampaign = await base44.asServiceRole.entities.MetricsEntity.filter({
                        unit_id: integration.unit_id,
                        platform_id: integration.platform_id,
                        date: date,
                        entity_level: 'campaign',
                        entity_id: insight.campaign_id
                    });

                    if (existingCampaign.length > 0) {
                        await base44.asServiceRole.entities.MetricsEntity.update(existingCampaign[0].id, campaignRecord);
                    } else {
                        await base44.asServiceRole.entities.MetricsEntity.create(campaignRecord);
                    }
                    totalEntities++;
                }

                // Salvar dados de adset
                if (insight.adset_id) {
                    const adsetRecord = {
                        unit_id: integration.unit_id,
                        platform_id: integration.platform_id,
                        date: date,
                        entity_level: 'adset',
                        entity_id: insight.adset_id,
                        entity_name: insight.adset_name || 'Unknown AdSet',
                        status: 'active',
                        spend: parseFloat(insight.spend || 0),
                        impressions: parseInt(insight.impressions || 0),
                        clicks: parseInt(insight.clicks || 0),
                        results: parseInt(insight.inline_link_clicks || 0),
                        cpr: parseFloat(insight.cost_per_inline_link_click || 0),
                        extras: {
                            actions: insight.actions || [],
                            cost_per_action_type: insight.cost_per_action_type || []
                        }
                    };

                    const existingAdset = await base44.asServiceRole.entities.MetricsEntity.filter({
                        unit_id: integration.unit_id,
                        platform_id: integration.platform_id,
                        date: date,
                        entity_level: 'adset',
                        entity_id: insight.adset_id
                    });

                    if (existingAdset.length > 0) {
                        await base44.asServiceRole.entities.MetricsEntity.update(existingAdset[0].id, adsetRecord);
                    } else {
                        await base44.asServiceRole.entities.MetricsEntity.create(adsetRecord);
                    }
                    totalEntities++;
                }

                // Salvar dados de ad
                if (insight.ad_id) {
                    const adRecord = {
                        unit_id: integration.unit_id,
                        platform_id: integration.platform_id,
                        date: date,
                        entity_level: 'ad',
                        entity_id: insight.ad_id,
                        entity_name: insight.ad_name || 'Unknown Ad',
                        status: 'active',
                        spend: parseFloat(insight.spend || 0),
                        impressions: parseInt(insight.impressions || 0),
                        clicks: parseInt(insight.clicks || 0),
                        results: parseInt(insight.inline_link_clicks || 0),
                        cpr: parseFloat(insight.cost_per_inline_link_click || 0),
                        extras: {
                            frequency: insight.frequency,
                            reach: insight.reach,
                            ctr: insight.ctr,
                            cpc: insight.cpc,
                            cpm: insight.cpm,
                            actions: insight.actions || [],
                            cost_per_action_type: insight.cost_per_action_type || []
                        }
                    };

                    const existingAd = await base44.asServiceRole.entities.MetricsEntity.filter({
                        unit_id: integration.unit_id,
                        platform_id: integration.platform_id,
                        date: date,
                        entity_level: 'ad',
                        entity_id: insight.ad_id
                    });

                    if (existingAd.length > 0) {
                        await base44.asServiceRole.entities.MetricsEntity.update(existingAd[0].id, adRecord);
                    } else {
                        await base44.asServiceRole.entities.MetricsEntity.create(adRecord);
                    }
                    totalEntities++;
                }

                processedDays++;
            }

        } else if (data_type === 'creatives') {
            // Processar dados de criativos (imagens, vídeos)
            for (const creative of data) {
                if (!creative.ad_id) {
                    console.warn('⚠️ Criativo sem "ad_id", pulando:', creative);
                    continue;
                }

                const creativeRecord = {
                    unit_id: integration.unit_id,
                    platform_id: integration.platform_id,
                    ad_id: creative.ad_id,
                    ad_name: creative.ad_name || 'Unknown Ad',
                    creative_type: creative.creative_type || 'image',
                    thumbnail_url: creative.thumbnail_url || creative.image_url,
                    media_url: creative.media_url || creative.video_url,
                    headline: creative.headline,
                    description: creative.description || creative.body,
                    call_to_action: creative.call_to_action,
                    spend: 0,
                    impressions: 0,
                    clicks: 0,
                    results: 0
                };

                // Verificar se já existe
                const existingCreative = await base44.asServiceRole.entities.Creative.filter({
                    unit_id: integration.unit_id,
                    platform_id: integration.platform_id,
                    ad_id: creative.ad_id
                });

                if (existingCreative.length > 0) {
                    await base44.asServiceRole.entities.Creative.update(existingCreative[0].id, creativeRecord);
                } else {
                    await base44.asServiceRole.entities.Creative.create(creativeRecord);
                }
                totalCreatives++;
            }

        } else {
            // Formato legado (mantido para compatibilidade)
            for (const dayData of data) {
                const { date, metrics, campaign_data, adset_data, ad_data } = dayData;

                if (!date) {
                    console.warn('⚠️ Data sem campo "date", pulando:', dayData);
                    continue;
                }

                // 1. Salvar métricas diárias agregadas
                if (metrics) {
                    console.log(`📊 Processando métricas para ${date}:`, metrics);
                    const metricRecord = {
                        unit_id: integration.unit_id,
                        platform_id: integration.platform_id,
                        date: date,
                        currency: metrics.currency || 'BRL',
                        spend: parseFloat(metrics.spend || 0),
                        impressions: parseInt(metrics.impressions || 0),
                        reach: parseInt(metrics.reach || 0),
                        clicks: parseInt(metrics.clicks || 0),
                        link_clicks: parseInt(metrics.link_clicks || 0),
                        ctr: parseFloat(metrics.ctr || 0),
                        cpc: parseFloat(metrics.cpc || 0),
                        cpm: parseFloat(metrics.cpm || 0),
                        conversions: parseInt(metrics.conversions || 0),
                        conversion_value: parseFloat(metrics.conversion_value || 0),
                        messages: parseInt(metrics.messages || 0),
                        leads: parseInt(metrics.leads || 0),
                        purchases: parseInt(metrics.purchases || 0),
                        extras: metrics.extras || {}
                    };

                    // Verificar se já existe métrica para essa data
                    const existing = await base44.asServiceRole.entities.MetricsDaily.filter({
                        unit_id: integration.unit_id,
                        platform_id: integration.platform_id,
                        date: date
                    });

                    if (existing.length > 0) {
                        await base44.asServiceRole.entities.MetricsDaily.update(existing[0].id, metricRecord);
                    } else {
                        await base44.asServiceRole.entities.MetricsDaily.create(metricRecord);
                    }
                    totalMetrics++;
                }

                // 2. Salvar dados de entidades (campanhas, adsets, ads)
                const entityLevels = [
                    { level: 'campaign', data: campaign_data },
                    { level: 'adset', data: adset_data },
                    { level: 'ad', data: ad_data }
                ];

                for (const { level, data: entities } of entityLevels) {
                    if (!entities || !Array.isArray(entities)) continue;
                    console.log(`📈 Processando ${entities.length} ${level}(s) para ${date}`);

                    for (const entity of entities) {
                        const entityRecord = {
                            unit_id: integration.unit_id,
                            platform_id: integration.platform_id,
                            date: date,
                            entity_level: level,
                            entity_id: entity.id || entity.entity_id,
                            entity_name: entity.name || entity.entity_name,
                            status: entity.status || 'active',
                            spend: parseFloat(entity.spend || 0),
                            impressions: parseInt(entity.impressions || 0),
                            clicks: parseInt(entity.clicks || 0),
                            results: parseInt(entity.results || entity.conversions || 0),
                            cpr: parseFloat(entity.cpr || entity.cost_per_result || 0),
                            extras: entity.extras || {}
                        };

                        // Verificar se já existe
                        const existingEntity = await base44.asServiceRole.entities.MetricsEntity.filter({
                            unit_id: integration.unit_id,
                            platform_id: integration.platform_id,
                            date: date,
                            entity_level: level,
                            entity_id: entityRecord.entity_id
                        });

                        if (existingEntity.length > 0) {
                            await base44.asServiceRole.entities.MetricsEntity.update(existingEntity[0].id, entityRecord);
                        } else {
                            await base44.asServiceRole.entities.MetricsEntity.create(entityRecord);
                        }
                        totalEntities++;
                    }
                }

                processedDays++;
            }
        }

        // Atualizar log com sucesso
        await base44.asServiceRole.entities.WebhookLog.update(webhookLogId, {
            records_processed: { days: processedDays, metrics: totalMetrics, entities: totalEntities }
        });
        
        return Response.json({
            success: true,
            message: `Dados processados com sucesso: ${processedDays} dia(s), ${totalMetrics} métricas, ${totalEntities} entidades`,
            processed: { days: processedDays, metrics: totalMetrics, entities: totalEntities }
        });

    } catch (error) {
        console.error('❌ ERRO ao processar webhook:', error);
        
        // Salvar erro no log
        try {
            const base44 = createClientFromRequest(req);
            if (webhookLogId) {
                await base44.asServiceRole.entities.WebhookLog.update(webhookLogId, {
                    status: 'error',
                    error_message: error.message
                });
            } else {
                await base44.asServiceRole.entities.WebhookLog.create({
                    source: 'n8n',
                    status: 'error',
                    error_message: error.message,
                    payload_received: {}
                });
            }
        } catch (logError) {
            console.error('Erro ao salvar log:', logError);
        }
        
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});