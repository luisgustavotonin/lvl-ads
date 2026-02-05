import React from 'react';
import MetricCard from './MetricCard';
import SpendChart from './SpendChart';
import FunnelChart from './FunnelChart';
import CampaignTable from './CampaignTable';
import CreativeGallery from './CreativeGallery';
import { DollarSign, Eye, MousePointer, Users, MessageCircle, ShoppingCart, Target, TrendingUp } from 'lucide-react';

export default function MetaSectionReport({ 
  metrics, 
  dailyData, 
  campaigns, 
  ads, 
  creatives,
  config 
}) {
  const totals = metrics || {};

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

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Investimento"
          value={totals.spend}
          type="currency"
          icon={DollarSign}
          color="blue"
        />
        <MetricCard 
          title="Impressões"
          value={totals.impressions}
          type="number"
          icon={Eye}
          color="purple"
        />
        <MetricCard 
          title="Alcance"
          value={totals.reach}
          type="number"
          icon={Users}
          color="green"
        />
        <MetricCard 
          title="Cliques"
          value={totals.clicks}
          type="number"
          icon={MousePointer}
          color="orange"
        />
        <MetricCard 
          title="CTR"
          value={totals.ctr}
          type="percent"
          icon={Target}
          color="cyan"
        />
        <MetricCard 
          title="CPC"
          value={totals.cpc}
          type="currency"
          icon={TrendingUp}
          color="pink"
        />
        <MetricCard 
          title="Mensagens"
          value={totals.messages}
          type="number"
          icon={MessageCircle}
          color="green"
        />
        <MetricCard 
          title="Compras"
          value={totals.purchases}
          type="number"
          icon={ShoppingCart}
          color="blue"
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