import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ReporteiStyleFunnel from '../unified/ReporteiStyleFunnel';
import UnifiedWhatsAppCards from '../unified/UnifiedWhatsAppCards';
import BrandLogo from './BrandLogo';
import { format, subDays } from 'date-fns';

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

  // Buscar configuração de cores da Unit
  const { data: unit } = useQuery({
    queryKey: ['unitFunnelConfig', unitId],
    queryFn: async () => {
      if (!unitId) return null;
      const result = await base44.entities.Unit.filter({ id: unitId });
      return result?.[0] || null;
    },
    enabled: !!unitId
  });

  const stageColors = useMemo(() => {
    const stages = unit?.settings?.funnel_stages || [];
    const colors = {};
    stages.forEach(stage => {
      colors[stage.key] = stage.color;
    });
    return colors;
  }, [unit]);

  // Buscar métricas unificadas (usa computeUnifiedMetrics)
  const { data: unifiedMetrics } = useQuery({
    queryKey: ['unifiedMetricsMeta', unitId, currentPeriod],
    queryFn: async () => {
      const response = await base44.functions.invoke('computeUnifiedMetrics', {
        unit_id: unitId,
        platform_id: 'META',
        start_date: currentPeriod.start,
        end_date: currentPeriod.end
      });
      return response.data;
    }
  });

  const { data: unifiedMetricsPrevious } = useQuery({
    queryKey: ['unifiedMetricsMetaPrevious', unitId, previousPeriod],
    queryFn: async () => {
      const response = await base44.functions.invoke('computeUnifiedMetrics', {
        unit_id: unitId,
        platform_id: 'META',
        start_date: previousPeriod.start,
        end_date: previousPeriod.end
      });
      return response.data;
    }
  });

  // Verificar se tem dados
  if (!unifiedMetrics || !unifiedMetrics.totals) return null;
  const hasData = unifiedMetrics.totals.spend > 0 || unifiedMetrics.totals.impressions > 0;
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

      {/* Funil estilo Reportei */}
      <ReporteiStyleFunnel 
        currentMetrics={unifiedMetrics}
        previousMetrics={unifiedMetricsPrevious}
      />

      {/* Cards de WhatsApp */}
      <div className="mt-6">
        <UnifiedWhatsAppCards 
          currentMetrics={unifiedMetrics}
          previousMetrics={unifiedMetricsPrevious}
        />
      </div>
    </div>
  );
}