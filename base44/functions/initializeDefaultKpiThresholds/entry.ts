import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { unit_id, provider = 'META' } = await req.json();

    // Verificar se já existem thresholds para essa unidade/provider
    const existing = await base44.entities.KpiThreshold.filter({ unit_id, provider });
    
    if (existing.length > 0) {
      return Response.json({ 
        message: 'Thresholds já existem',
        count: existing.length 
      });
    }

    // Thresholds recomendados para clínica odontológica (Meta Ads - WhatsApp)
    const defaultThresholds = [
      {
        unit_id, provider,
        kpi_key: 'spend', kpi_name: 'Investimento',
        group: 'Volume', direction: 'higher_is_better',
        green_min: 0, green_max: 999999, yellow_min: 0, yellow_max: 999999, red_min: 0, red_max: 999999,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'impressions', kpi_name: 'Impressões',
        group: 'Volume', direction: 'higher_is_better',
        green_min: 5000, green_max: 999999, yellow_min: 2000, yellow_max: 4999, red_min: 0, red_max: 1999,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'reach', kpi_name: 'Alcance',
        group: 'Volume', direction: 'higher_is_better',
        green_min: 3000, green_max: 999999, yellow_min: 1000, yellow_max: 2999, red_min: 0, red_max: 999,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'frequency', kpi_name: 'Frequência',
        group: 'Qualidade', direction: 'lower_is_better',
        green_min: 1.0, green_max: 2.2, yellow_min: 2.21, yellow_max: 3.0, red_min: 3.01, red_max: 999,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'link_clicks', kpi_name: 'Cliques no Link',
        group: 'Interesse', direction: 'higher_is_better',
        green_min: 50, green_max: 999999, yellow_min: 20, yellow_max: 49, red_min: 0, red_max: 19,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'ctr_link', kpi_name: 'CTR Link',
        group: 'Interesse', direction: 'higher_is_better',
        green_min: 1.5, green_max: 100, yellow_min: 1.0, yellow_max: 1.49, red_min: 0, red_max: 0.99,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'cpc_link', kpi_name: 'CPC Link',
        group: 'Custo', direction: 'lower_is_better',
        green_min: 0, green_max: 1.50, yellow_min: 1.51, yellow_max: 2.50, red_min: 2.51, red_max: 999,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'cpm', kpi_name: 'CPM',
        group: 'Custo', direction: 'lower_is_better',
        green_min: 0, green_max: 25, yellow_min: 26, yellow_max: 40, red_min: 41, red_max: 999,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'wa_conversations_started_7d', kpi_name: 'Conversas Iniciadas (WA)',
        group: 'Conversão', direction: 'higher_is_better',
        green_min: 10, green_max: 999999, yellow_min: 3, yellow_max: 9, red_min: 0, red_max: 2,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'cost_per_conversation', kpi_name: 'Custo por Conversa',
        group: 'Conversão', direction: 'lower_is_better',
        green_min: 0, green_max: 25, yellow_min: 26, yellow_max: 35, red_min: 36, red_max: 999,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'wa_total_messaging_connection', kpi_name: 'Contatos por Mensagem',
        group: 'Conversão', direction: 'higher_is_better',
        green_min: 5, green_max: 999999, yellow_min: 2, yellow_max: 4, red_min: 0, red_max: 1,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'cost_per_total_contact', kpi_name: 'Custo por Contato',
        group: 'Custo', direction: 'lower_is_better',
        green_min: 0, green_max: 20, yellow_min: 21, yellow_max: 30, red_min: 31, red_max: 999,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'wa_messaging_first_reply', kpi_name: 'Primeira Resposta (WA)',
        group: 'Qualidade', direction: 'higher_is_better',
        green_min: 5, green_max: 999999, yellow_min: 2, yellow_max: 4, red_min: 0, red_max: 1,
        evaluation_window: 'both', enabled: true
      },
      {
        unit_id, provider,
        kpi_key: 'cost_per_first_reply', kpi_name: 'Custo por Primeira Resposta',
        group: 'Custo', direction: 'lower_is_better',
        green_min: 0, green_max: 25, yellow_min: 26, yellow_max: 35, red_min: 36, red_max: 999,
        evaluation_window: 'both', enabled: true
      },
    ];

    // Criar todos os thresholds
    await base44.entities.KpiThreshold.bulkCreate(defaultThresholds);

    return Response.json({ 
      success: true,
      message: 'Thresholds padrão criados com sucesso',
      count: defaultThresholds.length 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});