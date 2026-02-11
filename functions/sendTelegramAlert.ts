import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { unit_id, test_mode } = await req.json();
    
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

    // Buscar dados da unidade
    const unit = await base44.asServiceRole.entities.Unit.filter({ id: unit_id });
    const unitName = unit[0]?.name || 'Unidade';

    // Mensagem de teste ou real
    let message;
    if (test_mode) {
      message = `🔔 *Teste de Alerta - ${unitName}*\n\n` +
                `✅ Configuração funcionando corretamente!\n\n` +
                `Data: ${new Date().toLocaleDateString('pt-BR')}\n` +
                `Hora: ${new Date().toLocaleTimeString('pt-BR')}\n\n` +
                `_Este é um alerta de teste._`;
    } else {
      // Template padrão
      const defaultTemplate = `🔔 *Alerta de Performance - {{unit_name}}*\n\n` +
                             `📅 Data: {{date}}\n` +
                             `⚠️ Alertas detectados: {{alert_count}}\n\n` +
                             `{{alerts}}\n\n` +
                             `_Configure os alertas em Parâmetros & Alertas_`;
      
      const template = config.message_template || defaultTemplate;
      
      // Substituir variáveis (exemplo simplificado para teste)
      message = template
        .replace(/{{unit_name}}/g, unitName)
        .replace(/{{date}}/g, new Date().toLocaleDateString('pt-BR'))
        .replace(/{{alert_count}}/g, '3')
        .replace(/{{alerts}}/g, '• CTR Link abaixo do esperado\n• CPM acima do normal\n• Frequência muito alta');
    }

    // Se houver webhook configurado, enviar para lá
    if (config.webhook_url) {
      const webhookResponse = await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id,
          unit_name: unitName,
          message,
          bot_token: config.bot_token,
          chat_id: config.chat_id,
          test_mode
        })
      });

      if (!webhookResponse.ok) {
        throw new Error('Erro ao enviar para webhook: ' + await webhookResponse.text());
      }

      return Response.json({ 
        ok: true, 
        message: 'Alerta enviado via webhook com sucesso',
        via: 'webhook'
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
      telegram_response: result
    });

  } catch (error) {
    console.error('❌ Erro ao enviar alerta Telegram:', error);
    return Response.json({ 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
});