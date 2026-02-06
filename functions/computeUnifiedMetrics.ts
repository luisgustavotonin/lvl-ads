import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * FUNÇÃO CENTRALIZADA para calcular métricas do funil + WhatsApp
 * Usada por Dashboard, Relatórios e PDF - NUNCA duplicar lógica
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { unit_id, platform_id, start_date, end_date } = await req.json();

        if (!platform_id || !start_date || !end_date) {
            return Response.json({ 
                error: 'Parâmetros obrigatórios: platform_id, start_date, end_date' 
            }, { status: 400 });
        }

        // 1. Buscar métricas do nível ACCOUNT (para REACH correto)
        const accountMetrics = await base44.asServiceRole.entities.MetricsAccountLevel.filter({
            platform_id,
            ...(unit_id && { unit_id })
        });

        const accountFiltered = accountMetrics.filter(m => 
            m.date >= start_date && m.date <= end_date
        );

        // 2. Buscar métricas detalhadas (level=ad, campaign, adset)
        const dailyMetrics = await base44.asServiceRole.entities.MetricsDaily.filter({
            platform_id,
            ...(unit_id && { unit_id })
        });

        const dailyFiltered = dailyMetrics.filter(m => 
            m.date >= start_date && m.date <= end_date
        );

        // 3. Calcular totais do FUNIL
        const totals = {
            spend: 0,
            impressions: 0,
            reach: 0, // CRÍTICO: usar do account level
            clicks: 0,
            link_clicks: 0,
            whatsapp_conversations_started: 0,
            whatsapp_new_contacts: 0,
            whatsapp_total_contacts: 0
        };

        // REACH: pegar do nível account (não somar ads)
        accountFiltered.forEach(m => {
            totals.reach += m.reach || 0;
        });

        // Demais métricas: somar do nível account OU daily
        if (accountFiltered.length > 0) {
            // Preferir account level
            accountFiltered.forEach(m => {
                totals.spend += m.spend || 0;
                totals.impressions += m.impressions || 0;
                totals.clicks += m.clicks || 0;
                totals.link_clicks += m.link_clicks || 0;
                totals.whatsapp_conversations_started += m.whatsapp_conversations_started || 0;
                totals.whatsapp_new_contacts += m.whatsapp_new_contacts || 0;
                totals.whatsapp_total_contacts += m.whatsapp_total_contacts || 0;
            });
        } else {
            // Fallback: somar do daily
            dailyFiltered.forEach(m => {
                totals.spend += m.spend || 0;
                totals.impressions += m.impressions || 0;
                totals.clicks += m.clicks || 0;
                totals.link_clicks += m.link_clicks || 0;
                totals.whatsapp_conversations_started += m.whatsapp_conversations_started || 0;
                totals.whatsapp_new_contacts += m.whatsapp_new_contacts || 0;
            });
        }

        // 4. Calcular custos WhatsApp
        const whatsappCosts = {
            cost_per_conversation: totals.whatsapp_conversations_started > 0 
                ? totals.spend / totals.whatsapp_conversations_started 
                : 0,
            cost_per_new_contact: totals.whatsapp_new_contacts > 0 
                ? totals.spend / totals.whatsapp_new_contacts 
                : 0,
            cost_per_total_contact: totals.whatsapp_total_contacts > 0 
                ? totals.spend / totals.whatsapp_total_contacts 
                : 0
        };

        // 5. Calcular percentuais do funil
        const funnelPercentages = {
            impressions: 100,
            reach: totals.impressions > 0 ? (totals.reach / totals.impressions * 100) : 0,
            clicks: totals.reach > 0 ? (totals.clicks / totals.reach * 100) : 0,
            link_clicks: totals.clicks > 0 ? (totals.link_clicks / totals.clicks * 100) : 0,
            whatsapp: totals.link_clicks > 0 ? (totals.whatsapp_conversations_started / totals.link_clicks * 100) : 0
        };

        // 6. Série temporal (dia a dia)
        const dailySeries = accountFiltered.length > 0 ? accountFiltered : dailyFiltered;
        const timeSeriesData = dailySeries
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(m => ({
                date: m.date,
                spend: m.spend || 0,
                impressions: m.impressions || 0,
                reach: m.reach || 0,
                clicks: m.clicks || 0,
                link_clicks: m.link_clicks || 0,
                whatsapp: m.whatsapp_conversations_started || 0
            }));

        return Response.json({
            success: true,
            totals,
            whatsappCosts,
            funnelPercentages,
            timeSeriesData,
            hasAccountLevelData: accountFiltered.length > 0,
            warning: accountFiltered.length === 0 ? 'Alcance pode estar supercontado (dados apenas no nível ad)' : null
        });

    } catch (error) {
        console.error('❌ Erro ao calcular métricas:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});