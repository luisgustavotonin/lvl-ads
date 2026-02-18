import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const { integration_id, date_mode, since, until, execution_type = 'insights', unit_ids, mode, run_type } = body;

        if (!integration_id) {
            return Response.json({ success: false, error: 'integration_id é obrigatório' }, { status: 400 });
        }

        if (execution_type === 'insights' && !date_mode) {
            return Response.json({ success: false, error: 'date_mode é obrigatório para insights' }, { status: 400 });
        }

        if (execution_type === 'creatives' && !run_type) {
            return Response.json({ success: false, error: 'run_type é obrigatório para criativos (single, selected, all)' }, { status: 400 });
        }

        if (execution_type === 'creatives' && run_type !== 'all' && !unit_ids) {
            return Response.json({ success: false, error: 'unit_ids é obrigatório para run_type single/selected' }, { status: 400 });
        }

        if (execution_type === 'insights') {
            const validDateModes = ['TODAY', 'TODAY_AND_YESTERDAY', 'YESTERDAY', 'LAST_7D', 'LAST_14D', 'LAST_28D', 'LAST_30D', 'CUSTOM'];
            if (!validDateModes.includes(date_mode)) {
                return Response.json({ success: false, error: `date_mode inválido. Use: ${validDateModes.join(', ')}` }, { status: 400 });
            }
            if (date_mode === 'CUSTOM' && (!since || !until)) {
                return Response.json({ success: false, error: 'Para date_mode CUSTOM, since e until são obrigatórios' }, { status: 400 });
            }
        }

        const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
        if (!integration) {
            return Response.json({ success: false, error: 'Integração não encontrada' }, { status: 404 });
        }

        // Selecionar webhook baseado no tipo de execução
        let webhookUrl;
        if (execution_type === 'creatives') {
            webhookUrl = integration.n8n_webhook_creatives_url;
            if (!webhookUrl) {
                return Response.json({ success: false, error: 'URL do webhook de criativos não configurada' }, { status: 400 });
            }
        } else {
            webhookUrl = integration.n8n_webhook_insights_url || integration.settings?.n8n_webhook_url;
            if (!webhookUrl) {
                return Response.json({ success: false, error: 'URL do webhook de insights não configurada' }, { status: 400 });
            }
        }

        // ✅ CORREÇÃO 1: Gerar run_id aqui (fonte única de verdade)
        const run_id = crypto.randomUUID();
        const now = new Date().toISOString();

        // ✅ CORREÇÃO 2: Criar Run com status "sent" (não "completed")
        const resolvedDateEnd = date_mode === 'CUSTOM' ? until : until || since || new Date().toISOString().split('T')[0];
        await base44.asServiceRole.entities.Run.create({
            run_id,
            unit_id: integration.unit_id,
            platform: integration.platform_id || 'META',
            date_start: date_mode === 'CUSTOM' ? since : date_mode,
            date_end: resolvedDateEnd,
            trigger_type: 'manual',
            status: 'queued',
            started_at_utc: now,
            metadata: { execution_type, date_mode, since, until, run_type }
        });

        // ✅ CORREÇÃO 2: ExecutionLog com status "sent"
        const logMessage = execution_type === 'creatives'
            ? `Criativos disparados: run_type=${run_type}${run_type !== 'all' && unit_ids ? ` (${Array.isArray(unit_ids) ? unit_ids.length : 1} unidade(s))` : ''}`
            : `Insights disparados: ${date_mode}${date_mode === 'CUSTOM' ? ` (${since} a ${until})` : ''}`;

        await base44.asServiceRole.entities.ExecutionLog.create({
            unit_id: integration.unit_id,
            log_type: 'integration_execution',
            execution_type: 'manual',
            execution_status: 'completed',
            execution_time: now,
            integration_id: integration_id,
            platform: integration.platform_id,
            message: `[SENT] ${logMessage} | run_id: ${run_id.substring(0, 8)}`
        });

        // Preparar payload com run_id e callback_url
        const accessToken = integration.settings?.access_token || '';
        let payload;

        if (execution_type === 'creatives') {
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
            payload = {
                run_id,                                          // ✅ sempre presente
                unit_id: integration.unit_id || '',             // ✅ sempre presente
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

        console.log('🔵 ========== ENVIANDO PARA N8N ==========');
        console.log('🔵 Tipo:', execution_type);
        console.log('🔵 URL:', webhookUrl);
        console.log('🔵 run_id gerado:', run_id);
        console.log('🔵 Payload COMPLETO:', JSON.stringify(payload, null, 2));
        console.log('🔵 ==========================================');

        const headers = { 'Content-Type': 'application/json' };
        if (execution_type === 'creatives' && accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
            headers['X-Access-Token'] = accessToken;
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Webhook erro:', response.status, errorText);

            // Marcar Run como failed se N8N rejeitar imediatamente
            await base44.asServiceRole.entities.Run.filter({ run_id, unit_id: integration.unit_id })
                .then(runs => runs.length > 0
                    ? base44.asServiceRole.entities.Run.update(runs[0].id, { status: 'failed', error_message: `N8N retornou ${response.status}` })
                    : null
                ).catch(() => {});

            return Response.json({
                success: false,
                error: `Webhook retornou erro ${response.status}`,
                details: errorText
            }, { status: 500 });
        }

        console.log('✅ Webhook enviado com sucesso, aguardando callback do N8N');

        return Response.json({
            success: true,
            run_id,
            message: 'Webhook enviado. Aguardando callback com dados do N8N.'
        });

    } catch (error) {
        console.error('❌ Erro:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});