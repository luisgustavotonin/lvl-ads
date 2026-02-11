import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function getBrasiliaDate() {
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return brasiliaTime;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bodyData = await req.json();
    const { unit_id, alert_type } = bodyData;

    if (!unit_id || !alert_type) {
      return Response.json({ error: 'unit_id and alert_type required' }, { status: 400 });
    }

    const currentTime = getBrasiliaDate();
    const currentHour = String(currentTime.getHours()).padStart(2, '0');
    const currentMinute = String(currentTime.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMinute}`;

    if (alert_type === 'telegram') {
      const configs = await base44.entities.TelegramAlertConfig.filter({
        unit_id,
        enabled: true,
        alert_frequency: 'daily'
      });

      for (const config of configs) {
        if (config.schedule_time === currentTimeStr) {
          await base44.functions.invoke('sendTelegramAlert', {
            unit_id,
            provider: config.provider
          });
        }
      }

      return Response.json({ success: true, message: 'Telegram alerts dispatched' });
    }

    if (alert_type === 'whatsapp') {
      const configs = await base44.entities.AlertConfig.filter({
        unit_id,
        enabled: true,
        alert_frequency: 'daily'
      });

      for (const config of configs) {
        if (config.schedule_time === currentTimeStr && config.webhook_url) {
          try {
            await fetch(config.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                unit_id,
                provider: config.provider,
                timestamp: new Date().toISOString()
              })
            });
          } catch (error) {
            console.error(`Webhook error for ${unit_id}:`, error.message);
          }
        }
      }

      return Response.json({ success: true, message: 'WhatsApp alerts dispatched' });
    }

    if (alert_type === 'integration') {
      const integrations = await base44.entities.Integration.filter({
        unit_id,
        schedule_enabled: true,
        schedule_frequency: 'daily'
      });

      for (const integration of integrations) {
        if (integration.schedule_time === currentTimeStr) {
          if (integration.auth_type === 'n8n_webhook' && integration.settings?.n8n_webhook_url) {
            try {
              await fetch(integration.settings.n8n_webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  integration_id: integration.id,
                  unit_id,
                  platform: integration.platform_id,
                  trigger: 'scheduled',
                  timestamp: new Date().toISOString()
                })
              });
            } catch (error) {
              console.error(`Integration webhook error for ${integration.id}:`, error.message);
            }
          }
        }
      }

      return Response.json({ success: true, message: 'Integration webhooks dispatched' });
    }

    return Response.json({ error: 'Invalid alert_type' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});