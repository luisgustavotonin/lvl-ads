import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper para obter data/hora atual em Brasília
function getBrasiliaDate() {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return brasiliaTime;
}

Deno.serve(async (req) => {
    let executionLogId = null;
    
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse JSON body e normalizar payload
        const body = await req.json();
        const payload = body.payload ?? body.data ?? body;
        
        const { 
            integration_id, 
            secret_token, 
            provider,
            unit_id,
            ad_account_id,
            date_mode,
            since,
            until,
            timezone,
            execution_log_id,
            metrics = {},
            ads = [],
            creatives = [],
            videos = []
        } = payload;
        
        executionLogId = execution_log_id;
        
        console.log('🔔 WEBHOOK RECEBIDO:', JSON.stringify({
            integration_id,
            unit_id,
            ad_account_id,
            provider,
            date_mode,
            since,
            until,
            daily_summary_count: metrics.daily_summary?.length || 0,
            ads_count: ads.length,
            creatives_count: creatives.length,
            videos_count: videos.length,
            execution_log_id
        }, null, 2));

        // Validação obrigatória
        if (!integration_id || !unit_id || !provider) {
            const errorMsg = 'integration_id, unit_id e provider são obrigatórios';
            if (executionLogId) {
                await base44.asServiceRole.entities.ExecutionLog.update(executionLogId, {
                    status: 'error',
                    error_message: errorMsg,
                    completed_at: getBrasiliaDate().toISOString()
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
                    completed_at: getBrasiliaDate().toISOString()
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
                    completed_at: getBrasiliaDate().toISOString()
                });
            }
            return Response.json({ 
                success: false, 
                error: errorMsg 
            }, { status: 403 });
        }

        // Validar provider
        if (provider !== 'meta') {
            const errorMsg = 'Apenas provider "meta" é suportado no momento';
            if (executionLogId) {
                await base44.asServiceRole.entities.ExecutionLog.update(executionLogId, {
                    status: 'error',
                    error_message: errorMsg,
                    completed_at: getBrasiliaDate().toISOString()
                });
            }
            return Response.json({ 
                success: false, 
                error: errorMsg 
            }, { status: 400 });
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

        // 1. Processar métricas diárias (metrics.daily_summary)
        const dailySummary = metrics.daily_summary || [];
        for (const metric of dailySummary) {
            const { date, spend, impressions, reach, clicks, link_clicks, whatsapp } = metric;
            
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
                ctr: 0,
                cpc: 0,
                cpm: 0,
                whatsapp_conversations_started: parseInt(whatsapp?.conversations_started_7d || 0),
                whatsapp_new_contacts: parseInt(whatsapp?.messaging_first_reply || 0),
                whatsapp_contacts: parseInt(whatsapp?.total_messaging_connection || 0),
                cost_per_whatsapp_conversation: parseFloat(whatsapp?.cost_per_conversation || 0),
                cost_per_whatsapp_new_contact: parseFloat(whatsapp?.cost_per_new_contact || 0),
                cost_per_whatsapp_contact: parseFloat(whatsapp?.cost_per_total_contact || 0)
            };

            // Calcular CTR, CPC, CPM
            if (dailyRecord.impressions > 0) {
                dailyRecord.ctr = (dailyRecord.clicks / dailyRecord.impressions) * 100;
                dailyRecord.cpm = (dailyRecord.spend / dailyRecord.impressions) * 1000;
            }
            if (dailyRecord.clicks > 0) {
                dailyRecord.cpc = dailyRecord.spend / dailyRecord.clicks;
            }

            // Upsert MetricsDaily
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

            // Também salvar em MetricsAccountLevel
            const accountRecord = {
                unit_id: unit_id,
                platform_id: platform_id,
                date: date,
                account_id: ad_account_id || integration.account_reference || 'unknown',
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
                date: date,
                account_id: accountRecord.account_id
            });

            if (existingAccount.length > 0) {
                await base44.asServiceRole.entities.MetricsAccountLevel.update(existingAccount[0].id, accountRecord);
            } else {
                await base44.asServiceRole.entities.MetricsAccountLevel.create(accountRecord);
            }
        }

        // 2. Processar anúncios (ads)
        for (const ad of ads) {
            const { 
                date_start,
                campaign_id, 
                campaign_name, 
                adset_id, 
                adset_name, 
                id: ad_id, 
                name: ad_name,
                objective,
                buying_type,
                spend, 
                impressions, 
                reach, 
                clicks,
                actions = []
            } = ad;
            
            const date = date_start;
            
            if (!date) {
                console.warn('⚠️ Ad sem date_start, pulando:', ad);
                continue;
            }

            // Extrair link_clicks das actions
            let link_clicks = 0;
            const linkClickAction = actions.find(a => a.action_type === 'link_click');
            if (linkClickAction) {
                link_clicks = parseInt(linkClickAction.value || 0);
            }

            const spendValue = parseFloat(spend || 0);
            const impressionsValue = parseInt(impressions || 0);
            const clicksValue = parseInt(clicks || 0);
            const linkClicksValue = parseInt(link_clicks || 0);
            
            // Calcular métricas
            let cpc = 0;
            let ctr = 0;
            let cpm = 0;
            
            if (clicksValue > 0) {
                cpc = spendValue / clicksValue;
            }
            if (impressionsValue > 0) {
                ctr = (clicksValue / impressionsValue) * 100;
                cpm = (spendValue / impressionsValue) * 1000;
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
                    spend: spendValue,
                    impressions: impressionsValue,
                    clicks: clicksValue,
                    results: linkClicksValue,
                    cpr: linkClicksValue > 0 ? spendValue / linkClicksValue : 0,
                    extras: {
                        objective: objective,
                        buying_type: buying_type,
                        reach: reach,
                        ctr: ctr,
                        cpc: cpc,
                        cpm: cpm
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
                    spend: spendValue,
                    impressions: impressionsValue,
                    clicks: clicksValue,
                    results: linkClicksValue,
                    cpr: linkClicksValue > 0 ? spendValue / linkClicksValue : 0,
                    extras: {
                        reach: reach,
                        ctr: ctr,
                        cpc: cpc,
                        cpm: cpm
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
                    spend: spendValue,
                    impressions: impressionsValue,
                    clicks: clicksValue,
                    results: linkClicksValue,
                    cpr: linkClicksValue > 0 ? spendValue / linkClicksValue : 0,
                    extras: {
                        reach: reach,
                        ctr: ctr,
                        cpc: cpc,
                        cpm: cpm
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
                ad_name,
                thumbnail_url,
                image_url,
                video_id
            } = creative;
            
            if (!ad_id) {
                console.warn('⚠️ Criativo sem ad_id, pulando:', creative);
                continue;
            }

            const creativeRecord = {
                unit_id: unit_id,
                platform_id: platform_id,
                ad_id: ad_id,
                ad_name: ad_name || ad_id,
                creative_type: video_id ? 'video' : 'image',
                thumbnail_url: thumbnail_url || image_url,
                media_url: image_url || thumbnail_url,
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
                length_seconds, 
                title, 
                permalink_url, 
                picture 
            } = video;
            
            if (!video_id) {
                console.warn('⚠️ Vídeo sem video_id, pulando:', video);
                continue;
            }

            const videoRecord = {
                unit_id: unit_id,
                platform_id: platform_id,
                video_id: video_id,
                video_length: parseInt(length_seconds || 0),
                video_title: title || '',
                video_permalink: permalink_url || '',
                video_thumbnail_url: picture || ''
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
                    completed_at: getBrasiliaDate().toISOString()
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