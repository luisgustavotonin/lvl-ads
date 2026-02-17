import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const { integration_id, date_mode, since, until, execution_type = 'insights', unit_ids } = body;

        if (!integration_id) {
            return Response.json({ 
                success: false, 
                error: 'integration_id é obrigatório' 
            }, { status: 400 });
        }

        // Validação específica por tipo de execução
        if (execution_type === 'insights' && !date_mode) {
            return Response.json({ 
                success: false, 
                error: 'date_mode é obrigatório para insights' 
            }, { status: 400 });
        }

        if (execution_type === 'creatives' && !unit_ids) {
            return Response.json({ 
                success: false, 
                error: 'unit_ids é obrigatório para criativos' 
            }, { status: 400 });
        }

        // Validar date_mode apenas para insights
        if (execution_type === 'insights') {
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
        }

        const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
        
        if (!integration) {
            return Response.json({ 
                success: false, 
                error: 'Integração não encontrada' 
            }, { status: 404 });
        }

        // Selecionar webhook baseado no tipo de execução
        let webhookUrl;
        if (execution_type === 'creatives') {
            webhookUrl = integration.n8n_webhook_creatives_url;
            if (!webhookUrl) {
                return Response.json({ 
                    success: false, 
                    error: 'URL do webhook de criativos não configurada' 
                }, { status: 400 });
            }
        } else {
            webhookUrl = integration.n8n_webhook_insights_url || integration.settings?.n8n_webhook_url;
            if (!webhookUrl) {
                return Response.json({ 
                    success: false, 
                    error: 'URL do webhook de insights não configurada' 
                }, { status: 400 });
            }
        }

        // Preparar payload baseado no tipo de execução
        let payload;
        
        if (execution_type === 'creatives') {
            // Payload para criativos - sem datas, com unidades
            payload = {
                execution_type: 'creatives',
                unit_ids: unit_ids,
                account_id: integration.account_reference || '',
                access_token: integration.settings?.access_token || ''
            };
        } else {
            // Payload para insights - com datas
            payload = {
                execution_type: 'insights',
                unit_id: integration.unit_id,
                account_id: integration.account_reference || '',
                access_token: integration.settings?.access_token || '',
                date_mode: date_mode,
                since: date_mode === 'CUSTOM' ? since : null,
                until: date_mode === 'CUSTOM' ? until : null
            };
        }

        console.log('🔵 ========== ENVIANDO PARA N8N ==========');
        console.log('🔵 Tipo:', execution_type);
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

        const logMessage = execution_type === 'creatives' 
            ? `Criativos executados: ${unit_ids === 'all' ? 'todas as unidades' : `${Array.isArray(unit_ids) ? unit_ids.length : 1} unidade(s)`}`
            : `Insights executados: ${date_mode}${date_mode === 'CUSTOM' ? ` (${since} a ${until})` : ''}`;

        await base44.asServiceRole.entities.ExecutionLog.create({
            unit_id: integration.unit_id,
            log_type: 'integration_execution',
            execution_type: 'manual',
            execution_status: 'completed',
            execution_time: new Date().toISOString(),
            integration_id: integration_id,
            platform: integration.platform_id,
            message: logMessage
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