import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function generateRequestId() {
    return crypto.randomUUID();
}

// Helper: Valida e normaliza data para formato YYYY-MM-DD (SEM timezone)
function normalizeDateString(dateInput) {
    if (!dateInput) return null;
    const dateStr = String(dateInput);
    const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) throw new Error(`Data inválida: ${dateStr}. Formato esperado: YYYY-MM-DD`);
    return match[1];
}

function getBrasiliaDate() {
    const now = new Date();
    return new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

Deno.serve(async (req) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    let diagnosticId = null;

    try {
        const base44 = createClientFromRequest(req);

        const bodyText = await req.text();
        let body = JSON.parse(bodyText);
        const requestSizeBytes = new TextEncoder().encode(bodyText).length;
        const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';

        if (Array.isArray(body) && body.length > 0) body = body[0];
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

        // Registrar diagnóstico
        const diagnostic = await base44.asServiceRole.entities.ApiDiagnostics.create({
            route: '/receiveN8nData',
            method: 'POST',
            status: 'iniciado',
            requestId,
            requestSizeBytes,
            clientIp,
            userAgent,
            source: 'n8n',
            eventId: run_id || null
        });
        diagnosticId = diagnostic.id;

        console.log('🔔 WEBHOOK RECEBIDO (BATCH):', JSON.stringify({
            run_id, integration_id, unit_id, account_id, provider,
            batch_index, batch_total, ads_count, approx_chars, generated_at, requestId
        }, null, 2));

        // Validação obrigatória
        if (!integration_id || !unit_id || !provider) {
            await base44.asServiceRole.entities.ApiDiagnostics.update(diagnosticId, {
                status: 'erro', httpStatusCode: 400,
                errorType: 'ValidationError',
                errorMessage: 'integration_id, unit_id e provider são obrigatórios',
                durationMs: Date.now() - startTime
            });
            return Response.json({ ok: false, error: 'integration_id, unit_id e provider são obrigatórios', requestId }, { status: 400 });
        }

        // ✅ CORREÇÃO 3: Validar run_id — deve existir na tabela Run (gerado pelo Base)
        if (run_id) {
            const existingRuns = await base44.asServiceRole.entities.Run.filter({ run_id, unit_id });
            if (existingRuns.length === 0) {
                console.warn(`⚠️ run_id ${run_id} não encontrado na tabela Run. Criando automaticamente para compatibilidade.`);
                // Criar Run automaticamente para não quebrar fluxo legado
                await base44.asServiceRole.entities.Run.create({
                    run_id,
                    unit_id,
                    platform: 'META',
                    status: 'receiving',
                    started_at_utc: new Date().toISOString(),
                    trigger_type: 'webhook',
                    metadata: { source: 'legacy_n8n_callback' }
                });
            } else {
                // Atualizar status para "receiving"
                await base44.asServiceRole.entities.Run.update(existingRuns[0].id, {
                    status: 'receiving'
                });
            }
        }

        // IDEMPOTÊNCIA: Verificar se este batch já foi processado
        if (run_id && batch_index !== undefined) {
            const existingLog = await base44.asServiceRole.entities.WebhookLog.filter({
                integration_id,
                source: 'n8n',
                'payload_received.run_id': run_id,
                'payload_received.batch_index': batch_index
            });
            if (existingLog.length > 0) {
                console.log(`⚠️ Batch duplicado ignorado: run_id=${run_id}, batch=${batch_index}`);
                await base44.asServiceRole.entities.ApiDiagnostics.update(diagnosticId, {
                    status: 'sucesso', httpStatusCode: 200,
                    durationMs: Date.now() - startTime, notes: 'Batch duplicado ignorado'
                });
                return Response.json({ ok: true, duplicate: true, message: 'Batch já processado anteriormente', run_id, batch_index, requestId });
            }
        }

        // Buscar integração e validar secret token
        const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
        if (!integration) {
            await base44.asServiceRole.entities.ApiDiagnostics.update(diagnosticId, {
                status: 'erro', httpStatusCode: 404,
                errorType: 'NotFoundError', errorMessage: 'Integração não encontrada',
                durationMs: Date.now() - startTime
            });
            return Response.json({ ok: false, error: 'Integração não encontrada', requestId }, { status: 404 });
        }

        const expectedToken = integration.settings?.n8n_secret_token;
        if (!secret_token || secret_token !== expectedToken) {
            await base44.asServiceRole.entities.ApiDiagnostics.update(diagnosticId, {
                status: 'erro', httpStatusCode: 401,
                errorType: 'AuthError', errorMessage: 'Token de segurança inválido ou ausente',
                durationMs: Date.now() - startTime
            });
            return Response.json({ ok: false, error: 'Token de segurança inválido ou ausente', requestId }, { status: 401 });
        }

        if (provider !== 'meta') {
            await base44.asServiceRole.entities.ApiDiagnostics.update(diagnosticId, {
                status: 'erro', httpStatusCode: 400,
                errorType: 'ValidationError', errorMessage: 'Apenas provider "meta" é suportado',
                durationMs: Date.now() - startTime
            });
            return Response.json({ ok: false, error: 'Apenas provider "meta" é suportado no momento', requestId }, { status: 400 });
        }

        const ensureObject = (value) => {
            if (Array.isArray(value)) return value.length > 0 ? Object.assign({}, ...value) : {};
            return typeof value === 'object' && value !== null ? value : {};
        };

        // ✅ CORREÇÃO 4: UPSERT com chave composta (run_id + ad_id + date)
        let adsUpserted = 0;

        for (const ad of ads) {
            const {
                ad_id,
                date: rawDate,
                campaign_id, campaign_name,
                adset_id, adset_name,
                ad_name, ad_effective_status,
                creative_id, creative_thumbnail_url,
                metrics = {},
                breakdowns = {}
            } = ad;

            if (!ad_id || !rawDate) {
                console.warn('⚠️ Ad sem ad_id ou date, pulando:', ad);
                continue;
            }

            let date;
            try {
                date = normalizeDateString(rawDate);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                    console.error(`❌ Data inválida após normalização: ${date} (ad_id: ${ad_id})`);
                    continue;
                }
            } catch (error) {
                console.error(`❌ Erro ao normalizar data para ad_id ${ad_id}:`, error.message);
                continue;
            }

            const adRecord = {
                unit_id, account_id, date,
                ad_id, ad_name: ad_name || ad_id,
                ad_effective_status: ad_effective_status || 'UNKNOWN',
                creative_id: creative_id || '',
                creative_thumbnail_url: creative_thumbnail_url || '',
                adset_id: adset_id || '', adset_name: adset_name || '',
                campaign_id: campaign_id || '', campaign_name: campaign_name || '',
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
                run_id: run_id || '',
                imported_at_utc: new Date().toISOString()
            };

            // UPSERT por chave composta: run_id + ad_id + date (idempotente dentro do mesmo run)
            const existing = await base44.asServiceRole.entities.MetaAdDaily.filter({
                unit_id, account_id, ad_id, date, run_id: run_id || ''
            });

            if (existing.length > 0) {
                await base44.asServiceRole.entities.MetaAdDaily.update(existing[0].id, adRecord);
            } else {
                await base44.asServiceRole.entities.MetaAdDaily.create(adRecord);
            }

            adsUpserted++;
        }

        // Log do webhook
        await base44.asServiceRole.entities.WebhookLog.create({
            integration_id,
            source: 'n8n',
            status: 'success',
            payload_received: { run_id, batch_index, batch_total, ads_count, generated_at },
            records_processed: { ads_upserted: adsUpserted }
        });

        // ✅ CORREÇÃO 2: Atualizar Run com status correto após receber dados
        const isLastBatch = batch_index !== undefined ? batch_index === batch_total : true;
        if (run_id) {
            const runs = await base44.asServiceRole.entities.Run.filter({ run_id, unit_id });
            if (runs.length > 0) {
                const currentRun = runs[0];
                const newTotalRecords = (currentRun.total_records || 0) + adsUpserted;
                const newCompletedBatches = (currentRun.completed_jobs || 0) + 1;

                await base44.asServiceRole.entities.Run.update(currentRun.id, {
                    total_records: newTotalRecords,
                    completed_jobs: newCompletedBatches,
                    status: isLastBatch ? 'success' : 'receiving',
                    finished_at_utc: isLastBatch ? new Date().toISOString() : null
                });

                // ✅ Atualizar ExecutionLog para "completed" no último batch
                if (isLastBatch) {
                    const execLogs = await base44.asServiceRole.entities.ExecutionLog.filter({
                        unit_id, message: { $regex: run_id.substring(0, 8) }
                    });
                    for (const log of execLogs) {
                        await base44.asServiceRole.entities.ExecutionLog.update(log.id, {
                            message: log.message.replace('[SENT]', '[COMPLETED]'),
                            error_details: `${newTotalRecords} registros processados`
                        });
                    }
                }
            }
        }

        // Agregar automaticamente no último batch
        if (isLastBatch) {
            console.log('🔄 Último batch recebido, iniciando agregação automática...');
            base44.asServiceRole.functions.invoke('aggregateMetaAdDaily', { unit_id })
                .then(() => console.log('✅ Agregação concluída'))
                .catch(err => console.error('⚠️ Erro na agregação (não fatal):', err.message));
        }

        await base44.asServiceRole.entities.ApiDiagnostics.update(diagnosticId, {
            status: 'sucesso', httpStatusCode: 200,
            durationMs: Date.now() - startTime,
            notes: `${adsUpserted} anúncios processados`
        });

        return Response.json({
            ok: true,
            run_id,
            batch_index, batch_total,
            ads_received: ads.length,
            ads_upserted: adsUpserted,
            run_status: isLastBatch ? 'success' : 'receiving',
            requestId,
            processed_at: getBrasiliaDate().toISOString()
        });

    } catch (error) {
        console.error('❌ ERRO ao processar webhook:', error);
        if (diagnosticId) {
            try {
                const base44 = createClientFromRequest(req);
                await base44.asServiceRole.entities.ApiDiagnostics.update(diagnosticId, {
                    status: 'erro', httpStatusCode: 500,
                    errorType: error.name || 'UnknownError',
                    errorMessage: error.message,
                    durationMs: Date.now() - startTime
                });
            } catch (_) {}
        }
        return Response.json({ ok: false, error: error.message, requestId }, { status: 500 });
    }
});