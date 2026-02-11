import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { unit_id, provider = 'META', window = '7d', ad_id } = await req.json();

    // Avaliar thresholds
    const evaluation = await base44.functions.invoke('evaluateKpiThresholds', {
      unit_id, provider, window, ad_id
    });

    if (!evaluation.data.success) {
      return Response.json({ error: 'Falha ao avaliar thresholds' }, { status: 500 });
    }

    const { evaluations } = evaluation.data;

    // Buscar regras ativas
    const rules = await base44.entities.KpiRule.filter({ 
      unit_id: 'global',
      provider,
      enabled: true 
    });

    const triggeredRules = [];

    // Avaliar cada regra
    rules.forEach(rule => {
      let conditionsMet = true;
      const conditions = rule.conditions || {};

      for (const [kpiKey, expectedStatus] of Object.entries(conditions)) {
        const evaluation = evaluations[kpiKey];
        if (!evaluation) {
          conditionsMet = false;
          break;
        }

        if (Array.isArray(expectedStatus)) {
          if (!expectedStatus.includes(evaluation.status)) {
            conditionsMet = false;
            break;
          }
        } else {
          if (evaluation.status !== expectedStatus) {
            conditionsMet = false;
            break;
          }
        }
      }

      if (conditionsMet) {
        triggeredRules.push({
          rule_name: rule.rule_name,
          severity: rule.severity,
          message_title: rule.message_title,
          message_body: rule.message_body,
          recommended_actions: rule.recommended_actions
        });
      }
    });

    return Response.json({
      success: true,
      evaluations,
      triggered_rules: triggeredRules,
      diagnostics_count: triggeredRules.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});