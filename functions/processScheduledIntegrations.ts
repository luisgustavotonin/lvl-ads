import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função helper para obter hora atual em um timezone específico
function getCurrentTimeInTimezone(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(now);
}

// Função helper para obter a data atual em um timezone específico
function getCurrentDateInTimezone(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Buscar todas as integrações com agendamento ativo
    const integrations = await base44.asServiceRole.entities.Integration.filter({
      schedule_enabled: true
    });

    if (!integrations || integrations.length === 0) {
      return Response.json({ 
        message: 'Nenhuma integração agendada encontrada',
        processed: 0
      });
    }

    const executions = [];
    const now = new Date();

    for (const integration of integrations) {
      try {
        // Verificar timezone configurado
        const timezone = integration.schedule_timezone || 'America/Sao_Paulo';
        
        // Obter hora e data atual no timezone da integração
        const currentTime = getCurrentTimeInTimezone(timezone);
        const currentDate = getCurrentDateInTimezone(timezone);
        
        // Verificar se tem horário configurado
        if (!integration.schedule_time) {
          continue;
        }

        // Verificar se a hora atual bate com a hora configurada
        const scheduledTime = integration.schedule_time;
        
        // Comparar HH:MM
        if (currentTime !== scheduledTime) {
          continue;
        }

        // Verificar frequência
        if (integration.schedule_frequency === 'daily') {
          // Para diário, verificar se já executou hoje
          if (integration.last_execution_date === currentDate) {
            console.log(`Integração ${integration.id} já executou hoje (${currentDate})`);
            continue;
          }
        }

        // Executar a integração
        console.log(`Disparando integração ${integration.id} às ${currentTime} (${timezone})`);
        
        const result = await base44.asServiceRole.functions.invoke('executeScheduledIntegration', {
          integration_id: integration.id
        });

        executions.push({
          integration_id: integration.id,
          account_name: integration.account_name || integration.integration_purpose,
          executed_at: currentTime,
          timezone: timezone,
          success: result.data?.success || false,
          message: result.data?.message || result.data?.error
        });

      } catch (error) {
        console.error(`Erro ao processar integração ${integration.id}:`, error);
        executions.push({
          integration_id: integration.id,
          account_name: integration.account_name || integration.integration_purpose,
          success: false,
          error: error.message
        });
      }
    }

    return Response.json({
      message: `Processadas ${integrations.length} integrações, ${executions.length} executadas`,
      total_integrations: integrations.length,
      executions: executions,
      processed_at: now.toISOString()
    });

  } catch (error) {
    console.error('Erro ao processar integrações agendadas:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});