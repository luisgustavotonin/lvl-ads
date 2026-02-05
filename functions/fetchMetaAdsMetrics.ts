import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { integration_id, period, start_date, end_date, metrics, breakdown } = await req.json();

    if (!integration_id) {
      return Response.json({ error: 'integration_id is required' }, { status: 400 });
    }

    // Buscar integração
    const integrations = await base44.asServiceRole.entities.Integration.filter({ id: integration_id });
    const integration = integrations[0];

    if (!integration || integration.platform_id !== 'META') {
      return Response.json({ error: 'Meta Ads integration not found' }, { status: 404 });
    }

    const { account_reference, settings, unit_id } = integration;
    const accessToken = settings?.access_token;

    if (!accessToken) {
      return Response.json({ error: 'Access token not configured' }, { status: 400 });
    }

    // Construir parâmetros de data
    let timeRange;
    if (start_date && end_date) {
      timeRange = `time_range={'since':'${start_date}','until':'${end_date}'}`;
    } else {
      const datePreset = period || 'yesterday';
      timeRange = `date_preset=${datePreset}`;
    }

    // Métricas solicitadas (ou padrão)
    const requestedMetrics = metrics && metrics.length > 0 ? metrics : [
      'spend',
      'impressions',
      'reach',
      'clicks',
      'cpm',
      'cpc',
      'ctr'
    ];
    
    const fields = requestedMetrics.join(',');

    // Construir URL com breakdown se necessário
    let insightsUrl = `https://graph.facebook.com/v18.0/${account_reference}/insights?fields=${fields}&${timeRange}&access_token=${accessToken}`;
    
    if (breakdown) {
      insightsUrl += `&level=${breakdown}`;
    }

    const response = await fetch(insightsUrl);

    if (!response.ok) {
      const error = await response.json();
      return Response.json({ 
        error: `Meta API error: ${error.error?.message || 'Unknown error'}`,
        details: error
      }, { status: response.status });
    }

    const data = await response.json();
    const metricsData = data.data || [];

    // Processar e salvar métricas
    const dailyMetrics = [];
    const entityMetrics = [];
    
    for (const metric of metricsData) {
      const date = metric.date_start;

      // Extrair ações (conversões, leads, etc)
      const actions = metric.actions || [];
      const actionValues = metric.action_values || [];
      const getActionValue = (actionType) => {
        const action = actions.find(a => a.action_type === actionType);
        return action ? parseFloat(action.value) : 0;
      };

      // Se tiver breakdown (campanha/adset/ad), salvar como MetricsEntity
      if (breakdown && (metric.campaign_id || metric.adset_id || metric.ad_id)) {
        const entityRecord = {
          unit_id,
          platform_id: 'META',
          date,
          entity_level: breakdown,
          entity_id: metric.campaign_id || metric.adset_id || metric.ad_id,
          entity_name: metric.campaign_name || metric.adset_name || metric.ad_name || 'Unknown',
          status: 'active',
          spend: parseFloat(metric.spend || 0),
          impressions: parseInt(metric.impressions || 0),
          clicks: parseInt(metric.clicks || 0),
          results: getActionValue('offsite_conversion.fb_pixel_purchase') + getActionValue('lead'),
          cpr: metric.cpc ? parseFloat(metric.cpc) : 0,
          extras: {
            reach: parseInt(metric.reach || 0),
            ctr: parseFloat(metric.ctr || 0),
            cpm: parseFloat(metric.cpm || 0),
            raw_actions: actions,
            raw_action_values: actionValues
          },
          source_run_id: `manual_${Date.now()}`
        };
        entityMetrics.push(entityRecord);
      }

      // Sempre salvar métricas diárias totais
      const metricRecord = {
        unit_id,
        platform_id: 'META',
        date,
        currency: 'BRL',
        spend: parseFloat(metric.spend || 0),
        impressions: parseInt(metric.impressions || 0),
        reach: parseInt(metric.reach || 0),
        clicks: parseInt(metric.clicks || 0),
        link_clicks: getActionValue('link_click'),
        ctr: parseFloat(metric.ctr || 0),
        cpc: parseFloat(metric.cpc || 0),
        cpm: parseFloat(metric.cpm || 0),
        conversions: getActionValue('offsite_conversion.fb_pixel_purchase') + 
                    getActionValue('onsite_conversion.purchase'),
        leads: getActionValue('offsite_conversion.fb_pixel_lead') + 
               getActionValue('lead'),
        messages: getActionValue('onsite_conversion.messaging_conversation_started_7d'),
        purchases: getActionValue('offsite_conversion.fb_pixel_purchase'),
        extras: {
          raw_actions: actions,
          raw_action_values: actionValues,
          date_stop: metric.date_stop,
          video_views: metric.video_views || 0,
          frequency: parseFloat(metric.frequency || 0)
        },
        source_run_id: `manual_${Date.now()}`
      };

      dailyMetrics.push(metricRecord);
    }

    // Salvar no banco de dados
    let dailyRecordsSaved = 0;
    let entityRecordsSaved = 0;

    // Salvar métricas diárias
    if (dailyMetrics.length > 0) {
      for (const metric of dailyMetrics) {
        const existing = await base44.asServiceRole.entities.MetricsDaily.filter({
          unit_id: metric.unit_id,
          platform_id: metric.platform_id,
          date: metric.date
        });

        if (existing.length > 0) {
          await base44.asServiceRole.entities.MetricsDaily.update(existing[0].id, metric);
        } else {
          await base44.asServiceRole.entities.MetricsDaily.create(metric);
        }
        dailyRecordsSaved++;
      }
    }

    // Salvar métricas por entidade (campanha/adset/ad)
    if (entityMetrics.length > 0) {
      for (const metric of entityMetrics) {
        const existing = await base44.asServiceRole.entities.MetricsEntity.filter({
          unit_id: metric.unit_id,
          platform_id: metric.platform_id,
          date: metric.date,
          entity_level: metric.entity_level,
          entity_id: metric.entity_id
        });

        if (existing.length > 0) {
          await base44.asServiceRole.entities.MetricsEntity.update(existing[0].id, metric);
        } else {
          await base44.asServiceRole.entities.MetricsEntity.create(metric);
        }
        entityRecordsSaved++;
      }
    }

    return Response.json({
      success: true,
      message: `${dailyRecordsSaved} registros diários e ${entityRecordsSaved} registros por entidade processados`,
      records_processed: {
        daily: dailyRecordsSaved,
        entity: entityRecordsSaved,
        total: dailyRecordsSaved + entityRecordsSaved
      },
      date_range: metricsData.length > 0 ? {
        start: metricsData[0].date_start,
        end: metricsData[metricsData.length - 1].date_stop
      } : null
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});