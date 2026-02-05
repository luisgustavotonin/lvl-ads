import React from 'react';
import MetricCard from './MetricCard';
import SpendChart from './SpendChart';
import CampaignTable from './CampaignTable';
import CreativeGallery from './CreativeGallery';
import { DollarSign, Eye, MousePointer, Target, TrendingUp, Video, Heart, Share2 } from 'lucide-react';

export default function TikTokSectionReport({ 
  metrics, 
  dailyData, 
  campaigns,
  creatives,
  config 
}) {
  const totals = metrics || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <span className="text-xl">🎵</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">TikTok Ads</h2>
          <p className="text-sm text-gray-500">Anúncios em vídeo</p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Investimento"
          value={totals.spend}
          type="currency"
          icon={DollarSign}
          color="purple"
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
          icon={Target}
          color="green"
        />
        <MetricCard 
          title="CPC"
          value={totals.cpc}
          type="currency"
          icon={TrendingUp}
          color="cyan"
        />
        <MetricCard 
          title="Visualizações"
          value={totals.extras?.video_views || 0}
          type="number"
          icon={Video}
          color="pink"
        />
        <MetricCard 
          title="Engajamentos"
          value={totals.extras?.engagements || 0}
          type="number"
          icon={Heart}
          color="purple"
        />
        <MetricCard 
          title="Compartilhamentos"
          value={totals.extras?.shares || 0}
          type="number"
          icon={Share2}
          color="blue"
        />
      </div>

      {/* Chart */}
      <SpendChart data={dailyData} title="Investimento TikTok por Dia" />

      {/* Campaigns Table */}
      <CampaignTable 
        data={campaigns} 
        title="Campanhas TikTok Ads" 
        level="campaign"
      />

      {/* Creatives */}
      <CreativeGallery 
        data={creatives} 
        title="Criativos TikTok" 
      />
    </div>
  );
}