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

        if (!integration_id || !date_mode) {
            return Response.json({ 
                success: false, 
                error: 'integration_id e date_mode são obrigatórios' 
            }, { status: 400 });
        }

        // Validar date_mode
        const validDateModes = ['TODAY', 'TODAY_AND_YESTERDAY', 'YESTERDAY', 'LAST_7D', 'LAST_14D', 'LAST_28D', 'LAST_30D', 'CUSTOM'];
        if (!validDateModes.includes(date_mode)) {
            return Response.json({ 
                success: false, 
                error: `date_mode inválido. Use: ${validDateModes.join(', ')}` 
            }, { status: 400 });
        }

        // Se for CUSTOM, validar datas
        if (date_mode === 'CUSTOM' && (!since || !until)) {
            return Response.json({ 
                success: false, 
                error: 'Para date_mode CUSTOM, since e until são obrigatórios' 
            }, { status: 400 });
        }

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

        // Preparar payload EXATAMENTE conforme recebido
        const payload = {
            unit_id: integration.unit_id,
            account_id: integration.account_reference || '',
            access_token: integration.settings?.access_token || '',
            date_mode: date_mode,
            since: date_mode === 'CUSTOM' ? since : null,
            until: date_mode === 'CUSTOM' ? until : null
        };

        console.log('🔵 ========== ENVIANDO PARA N8N ==========');
        console.log('🔵 URL:', webhookUrl);
        console.log('🔵 Payload COMPLETO:', JSON.stringify(payload, null, 2));
        console.log('🔵 ==========================================');

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Webhook erro:', response.status, errorText);
            return Response.json({
                success: false,
                error: `Webhook retornou erro ${response.status}`,
                details: errorText
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
            message: `Webhook executado: ${date_mode}${date_mode === 'CUSTOM' ? ` (${since} a ${until})` : ''}`
        });

        console.log('✅ Webhook executado com sucesso');

        return Response.json({
            success: true,
            message: 'Webhook executado com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});