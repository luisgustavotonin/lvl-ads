import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Processa um job de CREATIVE_DELTA
 * Atualiza apenas criativos que mudaram ou são novos
 * Armazena na tabela MetaCreativeDim
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { job_id, unit_id } = await req.json();

        if (!unit_id) {
            return Response.json({ 
                error: 'unit_id é obrigatório' 
            }, { status: 400 });
        }

        console.log(`🔄 Processando CREATIVE_DELTA - Unit: ${unit_id}`);

        // Buscar todos os creative_ids da MetaAdsDim para esta unidade
        const ads = await base44.asServiceRole.entities.MetaAdsDim.filter({
            unit_id: unit_id
        });

        const creativeIds = [...new Set(ads.map(ad => ad.creative_id).filter(Boolean))];
        
        if (creativeIds.length === 0) {
            return Response.json({
                ok: true,
                message: 'Nenhum creative_id encontrado',
                records_processed: 0
            });
        }

        console.log(`📊 Encontrados ${creativeIds.length} creative IDs únicos`);

        // Buscar unidade para token
        const unit = await base44.asServiceRole.entities.Unit.get(unit_id);
        const integrations = await base44.asServiceRole.entities.Integration.filter({
            unit_id: unit_id,
            platform_id: 'META'
        });

        const accessToken = integrations[0]?.settings?.access_token;
        if (!accessToken) {
            throw new Error('Access token não encontrado');
        }

        let recordsProcessed = 0;

        // Processar cada creative (em lotes)
        for (const creativeId of creativeIds) {
            try {
                const url = `https://graph.facebook.com/v22.0/${creativeId}`;
                const params = new URLSearchParams({
                    access_token: accessToken,
                    fields: 'title,body,link_url,call_to_action_type,thumbnail_url,asset_feed_spec'
                });

                const response = await fetch(`${url}?${params.toString()}`);
                
                if (!response.ok) {
                    console.warn(`⚠️ Erro ao buscar creative ${creativeId}: ${response.status}`);
                    continue;
                }

                const creative = await response.json();

                const creativeRecord = {
                    creative_id: creativeId,
                    headline: creative.title || '',
                    body: creative.body || '',
                    link_url: creative.link_url || '',
                    call_to_action: creative.call_to_action_type || '',
                    thumbnail_url: creative.thumbnail_url || '',
                    asset_spec: creative.asset_feed_spec || {},
                    last_updated: new Date().toISOString()
                };

                // UPSERT
                const existing = await base44.asServiceRole.entities.MetaCreativeDim.filter({
                    creative_id: creativeId
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.MetaCreativeDim.update(
                        existing[0].id,
                        creativeRecord
                    );
                } else {
                    await base44.asServiceRole.entities.MetaCreativeDim.create(creativeRecord);
                }

                recordsProcessed++;

            } catch (error) {
                console.error(`❌ Erro ao processar creative ${creativeId}:`, error.message);
            }
        }

        console.log(`✅ CREATIVE_DELTA processado: ${recordsProcessed} criativos`);

        return Response.json({
            ok: true,
            job_id,
            records_processed: recordsProcessed
        });

    } catch (error) {
        console.error('❌ Erro ao processar CREATIVE_DELTA:', error);
        return Response.json({ 
            ok: false,
            error: error.message 
        }, { status: 500 });
    }
});