import React from 'react';
import SpendChart from './SpendChart';
import FunnelChart from './FunnelChart';
import CampaignTable from './CampaignTable';
import CreativeGallery from './CreativeGallery';
import ReporteiStyleFunnel from '../unified/ReporteiStyleFunnel';
import UnifiedWhatsAppCards from '../unified/UnifiedWhatsAppCards';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function MetaSectionReport({ 
  unitId,
  startDate,
  endDate,
  dailyData, 
  campaigns, 
  ads, 
  creatives,
  config 
}) {
  // Usar função unificada para calcular métricas
  const { data: unifiedMetrics, isLoading } = useQuery({
    queryKey: ['unifiedMetricsMeta', unitId, startDate, endDate],
    queryFn: async () => {
      const response = await base44.functions.invoke('computeUnifiedMetrics', {
        unit_id: unitId,
        platform_id: 'META',
        start_date: startDate,
        end_date: endDate
      });
      return response.data;
    },
    enabled: !!startDate && !!endDate
  });

  if (isLoading || !unifiedMetrics) {
    return <div className="text-sm text-gray-500">Carregando métricas...</div>;
  }

  const funnelData = [
    { label: 'Impressões', value: unifiedMetrics.totals.impressions || 0, color: 'bg-blue-500' },
    { label: 'Cliques', value: unifiedMetrics.totals.clicks || 0, color: 'bg-blue-400' },
    { label: 'Conversas WhatsApp', value: unifiedMetrics.totals.whatsapp_conversations_started || 0, color: 'bg-green-400' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <span className="text-xl">📘</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Meta Ads</h2>
          <p className="text-sm text-gray-500">Facebook & Instagram</p>
        </div>
      </div>

      {/* Funil estilo Reportei */}
      <ReporteiStyleFunnel 
        currentMetrics={unifiedMetrics}
        previousMetrics={{}}
      />

      {/* Métricas de WhatsApp */}
      <UnifiedWhatsAppCards 
        currentMetrics={unifiedMetrics}
        previousMetrics={{}}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendChart data={dailyData} title="Investimento Meta por Dia" />
        <FunnelChart data={funnelData} title="Funil de Conversão Meta" />
      </div>

      {/* Tables */}
      <CampaignTable 
        data={campaigns} 
        title="Campanhas Meta Ads" 
        level="campaign"
      />

      <CampaignTable 
        data={ads} 
        title="Anúncios Meta Ads" 
        level="ad"
      />

      {/* Creatives */}
      <CreativeGallery 
        data={creatives} 
        title="Criativos Meta Ads" 
      />
    </div>
  );
}