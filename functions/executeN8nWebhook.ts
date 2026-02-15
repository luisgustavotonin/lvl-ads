import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const { integration_id, date_mode, since, until } = body;

        if (!integration_id) {
            return Response.json({ 
                success: false, 
                error: 'integration_id é obrigatório' 
            }, { status: 400 });
        }

        // Buscar integração
        const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
        
        if (!integration) {
            return Response.json({ 
                success: false, 
                error: 'Integração não encontrada' 
            }, { status: 404 });
        }

        const webhookUrl = integration.settings?.n8n_webhook_url;
        if (!webhookUrl) {
            return Response.json({ 
                success: false, 
                error: 'URL do webhook não configurada' 
            }, { status: 400 });
        }

        // Preparar payload
        const payload = {
            unit_id: integration.unit_id,
            account_id: integration.account_reference || '',
            access_token: integration.settings?.access_token || '',
            date_mode: date_mode || 'YESTERDAY',
            since: since || null,
            until: until || null
        };

        console.log('Chamando webhook:', webhookUrl);

        // Chamar webhook
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return Response.json({
                success: false,
                error: `Webhook retornou erro ${response.status}`,
                details: errorText
            }, { status: 500 });
        }

        // Log de sucesso
        await base44.asServiceRole.entities.ExecutionLog.create({
            unit_id: integration.unit_id,
            log_type: 'integration_execution',
            execution_type: 'manual',
            execution_status: 'completed',
            execution_time: new Date().toISOString(),
            integration_id: integration_id,
            platform: integration.platform_id,
            message: 'Webhook executado com sucesso'
        });

        return Response.json({
            success: true,
            message: 'Webhook executado com sucesso'
        });

    } catch (error) {
        console.error('Erro:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});