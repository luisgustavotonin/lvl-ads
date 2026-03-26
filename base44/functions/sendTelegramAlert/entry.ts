import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper para obter data atual em Brasília
function getBrasiliaDate() {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return brasiliaTime;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { unit_id } = await req.json();
    
    if (!unit_id) {
      return Response.json({ error: 'unit_id é obrigatório' }, { status: 400 });
    }

    // Buscar configuração do Telegram
    const configs = await base44.asServiceRole.entities.TelegramAlertConfig.filter({ 
      unit_id
    });
    
    if (!configs || configs.length === 0) {
      return Response.json({ error: 'Configuração Telegram não encontrada' }, { status: 404 });
    }

    const config = configs[0];

    if (!config.enabled) {
      return Response.json({ error: 'Alertas Telegram desabilitados' }, { status: 400 });
    }

    if (!config.bot_token || !config.chat_id) {
      return Response.json({ error: 'Bot token e Chat ID são obrigatórios' }, { status: 400 });
    }

    // Mensagem simples do alerta
    const message = `📊 <b>Alerta de Performance</b>\n\nUnidade: ${unit_id}\nHora: ${new Date().toLocaleString('pt-BR')}\n\nVerifique a dashboard para mais detalhes.`;

    // Se houver webhook, enviar para lá
    if (config.webhook_url && config.webhook_url.trim()) {
      try {
        const webhookResponse = await fetch(config.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: config.chat_id,
            text: message,
            parse_mode: 'Markdown'
          })
        });

        if (webhookResponse.ok) {
          return Response.json({ 
            success: true,
            message: 'Alerta enviado via webhook',
            via: 'webhook'
          });
        } else {
          console.warn('Webhook retornou:', webhookResponse.status);
        }
      } catch (webhookError) {
        console.error('Erro ao enviar webhook:', webhookError.message);
      }
    }

    // Fallback: enviar direto via API do Telegram
    const telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendMessage`;
    
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chat_id,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const telegramResult = await telegramResponse.json();

    if (!telegramResult.ok) {
      console.error('Telegram API error:', telegramResult);
      
      // Registrar falha no ExecutionLog
      await base44.asServiceRole.entities.ExecutionLog.create({
        unit_id: unit_id,
        log_type: 'alert_sent',
        status: 'error',
        trigger_type: 'manual',
        execution_time: getBrasiliaDate().toISOString(),
        alert_channel: 'telegram',
        message: 'Falha ao enviar alerta via Telegram',
        error_details: JSON.stringify(telegramResult)
      });
      
      return Response.json({ 
        error: 'Falha ao enviar via Telegram: ' + JSON.stringify(telegramResult)
      }, { status: 500 });
    }

    // Registrar sucesso no ExecutionLog
    await base44.asServiceRole.entities.ExecutionLog.create({
      unit_id: unit_id,
      log_type: 'alert_sent',
      status: 'success',
      trigger_type: 'manual',
      execution_time: getBrasiliaDate().toISOString(),
      alert_channel: 'telegram',
      message: 'Alerta enviado com sucesso via Telegram'
    });

    return Response.json({ 
      success: true,
      message: 'Alerta enviado com sucesso',
      via: 'telegram_api'
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return Response.json({ 
      error: error.message || 'Erro ao enviar alerta'
    }, { status: 500 });
  }
});