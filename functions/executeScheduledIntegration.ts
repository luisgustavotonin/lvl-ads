import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({ error: 'integration_id é obrigatório' }, { status: 400 });
    }

    // Buscar integração
    const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
    
    if (!integration) {
      return Response.json({ error: 'Integração não encontrada' }, { status: 404 });
    }

    // Registrar log de início
    await base44.asServiceRole.entities.ExecutionLog.create({
      unit_id: integration.unit_id,
      log_type: 'integration_execution',
      status: 'pending',
      trigger_type: 'scheduled',
      execution_time: new Date().toISOString(),
      integration_id: integration.id,
      platform: integration.platform_id,
      message: `Iniciando execução agendada: ${integration.account_name || integration.integration_purpose}`
    });

    let success = false;
    let errorMessage = null;

    try {
      // Executar a integração N8n
      const response = await base44.asServiceRole.functions.invoke('triggerN8nIntegration', {
        integration_id: integration.id,
        date_mode: integration.schedule_date_mode || 'YESTERDAY'
      });

      if (response.data && response.data.success) {
        success = true;
      } else {
        errorMessage = response.data?.error || 'Erro desconhecido';
      }
    } catch (error) {
      errorMessage = error.message;
    }

    // Atualizar integração com última execução
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    await base44.asServiceRole.entities.Integration.update(integration.id, {
      last_execution: now.toISOString(),
      last_execution_date: today,
      last_execution_status: success ? 'success' : 'error'
    });

    // Registrar log final
    await base44.asServiceRole.entities.ExecutionLog.create({
      unit_id: integration.unit_id,
      log_type: 'integration_execution',
      status: success ? 'success' : 'error',
      trigger_type: 'scheduled',
      execution_time: now.toISOString(),
      integration_id: integration.id,
      platform: integration.platform_id,
      message: success 
        ? `Execução agendada concluída: ${integration.account_name || integration.integration_purpose}`
        : `Erro na execução: ${errorMessage}`,
      error_details: errorMessage
    });

    return Response.json({ 
      success,
      message: success 
        ? 'Integração executada com sucesso'
        : `Erro: ${errorMessage}`
    });

  } catch (error) {
    console.error('Erro ao executar integração agendada:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});