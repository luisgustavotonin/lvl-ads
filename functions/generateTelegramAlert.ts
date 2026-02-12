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

    // Buscar dados do dia
    const today = new Date().toISOString().split('T')[0];
    
    const dailyData = await base44.asServiceRole.entities.MetaAdDaily.filter({
      unit_id,
      date: today
    }, '-spend', 100);

    if (!dailyData || dailyData.length === 0) {
      return Response.json({ 
        message: `<b>📊 Relatório do Dia</b>\n\n<i>Sem dados para ${today}</i>` 
      });
    }

    // Calcular totais
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalConversations = 0;
    const ads = [];

    dailyData.forEach(ad => {
      totalSpend += ad.spend || 0;
      totalImpressions += ad.impressions || 0;
      totalConversations += ad.wa_conversations_started_7d || 0;
      
      ads.push({
        name: ad.ad_name || 'Sem nome',
        spend: ad.spend || 0,
        cpm: ad.cpm || 0,
        ctr: ad.ctr_link || 0,
        conversations: ad.wa_conversations_started_7d || 0
      });
    });

    // Ordenar por spend
    ads.sort((a, b) => b.spend - a.spend);
    const topAds = ads.slice(0, 3);

    // Montar mensagem
    let msg = `<b>📊 Relatório Diário - ${today}</b>\n\n`;
    
    msg += `<b>Resumo Geral</b>\n`;
    msg += `💰 Gasto: R$ ${totalSpend.toFixed(2)}\n`;
    msg += `👁️ Impressões: ${totalImpressions.toLocaleString('pt-BR')}\n`;
    msg += `💬 Conversas: ${totalConversations}\n\n`;

    if (totalSpend > 0) {
      const costPerConv = totalConversations > 0 ? totalSpend / totalConversations : 0;
      msg += `💵 Custo/Conversa: R$ ${costPerConv.toFixed(2)}\n\n`;
    }

    msg += `<b>Top Anúncios</b>\n`;
    topAds.forEach((ad, idx) => {
      msg += `\n${idx + 1}. ${ad.name}\n`;
      msg += `   💰 R$ ${ad.spend.toFixed(2)} | `;
      msg += `📊 CPM: ${ad.cpm.toFixed(2)} | `;
      msg += `📈 CTR: ${(ad.ctr * 100).toFixed(2)}%\n`;
    });

    return Response.json({ message: msg });

  } catch (error) {
    console.error('Erro ao gerar alerta:', error);
    return Response.json({ 
      error: error.message || 'Erro ao processar'
    }, { status: 500 });
  }
});