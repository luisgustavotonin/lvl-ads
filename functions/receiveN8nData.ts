import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Valida e normaliza data para formato YYYY-MM-DD (SEM timezone)
function normalizeDateString(dateInput) {
    if (!dateInput) return null;
    
    // Se for string, pegar apenas YYYY-MM-DD (ignorar hora/timezone)
    const dateStr = String(dateInput);
    const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
    
    if (!match) {
        throw new Error(`Data inválida: ${dateStr}. Formato esperado: YYYY-MM-DD`);
    }
    
    return match[1]; // Retorna somente YYYY-MM-DD
}

// Helper para obter data/hora atual em Brasília
function getBrasiliaDate() {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return brasiliaTime;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse JSON body e normalizar payload
        let body = await req.json();
        
        // Se vier como array, pegar o primeiro elemento
        if (Array.isArray(body) && body.length > 0) {
            body = body[0];
        }
        
        const payload = body.payload ?? body.data ?? body;
        
        const { 
            run_id,
            integration_id, 
            secret_token, 
            account_id,
            unit_id,
            provider,
            generated_at,
            batch_index,
            batch_total,
            ads_count,
            approx_chars,
            ads = []
        } = payload;
        
        console.log('🔔 WEBHOOK RECEBIDO (BATCH):', JSON.stringify({
            run_id,
            integration_id,
            unit_id,
            account_id,
            provider,
            batch_index,
            batch_total,
            ads_count,
            approx_chars,
            generated_at
        }, null, 2));

        // Validação obrigatória
        if (!integration_id || !unit_id || !provider) {
            return Response.json({ 
                ok: false,
                error: 'integration_id, unit_id e provider são obrigatórios'
            }, { status: 400 });
        }

        // IDEMPOTÊNCIA: Verificar se este batch já foi processado
        if (run_id && batch_index !== undefined) {
            const existingLog = await base44.asServiceRole.entities.WebhookLog.filter({
                integration_id: integration_id,
                source: 'n8n',
                'payload_received.run_id': run_id,
                'payload_received.batch_index': batch_index
            });

            if (existingLog.length > 0) {
                console.log(`⚠️ Batch duplicado ignorado: run_id=${run_id}, batch=${batch_index}`);
                return Response.json({
                    ok: true,
                    duplicate: true,
                    message: 'Batch já processado anteriormente',
                    run_id: run_id,
                    batch_index: batch_index
                });
            }
        }

        // Buscar integração para validar o secret token
        const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
        
        if (!integration) {
            return Response.json({ 
                ok: false,
                error: 'Integração não encontrada'
            }, { status: 404 });
        }

        // Validar secret token (obrigatório)
        const expectedToken = integration.settings?.n8n_secret_token;
        if (!secret_token || secret_token !== expectedToken) {
            return Response.json({ 
                ok: false,
                error: 'Token de segurança inválido ou ausente'
            }, { status: 401 });
        }

        // Validar provider
        if (provider !== 'meta') {
            return Response.json({ 
                ok: false,
                error: 'Apenas provider "meta" é suportado no momento'
            }, { status: 400 });
        }

        // Função para garantir que o valor seja sempre um objeto
        const ensureObject = (value) => {
            if (Array.isArray(value)) {
                return value.length > 0 ? Object.assign({}, ...value) : {};
            }
            return typeof value === 'object' && value !== null ? value : {};
        };

        // Processar anúncios com UPSERT (idempotência)
        let adsUpserted = 0;

        for (const ad of ads) {
            const { 
                ad_id, 
                date: rawDate,
                campaign_id, 
                campaign_name, 
                adset_id, 
                adset_name, 
                ad_name,
                ad_effective_status,
                creative_id,
                creative_thumbnail_url,
                metrics = {},
                breakdowns = {}
            } = ad;
            
            if (!ad_id || !rawDate) {
                console.warn('⚠️ Ad sem ad_id ou date, pulando:', ad);
                continue;
            }

            // CRÍTICO: Normalizar data sem timezone (YYYY-MM-DD apenas)
            let date;
            try {
                date = normalizeDateString(rawDate);
                
                // Guard anti-bug: verificar se a data normalizada é válida
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                    console.error(`❌ Data no formato incorreto após normalização: ${date} (ad_id: ${ad_id})`);
                    continue;
                }
                
                // Log se a data foi alterada pela normalização
                if (date !== rawDate) {
                    console.log(`ℹ️ Data normalizada: ${rawDate} → ${date} (ad_id: ${ad_id})`);
                }
            } catch (error) {
                console.error(`❌ Erro ao normalizar data para ad_id ${ad_id}:`, error.message);
                continue;
            }

            // N8n já envia TUDO calculado - apenas pegar os valores
            const adRecord = {
                unit_id: unit_id,
                account_id: account_id,
                date: date,
                ad_id: ad_id,
                ad_name: ad_name || ad_id,
                ad_effective_status: ad_effective_status || 'UNKNOWN',
                creative_id: creative_id || '',
                creative_thumbnail_url: creative_thumbnail_url || '',
                adset_id: adset_id || '',
                adset_name: adset_name || '',
                campaign_id: campaign_id || '',
                campaign_name: campaign_name || '',
                spend: parseFloat(metrics.spend || 0),
                impressions: parseInt(metrics.impressions || 0),
                reach: parseInt(metrics.reach || 0),
                frequency: parseFloat(metrics.frequency || 0),
                clicks: parseInt(metrics.clicks || 0),
                link_clicks: parseInt(metrics.link_clicks || 0),
                ctr_link: parseFloat(metrics.ctr_link || 0),
                cpc_link: parseFloat(metrics.cpc_link || 0),
                cpm: parseFloat(metrics.cpm || 0),
                wa_conversations_started_7d: parseInt(metrics.wa_conversations_started_7d || 0),
                wa_total_messaging_connection: parseInt(metrics.wa_total_messaging_connection || 0),
                wa_messaging_first_reply: parseInt(metrics.wa_messaging_first_reply || 0),
                cost_per_conversation: parseFloat(metrics.cost_per_conversation || 0),
                cost_per_total_contact: parseFloat(metrics.cost_per_total_contact || 0),
                cost_per_first_reply: parseFloat(metrics.cost_per_first_reply || 0),
                demographics_json: ensureObject(breakdowns.demographics),
                placement_json: ensureObject(breakdowns.placement),
                devices_json: ensureObject(breakdowns.devices),
                run_id: run_id || ''
            };

            // UPSERT: buscar existente por chave única (unit_id, account_id, ad_id, date)
            const existing = await base44.asServiceRole.entities.MetaAdDaily.filter({
                unit_id: unit_id,
                account_id: account_id,
                ad_id: ad_id,
                date: date
            });

            if (existing.length > 0) {
                // UPDATE
                await base44.asServiceRole.entities.MetaAdDaily.update(existing[0].id, adRecord);
                console.log(`✅ Updated ad ${ad_id} for date ${date}`);
            } else {
                // INSERT
                await base44.asServiceRole.entities.MetaAdDaily.create(adRecord);
                console.log(`✅ Inserted ad ${ad_id} for date ${date}`);
            }
            
            adsUpserted++;
        }

        // Log do webhook
        await base44.asServiceRole.entities.WebhookLog.create({
            integration_id: integration_id,
            source: 'n8n',
            status: 'success',
            payload_received: {
                run_id,
                batch_index,
                batch_total,
                ads_count,
                generated_at
            },
            records_processed: {
                ads_upserted: adsUpserted
            }
        });

        // Se for o último batch, agregar dados automaticamente
        if (batch_index === batch_total) {
            console.log('🔄 Último batch recebido, iniciando agregação automática...');
            
            try {
                // Chamar função de agregação
                const aggregationResult = await base44.asServiceRole.functions.invoke('aggregateMetaAdDaily', {
                    unit_id: unit_id
                });
                
                console.log('✅ Agregação concluída:', aggregationResult);
            } catch (aggError) {
                console.error('⚠️ Erro na agregação (não fatal):', aggError.message);
                // Não falha o webhook se a agregação falhar
            }
        }

        return Response.json({
            ok: true,
            run_id: run_id,
            batch_index: batch_index,
            batch_total: batch_total,
            ads_received: ads.length,
            ads_upserted: adsUpserted,
            processed_at: getBrasiliaDate().toISOString()
        });

    } catch (error) {
        console.error('❌ ERRO ao processar webhook:', error);
        
        return Response.json({ 
            ok: false,
            error: error.message 
        }, { status: 500 });
    }
});