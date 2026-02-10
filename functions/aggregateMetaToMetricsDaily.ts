import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { date_from, date_to, unit_id } = await req.json();

    if (!unit_id) {
      return Response.json({ error: 'unit_id é obrigatório' }, { status: 400 });
    }

    if (!date_from || !date_to) {
      return Response.json({ error: 'date_from e date_to são obrigatórios' }, { status: 400 });
    }

    // CRÍTICO: date é STRING YYYY-MM-DD, comparação lexicográfica funciona
    // Buscar todos os MetaAdDaily no período especificado
    const metaAdDaily = await base44.asServiceRole.entities.MetaAdDaily.filter({
      unit_id,
      date: {
        $gte: date_from, // Comparação de string
        $lte: date_to,   // Comparação de string
      },
    }, '-date', 20000);

    if (metaAdDaily.length === 0) {
      return Response.json({ 
        ok: true, 
        message: 'Nenhum dado para agregar',
        stats: {
          dates_processed: 0,
          records_created: 0,
          records_updated: 0
        }
      });
    }

    // Agrupar por date (STRING, sem conversão)
    const byDate = {};
    metaAdDaily.forEach(ad => {
      const date = ad.date; // SEMPRE string YYYY-MM-DD
      if (!byDate[date]) {
        byDate[date] = {
          date, // STRING
          unit_id: ad.unit_id,
          account_id: ad.account_id,
          provider: 'meta',
          spend_sum: 0,
          impressions_sum: 0,
          reach_sum: 0,
          clicks_sum: 0,
          link_clicks_sum: 0,
          wa_conversations_started_7d_sum: 0,
          wa_total_messaging_connection_sum: 0,
          wa_messaging_first_reply_sum: 0,
          page_engagement_sum: 0,
          post_engagement_sum: 0,
          video_view_sum: 0,
          post_interaction_gross_sum: 0,
          post_reaction_sum: 0,
          post_net_like_sum: 0,
          aggregated_from_records: 0
        };
      }

      // Somar valores (conversão de tipo)
      byDate[date].spend_sum += parseFloat(ad.spend) || 0;
      byDate[date].impressions_sum += parseInt(ad.impressions) || 0;
      byDate[date].reach_sum += parseInt(ad.reach) || 0;
      byDate[date].clicks_sum += parseInt(ad.clicks) || 0;
      byDate[date].link_clicks_sum += parseInt(ad.link_clicks) || 0;
      byDate[date].wa_conversations_started_7d_sum += parseInt(ad.wa_conversations_started_7d) || 0;
      byDate[date].wa_total_messaging_connection_sum += parseInt(ad.wa_total_messaging_connection) || 0;
      byDate[date].wa_messaging_first_reply_sum += parseInt(ad.wa_messaging_first_reply) || 0;
      byDate[date].aggregated_from_records += 1;
    });

    // Recalcular métricas derivadas
    Object.values(byDate).forEach(day => {
      day.frequency_calc = day.reach_sum > 0 ? day.impressions_sum / day.reach_sum : 0;
      day.ctr_link_calc = day.impressions_sum > 0 ? day.link_clicks_sum / day.impressions_sum : 0;
      day.cpc_link_calc = day.link_clicks_sum > 0 ? day.spend_sum / day.link_clicks_sum : 0;
      day.cpm_calc = day.impressions_sum > 0 ? (day.spend_sum / day.impressions_sum) * 1000 : 0;
      day.cost_per_conversation_calc = day.wa_conversations_started_7d_sum > 0 ? 
        day.spend_sum / day.wa_conversations_started_7d_sum : 0;
      day.cost_per_total_contact_calc = day.wa_total_messaging_connection_sum > 0 ? 
        day.spend_sum / day.wa_total_messaging_connection_sum : 0;
      day.cost_per_first_reply_calc = day.wa_messaging_first_reply_sum > 0 ? 
        day.spend_sum / day.wa_messaging_first_reply_sum : 0;
    });

    let created = 0;
    let updated = 0;

    // Upsert em MetricsDaily
    for (const day of Object.values(byDate)) {
      const existing = await base44.asServiceRole.entities.MetricsDaily.filter({
        unit_id: day.unit_id,
        account_id: day.account_id,
        provider: 'meta',
        date: day.date // STRING comparison
      });

      if (existing.length > 0) {
        await base44.asServiceRole.entities.MetricsDaily.update(existing[0].id, day);
        updated++;
      } else {
        await base44.asServiceRole.entities.MetricsDaily.create(day);
        created++;
      }
    }

    return Response.json({
      ok: true,
      stats: {
        dates_processed: Object.keys(byDate).length,
        records_created: created,
        records_updated: updated,
        source_ads: metaAdDaily.length
      }
    });

  } catch (error) {
    console.error('Erro na agregação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});