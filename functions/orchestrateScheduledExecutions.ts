import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Função orquestradora para executar agendamentos de forma sequencial
 * Evita sobrecarga executando uma integração por vez com delay
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Autenticar usuário admin
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ 
                error: 'Forbidden: Admin access required' 
            }, { status: 403 });
        }

        // Buscar todas as integrações com agendamento ativo
        const allIntegrations = await base44.asServiceRole.entities.Integration.list();
        
        // Filtrar apenas as que têm agendamento ativo
        const scheduledIntegrations = allIntegrations.filter(i => 
            i.schedule_enabled === true &&
            i.connection_status === 'connected' &&
            i.auth_type === 'n8n_webhook'
        );

        if (scheduledIntegrations.length === 0) {
            return Response.json({
                success: true,
                message: 'Nenhuma integração agendada para executar',
                executed: 0
            });
        }

        console.log(`🔄 Iniciando orquestração de ${scheduledIntegrations.length} integrações`);

        const results = [];
        const DELAY_BETWEEN_EXECUTIONS = 30000; // 30 segundos

        // Executar uma por vez com delay
        for (let i = 0; i < scheduledIntegrations.length; i++) {
            const integration = scheduledIntegrations[i];
            
            console.log(`⏳ [${i + 1}/${scheduledIntegrations.length}] Executando: ${integration.account_name || integration.integration_purpose}`);

            try {
                // Invocar a função de trigger para esta integração
                const response = await base44.asServiceRole.functions.invoke('triggerN8nIntegration', {
                    integration_id: integration.id,
                    date_mode: integration.schedule_date_mode || 'YESTERDAY'
                });

                results.push({
                    integration_id: integration.id,
                    account_name: integration.account_name,
                    status: 'success',
                    execution_log_id: response.data?.execution_log_id
                });

                // Atualizar última execução da integração
                await base44.asServiceRole.entities.Integration.update(integration.id, {
                    last_execution: new Date().toISOString(),
                    last_execution_status: 'success'
                });

                console.log(`✅ Sucesso: ${integration.account_name || integration.integration_purpose}`);

            } catch (error) {
                console.error(`❌ Erro na integração ${integration.id}:`, error.message);
                
                results.push({
                    integration_id: integration.id,
                    account_name: integration.account_name,
                    status: 'error',
                    error: error.message
                });

                // Atualizar status de erro
                await base44.asServiceRole.entities.Integration.update(integration.id, {
                    last_execution: new Date().toISOString(),
                    last_execution_status: 'error'
                });
            }

            // Delay entre execuções (exceto na última)
            if (i < scheduledIntegrations.length - 1) {
                console.log(`⏸️  Aguardando 30s antes da próxima execução...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EXECUTIONS));
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        console.log(`✅ Orquestração concluída: ${successCount} sucessos, ${errorCount} erros`);

        return Response.json({
            success: true,
            message: `Orquestração concluída: ${successCount}/${scheduledIntegrations.length} integrações executadas com sucesso`,
            total: scheduledIntegrations.length,
            success_count: successCount,
            error_count: errorCount,
            results: results
        });

    } catch (error) {
        console.error('❌ Erro na orquestração:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});