import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { integration_id, date_preset = 'yesterday', start_date, end_date } = await req.json();

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
    let timeRange = `date_preset=${date_preset}`;
    if (start_date && end_date) {
      timeRange = `time_range={'since':'${start_date}','until':'${end_date}'}`;
    }

    // Buscar métricas da conta
    const fields = [
      'spend',
      'impressions',
      'reach',
      'clicks',
      'actions',
      'cpm',
      'cpc',
      'ctr'
    ].join(',');

    const insightsUrl = `https://graph.facebook.com/v18.0/${account_reference}/insights?fields=${fields}&${timeRange}&access_token=${accessToken}`;

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

    // Processar e salvar métricas diárias
    const dailyMetrics = [];
    
    for (const metric of metricsData) {
      const date = metric.date_start;

      // Extrair ações (conversões, leads, etc)
      const actions = metric.actions || [];
      const getActionValue = (actionType) => {
        const action = actions.find(a => a.action_type === actionType);
        return action ? parseFloat(action.value) : 0;
      };

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
          date_stop: metric.date_stop
        },
        source_run_id: `manual_${Date.now()}`
      };

      dailyMetrics.push(metricRecord);
    }

    // Salvar no banco de dados
    if (dailyMetrics.length > 0) {
      // Verificar se já existem métricas para essas datas e atualizar/criar
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
      }
    }

    return Response.json({
      success: true,
      message: `${dailyMetrics.length} registros de métricas processados`,
      records_processed: dailyMetrics.length,
      date_range: metricsData.length > 0 ? {
        start: metricsData[0].date_start,
        end: metricsData[metricsData.length - 1].date_stop
      } : null,
      metrics_summary: dailyMetrics
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});