import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

        const body = await req.json();
        const { integration_id, execution_type = 'insights', unit_ids, run_type, date_mode, since, until } = body;

        if (!integration_id) {
            return Response.json({ success: false, error: 'integration_id é obrigatório' }, { status: 400 });
        }

        const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
        if (!integration) {
            return Response.json({ success: false, error: 'Integração não encontrada' }, { status: 404 });
        }

        // Resolve webhook URL - support new model (webhook_url) and old model
        const isCreatives = execution_type === 'creatives' || integration.webhook_type === 'creatives';
        let webhookUrl = integration.webhook_url;
        if (!webhookUrl) {
            webhookUrl = isCreatives
                ? integration.n8n_webhook_creatives_url
                : integration.n8n_webhook_insights_url || integration.settings?.n8n_webhook_url;
        }

        if (!webhookUrl) {
            return Response.json({ success: false, error: 'URL do webhook não configurada' }, { status: 400 });
        }

        // Resolve units - use provided unit_ids or all integration's unit_ids
        const targetUnitIds = (unit_ids && unit_ids.length > 0) ? unit_ids : (integration.unit_ids || []);
        if (targetUnitIds.length === 0 && run_type !== 'all') {
            return Response.json({ success: false, error: 'Nenhuma unidade selecionada' }, { status: 400 });
        }

        // Fetch unit data for credentials
        let unitData = [];
        if (run_type !== 'all' && targetUnitIds.length > 0) {
            const allUnits = await base44.asServiceRole.entities.Unit.list();
            unitData = allUnits.filter(u => targetUnitIds.includes(u.id)).map(u => ({
                unit_id: u.id,
                account_id: u.account_id || integration.account_reference || '',
                access_token: u.secret_token || integration.settings?.access_token || '',
            }));
        }

        // Build payload
        let payload;
        if (isCreatives) {
            payload = {
                mode: 'manual',
                run_type: run_type || (targetUnitIds.length === 1 ? 'single' : 'selected'),
                units: unitData,
            };
        } else {
            if (!date_mode) {
                return Response.json({ success: false, error: 'date_mode é obrigatório para insights' }, { status: 400 });
            }
            payload = {
                mode: 'manual',
                run_type: run_type || (targetUnitIds.length === 1 ? 'single' : 'selected'),
                date_mode,
                since: date_mode === 'CUSTOM' ? since : null,
                until: date_mode === 'CUSTOM' ? until : null,
                units: unitData,
            };
        }

        console.log('🔵 Webhook:', webhookUrl);
        console.log('🔵 Payload:', JSON.stringify(payload, null, 2));

        const secretToken = integration.settings?.secret_token || integration.settings?.n8n_secret_token || '';
        const headers = { 'Content-Type': 'application/json' };
        if (secretToken) headers['Authorization'] = `Bearer ${secretToken}`;

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return Response.json({ success: false, error: `Webhook retornou erro ${response.status}`, details: errorText }, { status: 500 });
        }

        const logMsg = isCreatives
            ? `Criativos: ${unitData.length} unidade(s)`
            : `Insights: ${date_mode} - ${unitData.length} unidade(s)`;

        await base44.asServiceRole.entities.ExecutionLog.create({
            unit_id: integration.unit_id || targetUnitIds[0] || '',
            log_type: 'integration_execution',
            execution_type: 'manual',
            execution_status: 'completed',
            execution_time: new Date().toISOString(),
            integration_id,
            platform: integration.platform_id,
            message: logMsg,
        });

        return Response.json({ success: true, message: 'Webhook executado com sucesso' });

    } catch (error) {
        console.error('❌', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});