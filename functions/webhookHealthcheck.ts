import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * HEALTHCHECK - Testa conectividade com webhook N8N sem executar integração real
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { integration_id } = await req.json();

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

        // Validação de URL
        if (!webhookUrl) {
            return Response.json({
                success: false,
                error: 'URL do webhook não configurada',
                details: 'Configure a URL do webhook N8N nas configurações da integração'
            }, { status: 400 });
        }

        // Validar formato da URL
        const urlPattern = /^https?:\/\/.+/;
        if (!urlPattern.test(webhookUrl)) {
            return Response.json({
                success: false,
                error: 'URL do webhook inválida',
                url: webhookUrl,
                details: 'A URL deve começar com http:// ou https://'
            }, { status: 400 });
        }

        // Verificar se contém valores inválidos
        if (webhookUrl.includes('undefined') || webhookUrl.includes('null') || webhookUrl.includes('[object')) {
            return Response.json({
                success: false,
                error: 'URL do webhook contém valores inválidos',
                url: webhookUrl,
                details: 'A URL contém "undefined", "null" ou valores de objeto não resolvidos'
            }, { status: 400 });
        }

        console.log(`🔍 Testando webhook: ${webhookUrl}`);

        // Tentar conectar (timeout de 10s)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const startTime = Date.now();

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Healthcheck': 'true'
                },
                body: JSON.stringify({
                    healthcheck: true,
                    timestamp: new Date().toISOString()
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;

            const responseText = await response.text();
            let responseBody;
            try {
                responseBody = JSON.parse(responseText);
            } catch {
                responseBody = responseText.substring(0, 1000);
            }

            console.log(`✅ Resposta recebida: ${response.status} em ${duration}ms`);

            return Response.json({
                success: response.ok,
                status_code: response.status,
                url: webhookUrl,
                duration_ms: duration,
                response_preview: responseBody,
                message: response.ok 
                    ? `Webhook conectado com sucesso (${duration}ms)` 
                    : `Webhook retornou erro ${response.status}`
            });

        } catch (fetchError) {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;

            console.error(`❌ Erro ao conectar:`, fetchError.message);

            let errorType = 'unknown';
            if (fetchError.name === 'AbortError') {
                errorType = 'timeout';
            } else if (fetchError.message.includes('ECONNREFUSED')) {
                errorType = 'connection_refused';
            } else if (fetchError.message.includes('getaddrinfo')) {
                errorType = 'dns_error';
            }

            return Response.json({
                success: false,
                error: fetchError.message,
                error_type: errorType,
                url: webhookUrl,
                duration_ms: duration,
                details: errorType === 'timeout' 
                    ? 'Webhook não respondeu em 10 segundos'
                    : errorType === 'connection_refused'
                    ? 'Conexão recusada - verifique se o N8N está online'
                    : errorType === 'dns_error'
                    ? 'Erro de DNS - verifique se a URL está correta'
                    : 'Erro desconhecido ao conectar'
            });
        }

    } catch (error) {
        console.error('❌ Erro no healthcheck:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});