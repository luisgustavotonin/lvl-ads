import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Webhook público - N8n envia sem autenticação de usuário
        // Validamos com um secret token
        const { data, secret_token, integration_id } = await req.json();

        if (!data || !integration_id) {
            return Response.json({ 
                success: false, 
                error: 'data e integration_id são obrigatórios' 
            }, { status: 400 });
        }

        // Buscar integração para validar o secret token
        const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
        
        if (!integration) {
            return Response.json({ 
                success: false, 
                error: 'Integração não encontrada' 
            }, { status: 404 });
        }

        // Validar secret token
        const expectedToken = integration.settings?.n8n_secret_token;
        if (!expectedToken || secret_token !== expectedToken) {
            return Response.json({ 
                success: false, 
                error: 'Token de segurança inválido' 
            }, { status: 403 });
        }

        // Processar os dados recebidos
        // Espera-se um array de objetos com estrutura:
        // [{ date: "2024-01-01", metrics: {...}, campaign_data: [...], adset_data: [...], ad_data: [...] }]
        
        let processedDays = 0;
        let totalMetrics = 0;
        let totalEntities = 0;

        for (const dayData of data) {
            const { date, metrics, campaign_data, adset_data, ad_data } = dayData;

            if (!date) {
                console.warn('Data sem campo "date", pulando:', dayData);
                continue;
            }

            // 1. Salvar métricas diárias agregadas
            if (metrics) {
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

        return Response.json({
            success: true,
            message: `Dados processados com sucesso: ${processedDays} dia(s), ${totalMetrics} métricas, ${totalEntities} entidades`,
            processed: {
                days: processedDays,
                metrics: totalMetrics,
                entities: totalEntities
            }
        });

    } catch (error) {
        console.error('Erro ao processar dados do N8n:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});