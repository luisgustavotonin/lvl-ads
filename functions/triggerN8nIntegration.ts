import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper para obter data atual em Brasília
function getBrasiliaDate() {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return brasiliaTime;
}

// Helper para formatar data em YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { integration_id, date_mode, since, until, module } = await req.json();

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

        // Criar log de execução (SEMPRE em UTC)
        const executionLog = await base44.asServiceRole.entities.ExecutionLog.create({
            unit_id: integration.unit_id,
            log_type: 'integration_execution',
            execution_type: 'manual',
            execution_status: 'completed',
            status: 'pending',
            trigger_type: 'manual',
            execution_time: new Date().toISOString(),
            integration_id: integration_id,
            platform: integration.platform_id,
            message: `Integração ${integration.account_name} disparada manualmente`,
            records_processed: 0
        });

        // Calcular datas baseadas no horário de Brasília
        const brasiliaToday = getBrasiliaDate();
        let calculatedSince = since;
        let calculatedUntil = until;

        if (date_mode !== 'CUSTOM') {
            const today = formatDate(brasiliaToday);
            
            if (date_mode === 'TODAY') {
                calculatedSince = today;
                calculatedUntil = today;
            } else if (date_mode === 'YESTERDAY') {
                const yesterday = new Date(brasiliaToday);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = formatDate(yesterday);
                calculatedSince = yesterdayStr;
                calculatedUntil = yesterdayStr;
            } else if (date_mode === 'LAST_7D') {
                const sevenDaysAgo = new Date(brasiliaToday);
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                calculatedSince = formatDate(sevenDaysAgo);
                calculatedUntil = today;
            } else if (date_mode === 'LAST_14D') {
                const fourteenDaysAgo = new Date(brasiliaToday);
                fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
                calculatedSince = formatDate(fourteenDaysAgo);
                calculatedUntil = today;
            } else if (date_mode === 'LAST_28D') {
                const twentyEightDaysAgo = new Date(brasiliaToday);
                twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
                calculatedSince = formatDate(twentyEightDaysAgo);
                calculatedUntil = today;
            } else if (date_mode === 'LAST_30D') {
                const thirtyDaysAgo = new Date(brasiliaToday);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                calculatedSince = formatDate(thirtyDaysAgo);
                calculatedUntil = today;
            }
        }

        // Garantir que account_id tenha prefixo act_
        let accountId = integration.account_reference || '';
        if (accountId && !accountId.startsWith('act_')) {
            accountId = `act_${accountId}`;
        }

        // Preparar payload para o n8n
        const payload = {
            unit_id: integration.unit_id,
            account_id: accountId,
            access_token: integration.settings?.access_token || '',
            module: module || integration.integration_purpose || 'core',
            date_mode: date_mode,
            since: calculatedSince,
            until: calculatedUntil
        };

        console.log('📤 Disparando N8n:', JSON.stringify(payload, null, 2));

        // Disparar o n8n com timeout de 30 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        let n8nResponse;
        try {
            n8nResponse = await fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            await base44.asServiceRole.entities.ExecutionLog.update(executionLog.id, {
                execution_status: 'failed',
                status: 'error',
                error_details: `Erro ao conectar: ${fetchError.message}`
            });

            return Response.json({
                success: false,
                error: fetchError.name === 'AbortError' 
                    ? 'Timeout: N8n não respondeu em 30 segundos' 
                    : `Erro ao conectar: ${fetchError.message}`
            }, { status: 500 });
        }

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();
            await base44.asServiceRole.entities.ExecutionLog.update(executionLog.id, {
                execution_status: 'failed',
                status: 'error',
                error_details: `N8n returned ${n8nResponse.status}: ${errorText}`
            });

            return Response.json({
                success: false,
                error: `N8n retornou erro ${n8nResponse.status}`,
                details: errorText
            }, { status: 500 });
        }

        // Atualizar log como executado com sucesso
        await base44.asServiceRole.entities.ExecutionLog.update(executionLog.id, {
            execution_status: 'completed',
            status: 'success',
            message: `Integração executada com sucesso`
        });

        let n8nData;
        try {
            const responseText = await n8nResponse.text();
            n8nData = responseText ? JSON.parse(responseText) : {};
        } catch {
            n8nData = {};
        }

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