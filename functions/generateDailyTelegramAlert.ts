import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { unit_id } = await req.json();

    if (!unit_id) {
      return Response.json({ error: 'unit_id é obrigatório' }, { status: 400 });
    }

    // Buscar unidade
    const unit = await base44.asServiceRole.entities.Unit.get(unit_id);
    if (!unit) {
      return Response.json({ error: 'Unidade não encontrada' }, { status: 404 });
    }

    // Data de hoje (formato yyyy-MM-dd)
    const today = new Date().toISOString().split('T')[0];

    // Buscar dados do dia
    const todayData = await base44.asServiceRole.entities.MetaAdDaily.filter({
      unit_id,
      date: today
    }, '-spend', 10000);

    if (todayData.length === 0) {
      return Response.json({
        message: `Nenhum dado encontrado para hoje (${today})`
      });
    }

    // Calcular métricas totais do dia
    const totalSpend = todayData.reduce((sum, ad) => sum + (ad.spend || 0), 0);
    const totalConversations = todayData.reduce((sum, ad) => sum + (ad.wa_conversations_started_7d || 0), 0);
    const avgCostPerConversation = totalConversations > 0 ? totalSpend / totalConversations : 0;

    // Detectar alertas
    const alerts = [];

    todayData.forEach(ad => {
      const adName = ad.ad_name || 'Anúncio sem nome';
      const adsetName = ad.adset_name || 'Conjunto sem nome';
      const campaignName = ad.campaign_name || 'Campanha sem nome';

      // CTR abaixo de 1%
      if ((ad.ctr_link || 0) < 1) {
        alerts.push({
          severity: 'medium',
          message: `CTR baixo (${(ad.ctr_link || 0).toFixed(2)}%) em "${adName}"`
        });
      }

      // Custo por conversa 30% acima da média
      const costPerConv = ad.cost_per_conversation || 0;
      if (avgCostPerConversation > 0 && costPerConv > avgCostPerConversation * 1.3) {
        alerts.push({
          severity: 'high',
          message: `Custo/conversa elevado (${formatCurrency(costPerConv)}) em "${adName}"`
        });
      }

      // Frequência acima de 3
      if ((ad.frequency || 0) > 3) {
        alerts.push({
          severity: 'medium',
          message: `Frequência alta (${(ad.frequency || 0).toFixed(1)}) em "${adName}"`
        });
      }

      // Nenhuma conversão com investimento acima de R$ 50
      if ((ad.spend || 0) > 50 && (ad.wa_conversations_started_7d || 0) === 0) {
        alerts.push({
          severity: 'high',
          message: `Sem conversões com R$ ${(ad.spend || 0).toFixed(2)} investidos em "${adName}"`
        });
      }
    });

    // Ordenar alertas por severidade
    alerts.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });

    // Top 3 anúncios (melhor custo por conversa)
    const adsWithConversions = todayData.filter(ad => (ad.wa_conversations_started_7d || 0) > 0);
    const topAds = adsWithConversions
      .sort((a, b) => {
        const costA = a.cost_per_conversation || Infinity;
        const costB = b.cost_per_conversation || Infinity;
        return costA - costB;
      })
      .slice(0, 3);

    // Gerar recomendações
    const recommendations = [];
    
    const highSeverityAlerts = alerts.filter(a => a.severity === 'high');
    const frequencyAlerts = alerts.filter(a => a.message.includes('Frequência alta'));
    const ctrAlerts = alerts.filter(a => a.message.includes('CTR baixo'));
    const noConversionAlerts = alerts.filter(a => a.message.includes('Sem conversões'));

    if (frequencyAlerts.length > 0) {
      recommendations.push('Pausar anúncios com frequência acima de 3 para evitar fadiga de audiência');
    }
    if (ctrAlerts.length > 0) {
      recommendations.push('Revisar criativos com CTR baixo e testar novas variações');
    }
    if (noConversionAlerts.length > 0) {
      recommendations.push('Redistribuir orçamento dos anúncios sem conversão para os mais eficientes');
    }
    if (highSeverityAlerts.length > 0) {
      recommendations.push('Revisar segmentação dos anúncios com custo elevado por conversa');
    }
    if (recommendations.length === 0 && topAds.length > 0) {
      recommendations.push('Desempenho estável. Considerar escalar os anúncios com melhor performance');
      recommendations.push('Manter monitoramento de métricas ao longo do dia');
    }

    // Formatar mensagem
    const dateStr = new Date().toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });

    let message = `━━━━━━━━━━━━━━━━━━\n\n`;
    message += `🔔 *ALERTA DE PERFORMANCE*\n\n`;
    message += `📍 Unidade: *${unit.name}*\n`;
    message += `📅 Data: ${dateStr}\n`;
    message += `⏰ Período: Hoje (00:00 até agora)\n\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;

    // Resumo do dia
    message += `📊 *RESUMO DO DIA*\n\n`;
    message += `💰 Investimento: ${formatCurrency(totalSpend)}\n`;
    message += `💬 Conversas: ${totalConversations}\n`;
    message += `📈 Custo/Conversa: ${formatCurrency(avgCostPerConversation)}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;

    // Alertas
    message += `⚠️ *ALERTAS DETECTADOS*\n\n`;
    if (alerts.length === 0) {
      message += `✅ Nenhum alerta detectado\n\n`;
    } else {
      message += `Total: ${alerts.length} alerta(s)\n\n`;
      alerts.slice(0, 5).forEach((alert, idx) => {
        const emoji = alert.severity === 'high' ? '🔴' : '🟡';
        message += `${emoji} ${alert.message}\n\n`;
      });
    }
    message += `━━━━━━━━━━━━━━━━━━\n\n`;

    // Top 3 anúncios
    message += `📈 *TOP 3 ANÚNCIOS DO DIA*\n\n`;
    if (topAds.length === 0) {
      message += `Nenhum anúncio com conversões até o momento\n\n`;
    } else {
      const medals = ['🥇', '🥈', '🥉'];
      topAds.forEach((ad, idx) => {
        message += `${medals[idx]} *${ad.campaign_name || 'Campanha'}*\n`;
        message += `   ↳ ${ad.adset_name || 'Conjunto'}\n`;
        message += `   ↳ ${ad.ad_name || 'Anúncio'}\n\n`;
        message += `   💰 Investimento: ${formatCurrency(ad.spend || 0)}\n`;
        message += `   💬 Conversas: ${ad.wa_conversations_started_7d || 0}\n`;
        message += `   📊 Custo/Conversa: ${formatCurrency(ad.cost_per_conversation || 0)}\n\n`;
      });
    }
    message += `━━━━━━━━━━━━━━━━━━\n\n`;

    // Recomendações
    message += `💡 *RECOMENDAÇÕES*\n\n`;
    recommendations.forEach(rec => {
      message += `• ${rec}\n`;
    });
    message += `\n━━━━━━━━━━━━━━━━━━`;

    return Response.json({
      success: true,
      message,
      data: {
        totalSpend,
        totalConversations,
        avgCostPerConversation,
        alertsCount: alerts.length,
        topAdsCount: topAds.length
      }
    });

  } catch (error) {
    console.error('Error generating daily alert:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(value);
}