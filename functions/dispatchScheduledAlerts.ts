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

    // Processar Telegram
    for (const unit of units) {
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
    }

    // Processar WhatsApp
    for (const unit of units) {
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
    }

    // Processar Integrações
    for (const unit of units) {
      const integrations = await base44.asServiceRole.entities.Integration.filter({
        unit_id: unit.id,
        schedule_enabled: true,
        schedule_frequency: 'daily',
        schedule_time: currentTimeStr
      });

      for (const integration of integrations) {
        if (integration.auth_type === 'n8n_webhook' && integration.settings?.n8n_webhook_url) {
          try {
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
          } catch (error) {
            console.error(`Integration webhook error for ${integration.id}:`, error.message);
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
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});