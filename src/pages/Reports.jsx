import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays, format, differenceInDays } from 'date-fns';
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
import MetaExportPDF from '@/components/meta/MetaExportPDF';
import MetaExportCSV from '@/components/meta/MetaExportCSV';
import KPICardWithComparison from '@/components/report/KPICardWithComparison';
import FunnelChartNew from '@/components/report/FunnelChartNew';
import RankingTable from '@/components/report/RankingTable';
import FunnelEditor from '@/components/report/FunnelEditor';

const COLORS_BLUE = ['#DBEAFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1E40AF'];

const ALL_KPIS = [
  { id: 'spend', label: 'Investimento', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Investimento' },
  { id: 'impressions', label: 'Impressões', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Volume' },
  { id: 'reach', label: 'Alcance', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Volume' },
  { id: 'frequency', label: 'Frequência', format: (v) => v.toFixed(2), category: 'Qualidade' },
  { id: 'clicks', label: 'Cliques', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Engajamento' },
  { id: 'linkClicks', label: 'Cliques no link', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Engajamento' },
  { id: 'ctrLink', label: 'CTR Link', format: (v) => `${v.toFixed(2)}%`, category: 'Eficiência' },
  { id: 'cpcLink', label: 'CPC Link', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Custo' },
  { id: 'cpm', label: 'CPM', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Custo' },
  { id: 'conversations', label: 'Conversas Iniciadas', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Conversão' },
  { id: 'totalContact', label: 'Contatos por Mensagem', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Conversão' },
  { id: 'firstReply', label: 'Primeira Resposta', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Conversão' },
  { id: 'costPerConversation', label: 'Custo/Conversa', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Custo' },
  { id: 'costPerTotalContact', label: 'Custo/Contato Total', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Custo' },
  { id: 'costPerFirstReply', label: 'Custo/Primeira Resposta', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Custo' },
];

export default function Reports() {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [period, setPeriod] = useState({
    start: subDays(new Date(), 29),
    end: new Date(),
  });
  const [showComparison, setShowComparison] = useState(true);
  const [selectedKPIs, setSelectedKPIs] = useState(ALL_KPIS.map(k => k.id));
  const [selectedPlatforms, setSelectedPlatforms] = useState(['META']);
  const [funnelStages, setFunnelStages] = useState([
    { key: 'impressions', label: 'Impressões' },
    { key: 'linkClicks', label: 'Cliques no Link' },
    { key: 'conversations', label: 'Conversas Iniciadas' },
    { key: 'totalContact', label: 'Contatos por Mensagem' },
    { key: 'firstReply', label: 'Primeira Resposta' },
  ]);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: cardLabels = [] } = useQuery({
    queryKey: ['cardLabels', selectedUnit],
    queryFn: () => selectedUnit ? base44.entities.CardLabel.filter({ unit_id: selectedUnit }) : [],
    enabled: !!selectedUnit
  });

  React.useEffect(() => {
    if (units.length > 0 && !selectedUnit) {
      setSelectedUnit(units[0].id);
    }
  }, [units, selectedUnit]);

  // Carregar configuração do funil das settings da unidade
  React.useEffect(() => {
    if (selectedUnit && units.length > 0) {
      const unit = units.find(u => u.id === selectedUnit);
      if (unit?.settings?.funnel_stages && unit.settings.funnel_stages.length > 0) {
        setFunnelStages(unit.settings.funnel_stages);
      }
    }
  }, [selectedUnit, units]);

  const { data: currentMetrics = [], isLoading } = useQuery({
    queryKey: ['currentMetrics', selectedUnit, period.start, period.end, selectedPlatforms],
    queryFn: async () => {
      if (!selectedUnit) return [];
      if (!selectedPlatforms.includes('META')) return [];
      
      const unit = units.find(u => u.id === selectedUnit);
      if (!unit?.account_id) return [];

      const startDate = format(period.start, 'yyyy-MM-dd');
      const endDate = format(period.end, 'yyyy-MM-dd');
      
      const data = await base44.entities.MetaInsightBase.filter({
        account_id: unit.account_id,
        date: { $gte: startDate, $lte: endDate }
      }, '-date', 10000);
      return data || [];
    },
    enabled: !!selectedUnit && units.length > 0,
  });

  // Calcular período anterior
  const previousPeriod = useMemo(() => {
    const days = differenceInDays(period.end, period.start) + 1;
    return {
      start: subDays(period.start, days),
      end: subDays(period.start, 1)
    };
  }, [period]);

  const { data: previousMetrics = [] } = useQuery({
    queryKey: ['previousMetrics', selectedUnit, previousPeriod.start, previousPeriod.end, selectedPlatforms],
    queryFn: async () => {
      if (!selectedUnit) return [];
      if (!selectedPlatforms.includes('META')) return [];
      
      const unit = units.find(u => u.id === selectedUnit);
      if (!unit?.account_id) return [];

      const startDate = format(previousPeriod.start, 'yyyy-MM-dd');
      const endDate = format(previousPeriod.end, 'yyyy-MM-dd');
      
      const data = await base44.entities.MetaInsightBase.filter({
        account_id: unit.account_id,
        date: { $gte: startDate, $lte: endDate }
      }, '-date', 10000);
      return data || [];
    },
    enabled: !!selectedUnit && units.length > 0,
  });

  // (auto-detect removed — always show META when unit is selected)

  const current = useMemo(() => {
    const spend = currentMetrics.reduce((s, m) => s + (m.spend || 0), 0);
    const impressions = currentMetrics.reduce((s, m) => s + (m.impressions || 0), 0);
    const reach = currentMetrics.reduce((s, m) => s + (m.reach || 0), 0);
    const clicks = currentMetrics.reduce((s, m) => s + (m.clicks || 0), 0);
    const linkClicks = currentMetrics.reduce((s, m) => s + (m.link_clicks || 0), 0);
    const conversations = currentMetrics.reduce((s, m) => s + (m.messaging_conversations_started || 0), 0);
    const totalContact = currentMetrics.reduce((s, m) => s + (m.messaging_conversations_replied || 0), 0);
    const firstReply = currentMetrics.reduce((s, m) => s + (m.leads || 0), 0);
    
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
      totalContact,
      firstReply,
      costPerConversation: conversations > 0 ? spend / conversations : 0,
      costPerTotalContact: totalContact > 0 ? spend / totalContact : 0,
      costPerFirstReply: firstReply > 0 ? spend / firstReply : 0,
    };
  }, [currentMetrics]);

  const previous = useMemo(() => {
    const spend = previousMetrics.reduce((s, m) => s + (m.spend || 0), 0);
    const impressions = previousMetrics.reduce((s, m) => s + (m.impressions || 0), 0);
    const reach = previousMetrics.reduce((s, m) => s + (m.reach || 0), 0);
    const clicks = previousMetrics.reduce((s, m) => s + (m.clicks || 0), 0);
    const linkClicks = previousMetrics.reduce((s, m) => s + (m.link_clicks || 0), 0);
    const conversations = previousMetrics.reduce((s, m) => s + (m.wa_conversations_started_7d || 0), 0);
    const totalContact = previousMetrics.reduce((s, m) => s + (m.wa_total_messaging_connection || 0), 0);
    const firstReply = previousMetrics.reduce((s, m) => s + (m.wa_messaging_first_reply || 0), 0);
    
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
      totalContact,
      firstReply,
      costPerConversation: conversations > 0 ? spend / conversations : 0,
      costPerTotalContact: totalContact > 0 ? spend / totalContact : 0,
      costPerFirstReply: firstReply > 0 ? spend / firstReply : 0,
    };
  }, [previousMetrics]);

  const dailyCharts = useMemo(() => {
    const byDate = {};
    currentMetrics.forEach(m => {
      if (!byDate[m.date]) {
        byDate[m.date] = {
          date: m.date,
          spend: 0,
          impressions: 0,
          reach: 0,
          link_clicks: 0,
          ctr_link: 0,
          conversations: 0,
          cost_per_conversation: 0,
        };
      }
      byDate[m.date].spend += m.spend || 0;
      byDate[m.date].impressions += m.impressions || 0;
      byDate[m.date].reach += m.reach || 0;
      byDate[m.date].link_clicks += m.link_clicks || 0;
      byDate[m.date].conversations += m.wa_conversations_started_7d || 0;
    });

    // Recalcular métricas derivadas
    Object.values(byDate).forEach(day => {
      day.ctr_link = day.impressions > 0 ? ((day.link_clicks / day.impressions) * 100) : 0;
      day.cost_per_conversation = day.conversations > 0 ? (day.spend / day.conversations) : 0;
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [currentMetrics]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));
  const formatPercent = (val) => `${val.toFixed(2)}%`;
  const formatDateString = (dateStr) => {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}`;
  };

  const { data: thresholds = [] } = useQuery({
    queryKey: ['thresholds', selectedUnit],
    queryFn: () => selectedUnit ? base44.entities.KpiThreshold.filter({ unit_id: selectedUnit, enabled: true }) : [],
    enabled: !!selectedUnit
  });

  const getKpiLabel = (kpi) => {
    const customLabel = cardLabels.find(cl => cl.card_key === kpi.id);
    return customLabel?.custom_label || kpi.label;
  };

  const evaluateThreshold = (kpiKey, value) => {
    const threshold = thresholds.find(t => t.kpi_key === kpiKey);
    if (!threshold || value === null || value === undefined) return null;

    // Verificar green
    const greenMin = threshold.green_min !== null && threshold.green_min !== undefined ? threshold.green_min : -Infinity;
    const greenMax = threshold.green_max !== null && threshold.green_max !== undefined ? threshold.green_max : Infinity;
    if (value >= greenMin && value <= greenMax) return 'green';

    // Verificar yellow
    const yellowMin = threshold.yellow_min !== null && threshold.yellow_min !== undefined ? threshold.yellow_min : -Infinity;
    const yellowMax = threshold.yellow_max !== null && threshold.yellow_max !== undefined ? threshold.yellow_max : Infinity;
    if (value >= yellowMin && value <= yellowMax) return 'yellow';

    // Verificar red
    const redMin = threshold.red_min !== null && threshold.red_min !== undefined ? threshold.red_min : -Infinity;
    const redMax = threshold.red_max !== null && threshold.red_max !== undefined ? threshold.red_max : Infinity;
    if (value >= redMin && value <= redMax) return 'red';

    return null;
  };

  const selectedUnitData = units.find(u => u.id === selectedUnit);

  if (unitsLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <Card className="p-4 sm:p-6 lg:p-8 bg-white border border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-3 sm:gap-6">
              {selectedUnitData?.logo_url && (
                <img 
                  src={selectedUnitData.logo_url} 
                  alt={selectedUnitData.name}
                  className="w-14 h-14 sm:w-24 sm:h-24 lg:w-32 lg:h-32 object-contain rounded-lg"
                />
              )}
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold text-gray-900">Relatório - {selectedUnitData?.name || 'Cliente'}</h1>
                <p className="text-sm sm:text-base lg:text-lg text-gray-600 mt-1">Análise completa de performance</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <MetaExportCSV 
                metricsDaily={[]} 
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
          
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="w-full sm:w-64">
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

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Plataformas</Label>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="platform-meta"
                    checked={selectedPlatforms.includes('META')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPlatforms([...selectedPlatforms, 'META']);
                      } else {
                        setSelectedPlatforms(selectedPlatforms.filter(p => p !== 'META'));
                      }
                    }}
                  />
                  <label htmlFor="platform-meta" className="text-sm cursor-pointer">Meta Ads</label>
                </div>
                <div className="flex items-center gap-2 opacity-50">
                  <Checkbox id="platform-google" disabled />
                  <label htmlFor="platform-google" className="text-sm">Google Ads (em breve)</label>
                </div>
                <div className="flex items-center gap-2 opacity-50">
                  <Checkbox id="platform-tiktok" disabled />
                  <label htmlFor="platform-tiktok" className="text-sm">TikTok Ads (em breve)</label>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4" data-pdf-section>
              {selectedKPIs.map(kpiId => {
                const kpi = ALL_KPIS.find(k => k.id === kpiId);
                if (!kpi) return null;
                
                return (
                  <KPICardWithComparison
                    key={kpi.id}
                    kpiKey={kpi.id}
                    label={getKpiLabel(kpi)}
                    currentValue={current[kpi.id]}
                    previousValue={previous[kpi.id]}
                    formatValue={kpi.format}
                    unitId={selectedUnit}
                    isAdmin={user?.role === 'admin'}
                    thresholdStatus={evaluateThreshold(kpi.id, current[kpi.id])}
                  />
                );
              })}
            </div>

            {/* Funil */}
            <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Funil de Conversão</h3>
                <FunnelEditor 
                  unitId={selectedUnit}
                  currentStages={funnelStages}
                  onSave={setFunnelStages}
                />
              </div>
              <FunnelChartNew current={current} previous={previous} stages={funnelStages} />
            </Card>

            {/* Gráficos por Dia */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">Investimento por Dia</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 13 }} />
                      <YAxis tick={{ fontSize: 13 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Line type="monotone" dataKey="spend" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} label={{ position: 'top', fontSize: 12, fill: '#3B82F6', formatter: (v) => `R$${(v/1000).toFixed(1)}k` }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">Impressões por Dia</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 13 }} />
                      <YAxis tick={{ fontSize: 13 }} tickFormatter={(v) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)} />
                      <Tooltip formatter={(v) => formatNumber(v)} />
                      <Line type="monotone" dataKey="impressions" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} label={{ position: 'top', fontSize: 12, fill: '#10B981', formatter: (v) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v) }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">Alcance por Dia</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 13 }} />
                      <YAxis tick={{ fontSize: 13 }} tickFormatter={(v) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)} />
                      <Tooltip formatter={(v) => formatNumber(v)} />
                      <Line type="monotone" dataKey="reach" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6', r: 4 }} label={{ position: 'top', fontSize: 12, fill: '#8B5CF6', formatter: (v) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v) }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">CTR Link por Dia (%)</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 13 }} />
                      <YAxis tick={{ fontSize: 13 }} tickFormatter={(v) => v.toFixed(1) + '%'} />
                      <Tooltip formatter={(v) => formatPercent(v)} />
                      <Line type="monotone" dataKey="ctr_link" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', r: 4 }} label={{ position: 'top', fontSize: 12, fill: '#F59E0B', formatter: (v) => v.toFixed(1) + '%' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">Conversas por Dia</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 13 }} />
                      <YAxis tick={{ fontSize: 13 }} />
                      <Tooltip formatter={(v) => formatNumber(v)} />
                      <Line type="monotone" dataKey="conversations" stroke="#EC4899" strokeWidth={2} dot={{ fill: '#EC4899', r: 4 }} label={{ position: 'top', fontSize: 12, fill: '#EC4899' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm" data-pdf-section>
                <CardTitle className="text-lg mb-4">Custo/Conversa por Dia</CardTitle>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyCharts} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 13 }} />
                      <YAxis tick={{ fontSize: 13 }} tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Line type="monotone" dataKey="cost_per_conversation" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', r: 4 }} label={{ position: 'top', fontSize: 12, fill: '#EF4444', formatter: (v) => 'R$' + v.toFixed(0) }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Tabelas de Ranking */}
            <div className="space-y-6">
              <RankingTable 
                title="Campanhas em Destaque"
                data={currentMetrics}
                groupKey="campaign_id"
                nameKey="campaign_name"
                showThumbnail={false}
              />
              
              <RankingTable 
                title="Conjuntos de Anúncios em Destaque"
                data={currentMetrics}
                groupKey="adset_id"
                nameKey="adset_name"
                showThumbnail={false}
              />
              
              <RankingTable 
                title="Anúncios em Destaque"
                data={currentMetrics}
                groupKey="ad_id"
                nameKey="ad_name"
                showThumbnail={true}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}