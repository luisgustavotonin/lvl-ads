import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, TrendingUp, TrendingDown, Minus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import PeriodFilter from '@/components/report/PeriodFilter';
import MetaCampaignsTable from '@/components/meta/MetaCampaignsTable';
import MetaAdsetsTable from '@/components/meta/MetaAdsetsTable';
import MetaAdsTable from '@/components/meta/MetaAdsTable';
import MetaBreakdownPlacement from '@/components/meta/MetaBreakdownPlacement';
import MetaBreakdownDemographics from '@/components/meta/MetaBreakdownDemographics';
import MetaBreakdownDevices from '@/components/meta/MetaBreakdownDevices';
import MetaExportPDF from '@/components/meta/MetaExportPDF';
import MetaExportCSV from '@/components/meta/MetaExportCSV';

const COLORS_BLUE = ['#DBEAFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1E40AF'];

const ALL_KPIS = [
  { id: 'spend', label: 'Investimento', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Investimento' },
  { id: 'impressions', label: 'Impressões', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Alcance' },
  { id: 'reach', label: 'Alcance', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Alcance' },
  { id: 'frequency', label: 'Frequência', format: (v) => v.toFixed(2), category: 'Alcance' },
  { id: 'clicks', label: 'Cliques', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Engajamento' },
  { id: 'linkClicks', label: 'Cliques no link', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Engajamento' },
  { id: 'ctrLink', label: 'CTR Link', format: (v) => `${v.toFixed(2)}%`, category: 'Eficiência' },
  { id: 'cpcLink', label: 'CPC Link', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Eficiência' },
  { id: 'cpm', label: 'CPM', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Eficiência' },
  { id: 'conversations', label: 'Conversas', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'WhatsApp' },
  { id: 'costPerConversation', label: 'Custo/Conversa', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'WhatsApp' },
];

export default function Reports() {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [period, setPeriod] = useState({
    start: subDays(new Date(), 29),
    end: new Date(),
  });
  const [showComparison, setShowComparison] = useState(true);
  const [selectedKPIs, setSelectedKPIs] = useState(ALL_KPIS.map(k => k.id));

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  React.useEffect(() => {
    if (units.length > 0 && !selectedUnit) {
      setSelectedUnit(units[0].id);
    }
  }, [units, selectedUnit]);

  const { data: currentMetrics = [], isLoading } = useQuery({
    queryKey: ['currentMetrics', selectedUnit, period.start, period.end],
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

  const { data: metricsDaily = [] } = useQuery({
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

  const current = useMemo(() => {
    const spend = metricsDaily.reduce((s, m) => s + (m.spend_sum || 0), 0);
    const impressions = metricsDaily.reduce((s, m) => s + (m.impressions_sum || 0), 0);
    const reach = metricsDaily.reduce((s, m) => s + (m.reach_sum || 0), 0);
    const clicks = metricsDaily.reduce((s, m) => s + (m.clicks_sum || 0), 0);
    const linkClicks = metricsDaily.reduce((s, m) => s + (m.link_clicks_sum || 0), 0);
    const conversations = metricsDaily.reduce((s, m) => s + (m.wa_conversations_started_7d_sum || 0), 0);
    
    return {
      spend,
      impressions,
      reach,
      clicks,
      linkClicks,
      ctrLink: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
      cpcLink: linkClicks > 0 ? spend / linkClicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      frequency: reach > 0 ? impressions / reach : 0,
      conversations,
      costPerConversation: conversations > 0 ? spend / conversations : 0,
    };
  }, [metricsDaily]);

  const dailyCharts = useMemo(() => {
    const byDate = {};
    metricsDaily.forEach(m => {
      if (!byDate[m.date]) {
        byDate[m.date] = {
          date: m.date,
          spend: 0,
          impressions: 0,
          reach: 0,
          ctr_link: 0,
          conversations: 0,
          cost_per_conversation: 0,
        };
      }
      byDate[m.date].spend += m.spend_sum || 0;
      byDate[m.date].impressions += m.impressions_sum || 0;
      byDate[m.date].reach += m.reach_sum || 0;
      byDate[m.date].conversations += m.wa_conversations_started_7d_sum || 0;
    });

    // Recalcular métricas derivadas
    Object.values(byDate).forEach(day => {
      day.ctr_link = day.impressions > 0 ? ((day.conversations / day.impressions) * 100) : 0;
      day.cost_per_conversation = day.conversations > 0 ? (day.spend / day.conversations) : 0;
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [metricsDaily]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));
  const formatPercent = (val) => `${val.toFixed(2)}%`;
  const formatDateString = (dateStr) => {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}`;
  };

  const KPICard = ({ kpi }) => {
    const value = current[kpi.id];
    
    return (
      <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="text-sm text-gray-600 font-medium mb-2">{kpi.label}</div>
          <div className="text-3xl font-bold text-gray-900">{kpi.format(value)}</div>
        </CardContent>
      </Card>
    );
  };

  const selectedUnitData = units.find(u => u.id === selectedUnit);

  if (unitsLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto p-8 space-y-6">
        {/* Header */}
        <Card className="p-8 bg-white border border-gray-200 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Relatório Meta Ads - {selectedUnitData?.name || 'Cliente'}</h1>
              <p className="text-lg text-gray-600 mt-2">Análise completa de performance</p>
            </div>
            <div className="flex gap-2">
              <MetaExportCSV 
                metricsDaily={metricsDaily} 
                metaAdDaily={currentMetrics}
                unitName={selectedUnitData?.name || 'Unidade'}
                period={period}
              />
              <MetaExportPDF 
                unitName={selectedUnitData?.name || 'Unidade'}
                period={period}
              />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Settings2 className="w-4 h-4" />
                    KPIs
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Selecionar KPIs</SheetTitle>
                    <SheetDescription>Escolha quais indicadores exibir</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    {Object.entries(ALL_KPIS.reduce((acc, kpi) => {
                      if (!acc[kpi.category]) acc[kpi.category] = [];
                      acc[kpi.category].push(kpi);
                      return acc;
                    }, {})).map(([category, kpis]) => (
                      <div key={category}>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">{category}</h4>
                        {kpis.map(kpi => (
                          <div key={kpi.id} className="flex items-center gap-2 mb-2">
                            <Checkbox 
                              checked={selectedKPIs.includes(kpi.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedKPIs([...selectedKPIs, kpi.id]);
                                } else {
                                  setSelectedKPIs(selectedKPIs.filter(id => id !== kpi.id));
                                }
                              }}
                            />
                            <label className="text-sm">{kpi.label}</label>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <PeriodFilter value={period} onChange={setPeriod} />
          </div>
        </Card>

        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-pdf-section>
              {selectedKPIs.map(kpiId => {
                const kpi = ALL_KPIS.find(k => k.id === kpiId);
                return kpi ? <KPICard key={kpi.id} kpi={kpi} /> : null;
              })}
            </div>

            {/* Funil */}
            <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
              <h3 className="text-xl font-bold text-gray-900 mb-6">Funil de Conversão</h3>
              <div className="space-y-2">
                {[
                  { label: 'Investimento', value: current.spend, format: formatCurrency },
                  { label: 'Impressões', value: current.impressions, format: formatNumber },
                  { label: 'Alcance', value: current.reach, format: formatNumber },
                  { label: 'Cliques', value: current.clicks, format: formatNumber },
                  { label: 'Cliques no link', value: current.linkClicks, format: formatNumber },
                  { label: 'Conversas', value: current.conversations, format: formatNumber },
                ].map((step, idx) => {
                  const maxVal = current.spend;
                  const width = maxVal > 0 ? ((step.value / maxVal) * 100) : 0;
                  const displayWidth = Math.min(Math.max(width, 15), 100);
                  const convRate = idx > 0 ? ((step.value / [current.spend, current.impressions, current.reach, current.clicks, current.linkClicks, current.conversations][idx - 1]) * 100) : 0;
                  
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{step.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-900">{step.format(step.value)}</span>
                          {idx > 0 && <span className="text-xs text-gray-500">{convRate.toFixed(1)}%</span>}
                        </div>
                      </div>
                      <div className="w-full h-12 bg-gray-100 rounded overflow-hidden">
                        <div 
                          className="h-full flex items-center px-3 text-white text-sm font-bold transition-all"
                          style={{ 
                            width: `${displayWidth}%`,
                            backgroundColor: COLORS_BLUE[idx] || COLORS_BLUE[0]
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Gráficos por Dia */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">Investimento por Dia</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Line type="monotone" dataKey="spend" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">Impressões por Dia</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatNumber(v)} />
                      <Line type="monotone" dataKey="impressions" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">Alcance por Dia</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatNumber(v)} />
                      <Line type="monotone" dataKey="reach" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">CTR Link por Dia (%)</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatPercent(v)} />
                      <Line type="monotone" dataKey="ctr_link" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">Conversas por Dia</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatNumber(v)} />
                      <Line type="monotone" dataKey="conversations" stroke="#EC4899" strokeWidth={2} dot={{ fill: '#EC4899', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">Custo/Conversa por Dia</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Line type="monotone" dataKey="cost_per_conversation" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Tabelas de Ranking */}
            <MetaCampaignsTable metaAdDaily={currentMetrics} />
            <MetaAdsetsTable metaAdDaily={currentMetrics} />
            <MetaAdsTable metaAdDaily={currentMetrics} />

            {/* Breakdowns */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Análise por Segmento</h2>
              <div className="space-y-6">
                <MetaBreakdownPlacement metaAdDaily={currentMetrics} />
                <MetaBreakdownDemographics metaAdDaily={currentMetrics} />
                <MetaBreakdownDevices metaAdDaily={currentMetrics} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}