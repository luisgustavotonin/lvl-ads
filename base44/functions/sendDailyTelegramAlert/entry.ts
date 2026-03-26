import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { unit_id } = await req.json();

    if (!unit_id) {
      return Response.json({ error: 'unit_id é obrigatório' }, { status: 400 });
    }

    // Buscar configuração do Telegram
    const configs = await base44.asServiceRole.entities.TelegramAlertConfig.filter({
      unit_id,
      enabled: true
    });

    if (configs.length === 0) {
      return Response.json({ 
        error: 'Configuração de Telegram não encontrada ou desabilitada' 
      }, { status: 404 });
    }

    const config = configs[0];

    // Gerar relatório
    const reportResponse = await base44.asServiceRole.functions.invoke('generateDailyTelegramAlert', {
      unit_id
    });

    if (!reportResponse.data?.success) {
      return Response.json({ 
        error: 'Erro ao gerar relatório', 
        details: reportResponse.data 
      }, { status: 500 });
    }

    const message = reportResponse.data.message;

    // Enviar via webhook ou Telegram API
    if (config.webhook_url) {
      // Enviar via webhook (n8n)
      const webhookResponse = await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id,
          message,
          bot_token: config.bot_token,
          chat_id: config.chat_id,
          parse_mode: 'Markdown'
        })
      });

      if (!webhookResponse.ok) {
        throw new Error(`Webhook falhou: ${webhookResponse.statusText}`);
      }

      return Response.json({
        success: true,
        method: 'webhook',
        message: 'Alerta enviado via webhook com sucesso'
      });

    } else if (config.bot_token && config.chat_id) {
      // Enviar direto via Telegram API
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

      const result = await telegramResponse.json();

      if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`);
      }

      return Response.json({
        success: true,
        method: 'telegram_api',
        message: 'Alerta enviado via Telegram API com sucesso'
      });

    } else {
      return Response.json({ 
        error: 'Configuração inválida: webhook_url ou bot_token/chat_id necessários' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error sending daily alert:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});