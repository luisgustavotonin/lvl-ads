import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays, format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Tooltip as TooltipUI, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PeriodFilter from '@/components/report/PeriodFilter';
import MetaKPISelector from '@/components/meta/MetaKPISelector';
import MetaFunnel from '@/components/meta/MetaFunnel';
import MetaCampaignsTable from '@/components/meta/MetaCampaignsTable';
import MetaAdsetsTable from '@/components/meta/MetaAdsetsTable';
import MetaAdsTable from '@/components/meta/MetaAdsTable';
import MetaBreakdownPlacement from '@/components/meta/MetaBreakdownPlacement';
import MetaBreakdownDemographics from '@/components/meta/MetaBreakdownDemographics';
import MetaBreakdownDevices from '@/components/meta/MetaBreakdownDevices';

const ALL_KPIS = [
  // Entrega
  { id: 'spend', label: 'Investimento', category: 'Entrega', field: 'spend_sum', format: 'currency', formula: 'Σ Investimento' },
  { id: 'impressions', label: 'Impressões', category: 'Entrega', field: 'impressions_sum', format: 'number', formula: 'Σ Impressões' },
  { id: 'reach', label: 'Alcance', category: 'Entrega', field: 'reach_sum', format: 'number', formula: 'Σ Alcance' },
  { id: 'frequency', label: 'Frequência', category: 'Entrega', field: 'frequency_calc', format: 'decimal', formula: 'Impressões ÷ Alcance' },
  // Tráfego
  { id: 'clicks', label: 'Cliques', category: 'Tráfego', field: 'clicks_sum', format: 'number', formula: 'Σ Cliques' },
  { id: 'link_clicks', label: 'Cliques no link', category: 'Tráfego', field: 'link_clicks_sum', format: 'number', formula: 'Σ Cliques no link' },
  { id: 'ctr_link', label: 'CTR Link', category: 'Tráfego', field: 'ctr_link_calc', format: 'percent', formula: 'Cliques no link ÷ Impressões' },
  { id: 'cpc_link', label: 'CPC Link', category: 'Tráfego', field: 'cpc_link_calc', format: 'currency', formula: 'Investimento ÷ Cliques no link' },
  { id: 'cpm', label: 'CPM', category: 'Tráfego', field: 'cpm_calc', format: 'currency', formula: '(Investimento ÷ Impressões) × 1000' },
  // WhatsApp
  { id: 'conversations', label: 'Conversas iniciadas', category: 'WhatsApp', field: 'wa_conversations_started_7d_sum', format: 'number', formula: 'Σ Conversas iniciadas (7d)' },
  { id: 'cost_per_conversation', label: 'Custo por conversa', category: 'WhatsApp', field: 'cost_per_conversation_calc', format: 'currency', formula: 'Investimento ÷ Conversas' },
  { id: 'total_contact', label: 'Total messaging connection', category: 'WhatsApp', field: 'wa_total_messaging_connection_sum', format: 'number', formula: 'Σ Total messaging connection' },
  { id: 'cost_per_contact', label: 'Custo por total contact', category: 'WhatsApp', field: 'cost_per_total_contact_calc', format: 'currency', formula: 'Investimento ÷ Total contact' },
  { id: 'first_reply', label: 'First reply', category: 'WhatsApp', field: 'wa_messaging_first_reply_sum', format: 'number', formula: 'Σ First reply' },
  { id: 'cost_per_first_reply', label: 'Custo por first reply', category: 'WhatsApp', field: 'cost_per_first_reply_calc', format: 'currency', formula: 'Investimento ÷ First reply' },
  // Engajamento
  { id: 'page_engagement', label: 'Page engagement', category: 'Engajamento', field: 'page_engagement_sum', format: 'number', formula: 'Σ Page engagement' },
  { id: 'post_engagement', label: 'Post engagement', category: 'Engajamento', field: 'post_engagement_sum', format: 'number', formula: 'Σ Post engagement' },
  { id: 'video_views', label: 'Video views', category: 'Engajamento', field: 'video_view_sum', format: 'number', formula: 'Σ Video views' },
  { id: 'post_interaction', label: 'Post interaction gross', category: 'Engajamento', field: 'post_interaction_gross_sum', format: 'number', formula: 'Σ Post interaction' },
  { id: 'reactions', label: 'Reactions', category: 'Engajamento', field: 'post_reaction_sum', format: 'number', formula: 'Σ Reactions' },
  { id: 'net_likes', label: 'Net likes', category: 'Engajamento', field: 'post_net_like_sum', format: 'number', formula: 'Σ Net likes' },
];

export default function MetaDashboard() {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [period, setPeriod] = useState({
    start: subDays(new Date(), 29),
    end: new Date(),
  });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [selectedKPIs, setSelectedKPIs] = useState([
    'spend', 'impressions', 'reach', 'frequency', 'link_clicks', 'ctr_link', 'conversations', 'cost_per_conversation'
  ]);

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  React.useEffect(() => {
    if (units.length > 0 && !selectedUnit) {
      setSelectedUnit(units[0].id);
    }
  }, [units, selectedUnit]);

  const days = Math.ceil((period.end - period.start) / (1000 * 60 * 60 * 24)) + 1;
  const compareStart = subDays(period.start, days);
  const compareEnd = subDays(period.start, 1);

  const { data: currentMetrics = [], isLoading } = useQuery({
    queryKey: ['metricsDailyCurrent', selectedUnit, period.start, period.end],
    queryFn: async () => {
      if (!selectedUnit) return [];
      return base44.entities.MetricsDaily.filter({
        unit_id: selectedUnit,
        date: { 
          $gte: format(period.start, 'yyyy-MM-dd'), 
          $lte: format(period.end, 'yyyy-MM-dd') 
        }
      }, '-date', 5000);
    },
    enabled: !!selectedUnit,
  });

  const { data: metaAdDaily = [] } = useQuery({
    queryKey: ['metaAdDailyCurrent', selectedUnit, period.start, period.end],
    queryFn: async () => {
      if (!selectedUnit) return [];
      return base44.entities.MetaAdDaily.filter({
        unit_id: selectedUnit,
        date: { 
          $gte: format(period.start, 'yyyy-MM-dd'), 
          $lte: format(period.end, 'yyyy-MM-dd') 
        }
      }, '-date', 10000);
    },
    enabled: !!selectedUnit,
  });

  const { data: compareMetrics = [] } = useQuery({
    queryKey: ['metricsDailyCompare', selectedUnit, compareStart, compareEnd],
    queryFn: async () => {
      if (!selectedUnit || !compareEnabled) return [];
      return base44.entities.MetricsDaily.filter({
        unit_id: selectedUnit,
        date: { 
          $gte: format(compareStart, 'yyyy-MM-dd'), 
          $lte: format(compareEnd, 'yyyy-MM-dd') 
        }
      }, '-date', 5000);
    },
    enabled: !!selectedUnit && compareEnabled,
  });

  const currentTotals = useMemo(() => {
    if (!currentMetrics.length) return {};
    return ALL_KPIS.reduce((acc, kpi) => {
      if (kpi.field.endsWith('_calc')) {
        // Recalcular
        if (kpi.id === 'frequency') {
          const reach = currentMetrics.reduce((s, m) => s + (m.reach_sum || 0), 0);
          const impressions = currentMetrics.reduce((s, m) => s + (m.impressions_sum || 0), 0);
          acc[kpi.id] = reach > 0 ? impressions / reach : 0;
        } else if (kpi.id === 'ctr_link') {
          const link_clicks = currentMetrics.reduce((s, m) => s + (m.link_clicks_sum || 0), 0);
          const impressions = currentMetrics.reduce((s, m) => s + (m.impressions_sum || 0), 0);
          acc[kpi.id] = impressions > 0 ? link_clicks / impressions : 0;
        } else if (kpi.id === 'cpc_link') {
          const spend = currentMetrics.reduce((s, m) => s + (m.spend_sum || 0), 0);
          const link_clicks = currentMetrics.reduce((s, m) => s + (m.link_clicks_sum || 0), 0);
          acc[kpi.id] = link_clicks > 0 ? spend / link_clicks : 0;
        } else if (kpi.id === 'cpm') {
          const spend = currentMetrics.reduce((s, m) => s + (m.spend_sum || 0), 0);
          const impressions = currentMetrics.reduce((s, m) => s + (m.impressions_sum || 0), 0);
          acc[kpi.id] = impressions > 0 ? (spend / impressions) * 1000 : 0;
        } else if (kpi.id === 'cost_per_conversation') {
          const spend = currentMetrics.reduce((s, m) => s + (m.spend_sum || 0), 0);
          const conversations = currentMetrics.reduce((s, m) => s + (m.wa_conversations_started_7d_sum || 0), 0);
          acc[kpi.id] = conversations > 0 ? spend / conversations : 0;
        } else if (kpi.id === 'cost_per_contact') {
          const spend = currentMetrics.reduce((s, m) => s + (m.spend_sum || 0), 0);
          const contacts = currentMetrics.reduce((s, m) => s + (m.wa_total_messaging_connection_sum || 0), 0);
          acc[kpi.id] = contacts > 0 ? spend / contacts : 0;
        } else if (kpi.id === 'cost_per_first_reply') {
          const spend = currentMetrics.reduce((s, m) => s + (m.spend_sum || 0), 0);
          const replies = currentMetrics.reduce((s, m) => s + (m.wa_messaging_first_reply_sum || 0), 0);
          acc[kpi.id] = replies > 0 ? spend / replies : 0;
        }
      } else {
        // Somar
        acc[kpi.id] = currentMetrics.reduce((s, m) => s + (m[kpi.field] || 0), 0);
      }
      return acc;
    }, {});
  }, [currentMetrics]);

  const compareTotals = useMemo(() => {
    if (!compareMetrics.length) return {};
    return ALL_KPIS.reduce((acc, kpi) => {
      if (kpi.field.endsWith('_calc')) {
        if (kpi.id === 'frequency') {
          const reach = compareMetrics.reduce((s, m) => s + (m.reach_sum || 0), 0);
          const impressions = compareMetrics.reduce((s, m) => s + (m.impressions_sum || 0), 0);
          acc[kpi.id] = reach > 0 ? impressions / reach : 0;
        } else if (kpi.id === 'ctr_link') {
          const link_clicks = compareMetrics.reduce((s, m) => s + (m.link_clicks_sum || 0), 0);
          const impressions = compareMetrics.reduce((s, m) => s + (m.impressions_sum || 0), 0);
          acc[kpi.id] = impressions > 0 ? link_clicks / impressions : 0;
        } else if (kpi.id === 'cpc_link') {
          const spend = compareMetrics.reduce((s, m) => s + (m.spend_sum || 0), 0);
          const link_clicks = compareMetrics.reduce((s, m) => s + (m.link_clicks_sum || 0), 0);
          acc[kpi.id] = link_clicks > 0 ? spend / link_clicks : 0;
        } else if (kpi.id === 'cpm') {
          const spend = compareMetrics.reduce((s, m) => s + (m.spend_sum || 0), 0);
          const impressions = compareMetrics.reduce((s, m) => s + (m.impressions_sum || 0), 0);
          acc[kpi.id] = impressions > 0 ? (spend / impressions) * 1000 : 0;
        } else if (kpi.id === 'cost_per_conversation') {
          const spend = compareMetrics.reduce((s, m) => s + (m.spend_sum || 0), 0);
          const conversations = compareMetrics.reduce((s, m) => s + (m.wa_conversations_started_7d_sum || 0), 0);
          acc[kpi.id] = conversations > 0 ? spend / conversations : 0;
        } else if (kpi.id === 'cost_per_contact') {
          const spend = compareMetrics.reduce((s, m) => s + (m.spend_sum || 0), 0);
          const contacts = compareMetrics.reduce((s, m) => s + (m.wa_total_messaging_connection_sum || 0), 0);
          acc[kpi.id] = contacts > 0 ? spend / contacts : 0;
        } else if (kpi.id === 'cost_per_first_reply') {
          const spend = compareMetrics.reduce((s, m) => s + (m.spend_sum || 0), 0);
          const replies = compareMetrics.reduce((s, m) => s + (m.wa_messaging_first_reply_sum || 0), 0);
          acc[kpi.id] = replies > 0 ? spend / replies : 0;
        }
      } else {
        acc[kpi.id] = compareMetrics.reduce((s, m) => s + (m[kpi.field] || 0), 0);
      }
      return acc;
    }, {});
  }, [compareMetrics]);

  const formatValue = (value, format) => {
    if (format === 'currency') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    if (format === 'percent') return `${(value * 100).toFixed(2)}%`;
    if (format === 'decimal') return value.toFixed(2);
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  const getVariation = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const KPICard = ({ kpi }) => {
    const current = currentTotals[kpi.id] || 0;
    const previous = compareTotals[kpi.id] || 0;
    const variation = compareEnabled ? getVariation(current, previous) : null;
    const isPositive = variation !== null && variation > 0;
    const isNeutral = variation !== null && variation === 0;
    
    return (
      <Card className="p-4 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm text-gray-600 font-medium">{kpi.label}</span>
          <TooltipProvider>
            <TooltipUI>
              <TooltipTrigger>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{kpi.formula}</p>
              </TooltipContent>
            </TooltipUI>
          </TooltipProvider>
        </div>
        <div className="text-2xl font-bold text-gray-900 mb-2">{formatValue(current, kpi.format)}</div>
        {compareEnabled && variation !== null && (
          <div className={`flex items-center gap-1 text-sm font-semibold ${isNeutral ? 'text-gray-500' : isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isNeutral ? <Minus className="w-4 h-4" /> : isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{isPositive ? '+' : ''}{variation.toFixed(1)}%</span>
          </div>
        )}
      </Card>
    );
  };

  const chartData = useMemo(() => {
    const byDate = {};
    currentMetrics.forEach(m => {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date };
      byDate[m.date].spend = (byDate[m.date].spend || 0) + m.spend_sum;
      byDate[m.date].impressions = (byDate[m.date].impressions || 0) + m.impressions_sum;
      byDate[m.date].reach = (byDate[m.date].reach || 0) + m.reach_sum;
      byDate[m.date].clicks = (byDate[m.date].clicks || 0) + m.clicks_sum;
      byDate[m.date].conversations = (byDate[m.date].conversations || 0) + m.wa_conversations_started_7d_sum;
      byDate[m.date].link_clicks = (byDate[m.date].link_clicks || 0) + m.link_clicks_sum;
    });
    
    const data = Object.values(byDate).map(d => ({
      ...d,
      ctr: d.impressions > 0 ? (d.link_clicks / d.impressions) * 100 : 0,
      cost_per_conversation: d.conversations > 0 ? d.spend / d.conversations : 0,
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return data;
  }, [currentMetrics]);

  if (isLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen p-6 space-y-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Meta Ads Dashboard</h1>
            <p className="text-gray-600 mt-1">Análise completa de performance</p>
          </div>
          <MetaKPISelector selected={selectedKPIs} onChange={setSelectedKPIs} allKPIs={ALL_KPIS} />
        </div>

        {/* Filters */}
        <Card className="p-4 bg-white">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-64">
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PeriodFilter value={period} onChange={setPeriod} />
            <div className="flex items-center gap-2">
              <Switch checked={compareEnabled} onCheckedChange={setCompareEnabled} />
              <span className="text-sm text-gray-700">Comparar períodos</span>
            </div>
          </div>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {selectedKPIs.map(kpiId => {
            const kpi = ALL_KPIS.find(k => k.id === kpiId);
            return kpi ? <KPICard key={kpi.id} kpi={kpi} /> : null;
          })}
        </div>

        {/* Funil */}
        <MetaFunnel data={currentTotals} />

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-lg">Investimento por dia</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)} />
                    <Line type="monotone" dataKey="spend" stroke="#2563EB" strokeWidth={2} dot={{ fill: '#2563EB' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-lg">Impressões por dia</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="impressions" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-lg">Alcance por dia</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="reach" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-lg">CTR por dia (%)</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${v.toFixed(2)}%`} />
                    <Line type="monotone" dataKey="ctr" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-lg">Conversas por dia</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="conversations" fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-lg">Custo por conversa por dia</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)} />
                    <Line type="monotone" dataKey="cost_per_conversation" stroke="#EC4899" strokeWidth={2} dot={{ fill: '#EC4899' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabelas de Ranking */}
        <MetaCampaignsTable metaAdDaily={metaAdDaily} />
        <MetaAdsetsTable metaAdDaily={metaAdDaily} />
        <MetaAdsTable metaAdDaily={metaAdDaily} />

        {/* Breakdowns */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Análise por Segmento</h2>
          <div className="space-y-6">
            <MetaBreakdownPlacement metaAdDaily={metaAdDaily} />
            <MetaBreakdownDemographics metaAdDaily={metaAdDaily} />
            <MetaBreakdownDevices metaAdDaily={metaAdDaily} />
          </div>
        </div>
      </div>
    </div>
  );
}