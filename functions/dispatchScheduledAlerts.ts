import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function getBrasiliaDate() {
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return brasiliaTime;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const currentTime = getBrasiliaDate();
    const currentHour = String(currentTime.getHours()).padStart(2, '0');
    const currentMinute = String(currentTime.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMinute}`;

    // Buscar TODAS as unidades
    const units = await base44.asServiceRole.entities.Unit.list();
    
    let telegramDispatched = 0;
    let whatsappDispatched = 0;
    let integrationDispatched = 0;
    let skippedDueToLock = 0;

    // Processar cada unidade
    for (const unit of units) {
      // LOCK POR UNIDADE: Verificar última execução
      const recentLogs = await base44.asServiceRole.entities.ExecutionLog.filter(
        { 
          unit_id: unit.id,
          trigger_type: 'scheduled',
          execution_time: { $gte: new Date(Date.now() - 60000).toISOString() } // Últimos 60 segundos
        },
        '-execution_time',
        1
      );

      if (recentLogs.length > 0) {
        console.log(`⏭️ Pulando ${unit.name} - execução recente há menos de 1 minuto`);
        skippedDueToLock++;
        continue;
      }

      // Telegram
      const telegramConfigs = await base44.asServiceRole.entities.TelegramAlertConfig.filter({
        unit_id: unit.id,
        enabled: true,
        alert_frequency: 'daily',
        schedule_time: currentTimeStr
      });

      for (const config of telegramConfigs) {
        try {
          await base44.asServiceRole.functions.invoke('sendTelegramAlert', {
            unit_id: unit.id,
            provider: config.provider
          });
          telegramDispatched++;
        } catch (error) {
          console.error(`Telegram alert error for ${unit.id}:`, error.message);
        }
      }

      // WhatsApp
      const whatsappConfigs = await base44.asServiceRole.entities.AlertConfig.filter({
        unit_id: unit.id,
        enabled: true,
        alert_frequency: 'daily',
        schedule_time: currentTimeStr
      });

      for (const config of whatsappConfigs) {
        if (config.webhook_url) {
          try {
            await fetch(config.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                unit_id: unit.id,
                provider: config.provider,
                timestamp: new Date().toISOString()
              })
            });
            whatsappDispatched++;
          } catch (error) {
            console.error(`WhatsApp webhook error for ${unit.id}:`, error.message);
          }
        }
      }

      // Integrações
      const integrations = await base44.asServiceRole.entities.Integration.filter({
        unit_id: unit.id,
        schedule_enabled: true,
        schedule_frequency: 'daily',
        schedule_time: currentTimeStr
      });

      for (const integration of integrations) {
        if (integration.auth_type === 'n8n_webhook' && integration.settings?.n8n_webhook_url) {
          // Verificar última execução desta integração específica
          const lastExec = await base44.asServiceRole.entities.ExecutionLog.filter(
            {
              integration_id: integration.id,
              trigger_type: 'scheduled',
              execution_time: { $gte: new Date(Date.now() - 300000).toISOString() } // Últimos 5 minutos
            },
            '-execution_time',
            1
          );

          if (lastExec.length > 0) {
            console.log(`⏭️ Pulando integração ${integration.id} - executada recentemente`);
            continue;
          }

          try {
            // Registrar log ANTES de disparar
            await base44.asServiceRole.entities.ExecutionLog.create({
              unit_id: unit.id,
              log_type: 'integration_execution',
              status: 'pending',
              trigger_type: 'scheduled',
              execution_time: getBrasiliaDate().toISOString(),
              integration_id: integration.id,
              platform: integration.platform_id,
              message: `Integração agendada disparada às ${currentTimeStr}`
            });

            await fetch(integration.settings.n8n_webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                integration_id: integration.id,
                unit_id: unit.id,
                platform: integration.platform_id,
                trigger: 'scheduled',
                timestamp: new Date().toISOString()
              })
            });

            integrationDispatched++;

            // Atualizar última execução na integração
            await base44.asServiceRole.entities.Integration.update(integration.id, {
              last_execution: getBrasiliaDate().toISOString(),
              last_execution_status: 'success'
            });

          } catch (error) {
            console.error(`Integration webhook error for ${integration.id}:`, error.message);

            await base44.asServiceRole.entities.Integration.update(integration.id, {
              last_execution: getBrasiliaDate().toISOString(),
              last_execution_status: 'error'
            });
          }
        }
      }
    }

    return Response.json({ 
      success: true, 
      currentTime: currentTimeStr,
      dispatched: {
        telegram: telegramDispatched,
        whatsapp: whatsappDispatched,
        integration: integrationDispatched
      },
      skippedDueToLock
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});