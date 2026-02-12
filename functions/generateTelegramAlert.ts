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

    // Buscar informações da unidade
    const units = await base44.asServiceRole.entities.Unit.filter({ id: unit_id });
    const unitName = units[0]?.name || 'Unidade';
    
    // Buscar dados de hoje E ontem (caso ainda não tenha dados de hoje)
    const brasiliaDate = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const today = new Date(brasiliaDate).toISOString().split('T')[0];
    const yesterday = new Date(new Date(brasiliaDate) - 86400000).toISOString().split('T')[0];
    const todayFormatted = new Date(brasiliaDate).toLocaleDateString('pt-BR');
    
    // Tentar buscar dados de hoje primeiro
    let dailyData = await base44.asServiceRole.entities.MetaAdDaily.filter({
      unit_id,
      date: today
    });

    // Se não tiver dados de hoje, buscar de ontem
    let dateLabel = `Hoje (${todayFormatted})`;
    if (!dailyData || dailyData.length === 0) {
      dailyData = await base44.asServiceRole.entities.MetaAdDaily.filter({
        unit_id,
        date: yesterday
      });
      const yesterdayFormatted = new Date(new Date(brasiliaDate) - 86400000).toLocaleDateString('pt-BR');
      dateLabel = `Ontem (${yesterdayFormatted})`;
    }

    if (!dailyData || dailyData.length === 0) {
      return Response.json({ 
        message: `📡 CENTRAL DE PERFORMANCE – META ADS\nUnidade: ${unitName}\nData: ${todayFormatted}\nPeríodo analisado: Últimas 48h\n\n<i>Sem dados disponíveis para este período</i>` 
      });
    }

    // Calcular totais e coletar anúncios com conversas
    let totalSpend = 0;
    let totalConversations = 0;
    const adsWithConversations = [];

    dailyData.forEach(ad => {
      totalSpend += ad.spend || 0;
      totalConversations += ad.wa_conversations_started_7d || 0;
      
      // Adicionar apenas anúncios com conversas
      if ((ad.wa_conversations_started_7d || 0) > 0) {
        adsWithConversations.push({
          campaign_name: ad.campaign_name || 'Sem campanha',
          adset_name: ad.adset_name || 'Sem conjunto',
          ad_name: ad.ad_name || 'Sem nome',
          conversations: ad.wa_conversations_started_7d || 0
        });
      }
    });

    // Ordenar por conversas (maior para menor) e pegar top 3
    adsWithConversations.sort((a, b) => b.conversations - a.conversations);
    const topAds = adsWithConversations.slice(0, 3);

    // Custo médio por conversa
    const avgCostPerConv = totalConversations > 0 ? totalSpend / totalConversations : 0;

    // Status operacional automático
    let statusOperacional = '🟢 Nenhum desvio crítico identificado até o momento.';
    if (totalConversations === 0 && totalSpend > 50) {
      statusOperacional = '🔴 Atenção: Investimento acima de R$ 50,00 sem conversas geradas.';
    } else if (avgCostPerConv > 30) {
      statusOperacional = '🟡 Custo por conversa acima da média esperada. Recomenda-se otimização.';
    }

    // Lista de anúncios com conversas (top 3)
    let listaAnuncios = '';
    if (topAds.length === 0) {
      listaAnuncios = '(Nenhum anúncio gerou conversas no período.)';
    } else {
      topAds.forEach((ad, idx) => {
        listaAnuncios += `${idx + 1}º | ${ad.ad_name}\n`;
        listaAnuncios += `Campanha: ${ad.campaign_name}\n`;
        listaAnuncios += `Conjunto: ${ad.adset_name}\n`;
        listaAnuncios += `Conversas geradas: ${ad.conversations}\n\n`;
      });
      
      if (adsWithConversations.length > 3) {
        listaAnuncios += `(Demais anúncios ocultados por não estarem no top 3.)\n\n`;
      }
    }

    // Observação estratégica
    let observacaoEstrategica = '';
    if (adsWithConversations.length === 0) {
      observacaoEstrategica = 'Nenhum anúncio gerou conversas até o momento. Verifique a estratégia de segmentação e criativos.';
    } else if (adsWithConversations.length === 1) {
      observacaoEstrategica = 'A geração de conversas está concentrada em um único criativo até o momento. Recomenda-se monitoramento dos demais conjuntos ativos.';
    } else if (adsWithConversations.length <= 3) {
      observacaoEstrategica = 'Poucos anúncios estão gerando conversas. Considere expandir os criativos de maior performance.';
    } else {
      observacaoEstrategica = 'Múltiplos anúncios estão gerando conversas. Continue monitorando o desempenho.';
    }

    // Montar mensagem final
    let msg = `📡 CENTRAL DE PERFORMANCE – META ADS\n`;
    msg += `Unidade: ${unitName}\n`;
    msg += `Data: ${todayFormatted}\n`;
    msg += `Período analisado: ${dateLabel}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;
    
    msg += `📊 CONSOLIDADO DO DIA\n\n`;
    msg += `Investimento acumulado: R$ ${totalSpend.toFixed(2)}\n`;
    msg += `Conversas iniciadas: ${totalConversations}\n`;
    msg += `Custo médio por conversa: R$ ${avgCostPerConv.toFixed(2)}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;
    
    msg += `🎯 STATUS OPERACIONAL\n\n`;
    msg += `${statusOperacional}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;
    
    msg += `📈 ANÚNCIOS COM MAIOR GERAÇÃO DE CONVERSAS\n\n`;
    msg += `${listaAnuncios}`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;
    
    msg += `🔎 Observação Estratégica\n\n`;
    msg += `${observacaoEstrategica}`;

    return Response.json({ message: msg });

  } catch (error) {
    console.error('Erro ao gerar alerta:', error);
    return Response.json({ 
      error: error.message || 'Erro ao processar'
    }, { status: 500 });
  }
});