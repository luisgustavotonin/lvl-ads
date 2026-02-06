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