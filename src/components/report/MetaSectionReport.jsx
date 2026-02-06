import React from 'react';
import MetricCard from './MetricCard';
import SpendChart from './SpendChart';
import FunnelChart from './FunnelChart';
import CampaignTable from './CampaignTable';
import CreativeGallery from './CreativeGallery';
import WhatsAppMetricsCards from '../dashboard/WhatsAppMetricsCards';
import FunnelWithLine from '../dashboard/FunnelWithLine';
import { DollarSign, Eye, MousePointer, Users, MessageCircle, ShoppingCart, Target, TrendingUp } from 'lucide-react';

export default function MetaSectionReport({ 
  metrics, 
  previousMetrics,
  dailyData, 
  campaigns, 
  ads, 
  creatives,
  config 
}) {
  const totals = metrics || {};
  const previousTotals = previousMetrics || {};

  // Calcular totais de WhatsApp
  const calculateWhatsAppTotals = (metricsData) => {
    if (!Array.isArray(metricsData)) return { 
      whatsapp_conversations_started: 0, 
      whatsapp_contacts: 0, 
      whatsapp_new_contacts: 0,
      cost_per_whatsapp_conversation: 0,
      cost_per_whatsapp_contact: 0,
      cost_per_whatsapp_new_contact: 0
    };
    
    const totals = metricsData.reduce((acc, m) => ({
      spend: acc.spend + (m.spend || 0),
      whatsapp_conversations_started: acc.whatsapp_conversations_started + (m.whatsapp_conversations_started || 0),
      whatsapp_contacts: acc.whatsapp_contacts + (m.whatsapp_contacts || 0),
      whatsapp_new_contacts: acc.whatsapp_new_contacts + (m.whatsapp_new_contacts || 0)
    }), { spend: 0, whatsapp_conversations_started: 0, whatsapp_contacts: 0, whatsapp_new_contacts: 0 });

    return {
      whatsapp_conversations_started: totals.whatsapp_conversations_started,
      whatsapp_contacts: totals.whatsapp_contacts,
      whatsapp_new_contacts: totals.whatsapp_new_contacts,
      cost_per_whatsapp_conversation: totals.whatsapp_conversations_started > 0 ? totals.spend / totals.whatsapp_conversations_started : 0,
      cost_per_whatsapp_contact: totals.whatsapp_contacts > 0 ? totals.spend / totals.whatsapp_contacts : 0,
      cost_per_whatsapp_new_contact: totals.whatsapp_new_contacts > 0 ? totals.spend / totals.whatsapp_new_contacts : 0
    };
  };

  const currentWhatsAppTotals = calculateWhatsAppTotals(dailyData);
  const previousWhatsAppTotals = calculateWhatsAppTotals([]); // TODO: passar dados do período anterior

  const funnelData = [
    { label: 'Impressões', value: totals.impressions || 0, color: 'bg-blue-500' },
    { label: 'Cliques', value: totals.clicks || 0, color: 'bg-blue-400' },
    { label: 'Mensagens', value: totals.messages || 0, color: 'bg-green-400' },
    { label: 'Compras', value: totals.purchases || 0, color: 'bg-green-500' },
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

      {/* Funil com Linha */}
      {dailyData && dailyData.length > 0 && (
        <FunnelWithLine 
          metrics={dailyData}
          previousMetrics={[]}
        />
      )}

      {/* Métricas de WhatsApp */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Métricas de WhatsApp</h3>
        <WhatsAppMetricsCards 
          currentTotals={currentWhatsAppTotals}
          previousTotals={previousWhatsAppTotals}
        />
      </div>

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