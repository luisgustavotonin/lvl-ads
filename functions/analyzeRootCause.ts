import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { unit_id, metric_key, metric_value, lookback_days = 30 } = await req.json();

    if (!unit_id || !metric_key) {
      return Response.json({ error: 'unit_id e metric_key são obrigatórios' }, { status: 400 });
    }

    // Buscar dados históricos
    const today = new Date();
    const pastDate = new Date(today.getTime() - lookback_days * 24 * 60 * 60 * 1000);
    const dateStr = pastDate.toISOString().split('T')[0];

    const historicalData = await base44.asServiceRole.entities.MetaAdDaily.filter({
      unit_id,
      date: { $gte: dateStr }
    }, '-date', 1000);

    if (!historicalData || historicalData.length === 0) {
      return Response.json({
        success: true,
        root_causes: ['Dados históricos insuficientes para análise'],
        confidence: 'low'
      });
    }

    // Calcular correlações e identificar causas raiz
    const rootCauses = [];
    const correlations = {};

    // Análise por métrica
    if (metric_key === 'ctr_link') {
      // CTR baixo pode estar correlacionado com alta frequência, audience fatigue
      const avgFrequency = historicalData.reduce((sum, d) => sum + (d.frequency || 0), 0) / historicalData.length;
      if (metric_value < 0.01 && avgFrequency > 3) {
        rootCauses.push('Audience fatigue - frequência muito alta causando fadiga de audiência');
      }

      // CTR baixo com CPM alto = problemas de creative
      const avgCPM = historicalData.reduce((sum, d) => {
        const impressions = d.impressions || 0;
        const spend = d.spend || 0;
        return sum + (impressions > 0 ? (spend / impressions) * 1000 : 0);
      }, 0) / historicalData.length;
      if (metric_value < 0.01 && avgCPM > 5) {
        rootCauses.push('Creative irrelevante - testar novos formatos e mensagens');
      }

      // CTR baixo com segmentação muito ampla
      rootCauses.push('Segmentação de audiência muito ampla - refinar targeting');
    }

    if (metric_key === 'cpm') {
      // CPM alto com performance baixa = saturação de audience
      const avgCTR = historicalData.reduce((sum, d) => sum + (d.ctr_link || 0), 0) / historicalData.length;
      if (metric_value > 10 && avgCTR < 0.01) {
        rootCauses.push('Saturação de audiência - audience está sobrecarregada');
      }

      // CPM alto com baixa qualidade de creative
      rootCauses.push('Competição alta neste segmento - revisar positioning');
      rootCauses.push('Qualidade do site ou landing page pode estar afetando Score de Relevância');
    }

    if (metric_key === 'cost_per_conversation') {
      // Custo/conv alto com audience grande = eficiência baixa
      const avgReach = historicalData.reduce((sum, d) => sum + (d.reach || 0), 0) / historicalData.length;
      if (metric_value > 5 && avgReach > 10000) {
        rootCauses.push('Baixa taxa de conversão da audiência - optimizar landing page');
      }

      // Custo/conv alto = budget distribuído para baixo-performers
      rootCauses.push('Orçamento alocado para anúncios com baixa performance');
    }

    if (metric_key === 'frequency') {
      // Frequência alta = audience pequena ou budget muito concentrado
      if (metric_value > 5) {
        rootCauses.push('Audiência muito pequena ou budget concentrado - expandir audience');
        rootCauses.push('Estático creative - audiência viu muitas vezes a mesma mensagem');
      }
    }

    // Se não houver causas específicas, adicionar genéricas
    if (rootCauses.length === 0) {
      rootCauses.push('Mudanças no comportamento da audiência - monitorar tendências');
      rootCauses.push('Sazonalidade ou eventos externos afetando performance');
    }

    // Calcular confiança baseado na qualidade dos dados
    const dataQuality = historicalData.length / lookback_days;
    let confidence = 'low';
    if (dataQuality > 0.8) confidence = 'high';
    else if (dataQuality > 0.5) confidence = 'medium';

    return Response.json({
      success: true,
      root_causes: rootCauses.slice(0, 5),
      confidence,
      data_points: historicalData.length
    });

  } catch (error) {
    console.error('Erro na análise de causa raiz:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});