import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { unit_id, template = null } = await req.json();
    
    if (!unit_id) {
      return Response.json({ error: 'unit_id é obrigatório' }, { status: 400 });
    }

    // Buscar a unidade
    const units = await base44.asServiceRole.entities.Unit.filter({ id: unit_id });
    if (!units || units.length === 0) {
      return Response.json({ error: 'Unidade não encontrada' }, { status: 404 });
    }
    const unit = units[0];

    // Buscar dados do dia
    const today = new Date().toISOString().split('T')[0];
    
    const dailyData = await base44.asServiceRole.entities.MetaAdDaily.filter({
      unit_id,
      date: today
    }, '-spend', 100);

    if (!dailyData || dailyData.length === 0) {
      return Response.json({ 
        message: `🔔 ALERTA DE PERFORMANCE\n\n📍 Unidade: ${unit.name}\n📅 Data: ${formatDate(today)}\n\n━━━━━━━━━━━━━━━━━━\n\n<i>Sem dados para hoje</i>` 
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
        campaign_name: ad.campaign_name || 'Sem campanha',
        name: ad.ad_name || 'Sem nome',
        adset_name: ad.adset_name || '',
        spend: ad.spend || 0,
        conversations: ad.wa_conversations_started_7d || 0
      });
    });

    const costPerConv = totalConversations > 0 ? totalSpend / totalConversations : 0;

    // Ordenar por spend
    ads.sort((a, b) => b.spend - a.spend);
    const topAds = ads.slice(0, 3);

    // Usar template customizado ou padrão
    let msg = template || `🔔 ALERTA DE PERFORMANCE\n\n📍 Unidade: ${unit.name}\n📅 Data: ${formatDate(today)}\n⏰ Período: Hoje (00:00 até agora)\n\n━━━━━━━━━━━━━━━━━━\n\n📊 RESUMO DO DIA\n\n💰 Investimento: R$ ${totalSpend.toFixed(2)}\n💬 Conversas: ${totalConversations}\n📈 Custo/Conversa: R$ ${costPerConv.toFixed(2)}\n\n━━━━━━━━━━━━━━━━━━\n\n⚠️ ALERTAS DETECTADOS\n\n✅ Nenhum alerta detectado\n\n━━━━━━━━━━━━━━━━━━\n\n📈 TOP 3 ANÚNCIOS DO DIA`;

    topAds.forEach((ad, idx) => {
      const medals = ['🥇', '🥈', '🥉'];
      const costPerAd = ad.conversations > 0 ? ad.spend / ad.conversations : 0;
      msg += `\n\n${medals[idx]} ${ad.campaign_name}\n   └─ ${ad.adset_name}\n   └─ ${ad.name}\n\n   💰 Investimento: R$ ${ad.spend.toFixed(2)}\n   💬 Conversas: ${ad.conversations}\n   📊 Custo/Conversa: R$ ${costPerAd.toFixed(2)}`;
    });

    return Response.json({ message: msg });

  } catch (error) {
    console.error('Erro ao gerar alerta:', error);
    return Response.json({ 
      error: error.message || 'Erro ao processar'
    }, { status: 500 });
  }
});

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}