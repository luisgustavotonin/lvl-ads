import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays, differenceInDays } from 'date-fns';
import { Download, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import ReporteiFilters from '@/components/reportei/ReporteiFilters';
import KPISelector from '@/components/reportei/KPISelector';
import KPICard from '@/components/reportei/KPICard';
import FunnelChart from '@/components/reportei/FunnelChart';
import TimeSeriesChart from '@/components/reportei/TimeSeriesChart';
import DataTable from '@/components/reportei/DataTable';

const DEFAULT_KPIS = [
  'spend', 'impressions', 'reach', 'frequency',
  'clicks', 'link_clicks', 'ctr_link', 'cpc_link', 'cpm',
  'wa_conversations', 'cost_per_conversation'
];

const THEMES = [
  { id: 'reportei_blue', name: 'Reportei Blue', primary: '#3B82F6', secondary: '#60A5FA' },
  { id: 'neutral', name: 'Neutro', primary: '#6B7280', secondary: '#9CA3AF' },
  { id: 'dark', name: 'Dark', primary: '#1F2937', secondary: '#374151' },
];

export default function ReporteiStyle() {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [period, setPeriod] = useState({
    start: subDays(new Date(), 29),
    end: new Date(),
  });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedKPIs, setSelectedKPIs] = useState(DEFAULT_KPIS);
  const [theme, setTheme] = useState('reportei_blue');

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  // Auto-select first unit
  React.useEffect(() => {
    if (units.length > 0 && !selectedUnit) {
      setSelectedUnit(units[0].id);
    }
  }, [units, selectedUnit]);

  // Fetch current period data
  const { data: metricsDaily = [], isLoading: metricsLoading } = useQuery({
    queryKey: ['metricsDailyReportei', selectedUnit, period.start, period.end],
    queryFn: async () => {
      if (!selectedUnit) return [];
      return base44.entities.MetricsDaily.filter({
        unit_id: selectedUnit,
        platform_id: 'META',
        date: { 
          $gte: period.start.toISOString().split('T')[0], 
          $lte: period.end.toISOString().split('T')[0] 
        }
      });
    },
    enabled: !!selectedUnit,
  });

  // Fetch comparison period data
  const comparePeriod = useMemo(() => {
    if (!compareEnabled) return null;
    const days = differenceInDays(period.end, period.start);
    return {
      start: subDays(period.start, days + 1),
      end: subDays(period.start, 1),
    };
  }, [period, compareEnabled]);

  const { data: compareMetrics = [] } = useQuery({
    queryKey: ['compareMetricsReportei', selectedUnit, comparePeriod?.start, comparePeriod?.end],
    queryFn: async () => {
      if (!selectedUnit || !comparePeriod) return [];
      return base44.entities.MetricsDaily.filter({
        unit_id: selectedUnit,
        platform_id: 'META',
        date: { 
          $gte: comparePeriod.start.toISOString().split('T')[0], 
          $lte: comparePeriod.end.toISOString().split('T')[0] 
        }
      });
    },
    enabled: !!selectedUnit && !!comparePeriod,
  });

  // Fetch ad-level data for breakdowns
  const { data: adData = [] } = useQuery({
    queryKey: ['metaAdDailyReportei', selectedUnit, period.start, period.end],
    queryFn: async () => {
      if (!selectedUnit) return [];
      return base44.entities.MetaAdDaily.filter({
        unit_id: selectedUnit,
        date: { 
          $gte: period.start.toISOString().split('T')[0], 
          $lte: period.end.toISOString().split('T')[0] 
        }
      });
    },
    enabled: !!selectedUnit,
  });

  // Calculate aggregated metrics
  const aggregated = useMemo(() => {
    const sum = (field) => metricsDaily.reduce((acc, m) => acc + (m[field] || 0), 0);
    
    const spend = sum('spend');
    const impressions = sum('impressions');
    const reach = sum('reach');
    const clicks = sum('clicks');
    const link_clicks = sum('link_clicks');
    const wa_conversations = sum('whatsapp_conversations_started');
    const wa_total_connection = sum('whatsapp_contacts');
    const wa_first_reply = sum('whatsapp_new_contacts');
    
    return {
      spend,
      impressions,
      reach,
      frequency: reach > 0 ? impressions / reach : 0,
      clicks,
      link_clicks,
      ctr_link: impressions > 0 ? (link_clicks / impressions) * 100 : 0,
      cpc_link: link_clicks > 0 ? spend / link_clicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      wa_conversations,
      cost_per_conversation: wa_conversations > 0 ? spend / wa_conversations : 0,
      wa_total_connection,
      cost_per_total_contact: wa_total_connection > 0 ? spend / wa_total_connection : 0,
      wa_first_reply,
      cost_per_first_reply: wa_first_reply > 0 ? spend / wa_first_reply : 0,
    };
  }, [metricsDaily]);

  const aggregatedCompare = useMemo(() => {
    if (!compareEnabled || compareMetrics.length === 0) return null;
    
    const sum = (field) => compareMetrics.reduce((acc, m) => acc + (m[field] || 0), 0);
    
    const spend = sum('spend');
    const impressions = sum('impressions');
    const reach = sum('reach');
    const clicks = sum('clicks');
    const link_clicks = sum('link_clicks');
    const wa_conversations = sum('whatsapp_conversations_started');
    const wa_total_connection = sum('whatsapp_contacts');
    const wa_first_reply = sum('whatsapp_new_contacts');
    
    return {
      spend,
      impressions,
      reach,
      frequency: reach > 0 ? impressions / reach : 0,
      clicks,
      link_clicks,
      ctr_link: impressions > 0 ? (link_clicks / impressions) * 100 : 0,
      cpc_link: link_clicks > 0 ? spend / link_clicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      wa_conversations,
      cost_per_conversation: wa_conversations > 0 ? spend / wa_conversations : 0,
    };
  }, [compareMetrics, compareEnabled]);

  // Daily chart data
  const dailyData = useMemo(() => {
    const byDate = {};
    metricsDaily.forEach(m => {
      if (!byDate[m.date]) {
        byDate[m.date] = { 
          date: m.date, 
          spend: 0, 
          impressions: 0, 
          clicks: 0,
          wa_conversations: 0
        };
      }
      byDate[m.date].spend += m.spend || 0;
      byDate[m.date].impressions += m.impressions || 0;
      byDate[m.date].clicks += m.clicks || 0;
      byDate[m.date].wa_conversations += m.whatsapp_conversations_started || 0;
    });
    return Object.values(byDate).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [metricsDaily]);

  // Campaign data
  const campaigns = useMemo(() => {
    const byCampaign = {};
    adData.forEach(ad => {
      if (!byCampaign[ad.campaign_id]) {
        byCampaign[ad.campaign_id] = {
          campaign_name: ad.campaign_name,
          spend: 0,
          impressions: 0,
          reach: 0,
          link_clicks: 0,
          conversations: 0,
        };
      }
      byCampaign[ad.campaign_id].spend += ad.spend || 0;
      byCampaign[ad.campaign_id].impressions += ad.impressions || 0;
      byCampaign[ad.campaign_id].reach += ad.reach || 0;
      byCampaign[ad.campaign_id].link_clicks += ad.link_clicks || 0;
      byCampaign[ad.campaign_id].conversations += ad.wa_conversations_started_7d || 0;
    });
    
    return Object.values(byCampaign).map(c => ({
      ...c,
      ctr_link: c.impressions > 0 ? (c.link_clicks / c.impressions) * 100 : 0,
      cpc_link: c.link_clicks > 0 ? c.spend / c.link_clicks : 0,
      cost_per_conversation: c.conversations > 0 ? c.spend / c.conversations : 0,
    }));
  }, [adData]);

  const getKPIConfig = (kpiId) => {
    const configs = {
      spend: { label: 'Investimento', type: 'currency', theme: 'blue' },
      impressions: { label: 'Impressões', type: 'number', theme: 'purple' },
      reach: { label: 'Alcance', type: 'number', theme: 'green' },
      frequency: { label: 'Frequência', type: 'decimal', theme: 'orange', formula: 'Impressões / Alcance' },
      clicks: { label: 'Cliques', type: 'number', theme: 'blue' },
      link_clicks: { label: 'Cliques no link', type: 'number', theme: 'purple' },
      ctr_link: { label: 'CTR Link', type: 'percent', theme: 'green', formula: 'Cliques no link / Impressões * 100' },
      cpc_link: { label: 'CPC Link', type: 'currency', theme: 'orange', formula: 'Investimento / Cliques no link' },
      cpm: { label: 'CPM', type: 'currency', theme: 'blue', formula: '(Investimento / Impressões) * 1000' },
      wa_conversations: { label: 'Conversas iniciadas', type: 'number', theme: 'green' },
      cost_per_conversation: { label: 'Custo por conversa', type: 'currency', theme: 'orange', formula: 'Investimento / Conversas' },
    };
    return configs[kpiId] || { label: kpiId, type: 'number', theme: 'blue' };
  };

  if (unitsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatório de Tráfego Pago</h1>
          <p className="text-gray-500 mt-1">Estilo Reportei - Meta Ads</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Palette className="w-4 h-4" />
            Tema: {THEMES.find(t => t.id === theme)?.name}
          </Button>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <ReporteiFilters
        units={units}
        selectedUnit={selectedUnit}
        onUnitChange={setSelectedUnit}
        period={period}
        onPeriodChange={setPeriod}
        compareEnabled={compareEnabled}
        onCompareToggle={setCompareEnabled}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
      />

      {/* KPI Selector */}
      <div className="flex justify-end">
        <KPISelector selectedKPIs={selectedKPIs} onChange={setSelectedKPIs} />
      </div>

      {metricsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {selectedKPIs.map((kpiId) => {
              const config = getKPIConfig(kpiId);
              return (
                <KPICard
                  key={kpiId}
                  label={config.label}
                  value={aggregated[kpiId]}
                  type={config.type}
                  previousValue={aggregatedCompare?.[kpiId]}
                  formula={config.formula}
                  theme={config.theme}
                />
              );
            })}
          </div>

          {/* Funil */}
          <FunnelChart data={aggregated} />

          {/* Time Series Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimeSeriesChart
              data={dailyData}
              title="Investimento por Dia"
              dataKey="spend"
              type="bar"
              valueType="currency"
              color="#3B82F6"
            />
            <TimeSeriesChart
              data={dailyData}
              title="Impressões por Dia"
              dataKey="impressions"
              type="line"
              valueType="number"
              color="#8B5CF6"
            />
            <TimeSeriesChart
              data={dailyData}
              title="Cliques por Dia"
              dataKey="clicks"
              type="line"
              valueType="number"
              color="#10B981"
            />
            <TimeSeriesChart
              data={dailyData}
              title="Conversas iniciadas por Dia"
              dataKey="wa_conversations"
              type="line"
              valueType="number"
              color="#F59E0B"
            />
          </div>

          {/* Campaigns Table */}
          <DataTable
            title="Desempenho por Campanha"
            columns={[
              { field: 'campaign_name', label: 'Campanha', type: 'string' },
              { field: 'spend', label: 'Investimento', type: 'currency' },
              { field: 'impressions', label: 'Impressões', type: 'number' },
              { field: 'reach', label: 'Alcance', type: 'number' },
              { field: 'link_clicks', label: 'Cliques no link', type: 'number' },
              { field: 'ctr_link', label: 'CTR Link', type: 'percent' },
              { field: 'cpc_link', label: 'CPC Link', type: 'currency' },
              { field: 'conversations', label: 'Conversas', type: 'number' },
              { field: 'cost_per_conversation', label: 'Custo/Conversa', type: 'currency' },
            ]}
            data={campaigns}
          />
        </>
      )}
    </div>
  );
}