import React, { useMemo } from 'react';
import FunnelCard from './FunnelCard';
import FunnelSparkline from './FunnelSparkline';
import BrandLogo from './BrandLogo';
import { format, subDays } from 'date-fns';

const processDailySummary = (rawData, startDate, endDate) => {
  // Agrupar por dia
  const dailyMap = new Map();

  rawData.forEach(item => {
    const date = item.date_start || item.date;
    if (!date) return;

    const dateObj = new Date(date);
    if (dateObj < startDate || dateObj > endDate) return;

    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        spend_total: 0,
        impressions_total: 0,
        clicks_total: 0,
        link_clicks_total: 0,
        reach_total: 0,
        whatsapp_conversations_started: 0,
        whatsapp_contacts_total: 0,
        whatsapp_new_contacts: 0
      });
    }

    const day = dailyMap.get(date);
    day.spend_total += parseFloat(item.spend || 0);
    day.impressions_total += parseInt(item.impressions || 0);
    day.clicks_total += parseInt(item.clicks || 0);
    day.link_clicks_total += parseInt(item.inline_link_clicks || 0);

    // Processar actions[] para WhatsApp
    if (Array.isArray(item.actions)) {
      item.actions.forEach(action => {
        const value = parseInt(action.value || 0);
        if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
          day.whatsapp_conversations_started += value;
        }
        if (action.action_type === 'onsite_conversion.total_messaging_connection') {
          day.whatsapp_contacts_total += value;
        }
        if (action.action_type === 'onsite_conversion.messaging_first_reply') {
          day.whatsapp_new_contacts += value;
        }
      });
    }
  });

  return Array.from(dailyMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
};

const calculateTotals = (dailySummary) => {
  return dailySummary.reduce((acc, day) => ({
    spend: acc.spend + day.spend_total,
    impressions: acc.impressions + day.impressions_total,
    reach: Math.max(acc.reach, day.reach_total), // reach não soma
    clicks: acc.clicks + day.clicks_total,
    link_clicks: acc.link_clicks + day.link_clicks_total,
    whatsapp: acc.whatsapp + day.whatsapp_conversations_started
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, link_clicks: 0, whatsapp: 0 });
};

export default function MetaFunnelSection({ rawData, period = 'last_7_days', customStartDate, customEndDate }) {
  const { currentPeriod, previousPeriod } = useMemo(() => {
    let start, end;
    
    if (period === 'custom' && customStartDate && customEndDate) {
      start = new Date(customStartDate);
      end = new Date(customEndDate);
    } else if (period === 'yesterday') {
      end = subDays(new Date(), 1);
      start = end;
    } else {
      // last_7_days (default)
      end = new Date();
      start = subDays(end, 6);
    }

    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const prevEnd = subDays(start, 1);
    const prevStart = subDays(prevEnd, daysDiff - 1);

    return {
      currentPeriod: { start, end },
      previousPeriod: { start: prevStart, end: prevEnd }
    };
  }, [period, customStartDate, customEndDate]);

  const currentData = useMemo(() => {
    return processDailySummary(rawData, currentPeriod.start, currentPeriod.end);
  }, [rawData, currentPeriod]);

  const previousData = useMemo(() => {
    return processDailySummary(rawData, previousPeriod.start, previousPeriod.end);
  }, [rawData, previousPeriod]);

  const currentTotals = calculateTotals(currentData);
  const previousTotals = calculateTotals(previousData);

  // Sparkline data (impressions)
  const sparklineData = currentData.map(d => ({ value: d.impressions_total }));

  // Verificar se tem dados
  const hasData = currentTotals.spend > 0 || currentTotals.impressions > 0;
  if (!hasData) return null;

  return (
    <div className="space-y-6">
      {/* Header com logo */}
      <div className="flex items-center justify-between">
        <BrandLogo platform="META" />
        <div className="text-sm text-gray-500">
          {format(currentPeriod.start, 'dd/MM/yyyy')} - {format(currentPeriod.end, 'dd/MM/yyyy')}
        </div>
      </div>

      {/* Funil de Cards */}
      <div className="relative">
        <FunnelSparkline data={sparklineData} />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <FunnelCard 
            title="Valor investido"
            value={currentTotals.spend}
            previousValue={previousTotals.spend}
            type="currency"
          />
          <FunnelCard 
            title="Impressões Totais"
            value={currentTotals.impressions}
            previousValue={previousTotals.impressions}
          />
          <FunnelCard 
            title="Alcance Total"
            value={currentTotals.reach}
            previousValue={previousTotals.reach}
          />
          <FunnelCard 
            title="Total de Cliques"
            value={currentTotals.clicks}
            previousValue={previousTotals.clicks}
          />
          <FunnelCard 
            title="Total de cliques no link"
            value={currentTotals.link_clicks}
            previousValue={previousTotals.link_clicks}
            subtext="do total de cliques"
            percentage={currentTotals.clicks > 0 ? (currentTotals.link_clicks / currentTotals.clicks * 100) : 0}
          />
          <FunnelCard 
            title="Conversas iniciadas por mensagem"
            value={currentTotals.whatsapp}
            previousValue={previousTotals.whatsapp}
            subtext="dos cliques no link"
            percentage={currentTotals.link_clicks > 0 ? (currentTotals.whatsapp / currentTotals.link_clicks * 100) : 0}
          />
        </div>
      </div>
    </div>
  );
}