import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { integration_id, date_mode, since, until } = await req.json();

        if (!integration_id || !date_mode) {
            return Response.json({ 
                success: false, 
                error: 'integration_id e date_mode são obrigatórios' 
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

        if (integration.auth_type !== 'n8n_webhook') {
            return Response.json({ 
                success: false, 
                error: 'Esta integração não é do tipo N8n webhook' 
            }, { status: 400 });
        }

        const n8nWebhookUrl = integration.settings?.n8n_webhook_url;
        const secretToken = integration.settings?.n8n_secret_token;

        if (!n8nWebhookUrl) {
            return Response.json({ 
                success: false, 
                error: 'URL do webhook N8n não configurada' 
            }, { status: 400 });
        }

        // Preparar provider name
        const providerMap = {
            'META': 'meta',
            'GOOGLE_ADS': 'google',
            'TIKTOK_ADS': 'tiktok',
            'YOUTUBE': 'youtube'
        };
        const provider = providerMap[integration.platform_id] || 'meta';

        // Criar log de execução
        const executionLog = await base44.asServiceRole.entities.ExecutionLog.create({
            integration_id: integration_id,
            unit_id: integration.unit_id,
            provider: provider,
            execution_type: 'manual',
            date_mode: date_mode,
            since: since || null,
            until: until || null,
            status: 'pending',
            started_at: new Date().toISOString()
        });

        // Preparar payload para o n8n
        const payload = {
            integration_id: integration_id,
            secret_token: secretToken || '',
            access_token: integration.settings?.access_token || '',
            unit_id: integration.unit_id,
            account_id: integration.account_reference || '',
            provider: provider,
            date_mode: date_mode,
            since: since || null,
            until: until || null,
            request_type: 'FULL_SYNC',
            execution_log_id: executionLog.id
        };

        console.log('📤 Disparando N8n:', JSON.stringify(payload, null, 2));

        // Disparar o n8n
        const n8nResponse = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();
            await base44.asServiceRole.entities.ExecutionLog.update(executionLog.id, {
                status: 'error',
                error_message: `N8n returned ${n8nResponse.status}: ${errorText}`,
                completed_at: new Date().toISOString()
            });

            return Response.json({
                success: false,
                error: `Erro ao chamar N8n: ${n8nResponse.status}`
            }, { status: 500 });
        }

        // Atualizar log como running
        await base44.asServiceRole.entities.ExecutionLog.update(executionLog.id, {
            status: 'running'
        });

        const n8nData = await n8nResponse.json();

        return Response.json({
            success: true,
            message: 'Execução disparada com sucesso',
            execution_log_id: executionLog.id,
            n8n_response: n8nData
        });

    } catch (error) {
        console.error('❌ Erro ao disparar N8n:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});