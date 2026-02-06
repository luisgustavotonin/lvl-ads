import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays } from 'date-fns';
import { Settings2, Download, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import UnitSelector from '@/components/report/UnitSelector';
import PeriodSelector from '@/components/report/PeriodSelector';
import PlatformSelector from '@/components/report/PlatformSelector';
import ReportCustomizer from '@/components/report/ReportCustomizer';
import PdfExportModal from '@/components/report/PdfExportModal';
import MetricCard from '@/components/report/MetricCard';
import SpendChart from '@/components/report/SpendChart';
import PlatformBarChart from '@/components/report/PlatformBarChart';
import MetaSectionReport from '@/components/report/MetaSectionReport';
import GoogleSectionReport from '@/components/report/GoogleSectionReport';
import TikTokSectionReport from '@/components/report/TikTokSectionReport';

import { DollarSign, Eye, MousePointer, Users, Target, TrendingUp, MessageCircle, ShoppingCart } from 'lucide-react';

const DEFAULT_PLATFORMS = [
  { platform_id: 'META', name: 'Meta Ads' },
  { platform_id: 'GOOGLE_ADS', name: 'Google Ads' },
  { platform_id: 'TIKTOK_ADS', name: 'TikTok Ads' },
  { platform_id: 'YOUTUBE', name: 'YouTube' },
];

const DEFAULT_CONFIG = {
  cards: [
    { id: 'spend', visible: true },
    { id: 'impressions', visible: true },
    { id: 'reach', visible: true },
    { id: 'clicks', visible: true },
    { id: 'ctr', visible: true },
    { id: 'cpc', visible: true },
    { id: 'messages', visible: true },
    { id: 'purchases', visible: true },
  ],
  charts: [
    { id: 'spend_daily', visible: true },
    { id: 'spend_platform', visible: true },
  ],
  sections: ['summary', 'meta', 'google', 'tiktok'],
};

export default function Reports() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [selectedUnit, setSelectedUnit] = useState(null);
  const [period, setPeriod] = useState({
    periodId: 'last_30_days',
    start: subDays(today, 29),
    end: today,
  });
  const [selectedPlatforms, setSelectedPlatforms] = useState(['META', 'GOOGLE_ADS', 'TIKTOK_ADS', 'YOUTUBE']);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState(DEFAULT_CONFIG);

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: platforms = [] } = useQuery({
    queryKey: ['platforms'],
    queryFn: () => base44.entities.Platform.list(),
    initialData: DEFAULT_PLATFORMS,
  });

  // Set first unit as default
  React.useEffect(() => {
    if (units.length > 0 && !selectedUnit) {
      setSelectedUnit(units[0].id);
    }
  }, [units, selectedUnit]);

  const { data: metricsDaily = [], isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['metricsDaily', selectedUnit, period.start, period.end],
    queryFn: async () => {
      if (!selectedUnit) return [];
      const startStr = period.start.toISOString().split('T')[0];
      const endStr = period.end.toISOString().split('T')[0];
      return base44.entities.MetricsDaily.filter({
        unit_id: selectedUnit,
        date: { $gte: startStr, $lte: endStr }
      });
    },
    enabled: !!selectedUnit,
  });

  const { data: metricsEntity = [] } = useQuery({
    queryKey: ['metricsEntity', selectedUnit, period.start, period.end],
    queryFn: async () => {
      if (!selectedUnit) return [];
      const startStr = period.start.toISOString().split('T')[0];
      const endStr = period.end.toISOString().split('T')[0];
      return base44.entities.MetricsEntity.filter({
        unit_id: selectedUnit,
        date: { $gte: startStr, $lte: endStr }
      });
    },
    enabled: !!selectedUnit,
  });

  const { data: creatives = [] } = useQuery({
    queryKey: ['creatives', selectedUnit],
    queryFn: () => selectedUnit ? base44.entities.Creative.filter({ unit_id: selectedUnit }) : [],
    enabled: !!selectedUnit,
  });

  // Filter data by selected platforms
  const filteredMetrics = useMemo(() => {
    return metricsDaily.filter(m => selectedPlatforms.includes(m.platform_id));
  }, [metricsDaily, selectedPlatforms]);

  const filteredEntities = useMemo(() => {
    return metricsEntity.filter(m => selectedPlatforms.includes(m.platform_id));
  }, [metricsEntity, selectedPlatforms]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredMetrics.reduce((acc, m) => ({
      spend: (acc.spend || 0) + (m.spend || 0),
      impressions: (acc.impressions || 0) + (m.impressions || 0),
      reach: (acc.reach || 0) + (m.reach || 0),
      clicks: (acc.clicks || 0) + (m.clicks || 0),
      link_clicks: (acc.link_clicks || 0) + (m.link_clicks || 0),
      conversions: (acc.conversions || 0) + (m.conversions || 0),
      messages: (acc.messages || 0) + (m.messages || 0),
      purchases: (acc.purchases || 0) + (m.purchases || 0),
    }), {});
  }, [filteredMetrics]);

  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

  // Daily chart data
  const dailyChartData = useMemo(() => {
    const byDate = {};
    filteredMetrics.forEach(m => {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, spend: 0 };
      byDate[m.date].spend += m.spend || 0;
    });
    return Object.values(byDate).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [filteredMetrics]);

  // Platform chart data
  const platformChartData = useMemo(() => {
    const byPlatform = {};
    filteredMetrics.forEach(m => {
      if (!byPlatform[m.platform_id]) {
        const platformInfo = platforms.find(p => p.platform_id === m.platform_id);
        byPlatform[m.platform_id] = { 
          platform_id: m.platform_id, 
          name: platformInfo?.name || m.platform_id,
          spend: 0 
        };
      }
      byPlatform[m.platform_id].spend += m.spend || 0;
    });
    return Object.values(byPlatform);
  }, [filteredMetrics, platforms]);

  // Platform specific data
  const getMetricsForPlatform = (platformId) => {
    const platformMetrics = metricsDaily.filter(m => m.platform_id === platformId);
    const metrics = platformMetrics.reduce((acc, m) => ({
      spend: (acc.spend || 0) + (m.spend || 0),
      impressions: (acc.impressions || 0) + (m.impressions || 0),
      reach: (acc.reach || 0) + (m.reach || 0),
      clicks: (acc.clicks || 0) + (m.clicks || 0),
      messages: (acc.messages || 0) + (m.messages || 0),
      purchases: (acc.purchases || 0) + (m.purchases || 0),
      conversions: (acc.conversions || 0) + (m.conversions || 0),
      conversion_value: (acc.conversion_value || 0) + (m.conversion_value || 0),
      extras: m.extras || {},
    }), {});
    metrics.ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
    metrics.cpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
    metrics.cpm = metrics.impressions > 0 ? (metrics.spend / metrics.impressions) * 1000 : 0;
    return metrics;
  };

  const getDailyDataForPlatform = (platformId) => {
    const byDate = {};
    metricsDaily.filter(m => m.platform_id === platformId).forEach(m => {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, spend: 0 };
      byDate[m.date].spend += m.spend || 0;
    });
    return Object.values(byDate).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const getCampaignsForPlatform = (platformId) => {
    return metricsEntity
      .filter(m => m.platform_id === platformId && m.entity_level === 'campaign')
      .reduce((acc, m) => {
        const existing = acc.find(e => e.entity_id === m.entity_id);
        if (existing) {
          existing.spend += m.spend || 0;
          existing.impressions += m.impressions || 0;
          existing.clicks += m.clicks || 0;
          existing.results += m.results || 0;
        } else {
          acc.push({ ...m });
        }
        return acc;
      }, []);
  };

  const getAdsForPlatform = (platformId) => {
    return metricsEntity
      .filter(m => m.platform_id === platformId && m.entity_level === 'ad')
      .reduce((acc, m) => {
        const existing = acc.find(e => e.entity_id === m.entity_id);
        if (existing) {
          existing.spend += m.spend || 0;
          existing.impressions += m.impressions || 0;
          existing.clicks += m.clicks || 0;
          existing.results += m.results || 0;
        } else {
          acc.push({ ...m });
        }
        return acc;
      }, []);
  };

  const getCreativesForPlatform = (platformId) => {
    return creatives.filter(c => c.platform_id === platformId);
  };

  const selectedUnitData = units.find(u => u.id === selectedUnit);

  const isCardVisible = (cardId) => {
    const card = reportConfig.cards.find(c => c.id === cardId);
    return card?.visible !== false;
  };

  const isChartVisible = (chartId) => {
    const chart = reportConfig.charts.find(c => c.id === chartId);
    return chart?.visible !== false;
  };

  const isSectionVisible = (sectionId) => {
    return reportConfig.sections?.includes(sectionId) ?? true;
  };

  // Report content component
  const ReportContent = () => (
    <div className="space-y-12">
      {/* Summary Section */}
      {isSectionVisible('summary') && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Resumo Geral</h2>
              <p className="text-sm text-gray-500">Métricas consolidadas de todas as plataformas</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isCardVisible('spend') && (
              <MetricCard title="Investimento Total" value={totals.spend} type="currency" icon={DollarSign} color="blue" />
            )}
            {isCardVisible('impressions') && (
              <MetricCard title="Impressões" value={totals.impressions} type="number" icon={Eye} color="purple" />
            )}
            {isCardVisible('reach') && (
              <MetricCard title="Alcance" value={totals.reach} type="number" icon={Users} color="green" />
            )}
            {isCardVisible('clicks') && (
              <MetricCard title="Cliques" value={totals.clicks} type="number" icon={MousePointer} color="orange" />
            )}
            {isCardVisible('ctr') && (
              <MetricCard title="CTR Médio" value={totals.ctr} type="percent" icon={Target} color="cyan" />
            )}
            {isCardVisible('cpc') && (
              <MetricCard title="CPC Médio" value={totals.cpc} type="currency" icon={TrendingUp} color="pink" />
            )}
            {isCardVisible('messages') && (
              <MetricCard title="Mensagens" value={totals.messages} type="number" icon={MessageCircle} color="green" />
            )}
            {isCardVisible('purchases') && (
              <MetricCard title="Compras" value={totals.purchases} type="number" icon={ShoppingCart} color="blue" />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {isChartVisible('spend_daily') && (
              <SpendChart data={dailyChartData} title="Investimento por Dia" />
            )}
            {isChartVisible('spend_platform') && (
              <PlatformBarChart data={platformChartData} title="Investimento por Plataforma" />
            )}
          </div>
        </div>
      )}

      {/* Meta Section */}
      {isSectionVisible('meta') && selectedPlatforms.includes('META') && (
        <MetaSectionReport
          unitId={selectedUnit}
          startDate={period.start.toISOString().split('T')[0]}
          endDate={period.end.toISOString().split('T')[0]}
          dailyData={getDailyDataForPlatform('META')}
          campaigns={getCampaignsForPlatform('META')}
          ads={getAdsForPlatform('META')}
          creatives={getCreativesForPlatform('META')}
          config={reportConfig}
        />
      )}

      {/* Google Section */}
      {isSectionVisible('google') && selectedPlatforms.includes('GOOGLE_ADS') && (
        <GoogleSectionReport
          metrics={getMetricsForPlatform('GOOGLE_ADS')}
          dailyData={getDailyDataForPlatform('GOOGLE_ADS')}
          campaigns={getCampaignsForPlatform('GOOGLE_ADS')}
          config={reportConfig}
        />
      )}

      {/* TikTok Section */}
      {isSectionVisible('tiktok') && selectedPlatforms.includes('TIKTOK_ADS') && (
        <TikTokSectionReport
          metrics={getMetricsForPlatform('TIKTOK_ADS')}
          dailyData={getDailyDataForPlatform('TIKTOK_ADS')}
          campaigns={getCampaignsForPlatform('TIKTOK_ADS')}
          creatives={getCreativesForPlatform('TIKTOK_ADS')}
          config={reportConfig}
        />
      )}
    </div>
  );

  if (unitsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <UnitSelector 
            units={units} 
            value={selectedUnit} 
            onChange={setSelectedUnit}
          />
          
          <PeriodSelector 
            value={period} 
            onChange={setPeriod}
          />
          
          <PlatformSelector 
            platforms={platforms.length > 0 ? platforms : DEFAULT_PLATFORMS}
            selected={selectedPlatforms}
            onChange={setSelectedPlatforms}
          />

          <div className="flex-1" />

          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => refetchMetrics()}
            disabled={metricsLoading}
          >
            {metricsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Atualizar
          </Button>

          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => setCustomizerOpen(true)}
          >
            <Settings2 className="w-4 h-4" />
            Personalizar
          </Button>

          <Button 
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={() => setExportOpen(true)}
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Report Content */}
      {metricsLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <ReportContent />
      )}

      {/* Customizer Sidebar */}
      <ReportCustomizer
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        config={reportConfig}
        onConfigChange={setReportConfig}
      />

      {/* PDF Export Modal */}
      <PdfExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        unit={selectedUnitData}
        period={period}
      >
        <ReportContent />
      </PdfExportModal>
    </div>
  );
}