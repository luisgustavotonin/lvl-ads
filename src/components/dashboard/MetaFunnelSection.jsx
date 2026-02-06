import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import FunnelCard from './FunnelCard';
import FunnelSparkline from './FunnelSparkline';
import BrandLogo from './BrandLogo';
import { format, subDays } from 'date-fns';

const calculateTotals = (metrics) => {
  return metrics.reduce((acc, m) => ({
    spend: acc.spend + (m.spend || 0),
    impressions: acc.impressions + (m.impressions || 0),
    reach: acc.reach + (m.reach || 0), // reach já vem correto do backend
    clicks: acc.clicks + (m.clicks || 0),
    link_clicks: acc.link_clicks + (m.link_clicks || 0),
    whatsapp: acc.whatsapp + (m.messages || 0) // TODO: definir métrica correta
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, link_clicks: 0, whatsapp: 0 });
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

  // Sparkline data (impressions)
  const sparklineData = currentMetrics
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(m => ({ value: m.impressions }));

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