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

        const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
        
        if (!integration) {
            return Response.json({ 
                success: false, 
                error: 'Integração não encontrada' 
            }, { status: 404 });
        }

        const n8nWebhookUrl = integration.settings?.n8n_webhook_url;

        if (!n8nWebhookUrl) {
            return Response.json({ 
                success: false, 
                error: 'URL do webhook não configurada' 
            }, { status: 400 });
        }

        // Calcular datas
        const today = new Date().toISOString().split('T')[0];
        let calculatedSince = since;
        let calculatedUntil = until;

        if (date_mode !== 'CUSTOM') {
            const daysMap = {
                'TODAY': 0,
                'YESTERDAY': 1,
                'LAST_7D': 7,
                'LAST_14D': 14,
                'LAST_28D': 28,
                'LAST_30D': 30
            };
            
            const days = daysMap[date_mode] || 0;
            if (date_mode === 'TODAY') {
                calculatedSince = today;
                calculatedUntil = today;
            } else {
                const d = new Date();
                d.setDate(d.getDate() - days);
                calculatedSince = d.toISOString().split('T')[0];
                calculatedUntil = today;
            }
        }

        const payload = {
            unit_id: integration.unit_id,
            account_id: integration.account_reference || '',
            access_token: integration.settings?.access_token || '',
            date_mode: date_mode,
            since: calculatedSince,
            until: calculatedUntil
        };

        console.log('Disparando N8n:', payload);

        const n8nResponse = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!n8nResponse.ok) {
            return Response.json({
                success: false,
                error: `N8n retornou erro ${n8nResponse.status}`
            }, { status: 500 });
        }

        await base44.asServiceRole.entities.ExecutionLog.create({
            unit_id: integration.unit_id,
            log_type: 'integration_execution',
            execution_type: 'manual',
            execution_status: 'completed',
            execution_time: new Date().toISOString(),
            integration_id: integration_id,
            platform: integration.platform_id,
            message: 'Integração executada com sucesso',
            records_processed: 0
        });

        return Response.json({
            success: true,
            message: 'Integração executada com sucesso'
        });

    } catch (error) {
        console.error('Erro:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});