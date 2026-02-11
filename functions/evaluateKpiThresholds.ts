import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { unit_id, provider = 'META', window = '7d', ad_id } = await req.json();

    // Buscar thresholds
    const thresholds = await base44.entities.KpiThreshold.filter({ 
      unit_id, 
      provider,
      enabled: true 
    });

    // Calcular período
    const today = new Date();
    const daysAgo = window === '7d' ? 7 : 30;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysAgo);

    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    // Buscar dados
    const filter = { unit_id, date: { $gte: dateFrom, $lte: dateTo } };
    if (ad_id) filter.ad_id = ad_id;

    const data = await base44.entities.MetaAdDaily.filter(filter, '-date', 5000);

    // Agregar métricas
    const aggregated = data.reduce((acc, d) => {
      return {
        spend: acc.spend + (d.spend || 0),
        impressions: acc.impressions + (d.impressions || 0),
        reach: acc.reach + (d.reach || 0),
        frequency: acc.frequency + (d.frequency || 0),
        clicks: acc.clicks + (d.clicks || 0),
        link_clicks: acc.link_clicks + (d.link_clicks || 0),
        ctr_link: acc.ctr_link + (d.ctr_link || 0),
        cpc_link: acc.cpc_link + (d.cpc_link || 0),
        cpm: acc.cpm + (d.cpm || 0),
        wa_conversations_started_7d: acc.wa_conversations_started_7d + (d.wa_conversations_started_7d || 0),
        wa_total_messaging_connection: acc.wa_total_messaging_connection + (d.wa_total_messaging_connection || 0),
        wa_messaging_first_reply: acc.wa_messaging_first_reply + (d.wa_messaging_first_reply || 0),
        cost_per_conversation: acc.cost_per_conversation + (d.cost_per_conversation || 0),
        cost_per_total_contact: acc.cost_per_total_contact + (d.cost_per_total_contact || 0),
        cost_per_first_reply: acc.cost_per_first_reply + (d.cost_per_first_reply || 0),
        count: acc.count + 1
      };
    }, {
      spend: 0, impressions: 0, reach: 0, frequency: 0, clicks: 0, link_clicks: 0,
      ctr_link: 0, cpc_link: 0, cpm: 0, wa_conversations_started_7d: 0,
      wa_total_messaging_connection: 0, wa_messaging_first_reply: 0,
      cost_per_conversation: 0, cost_per_total_contact: 0, cost_per_first_reply: 0,
      count: 0
    });

    // Calcular médias onde necessário
    if (aggregated.count > 0) {
      aggregated.frequency = aggregated.frequency / aggregated.count;
      aggregated.ctr_link = aggregated.ctr_link / aggregated.count;
      aggregated.cpc_link = aggregated.cpc_link / aggregated.count;
      aggregated.cpm = aggregated.cpm / aggregated.count;
      aggregated.cost_per_conversation = aggregated.cost_per_conversation / aggregated.count;
      aggregated.cost_per_total_contact = aggregated.cost_per_total_contact / aggregated.count;
      aggregated.cost_per_first_reply = aggregated.cost_per_first_reply / aggregated.count;
    }

    // Verificar mínimos
    const minSpendKey = window === '7d' ? 'min_spend_to_evaluate_7d' : 'min_spend_to_evaluate_30d';
    const minImpressionsKey = window === '7d' ? 'min_impressions_to_evaluate_7d' : 'min_impressions_to_evaluate_30d';

    const evaluations = {};

    thresholds.forEach(threshold => {
      const minSpend = threshold[minSpendKey] || 0;
      const minImpressions = threshold[minImpressionsKey] || 0;

      if (aggregated.spend < minSpend || aggregated.impressions < minImpressions) {
        evaluations[threshold.kpi_key] = {
          status: 'insufficient_data',
          value: aggregated[threshold.kpi_key],
          threshold: threshold
        };
        return;
      }

      const value = aggregated[threshold.kpi_key] || 0;
      let status = 'gray';

      if (value >= threshold.green_min && value <= threshold.green_max) {
        status = 'green';
      } else if (value >= threshold.yellow_min && value <= threshold.yellow_max) {
        status = 'yellow';
      } else if (value >= threshold.red_min && value <= threshold.red_max) {
        status = 'red';
      }

      evaluations[threshold.kpi_key] = {
        status,
        value,
        threshold: {
          kpi_name: threshold.kpi_name,
          direction: threshold.direction,
          green: [threshold.green_min, threshold.green_max],
          yellow: [threshold.yellow_min, threshold.yellow_max],
          red: [threshold.red_min, threshold.red_max]
        }
      };
    });

    return Response.json({
      success: true,
      window,
      period: { from: dateFrom, to: dateTo },
      aggregated,
      evaluations
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});