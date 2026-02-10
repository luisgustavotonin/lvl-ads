import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Conversão de tipos segura
function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

// Extrair valor de actions[] se existir
function getActionValue(actions, actionType) {
  if (!Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? toNumber(action.value) : 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { unit_id, date_from, date_to } = body;

    console.log('🔄 Iniciando agregação MetaAdDaily → MetricsDaily');
    console.log('Parâmetros:', { unit_id, date_from, date_to });

    // Buscar dados de MetaAdDaily
    let query = {};
    if (unit_id) query.unit_id = unit_id;
    if (date_from && date_to) {
      query.date = { $gte: date_from, $lte: date_to };
    }

    const metaAds = await base44.asServiceRole.entities.MetaAdDaily.filter(query, '-date', 10000);
    console.log(`📊 ${metaAds.length} registros MetaAdDaily encontrados`);

    if (metaAds.length === 0) {
      return Response.json({
        success: true,
        message: 'Nenhum registro para agregar',
        stats: { processed: 0, created: 0, updated: 0 }
      });
    }

    // Agrupar por provider + unit_id + account_id + date
    const groups = {};
    
    for (const ad of metaAds) {
      const key = `${ad.unit_id}|${ad.account_id}|${ad.date}`;
      
      if (!groups[key]) {
        groups[key] = {
          unit_id: ad.unit_id,
          account_id: ad.account_id,
          provider: 'meta',
          date: ad.date,
          records: []
        };
      }
      
      groups[key].records.push(ad);
    }

    console.log(`📦 ${Object.keys(groups).length} grupos criados (unit+account+date)`);

    let created = 0;
    let updated = 0;
    const warnings = [];

    // Processar cada grupo
    for (const [key, group] of Object.entries(groups)) {
      const { unit_id, account_id, provider, date, records } = group;

      // SOMAR métricas
      let spend_sum = 0;
      let impressions_sum = 0;
      let reach_sum = 0;
      let clicks_sum = 0;
      let link_clicks_sum = 0;
      let wa_conversations_started_7d_sum = 0;
      let wa_total_messaging_connection_sum = 0;
      let wa_messaging_first_reply_sum = 0;
      let page_engagement_sum = 0;
      let post_engagement_sum = 0;
      let video_view_sum = 0;
      let post_interaction_gross_sum = 0;
      let post_reaction_sum = 0;
      let post_net_like_sum = 0;

      for (const ad of records) {
        // Conversão de tipos OBRIGATÓRIA
        spend_sum += toNumber(ad.spend);
        impressions_sum += toNumber(ad.impressions);
        reach_sum += toNumber(ad.reach);
        clicks_sum += toNumber(ad.clicks);
        link_clicks_sum += toNumber(ad.link_clicks);
        wa_conversations_started_7d_sum += toNumber(ad.wa_conversations_started_7d);
        wa_total_messaging_connection_sum += toNumber(ad.wa_total_messaging_connection);
        wa_messaging_first_reply_sum += toNumber(ad.wa_messaging_first_reply);

        // Tentar extrair de actions[] se existir
        if (ad.actions && Array.isArray(ad.actions)) {
          page_engagement_sum += getActionValue(ad.actions, 'page_engagement');
          post_engagement_sum += getActionValue(ad.actions, 'post_engagement');
          video_view_sum += getActionValue(ad.actions, 'video_view');
          post_interaction_gross_sum += getActionValue(ad.actions, 'post');
          post_reaction_sum += getActionValue(ad.actions, 'post_reaction');
          post_net_like_sum += getActionValue(ad.actions, 'like');
        }

        // Warning se reach = 0
        if (toNumber(ad.reach) === 0 && toNumber(ad.impressions) > 0) {
          warnings.push(`⚠️ Reach = 0 mas impressions > 0 para ad_id=${ad.ad_id} date=${ad.date}`);
        }
      }

      // RECALCULAR métricas derivadas
      const frequency_calc = reach_sum > 0 ? impressions_sum / reach_sum : 0;
      const ctr_link_calc = impressions_sum > 0 ? link_clicks_sum / impressions_sum : 0;
      const cpc_link_calc = link_clicks_sum > 0 ? spend_sum / link_clicks_sum : 0;
      const cpm_calc = impressions_sum > 0 ? (spend_sum / impressions_sum) * 1000 : 0;
      const cost_per_conversation_calc = wa_conversations_started_7d_sum > 0 ? spend_sum / wa_conversations_started_7d_sum : 0;
      const cost_per_total_contact_calc = wa_total_messaging_connection_sum > 0 ? spend_sum / wa_total_messaging_connection_sum : 0;
      const cost_per_first_reply_calc = wa_messaging_first_reply_sum > 0 ? spend_sum / wa_messaging_first_reply_sum : 0;

      const metricData = {
        unit_id,
        account_id,
        provider,
        date,
        spend_sum,
        impressions_sum,
        reach_sum,
        clicks_sum,
        link_clicks_sum,
        wa_conversations_started_7d_sum,
        wa_total_messaging_connection_sum,
        wa_messaging_first_reply_sum,
        page_engagement_sum,
        post_engagement_sum,
        video_view_sum,
        post_interaction_gross_sum,
        post_reaction_sum,
        post_net_like_sum,
        frequency_calc,
        ctr_link_calc,
        cpc_link_calc,
        cpm_calc,
        cost_per_conversation_calc,
        cost_per_total_contact_calc,
        cost_per_first_reply_calc,
        aggregated_from_records: records.length
      };

      // Verificar se já existe
      const existing = await base44.asServiceRole.entities.MetricsDaily.filter({
        unit_id,
        account_id,
        provider,
        date
      });

      if (existing.length > 0) {
        await base44.asServiceRole.entities.MetricsDaily.update(existing[0].id, metricData);
        updated++;
      } else {
        await base44.asServiceRole.entities.MetricsDaily.create(metricData);
        created++;
      }
    }

    console.log(`✅ Agregação concluída: ${created} criados, ${updated} atualizados`);
    if (warnings.length > 0) {
      console.log('⚠️ Warnings:', warnings.slice(0, 10));
    }

    return Response.json({
      success: true,
      stats: {
        processed: metaAds.length,
        groups: Object.keys(groups).length,
        created,
        updated,
        warnings: warnings.length
      },
      warnings: warnings.slice(0, 20)
    });

  } catch (error) {
    console.error('❌ Erro na agregação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});