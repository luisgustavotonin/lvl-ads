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

    // Buscar alertas reais dos últimos dias
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const alertLogs = await base44.asServiceRole.entities.AlertLog.filter({
      unit_id,
      sent_at: { $gte: yesterdayStr }
    });

    // Filtrar por severidade
    let filteredAlerts = alertLogs;
    if (config.severity_filter === 'high_only') {
      filteredAlerts = alertLogs.filter(a => a.severity === 'high');
    } else if (config.severity_filter === 'medium_high') {
      filteredAlerts = alertLogs.filter(a => a.severity === 'high' || a.severity === 'medium');
    }

    // Buscar top anúncios
    const topAds = await base44.asServiceRole.entities.MetaAdDaily.filter({
      unit_id,
      date: yesterdayStr
    });

    // Ordenar por conversas e pegar top N
    const sortedAds = topAds
      .sort((a, b) => (b.wa_conversations_started_7d || 0) - (a.wa_conversations_started_7d || 0))
      .slice(0, config.top_ads_quantity || 3);

    // Montar string de alertas
    const alertsText = filteredAlerts.length > 0
      ? filteredAlerts.map(alert => {
          const icon = alert.severity === 'high' ? '🔴' : alert.severity === 'medium' ? '🟡' : '🟢';
          return `${icon} ${alert.message}`;
        }).join('\n')
      : '✅ Nenhum alerta detectado';

    // Montar string de top anúncios
    let topAdsText = '';
    if (sortedAds.length > 0) {
      topAdsText = sortedAds.map((ad, idx) => {
        const medals = ['🥇', '🥈', '🥉'];
        const medal = medals[idx] || '🏆';
        const spend = ad.spend?.toFixed(2) || '0.00';
        const conversations = ad.wa_conversations_started_7d || 0;
        const costPerConv = conversations > 0 ? (ad.spend / conversations).toFixed(2) : '0.00';
        
        return `${medal} *${ad.ad_name || 'Anúncio ' + (idx + 1)}*\n` +
               `💰 Investimento: R$ ${spend}\n` +
               `💬 Conversas: ${conversations}\n` +
               `📈 Custo/Conversa: R$ ${costPerConv}`;
      }).join('\n\n');
    } else {
      topAdsText = '_Nenhum anúncio encontrado no período_';
    }

    // Template padrão se não houver customizado
    const defaultTemplate = `🔔 *ALERTA DE PERFORMANCE - {{unit_name}}*

📅 *Data:* {{date}}
⏰ *Período:* Últimas 24 horas

━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *{{alert_count}} alertas detectados*

{{alerts}}

━━━━━━━━━━━━━━━━━━━━━━━━

📊 *TOP ${config.top_ads_quantity || 3} ANÚNCIOS DO DIA*

{{top_ads}}

━━━━━━━━━━━━━━━━━━━━━━━━

💡 *Recomendações:*
• Revisar anúncios com CTR abaixo de 1%
• Ajustar segmentação em campanhas com CPM elevado
• Pausar anúncios com frequência acima de 3.0

━━━━━━━━━━━━━━━━━━━━━━━━

🔗 _Acesse o painel para detalhes completos_`;

    const template = config.message_template || defaultTemplate;

    // Substituir todas as variáveis
    const message = template
      .replace(/{{unit_name}}/g, unitName)
      .replace(/{{date}}/g, new Date().toLocaleDateString('pt-BR'))
      .replace(/{{alert_count}}/g, filteredAlerts.length.toString())
      .replace(/{{alerts}}/g, alertsText)
      .replace(/{{top_ads}}/g, config.include_top_ads ? topAdsText : '_Top anúncios desabilitado_');

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