import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
      unit_id,
      enabled: true 
    });
    
    if (configs.length === 0) {
      return Response.json({ error: 'Configuração Telegram não encontrada ou desabilitada' }, { status: 400 });
    }

    const config = configs[0];

    if (!config.bot_token || !config.chat_id) {
      return Response.json({ error: 'Bot token e Chat ID são obrigatórios' }, { status: 400 });
    }

    // Gerar relatório usando a nova função
    const reportResponse = await base44.asServiceRole.functions.invoke('generateDailyTelegramAlert', {
      unit_id
    });

    if (!reportResponse?.data?.success) {
      throw new Error('Erro ao gerar relatório: ' + JSON.stringify(reportResponse?.data));
    }

    const message = reportResponse?.data?.message;

    // Payload simples para webhook ou Telegram
    const payload = {
      chat_id: config.chat_id,
      message: message
    };

    // Se houver webhook configurado, enviar para lá
    if (config.webhook_url) {
      const webhookResponse = await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!webhookResponse.ok) {
        throw new Error('Erro ao enviar para webhook: ' + await webhookResponse.text());
      }

      return Response.json({ 
        ok: true, 
        message: 'Alerta enviado via webhook com sucesso',
        via: 'webhook',
        payload
      });
    }

    // Enviar direto via API do Telegram
    const telegramApiUrl = `https://api.telegram.org/bot${config.bot_token}/sendMessage`;
    
    const telegramResponse = await fetch(telegramApiUrl, {
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
      throw new Error('Erro da API Telegram: ' + JSON.stringify(result));
    }

    return Response.json({ 
      ok: true, 
      message: 'Alerta enviado com sucesso',
      via: 'telegram_api',
      telegram_response: result,
      payload
    });

  } catch (error) {
    console.error('❌ Erro ao enviar alerta Telegram:', error);
    return Response.json({ 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
});