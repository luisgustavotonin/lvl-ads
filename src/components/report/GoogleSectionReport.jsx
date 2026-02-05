import React from 'react';
import MetricCard from './MetricCard';
import SpendChart from './SpendChart';
import CampaignTable from './CampaignTable';
import { DollarSign, Eye, MousePointer, Target, TrendingUp, Percent, ShoppingCart, BarChart } from 'lucide-react';

export default function GoogleSectionReport({ 
  metrics, 
  dailyData, 
  campaigns,
  config 
}) {
  const totals = metrics || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
          <span className="text-xl">🔍</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Google Ads</h2>
          <p className="text-sm text-gray-500">Search, Display & YouTube</p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Investimento"
          value={totals.spend}
          type="currency"
          icon={DollarSign}
          color="green"
        />
        <MetricCard 
          title="Impressões"
          value={totals.impressions}
          type="number"
          icon={Eye}
          color="blue"
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
          icon={Percent}
          color="purple"
        />
        <MetricCard 
          title="CPC"
          value={totals.cpc}
          type="currency"
          icon={TrendingUp}
          color="cyan"
        />
        <MetricCard 
          title="CPM"
          value={totals.cpm}
          type="currency"
          icon={BarChart}
          color="pink"
        />
        <MetricCard 
          title="Conversões"
          value={totals.conversions}
          type="number"
          icon={Target}
          color="green"
        />
        <MetricCard 
          title="Valor Conversões"
          value={totals.conversion_value}
          type="currency"
          icon={ShoppingCart}
          color="blue"
        />
      </div>

      {/* Chart */}
      <SpendChart data={dailyData} title="Investimento Google por Dia" />

      {/* Campaigns Table */}
      <CampaignTable 
        data={campaigns} 
        title="Campanhas Google Ads" 
        level="campaign"
      />
    </div>
  );
}