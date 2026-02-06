import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import FunnelWithLine from './FunnelWithLine';
import BrandLogo from './BrandLogo';
import WhatsAppMetricsCards from './WhatsAppMetricsCards';
import { format, subDays } from 'date-fns';

const calculateTotals = (metrics) => {
  const totals = metrics.reduce((acc, m) => ({
    spend: acc.spend + (m.spend || 0),
    impressions: acc.impressions + (m.impressions || 0),
    reach: acc.reach + (m.reach || 0),
    clicks: acc.clicks + (m.clicks || 0),
    link_clicks: acc.link_clicks + (m.link_clicks || 0),
    whatsapp_conversations_started: acc.whatsapp_conversations_started + (m.whatsapp_conversations_started || 0),
    whatsapp_contacts: acc.whatsapp_contacts + (m.whatsapp_contacts || 0),
    whatsapp_new_contacts: acc.whatsapp_new_contacts + (m.whatsapp_new_contacts || 0)
  }), { 
    spend: 0, 
    impressions: 0, 
    reach: 0, 
    clicks: 0, 
    link_clicks: 0, 
    whatsapp_conversations_started: 0,
    whatsapp_contacts: 0,
    whatsapp_new_contacts: 0
  });

  // Calcular custos médios
  totals.cost_per_whatsapp_conversation = totals.whatsapp_conversations_started > 0 
    ? totals.spend / totals.whatsapp_conversations_started 
    : 0;
  totals.cost_per_whatsapp_contact = totals.whatsapp_contacts > 0 
    ? totals.spend / totals.whatsapp_contacts 
    : 0;
  totals.cost_per_whatsapp_new_contact = totals.whatsapp_new_contacts > 0 
    ? totals.spend / totals.whatsapp_new_contacts 
    : 0;

  return totals;
};

export default function MetaFunnelSection({ unitId, period = 'last_7_days', customStartDate, customEndDate }) {
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
      currentPeriod: { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') },
      previousPeriod: { start: format(prevStart, 'yyyy-MM-dd'), end: format(prevEnd, 'yyyy-MM-dd') }
    };
  }, [period, customStartDate, customEndDate]);

  // Buscar métricas do período atual
  const { data: currentMetrics = [] } = useQuery({
    queryKey: ['metaMetricsCurrent', unitId, currentPeriod],
    queryFn: async () => {
      const metrics = await base44.entities.MetricsDaily.filter({
        platform_id: 'META',
        ...(unitId && { unit_id: unitId })
      });
      return metrics.filter(m => m.date >= currentPeriod.start && m.date <= currentPeriod.end);
    },
  });

  // Buscar métricas do período anterior
  const { data: previousMetrics = [] } = useQuery({
    queryKey: ['metaMetricsPrevious', unitId, previousPeriod],
    queryFn: async () => {
      const metrics = await base44.entities.MetricsDaily.filter({
        platform_id: 'META',
        ...(unitId && { unit_id: unitId })
      });
      return metrics.filter(m => m.date >= previousPeriod.start && m.date <= previousPeriod.end);
    },
  });

  const currentTotals = calculateTotals(currentMetrics);
  const previousTotals = calculateTotals(previousMetrics);

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

      {/* Funil com Linha */}
      <FunnelWithLine 
        metrics={currentMetrics}
        previousMetrics={previousMetrics}
      />

      {/* Cards de WhatsApp com Custos */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Métricas de WhatsApp</h3>
        <WhatsAppMetricsCards 
          currentTotals={currentTotals}
          previousTotals={previousTotals}
        />
      </div>
    </div>
  );
}