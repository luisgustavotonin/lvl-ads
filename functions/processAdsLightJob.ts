import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Processa um job de ADS_LIGHT
 * Coleta apenas dimensões básicas dos anúncios (sem métricas)
 * Armazena na tabela MetaAdsDim
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { job_id, unit_id, date_start, date_end } = await req.json();

        if (!unit_id) {
            return Response.json({ 
                error: 'unit_id é obrigatório' 
            }, { status: 400 });
        }

        console.log(`🔄 Processando ADS_LIGHT - Unit: ${unit_id}`);

        // Buscar unidade
        const unit = await base44.asServiceRole.entities.Unit.get(unit_id);
        if (!unit || !unit.account_id) {
            throw new Error('Unidade não encontrada');
        }

        // Buscar integração Meta
        const integrations = await base44.asServiceRole.entities.Integration.filter({
            unit_id: unit_id,
            platform_id: 'META'
        });

        if (integrations.length === 0) {
            throw new Error('Integração Meta não encontrada');
        }

        const accessToken = integrations[0].settings?.access_token;
        if (!accessToken) {
            throw new Error('Access token não encontrado');
        }

        // Buscar anúncios da conta
        const baseUrl = `https://graph.facebook.com/v22.0/${unit.account_id}/ads`;
        const fields = [
            'id',
            'name',
            'effective_status',
            'campaign_id',
            'campaign{id,name}',
            'adset_id',
            'adset{id,name}',
            'creative{id}'
        ].join(',');

        const params = new URLSearchParams({
            access_token: accessToken,
            fields: fields,
            limit: '1000'
        });

        let url = `${baseUrl}?${params.toString()}`;
        let recordsProcessed = 0;

        while (url) {
            console.log(`📊 Buscando ads...`);
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Meta API Error: ${response.status} - ${errorData}`);
            }

            const data = await response.json();

            // Processar cada anúncio
            for (const ad of (data.data || [])) {
                const adRecord = {
                    unit_id: unit_id,
                    ad_id: ad.id,
                    ad_name: ad.name || ad.id,
                    ad_status: ad.effective_status,
                    campaign_id: ad.campaign?.id || '',
                    campaign_name: ad.campaign?.name || '',
                    adset_id: ad.adset?.id || '',
                    adset_name: ad.adset?.name || '',
                    creative_id: ad.creative?.id || '',
                    account_id: unit.account_id,
                    last_updated: new Date().toISOString()
                };

                // UPSERT
                const existing = await base44.asServiceRole.entities.MetaAdsDim.filter({
                    unit_id: unit_id,
                    ad_id: ad.id
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaAdsDim.update(
                        existing[0].id,
                        adRecord
                    );
                } else {
                    await base44.asServiceRole.entities.MetaAdsDim.create(adRecord);
                }

                recordsProcessed++;
            }

            url = data.paging?.next || null;
        }

        console.log(`✅ ADS_LIGHT processado: ${recordsProcessed} anúncios`);

        return Response.json({
            ok: true,
            job_id,
            records_processed: recordsProcessed
        });

    } catch (error) {
        console.error('❌ Erro ao processar ADS_LIGHT:', error);
        return Response.json({ 
            ok: false,
            error: error.message 
        }, { status: 500 });
    }
});