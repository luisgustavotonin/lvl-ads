import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Todos os KPIs do relatório (baseado em pages/Reports)
const ALL_REPORT_KPIS = [
  { id: 'spend', label: 'Investimento', group: 'Investimento', direction: 'higher_is_better' },
  { id: 'impressions', label: 'Impressões', group: 'Volume', direction: 'higher_is_better' },
  { id: 'reach', label: 'Alcance', group: 'Volume', direction: 'higher_is_better' },
  { id: 'frequency', label: 'Frequência', group: 'Qualidade', direction: 'higher_is_better' },
  { id: 'clicks', label: 'Cliques', group: 'Engajamento', direction: 'higher_is_better' },
  { id: 'linkClicks', label: 'Cliques no link', group: 'Engajamento', direction: 'higher_is_better' },
  { id: 'ctrLink', label: 'CTR Link', group: 'Eficiência', direction: 'higher_is_better' },
  { id: 'cpcLink', label: 'CPC Link', group: 'Custo', direction: 'lower_is_better' },
  { id: 'cpm', label: 'CPM', group: 'Custo', direction: 'lower_is_better' },
  { id: 'conversations', label: 'Conversas Iniciadas', group: 'Conversão', direction: 'higher_is_better' },
  { id: 'totalContact', label: 'Contatos por Mensagem', group: 'Conversão', direction: 'higher_is_better' },
  { id: 'firstReply', label: 'Primeira Resposta', group: 'Conversão', direction: 'higher_is_better' },
  { id: 'costPerConversation', label: 'Custo/Conversa', group: 'Custo', direction: 'lower_is_better' },
  { id: 'costPerTotalContact', label: 'Custo/Contato Total', group: 'Custo', direction: 'lower_is_better' },
  { id: 'costPerFirstReply', label: 'Custo/Primeira Resposta', group: 'Custo', direction: 'lower_is_better' },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const { unit_id } = await req.json();
    
    if (!unit_id) {
      return Response.json({ error: 'unit_id é obrigatório' }, { status: 400 });
    }

    // Buscar thresholds existentes para esta unidade
    const existingThresholds = await base44.asServiceRole.entities.KpiThreshold.filter({ unit_id });
    const existingKeys = new Set(existingThresholds.map(t => t.kpi_key));

    // Criar thresholds para KPIs que ainda não existem
    const newThresholds = [];
    for (const kpi of ALL_REPORT_KPIS) {
      if (!existingKeys.has(kpi.id)) {
        newThresholds.push({
          unit_id,
          provider: 'META',
          kpi_key: kpi.id,
          kpi_name: kpi.label,
          group: kpi.group,
          direction: kpi.direction,
          green_min: 0,
          green_max: 999999,
          yellow_min: 0,
          yellow_max: 0,
          red_min: 0,
          red_max: 0,
          evaluation_window: 'both',
          min_spend_to_evaluate_7d: 20,
          min_spend_to_evaluate_30d: 50,
          min_impressions_to_evaluate_7d: 1000,
          min_impressions_to_evaluate_30d: 3000,
          enabled: false
        });
      }
    }

    if (newThresholds.length > 0) {
      await base44.asServiceRole.entities.KpiThreshold.bulkCreate(newThresholds);
    }

    return Response.json({
      ok: true,
      created: newThresholds.length,
      total_kpis: ALL_REPORT_KPIS.length,
      message: `${newThresholds.length} novos KPIs adicionados aos parâmetros`
    });

  } catch (error) {
    console.error('❌ Erro ao sincronizar KPIs:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});