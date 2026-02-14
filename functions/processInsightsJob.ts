import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Processa um job de INSIGHTS
 * Coleta dados de um módulo específico (core, platform, age, gender, device)
 * Armazena em formato long na tabela MetaInsightsStaging
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { job_id, unit_id, module, date_start, date_end } = await req.json();

        if (!unit_id || !module || !date_start || !date_end) {
            return Response.json({ 
                error: 'Parâmetros obrigatórios: unit_id, module, date_start, date_end' 
            }, { status: 400 });
        }

        console.log(`🔄 Processando INSIGHTS - Unit: ${unit_id}, Module: ${module}`);

        // Buscar unidade para pegar account_id e token
        const unit = await base44.asServiceRole.entities.Unit.get(unit_id);
        if (!unit || !unit.account_id) {
            throw new Error('Unidade não encontrada ou sem account_id');
        }

        // Buscar integração Meta da unidade para pegar token
        const integrations = await base44.asServiceRole.entities.Integration.filter({
            unit_id: unit_id,
            platform_id: 'META'
        });

        if (integrations.length === 0) {
            throw new Error('Integração Meta não encontrada');
        }

        const integration = integrations[0];
        const accessToken = integration.settings?.access_token;
        
        if (!accessToken) {
            throw new Error('Access token não encontrado');
        }

        // Mapear módulo para breakdown da API
        const breakdownMap = {
            core: null, // Sem breakdown
            platform: 'publisher_platform',
            age: 'age',
            gender: 'gender',
            device: 'impression_device'
        };

        const breakdown = breakdownMap[module];

        // Construir URL da API
        const baseUrl = `https://graph.facebook.com/v22.0/${unit.account_id}/insights`;
        const fields = [
            'spend',
            'impressions',
            'reach',
            'frequency',
            'clicks',
            'cpc',
            'cpm',
            'ctr',
            'actions',
            'action_values'
        ].join(',');

        const params = new URLSearchParams({
            access_token: accessToken,
            level: 'ad',
            time_increment: '1',
            date_preset: 'maximum',
            fields: fields,
            limit: '1000',
            filtering: JSON.stringify([{
                field: 'ad.effective_status',
                operator: 'IN',
                value: ['ACTIVE', 'PAUSED']
            }])
        });

        if (breakdown) {
            params.append('breakdowns', breakdown);
        }

        if (date_start && date_end) {
            params.set('time_range', JSON.stringify({
                since: date_start,
                until: date_end
            }));
            params.delete('date_preset');
        }

        // Fazer chamada à API com paginação
        let url = `${baseUrl}?${params.toString()}`;
        let recordsProcessed = 0;
        const breakdownKey = breakdown || 'none';

        while (url) {
            console.log(`📊 Buscando insights - ${module}...`);
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Meta API Error: ${response.status} - ${errorData}`);
            }

            const data = await response.json();

            // Processar cada registro
            for (const insight of (data.data || [])) {
                const adId = insight.ad_id;
                const dateValue = insight.date_start; // YYYY-MM-DD

                // Determinar breakdown_value
                let breakdownValue = 'all';
                if (breakdown) {
                    breakdownValue = insight[breakdown] || 'unknown';
                }

                // Preparar registro staging
                const stagingRecord = {
                    unit_id: unit_id,
                    day: dateValue,
                    ad_id: adId,
                    module: module,
                    breakdown_key: breakdownKey,
                    breakdown_value: breakdownValue,
                    spend: parseFloat(insight.spend || 0),
                    impressions: parseInt(insight.impressions || 0),
                    reach: parseInt(insight.reach || 0),
                    frequency: parseFloat(insight.frequency || 0),
                    clicks: parseInt(insight.clicks || 0),
                    cpc: parseFloat(insight.cpc || 0),
                    cpm: parseFloat(insight.cpm || 0),
                    ctr: parseFloat(insight.ctr || 0),
                    actions: insight.actions || {},
                    action_values: insight.action_values || {},
                    job_id: job_id
                };

                // UPSERT: Verificar se já existe
                const existing = await base44.asServiceRole.entities.MetaInsightsStaging.filter({
                    unit_id: unit_id,
                    day: dateValue,
                    ad_id: adId,
                    module: module,
                    breakdown_value: breakdownValue
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaInsightsStaging.update(
                        existing[0].id,
                        stagingRecord
                    );
                } else {
                    await base44.asServiceRole.entities.MetaInsightsStaging.create(stagingRecord);
                }

                recordsProcessed++;
            }

            // Próxima página
            url = data.paging?.next || null;
        }

        console.log(`✅ INSIGHTS processado - ${module}: ${recordsProcessed} registros`);

        return Response.json({
            ok: true,
            job_id,
            module,
            records_processed: recordsProcessed
        });

    } catch (error) {
        console.error('❌ Erro ao processar INSIGHTS:', error);
        return Response.json({ 
            ok: false,
            error: error.message 
        }, { status: 500 });
    }
});