import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    let webhookLogId = null;
    let executionLogId = null;
    
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse JSON body
        const body = await req.json();
        const { 
            integration_id, 
            secret_token, 
            unit_id,
            provider,
            range,
            metrics_daily = [],
            metrics_ads = [],
            creatives = [],
            videos = [],
            execution_log_id
        } = body;
        
        executionLogId = execution_log_id;
        
        console.log('🔔 WEBHOOK RECEBIDO:', JSON.stringify({
            integration_id,
            unit_id,
            provider,
            range,
            metrics_daily_count: metrics_daily.length,
            metrics_ads_count: metrics_ads.length,
            creatives_count: creatives.length,
            videos_count: videos.length,
            execution_log_id
        }, null, 2));

        if (!integration_id || !unit_id || !provider) {
            const errorMsg = 'integration_id, unit_id e provider são obrigatórios';
            if (executionLogId) {
                await base44.asServiceRole.entities.ExecutionLog.update(executionLogId, {
                    status: 'error',
                    error_message: errorMsg,
                    completed_at: new Date().toISOString()
                });
            }
            return Response.json({ 
                success: false, 
                error: errorMsg 
            }, { status: 400 });
        }

        // Buscar integração para validar o secret token
        const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
        
        if (!integration) {
            const errorMsg = 'Integração não encontrada';
            if (executionLogId) {
                await base44.asServiceRole.entities.ExecutionLog.update(executionLogId, {
                    status: 'error',
                    error_message: errorMsg,
                    completed_at: new Date().toISOString()
                });
            }
            return Response.json({ 
                success: false, 
                error: errorMsg 
            }, { status: 404 });
        }

        // Validar secret token
        const expectedToken = integration.settings?.n8n_secret_token;
        if (expectedToken && secret_token !== expectedToken) {
            const errorMsg = 'Token de segurança inválido';
            if (executionLogId) {
                await base44.asServiceRole.entities.ExecutionLog.update(executionLogId, {
                    status: 'error',
                    error_message: errorMsg,
                    completed_at: new Date().toISOString()
                });
            }
            return Response.json({ 
                success: false, 
                error: errorMsg 
            }, { status: 403 });
        }

        // Mapear provider para platform_id
        const platformMap = {
            'meta': 'META',
            'google': 'GOOGLE_ADS',
            'tiktok': 'TIKTOK_ADS',
            'youtube': 'YOUTUBE'
        };
        const platform_id = platformMap[provider] || 'META';

        let processedMetrics = 0;
        let processedAds = 0;
        let processedCreatives = 0;
        let processedVideos = 0;

        // 1. Processar métricas diárias (metrics_daily)
        for (const metric of metrics_daily) {
            const { date, spend, impressions, reach, clicks, link_clicks, ctr, cpc, cpm, whatsapp } = metric;
            
            if (!date) {
                console.warn('⚠️ Métrica sem date, pulando:', metric);
                continue;
            }

            const dailyRecord = {
                unit_id: unit_id,
                platform_id: platform_id,
                date: date,
                currency: 'BRL',
                spend: parseFloat(spend || 0),
                impressions: parseInt(impressions || 0),
                reach: parseInt(reach || 0),
                clicks: parseInt(clicks || 0),
                link_clicks: parseInt(link_clicks || 0),
                ctr: parseFloat(ctr || 0),
                cpc: parseFloat(cpc || 0),
                cpm: parseFloat(cpm || 0),
                whatsapp_conversations_started: parseInt(whatsapp?.conversations_started_7d || 0),
                whatsapp_new_contacts: parseInt(whatsapp?.messaging_first_reply || 0),
                whatsapp_contacts: parseInt(whatsapp?.total_messaging_connection || 0),
                cost_per_whatsapp_conversation: 0,
                cost_per_whatsapp_new_contact: 0,
                cost_per_whatsapp_contact: 0
            };

            // Calcular custos de WhatsApp
            if (dailyRecord.whatsapp_conversations_started > 0) {
                dailyRecord.cost_per_whatsapp_conversation = dailyRecord.spend / dailyRecord.whatsapp_conversations_started;
            }
            if (dailyRecord.whatsapp_new_contacts > 0) {
                dailyRecord.cost_per_whatsapp_new_contact = dailyRecord.spend / dailyRecord.whatsapp_new_contacts;
            }
            if (dailyRecord.whatsapp_contacts > 0) {
                dailyRecord.cost_per_whatsapp_contact = dailyRecord.spend / dailyRecord.whatsapp_contacts;
            }

            // Upsert
            const existing = await base44.asServiceRole.entities.MetricsDaily.filter({
                unit_id: unit_id,
                platform_id: platform_id,
                date: date
            });

            if (existing.length > 0) {
                await base44.asServiceRole.entities.MetricsDaily.update(existing[0].id, dailyRecord);
            } else {
                await base44.asServiceRole.entities.MetricsDaily.create(dailyRecord);
            }
            processedMetrics++;

            // Também salvar em MetricsAccountLevel para preservar reach único
            const accountRecord = {
                unit_id: unit_id,
                platform_id: platform_id,
                date: date,
                account_id: integration.account_reference || 'unknown',
                currency: 'BRL',
                spend: dailyRecord.spend,
                impressions: dailyRecord.impressions,
                reach: dailyRecord.reach,
                clicks: dailyRecord.clicks,
                link_clicks: dailyRecord.link_clicks,
                impressions_facebook: 0,
                reach_facebook: 0,
                impressions_instagram: 0,
                reach_instagram: 0,
                whatsapp_conversations_started: dailyRecord.whatsapp_conversations_started,
                whatsapp_new_contacts: dailyRecord.whatsapp_new_contacts,
                whatsapp_total_contacts: dailyRecord.whatsapp_contacts,
                cost_per_whatsapp_conversation: dailyRecord.cost_per_whatsapp_conversation,
                cost_per_whatsapp_new_contact: dailyRecord.cost_per_whatsapp_new_contact,
                actions: [],
                cost_per_action_type: []
            };

            const existingAccount = await base44.asServiceRole.entities.MetricsAccountLevel.filter({
                unit_id: unit_id,
                platform_id: platform_id,
                date: date
            });

            if (existingAccount.length > 0) {
                await base44.asServiceRole.entities.MetricsAccountLevel.update(existingAccount[0].id, accountRecord);
            } else {
                await base44.asServiceRole.entities.MetricsAccountLevel.create(accountRecord);
            }
        }

        // 2. Processar métricas de anúncios (metrics_ads)
        for (const ad of metrics_ads) {
            const { 
                date, 
                campaign_id, 
                campaign_name, 
                adset_id, 
                adset_name, 
                ad_id, 
                ad_name,
                objective,
                buying_type,
                spend, 
                impressions, 
                reach, 
                clicks, 
                link_clicks,
                ctr,
                cpc,
                cpm,
                whatsapp
            } = ad;
            
            if (!date) {
                console.warn('⚠️ Ad sem date, pulando:', ad);
                continue;
            }

            // Salvar campanha
            if (campaign_id) {
                const campaignRecord = {
                    unit_id: unit_id,
                    platform_id: platform_id,
                    date: date,
                    entity_level: 'campaign',
                    entity_id: campaign_id,
                    entity_name: campaign_name || 'Unknown Campaign',
                    status: 'active',
                    spend: parseFloat(spend || 0),
                    impressions: parseInt(impressions || 0),
                    clicks: parseInt(clicks || 0),
                    results: parseInt(link_clicks || 0),
                    cpr: parseFloat(cpc || 0),
                    extras: {
                        objective: objective,
                        buying_type: buying_type,
                        reach: reach,
                        whatsapp: whatsapp || {}
                    }
                };

                const existingCampaign = await base44.asServiceRole.entities.MetricsEntity.filter({
                    unit_id: unit_id,
                    platform_id: platform_id,
                    date: date,
                    entity_level: 'campaign',
                    entity_id: campaign_id
                });

                if (existingCampaign.length > 0) {
                    await base44.asServiceRole.entities.MetricsEntity.update(existingCampaign[0].id, campaignRecord);
                } else {
                    await base44.asServiceRole.entities.MetricsEntity.create(campaignRecord);
                }
                processedAds++;
            }

            // Salvar adset
            if (adset_id) {
                const adsetRecord = {
                    unit_id: unit_id,
                    platform_id: platform_id,
                    date: date,
                    entity_level: 'adset',
                    entity_id: adset_id,
                    entity_name: adset_name || 'Unknown AdSet',
                    status: 'active',
                    spend: parseFloat(spend || 0),
                    impressions: parseInt(impressions || 0),
                    clicks: parseInt(clicks || 0),
                    results: parseInt(link_clicks || 0),
                    cpr: parseFloat(cpc || 0),
                    extras: {
                        reach: reach,
                        whatsapp: whatsapp || {}
                    }
                };

                const existingAdset = await base44.asServiceRole.entities.MetricsEntity.filter({
                    unit_id: unit_id,
                    platform_id: platform_id,
                    date: date,
                    entity_level: 'adset',
                    entity_id: adset_id
                });

                if (existingAdset.length > 0) {
                    await base44.asServiceRole.entities.MetricsEntity.update(existingAdset[0].id, adsetRecord);
                } else {
                    await base44.asServiceRole.entities.MetricsEntity.create(adsetRecord);
                }
                processedAds++;
            }

            // Salvar ad
            if (ad_id) {
                const adRecord = {
                    unit_id: unit_id,
                    platform_id: platform_id,
                    date: date,
                    entity_level: 'ad',
                    entity_id: ad_id,
                    entity_name: ad_name || 'Unknown Ad',
                    status: 'active',
                    spend: parseFloat(spend || 0),
                    impressions: parseInt(impressions || 0),
                    clicks: parseInt(clicks || 0),
                    results: parseInt(link_clicks || 0),
                    cpr: parseFloat(cpc || 0),
                    extras: {
                        reach: reach,
                        ctr: ctr,
                        cpc: cpc,
                        cpm: cpm,
                        whatsapp: whatsapp || {}
                    }
                };

                const existingAd = await base44.asServiceRole.entities.MetricsEntity.filter({
                    unit_id: unit_id,
                    platform_id: platform_id,
                    date: date,
                    entity_level: 'ad',
                    entity_id: ad_id
                });

                if (existingAd.length > 0) {
                    await base44.asServiceRole.entities.MetricsEntity.update(existingAd[0].id, adRecord);
                } else {
                    await base44.asServiceRole.entities.MetricsEntity.create(adRecord);
                }
                processedAds++;
            }
        }

        // 3. Processar criativos
        for (const creative of creatives) {
            const { 
                ad_id, 
                creative_name, 
                creative_thumbnail_url, 
                creative_image_url,
                video_id,
                best_thumbnail_url
            } = creative;
            
            if (!ad_id) {
                console.warn('⚠️ Criativo sem ad_id, pulando:', creative);
                continue;
            }

            const creativeRecord = {
                unit_id: unit_id,
                platform_id: platform_id,
                ad_id: ad_id,
                ad_name: creative_name || ad_id,
                creative_type: video_id ? 'video' : 'image',
                thumbnail_url: creative_thumbnail_url || best_thumbnail_url || creative_image_url,
                media_url: creative_image_url || creative_thumbnail_url,
                spend: 0,
                impressions: 0,
                clicks: 0,
                results: 0
            };

            const existingCreative = await base44.asServiceRole.entities.Creative.filter({
                unit_id: unit_id,
                platform_id: platform_id,
                ad_id: ad_id
            });

            if (existingCreative.length > 0) {
                await base44.asServiceRole.entities.Creative.update(existingCreative[0].id, creativeRecord);
            } else {
                await base44.asServiceRole.entities.Creative.create(creativeRecord);
            }
            processedCreatives++;
        }

        // 4. Processar vídeos
        for (const video of videos) {
            const { 
                video_id, 
                video_length, 
                video_title, 
                video_permalink, 
                video_thumbnail_url 
            } = video;
            
            if (!video_id) {
                console.warn('⚠️ Vídeo sem video_id, pulando:', video);
                continue;
            }

            const videoRecord = {
                unit_id: unit_id,
                platform_id: platform_id,
                video_id: video_id,
                video_length: parseInt(video_length || 0),
                video_title: video_title || '',
                video_permalink: video_permalink || '',
                video_thumbnail_url: video_thumbnail_url || ''
            };

            const existingVideo = await base44.asServiceRole.entities.Video.filter({
                unit_id: unit_id,
                platform_id: platform_id,
                video_id: video_id
            });

            if (existingVideo.length > 0) {
                await base44.asServiceRole.entities.Video.update(existingVideo[0].id, videoRecord);
            } else {
                await base44.asServiceRole.entities.Video.create(videoRecord);
            }
            processedVideos++;
        }

        // Atualizar execution log com sucesso
        if (executionLogId) {
            await base44.asServiceRole.entities.ExecutionLog.update(executionLogId, {
                status: 'success',
                metrics_processed: processedMetrics,
                ads_processed: processedAds,
                creatives_processed: processedCreatives,
                videos_processed: processedVideos,
                completed_at: new Date().toISOString()
            });
        }
        
        return Response.json({
            success: true,
            message: `Dados processados: ${processedMetrics} métricas, ${processedAds} anúncios, ${processedCreatives} criativos, ${processedVideos} vídeos`,
            processed: { 
                metrics: processedMetrics,
                ads: processedAds,
                creatives: processedCreatives,
                videos: processedVideos
            }
        });

    } catch (error) {
        console.error('❌ ERRO ao processar webhook:', error);
        
        if (executionLogId) {
            try {
                const base44 = createClientFromRequest(req);
                await base44.asServiceRole.entities.ExecutionLog.update(executionLogId, {
                    status: 'error',
                    error_message: error.message,
                    completed_at: new Date().toISOString()
                });
            } catch (logError) {
                console.error('Erro ao atualizar log:', logError);
            }
        }
        
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});