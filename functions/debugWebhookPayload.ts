import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * FUNÇÃO DE DEBUG TEMPORÁRIA
 * Chame esta função no lugar de executeN8nWebhook para ver EXATAMENTE o que está sendo enviado ao N8N
 * sem realmente enviar. Retorna o payload que seria enviado.
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const { integration_id, date_mode, since, until, execution_type = 'insights', unit_ids, mode, run_type } = body;

        console.log('🐛 DEBUG - Body recebido do frontend:', JSON.stringify(body, null, 2));

        if (!integration_id) {
            return Response.json({ error: 'integration_id é obrigatório' }, { status: 400 });
        }

        const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
        if (!integration) {
            return Response.json({ error: 'Integração não encontrada' }, { status: 404 });
        }

        console.log('🐛 DEBUG - Integration encontrada:', JSON.stringify({
            id: integration.id,
            unit_id: integration.unit_id,
            platform_id: integration.platform_id,
            account_reference: integration.account_reference,
            n8n_webhook_insights_url: integration.n8n_webhook_insights_url,
            n8n_webhook_creatives_url: integration.n8n_webhook_creatives_url,
        }, null, 2));

        // Simular geração do run_id
        const run_id = crypto.randomUUID();

        let payload;
        let webhookUrl;

        if (execution_type === 'creatives') {
            webhookUrl = integration.n8n_webhook_creatives_url;
            payload = {
                run_id,
                mode: mode || 'manual',
                run_type,
                callback_url: `https://api.base44.com/api/apps/${Deno.env.get('BASE44_APP_ID')}/functions/receiveN8nData`
            };
            if (run_type !== 'all') {
                payload.account_id = integration.account_reference || '';
                payload.unit_ids = unit_ids;
            }
        } else {
            webhookUrl = integration.n8n_webhook_insights_url || integration.settings?.n8n_webhook_url;
            payload = {
                run_id,
                unit_id: integration.unit_id || '',
                account_id: integration.account_reference || '',
                mode: mode || 'manual',
                run_type: run_type || 'single',
                date_mode,
                since: date_mode === 'CUSTOM' ? since : null,
                until: date_mode === 'CUSTOM' ? until : null,
                unit_ids: unit_ids || null,
                callback_url: `https://api.base44.com/api/apps/${Deno.env.get('BASE44_APP_ID')}/functions/receiveN8nData`
            };
        }

        console.log('🐛 DEBUG - Payload que SERIA enviado ao N8N:', JSON.stringify(payload, null, 2));
        console.log('🐛 DEBUG - Webhook URL:', webhookUrl);

        // ⚠️ NÃO ENVIA para o N8N - apenas retorna o debug
        return Response.json({
            debug: true,
            message: '⚠️ MODO DEBUG - NÃO enviou para N8N',
            input_received: body,
            integration_info: {
                id: integration.id,
                unit_id: integration.unit_id,
                account_reference: integration.account_reference,
                n8n_webhook_insights_url: integration.n8n_webhook_insights_url,
            },
            payload_would_send: payload,
            webhook_url: webhookUrl,
            run_id_generated: run_id,
        });

    } catch (error) {
        console.error('❌ Erro no debug:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});