import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { unit_id, provider = 'META', alert_data } = await req.json();

    // Buscar configuração de alertas da unidade
    const configs = await base44.entities.AlertConfig.filter({ unit_id, provider, enabled: true });
    
    if (configs.length === 0) {
      return Response.json({ 
        success: false,
        message: 'Alertas não configurados para esta unidade' 
      });
    }

    const config = configs[0];

    // Filtrar por severidade
    const severityMap = {
      'high_only': ['high'],
      'medium_high': ['medium', 'high'],
      'all': ['low', 'medium', 'high']
    };

    const allowedSeverities = severityMap[config.severity_filter] || ['high'];
    
    const filteredRules = alert_data.triggered_rules?.filter(rule => 
      allowedSeverities.includes(rule.severity)
    ) || [];

    if (filteredRules.length === 0) {
      return Response.json({ 
        success: true,
        message: 'Nenhum alerta atende aos critérios de severidade' 
      });
    }

    // Buscar unit info
    const unit = await base44.entities.Unit.get(unit_id);

    // Montar mensagem
    let message = `🚨 *ALERTA META ADS*\n\n`;
    message += `📍 *Unidade:* ${unit?.name || unit_id}\n`;
    message += `📅 *Período:* ${alert_data.window || '7d'}\n`;
    message += `⚠️ *Problemas detectados:* ${filteredRules.length}\n\n`;

    filteredRules.forEach((rule, idx) => {
      message += `*${idx + 1}. ${rule.message_title}*\n`;
      message += `${rule.message_body}\n\n`;
      message += `💡 *Ações sugeridas:*\n`;
      rule.recommended_actions?.forEach(action => {
        message += `   • ${action}\n`;
      });
      message += `\n`;
    });

    // Top anúncios (se configurado)
    if (config.include_top_ads && alert_data.top_ads) {
      message += `\n📊 *Top ${config.top_ads_quantity || 3} Anúncios:*\n`;
      alert_data.top_ads.slice(0, config.top_ads_quantity || 3).forEach((ad, idx) => {
        message += `${idx + 1}. ${ad.ad_name} - R$ ${ad.spend?.toFixed(2)}\n`;
      });
    }

    // Payload do webhook
    const webhookPayload = {
      phone: config.phone_number,
      message,
      unit_id,
      provider,
      alert_type: 'diagnostic',
      severity: filteredRules[0]?.severity || 'medium',
      triggered_rules: filteredRules
    };

    // Enviar via webhook (se configurado) ou retornar payload
    if (config.webhook_url) {
      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      });

      // Log do alerta
      await base44.entities.AlertLog.create({
        unit_id,
        provider,
        alert_type: 'diagnostic_rule',
        severity: filteredRules[0]?.severity || 'medium',
        rule_name: filteredRules.map(r => r.rule_name).join(', '),
        message,
        sent_at: new Date().toISOString(),
        sent_status: response.ok ? 'sent' : 'failed'
      });

      return Response.json({
        success: response.ok,
        message: response.ok ? 'Alerta enviado com sucesso' : 'Erro ao enviar alerta',
        webhook_response: response.status
      });
    }

    return Response.json({
      success: true,
      message: 'Payload gerado (sem webhook configurado)',
      payload: webhookPayload
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});