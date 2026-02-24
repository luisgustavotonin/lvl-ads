import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays, format, differenceInDays } from 'date-fns';
import { Settings2, Globe, Monitor, Users, Image, GripVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

import PeriodFilter from '@/components/report/PeriodFilter';
import MetaExportPDF from '@/components/meta/MetaExportPDF';
import KPICardWithComparison from '@/components/report/KPICardWithComparison';
import FunnelChartNew from '@/components/report/FunnelChartNew';
import RankingTable from '@/components/report/RankingTable';
import FunnelEditor from '@/components/report/FunnelEditor';
import ReportPlatforms from '@/components/report/ReportPlatforms';
import ReportDevice from '@/components/report/ReportDevice';
import ReportDemographic from '@/components/report/ReportDemographic';
import ReportCreatives from '@/components/report/ReportCreatives';

// Grid drag/resize
import { Responsive, WidthProvider } from 'react-grid-layout';
const ResponsiveGridLayout = WidthProvider(Responsive);

const REPORT_TABS = [
  { id: 'overview', label: 'Visão Geral', icon: Settings2 },
  { id: 'platforms', label: 'Plataformas', icon: Globe },
  { id: 'device', label: 'Device', icon: Monitor },
  { id: 'demographic', label: 'Demográfico', icon: Users },
  { id: 'creatives', label: 'Criativos', icon: Image },
];

const ALL_KPIS = [
  { id: 'spend', label: 'Investimento', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Investimento' },
  { id: 'impressions', label: 'Impressões', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Volume' },
  { id: 'reach', label: 'Alcance', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Volume' },
  { id: 'frequency', label: 'Frequência', format: (v) => (v ?? 0).toFixed(2), category: 'Qualidade' },
  { id: 'clicks', label: 'Cliques', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Engajamento' },
  { id: 'linkClicks', label: 'Cliques no link', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Engajamento' },
  { id: 'ctrLink', label: 'CTR Link', format: (v) => `${(v ?? 0).toFixed(2)}%`, category: 'Eficiência' },
  { id: 'cpcLink', label: 'CPC Link', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Custo' },
  { id: 'cpm', label: 'CPM', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Custo' },
  { id: 'conversations', label: 'Conversas Iniciadas', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Conversão' },
  { id: 'totalContact', label: 'Contatos por Mensagem', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Conversão' },
  { id: 'firstReply', label: 'Primeira Resposta', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), category: 'Conversão' },
  { id: 'costPerConversation', label: 'Custo/Conversa', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Custo' },
  { id: 'costPerTotalContact', label: 'Custo/Contato Total', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Custo' },
  { id: 'costPerFirstReply', label: 'Custo/Primeira Resposta', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), category: 'Custo' },
];

// Blocos do dashboard (estrutura única)
const BLOCKS = [
  { id: 'kpis', label: 'KPIs' },
  { id: 'funnel', label: 'Funil' },
  { id: 'charts', label: 'Gráficos por Dia' },
  { id: 'rank_campaign', label: 'Ranking Campanhas' },
  { id: 'rank_adset', label: 'Ranking Conjuntos' },
  { id: 'rank_ads', label: 'Ranking Anúncios' },
];

const DEFAULT_VISIBLE_BLOCKS = BLOCKS.map(b => b.id);

// Layout padrão (você ajusta no modo edição e salva na Unit.settings)
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'kpis', x: 0, y: 0, w: 12, h: 7 },
    { i: 'funnel', x: 0, y: 7, w: 12, h: 11 },
    { i: 'charts', x: 0, y: 18, w: 12, h: 20 },
    { i: 'rank_campaign', x: 0, y: 38, w: 12, h: 12 },
    { i: 'rank_adset', x: 0, y: 50, w: 12, h: 12 },
    { i: 'rank_ads', x: 0, y: 62, w: 12, h: 12 },
  ],
  md: [
    { i: 'kpis', x: 0, y: 0, w: 10, h: 7 },
    { i: 'funnel', x: 0, y: 7, w: 10, h: 11 },
    { i: 'charts', x: 0, y: 18, w: 10, h: 20 },
    { i: 'rank_campaign', x: 0, y: 38, w: 10, h: 12 },
    { i: 'rank_adset', x: 0, y: 50, w: 10, h: 12 },
    { i: 'rank_ads', x: 0, y: 62, w: 10, h: 12 },
  ],
  sm: [
    { i: 'kpis', x: 0, y: 0, w: 6, h: 9 },
    { i: 'funnel', x: 0, y: 9, w: 6, h: 12 },
    { i: 'charts', x: 0, y: 21, w: 6, h: 22 },
    { i: 'rank_campaign', x: 0, y: 43, w: 6, h: 14 },
    { i: 'rank_adset', x: 0, y: 57, w: 6, h: 14 },
    { i: 'rank_ads', x: 0, y: 71, w: 6, h: 14 },
  ],
};

// Dark UI classes (estilo “preto + cinza transparente”)
const ui = {
  page: 'min-h-screen bg-zinc-950 text-white',
  container: 'max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6',
  card: 'bg-white/5 border border-white/10 shadow-lg backdrop-blur-md rounded-2xl',
  cardPad: 'p-4 sm:p-6',
  subtleText: 'text-white/70',
  strongText: 'text-white',
  tabWrap: 'flex overflow-x-auto gap-1 bg-white/5 rounded-2xl border border-white/10 p-1',
  tabActive: 'bg-white/10 text-white shadow-sm',
  tabIdle: 'text-white/70 hover:bg-white/5 hover:text-white',
  divider: 'border-white/10',
};

// helpers label
function shortCompact(v) {
  if (v == null) return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  // compact BR
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

function formatDateString(dateStr) {
  const parts = String(dateStr || '').split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

export default function Reports() {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [period, setPeriod] = useState({ start: subDays(new Date(), 29), end: new Date() });
  const [customComparisonPeriod, setCustomComparisonPeriod] = useState(null);
  const [selectedKPIs, setSelectedKPIs] = useState(ALL_KPIS.map(k => k.id));
  const [selectedPlatforms, setSelectedPlatforms] = useState(['META']);
  const [activeTab, setActiveTab] = useState('overview');

  // Layout state (global / por unidade)
  const [editLayout, setEditLayout] = useState(false);
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
  const [visibleBlocks, setVisibleBlocks] = useState(DEFAULT_VISIBLE_BLOCKS);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin';

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const selectedUnitData = units.find(u => u.id === selectedUnit);

  // Preferência (KPIs) continua por unidade (do jeito que você já tinha)
  const { data: preference } = useQuery({
    queryKey: ['reportPreference', selectedUnit],
    queryFn: () => selectedUnit ? base44.entities.ReportPreference.filter({ unit_id: selectedUnit }).then(d => d[0]) : null,
    enabled: !!selectedUnit
  });

  React.useEffect(() => {
    if (preference?.selected_kpis?.length > 0) setSelectedKPIs(preference.selected_kpis);
  }, [preference]);

  // Inicializa unidade
  React.useEffect(() => {
    if (units.length > 0 && !selectedUnit) setSelectedUnit(units[0].id);
  }, [units, selectedUnit]);

  // Carrega layout global salvo na Unit.settings
  React.useEffect(() => {
    if (!selectedUnitData?.settings) return;

    const s = selectedUnitData.settings || {};
    if (s.report_layouts) setLayouts(s.report_layouts);
    if (Array.isArray(s.report_visible_blocks) && s.report_visible_blocks.length > 0) {
      setVisibleBlocks(s.report_visible_blocks);
    }
  }, [selectedUnitData?.id]); // troca de unidade

  // Salva KPIs (debounce)
  React.useEffect(() => {
    if (!selectedUnit || selectedKPIs.length === 0) return;

    const savePreference = async () => {
      const payload = { unit_id: selectedUnit, selected_kpis: selectedKPIs };
      if (preference?.id) await base44.entities.ReportPreference.update(preference.id, payload);
      else await base44.entities.ReportPreference.create(payload);
    };

    const t = setTimeout(savePreference, 500);
    return () => clearTimeout(t);
  }, [selectedKPIs, selectedUnit, preference]);

  // Salva layout global (somente admin, quando estiver editando)
  React.useEffect(() => {
    if (!isAdmin) return;
    if (!selectedUnitData?.id) return;

    const save = async () => {
      // só salva se você estiver em modo edição (evita writes desnecessários)
      if (!editLayout) return;

      const newSettings = {
        ...(selectedUnitData.settings || {}),
        report_layouts: layouts,
        report_visible_blocks: visibleBlocks,
      };

      await base44.entities.Unit.update(selectedUnitData.id, { settings: newSettings });
    };

    const t = setTimeout(save, 900);
    return () => clearTimeout(t);
  }, [layouts, visibleBlocks, editLayout, isAdmin, selectedUnitData?.id]);

  // Funil (mantém como você tinha)
  const [funnelStages, setFunnelStages] = useState([
    { key: 'impressions', label: 'Impressões' },
    { key: 'linkClicks', label: 'Cliques no Link' },
    { key: 'conversations', label: 'Conversas Iniciadas' },
    { key: 'totalContact', label: 'Contatos por Mensagem' },
    { key: 'firstReply', label: 'Primeira Resposta' },
  ]);

  React.useEffect(() => {
    if (!selectedUnitData?.settings?.funnel_stages?.length) return;
    setFunnelStages(selectedUnitData.settings.funnel_stages);
  }, [selectedUnitData?.id]);

  const { data: cardLabels = [] } = useQuery({
    queryKey: ['cardLabels', selectedUnit],
    queryFn: () => selectedUnit ? base44.entities.CardLabel.filter({ unit_id: selectedUnit }) : [],
    enabled: !!selectedUnit
  });

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
    if (!threshold || value == null) return null;

    const greenMin = threshold.green_min ?? -Infinity;
    const greenMax = threshold.green_max ?? Infinity;
    if (value >= greenMin && value <= greenMax) return 'green';

    const yellowMin = threshold.yellow_min ?? -Infinity;
    const yellowMax = threshold.yellow_max ?? Infinity;
    if (value >= yellowMin && value <= yellowMax) return 'yellow';

    const redMin = threshold.red_min ?? -Infinity;
    const redMax = threshold.red_max ?? Infinity;
    if (value >= redMin && value <= redMax) return 'red';

    return null;
  };

  // Dados Meta
  const { data: currentMetrics = [], isLoading } = useQuery({
    queryKey: ['currentMetrics', selectedUnit, period.start, period.end, selectedPlatforms],
    queryFn: async () => {
      if (!selectedUnit) return [];
      if (!selectedPlatforms.includes('META')) return [];
      if (!selectedUnitData?.account_id) return [];

      const startDate = format(period.start, 'yyyy-MM-dd');
      const endDate = format(period.end, 'yyyy-MM-dd');

      const data = await base44.entities.MetaInsightBase.filter({
        account_id: selectedUnitData.account_id,
        date: { $gte: startDate, $lte: endDate }
      }, '-date', 10000);

      return data || [];
    },
    enabled: !!selectedUnit && units.length > 0,
  });

  const previousPeriod = useMemo(() => {
    const days = differenceInDays(period.end, period.start) + 1;
    return { start: subDays(period.start, days), end: subDays(period.start, 1) };
  }, [period]);

  const { data: previousMetrics = [] } = useQuery({
    queryKey: ['previousMetrics', selectedUnit, previousPeriod.start, previousPeriod.end, selectedPlatforms],
    queryFn: async () => {
      if (!selectedUnit) return [];
      if (!selectedPlatforms.includes('META')) return [];
      if (!selectedUnitData?.account_id) return [];

      const startDate = format(previousPeriod.start, 'yyyy-MM-dd');
      const endDate = format(previousPeriod.end, 'yyyy-MM-dd');

      const data = await base44.entities.MetaInsightBase.filter({
        account_id: selectedUnitData.account_id,
        date: { $gte: startDate, $lte: endDate }
      }, '-date', 10000);

      return data || [];
    },
    enabled: !!selectedUnit && units.length > 0,
  });

  // Criativos
  const { data: creatives = [] } = useQuery({
    queryKey: ['metaCreatives', selectedUnit],
    queryFn: async () => {
      if (!selectedUnit) return [];
      if (!selectedUnitData?.account_id) return [];
      const data = await base44.entities.MetaAdsCreative.filter({
        account_id: selectedUnitData.account_id
      }, '-last_updated', 5000);
      return data || [];
    },
    enabled: !!selectedUnit && units.length > 0,
  });

  // Aggregations
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
      spend, impressions, reach, clicks, linkClicks,
      ctrLink: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
      cpcLink: linkClicks > 0 ? spend / linkClicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      frequency: reach > 0 ? impressions / reach : 0,
      conversations, totalContact, firstReply,
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
    const conversations = previousMetrics.reduce((s, m) => s + (m.messaging_conversations_started || 0), 0);
    const totalContact = previousMetrics.reduce((s, m) => s + (m.messaging_conversations_replied || 0), 0);
    const firstReply = previousMetrics.reduce((s, m) => s + (m.leads || 0), 0);

    return {
      spend, impressions, reach, clicks, linkClicks,
      ctrLink: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
      cpcLink: linkClicks > 0 ? spend / linkClicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      frequency: reach > 0 ? impressions / reach : 0,
      conversations, totalContact, firstReply,
      costPerConversation: conversations > 0 ? spend / conversations : 0,
      costPerTotalContact: totalContact > 0 ? spend / totalContact : 0,
      costPerFirstReply: firstReply > 0 ? spend / firstReply : 0,
    };
  }, [previousMetrics]);

  // Enriquecer com criativos
  const enrichedMetrics = useMemo(() => {
    const creativeByAdId = {};
    creatives.forEach(c => {
      if (c.ad_id) {
        creativeByAdId[c.ad_id] = {
          thumbnail: c.thumbnail_url || c.image_url,
          status: c.raw?.status || 'ACTIVE'
        };
      }
    });

    return currentMetrics.map(m => ({
      ...m,
      creative_thumbnail_url: creativeByAdId[m.ad_id]?.thumbnail || null,
      ad_effective_status: creativeByAdId[m.ad_id]?.status || 'ACTIVE'
    }));
  }, [currentMetrics, creatives]);

  // Daily charts
  const dailyCharts = useMemo(() => {
    const byDate = {};
    enrichedMetrics.forEach(m => {
      if (!byDate[m.date]) {
        byDate[m.date] = { date: m.date, spend: 0, impressions: 0, reach: 0, ctr_link: 0, link_clicks: 0, conversations: 0, cost_per_conversation: 0 };
      }
      byDate[m.date].spend += m.spend || 0;
      byDate[m.date].impressions += m.impressions || 0;
      byDate[m.date].reach += m.reach || 0;
      byDate[m.date].link_clicks += m.link_clicks || 0;
      byDate[m.date].conversations += m.messaging_conversations_started || 0;
    });

    Object.values(byDate).forEach(day => {
      day.ctr_link = day.impressions > 0 ? (day.link_clicks / day.impressions) * 100 : 0;
      day.cost_per_conversation = day.conversations > 0 ? (day.spend / day.conversations) : 0;
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [enrichedMetrics]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val || 0));
  const formatPercent = (val) => `${(val || 0).toFixed(2)}%`;

  const isVisible = (id) => visibleBlocks.includes(id);

  if (unitsLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className={ui.page}>
      <div className={ui.container}>
        {/* Header */}
        <Card className={`${ui.card} ${ui.cardPad}`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-3 sm:gap-6">
              {selectedUnitData?.logo_url && (
                <img
                  src={selectedUnitData.logo_url}
                  alt={selectedUnitData.name}
                  className="w-14 h-14 sm:w-24 sm:h-24 lg:w-28 lg:h-28 object-contain rounded-xl bg-white/5 border border-white/10 p-2"
                />
              )}
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold text-white">
                  Relatório - {selectedUnitData?.name || 'Cliente'}
                </h1>
                <p className={`text-sm sm:text-base lg:text-lg mt-1 ${ui.subtleText}`}>
                  Análise completa de performance
                </p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {activeTab === 'overview' && (
                <MetaExportPDF unitName={selectedUnitData?.name || 'Unidade'} period={period} />
              )}

              {/* Edit layout (admin only) */}
              {isAdmin && activeTab === 'overview' && (
                <Button
                  variant={editLayout ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => setEditLayout(v => !v)}
                >
                  <GripVertical className="w-4 h-4" />
                  {editLayout ? "Finalizar Layout" : "Editar Layout"}
                </Button>
              )}

              {/* Blocks visibility (admin only) */}
              {isAdmin && activeTab === 'overview' && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Settings2 className="w-4 h-4" />
                      Blocos
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Blocos do Relatório</SheetTitle>
                      <SheetDescription>Marque o que aparece para todos</SheetDescription>
                    </SheetHeader>

                    <div className="mt-6 space-y-3">
                      {BLOCKS.map(b => (
                        <div key={b.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={visibleBlocks.includes(b.id)}
                            onCheckedChange={(checked) => {
                              setVisibleBlocks(prev =>
                                checked ? [...new Set([...prev, b.id])] : prev.filter(x => x !== b.id)
                              );
                            }}
                          />
                          <span className="text-sm">{b.label}</span>
                        </div>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
              )}

              {/* KPI selection */}
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
                        <h4 className="font-semibold text-sm text-gray-200 mb-2">{category}</h4>
                        {kpis.map(kpi => (
                          <div key={kpi.id} className="flex items-center gap-2 mb-2">
                            <Checkbox
                              checked={selectedKPIs.includes(kpi.id)}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedKPIs([...new Set([...selectedKPIs, kpi.id])]);
                                else setSelectedKPIs(selectedKPIs.filter(id => id !== kpi.id));
                              }}
                            />
                            <label className="text-sm text-white/80">{kpi.label}</label>
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
                <SelectTrigger className="w-full sm:w-64 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <PeriodFilter
                value={period}
                onChange={setPeriod}
                comparisonPeriod={customComparisonPeriod}
                onComparisonChange={setCustomComparisonPeriod}
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-white/80 mb-2 block">Plataformas</Label>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="platform-meta"
                    checked={selectedPlatforms.includes('META')}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedPlatforms([...new Set([...selectedPlatforms, 'META'])]);
                      else setSelectedPlatforms(selectedPlatforms.filter(p => p !== 'META'));
                    }}
                  />
                  <label htmlFor="platform-meta" className="text-sm cursor-pointer text-white/80">Meta Ads</label>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className={ui.tabWrap}>
          {REPORT_TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-1 justify-center ${
                  active ? ui.tabActive : ui.tabIdle
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Breakdowns */}
        {activeTab === 'platforms' && (
          <ReportPlatforms unit={selectedUnitData} period={period} />
        )}
        {activeTab === 'device' && (
          <ReportDevice unit={selectedUnitData} period={period} />
        )}
        {activeTab === 'demographic' && (
          <ReportDemographic unit={selectedUnitData} period={period} />
        )}
        {activeTab === 'creatives' && (
          <ReportCreatives unit={selectedUnitData} period={period} />
        )}

        {/* Overview */}
        {activeTab === 'overview' && (isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768 }}
            cols={{ lg: 12, md: 10, sm: 6 }}
            rowHeight={20}
            margin={[16, 16]}
            isDraggable={isAdmin && editLayout}
            isResizable={isAdmin && editLayout}
            draggableHandle=".drag-handle"
            onLayoutChange={(currentLayout, allLayouts) => {
              // salva layouts por breakpoint
              setLayouts(allLayouts);
            }}
          >
            {/* KPIs */}
            {isVisible('kpis') && (
              <div key="kpis">
                <Card className={`${ui.card} h-full ${ui.cardPad}`}>
                  {isAdmin && editLayout && (
                    <div className="drag-handle cursor-move text-xs text-white/50 mb-3 flex items-center gap-2">
                      <GripVertical className="w-4 h-4" /> Arraste aqui
                    </div>
                  )}
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
                          isAdmin={isAdmin}
                          thresholdStatus={evaluateThreshold(kpi.id, current[kpi.id])}
                        />
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* Funil */}
            {isVisible('funnel') && (
              <div key="funnel">
                <Card className={`${ui.card} h-full ${ui.cardPad}`} data-pdf-section>
                  {isAdmin && editLayout && (
                    <div className="drag-handle cursor-move text-xs text-white/50 mb-3 flex items-center gap-2">
                      <GripVertical className="w-4 h-4" /> Arraste aqui
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Funil de Conversão</h3>
                    <FunnelEditor unitId={selectedUnit} currentStages={funnelStages} onSave={setFunnelStages} />
                  </div>
                  <FunnelChartNew current={current} previous={previous} stages={funnelStages} unitId={selectedUnit} />
                </Card>
              </div>
            )}

            {/* Charts */}
            {isVisible('charts') && (
              <div key="charts">
                <Card className={`${ui.card} h-full ${ui.cardPad}`}>
                  {isAdmin && editLayout && (
                    <div className="drag-handle cursor-move text-xs text-white/50 mb-3 flex items-center gap-2">
                      <GripVertical className="w-4 h-4" /> Arraste aqui
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-white/80">Gráficos por Dia</h3>
                    <span className="text-xs text-white/50">Rótulos sempre ON</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {[
                      { title: 'Investimento por Dia', dataKey: 'spend', stroke: '#3B82F6', fmt: (v) => formatCurrency(v), tickFmt: (v) => shortCompact(v), labelFmt: (v) => `R$${shortCompact(v)}` },
                      { title: 'Impressões por Dia', dataKey: 'impressions', stroke: '#22C55E', fmt: (v) => formatNumber(v), tickFmt: (v) => shortCompact(v), labelFmt: (v) => shortCompact(v) },
                      { title: 'Alcance por Dia', dataKey: 'reach', stroke: '#A855F7', fmt: (v) => formatNumber(v), tickFmt: (v) => shortCompact(v), labelFmt: (v) => shortCompact(v) },
                      { title: 'CTR Link por Dia (%)', dataKey: 'ctr_link', stroke: '#F59E0B', fmt: (v) => formatPercent(v), tickFmt: (v) => `${Number(v || 0).toFixed(1)}%`, labelFmt: (v) => `${Number(v || 0).toFixed(1)}%` },
                      { title: 'Conversas por Dia', dataKey: 'conversations', stroke: '#EC4899', fmt: (v) => formatNumber(v), tickFmt: (v) => shortCompact(v), labelFmt: (v) => shortCompact(v) },
                      { title: 'Custo/Conversa por Dia', dataKey: 'cost_per_conversation', stroke: '#EF4444', fmt: (v) => formatCurrency(v), tickFmt: (v) => shortCompact(v), labelFmt: (v) => `R$${shortCompact(v)}` },
                    ].map(chart => (
                      <Card key={chart.dataKey} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <CardTitle className="text-sm sm:text-base text-white/90 mb-3">{chart.title}</CardTitle>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={dailyCharts}
                              margin={{ top: 34, right: 16, left: 0, bottom: 0 }} // ↑ top maior p/ rótulos não baterem
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                              <XAxis
                                dataKey="date"
                                tickFormatter={formatDateString}
                                tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.65)' }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                                tickLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                              />
                              <YAxis
                                tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.65)' }}
                                tickFormatter={chart.tickFmt}
                                axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                                tickLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                                width={48}
                              />
                              <Tooltip
                                formatter={(v) => chart.fmt(v)}
                                contentStyle={{
                                  background: 'rgba(24,24,27,0.95)',
                                  border: '1px solid rgba(255,255,255,0.10)',
                                  borderRadius: 12,
                                  color: 'white'
                                }}
                                labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                              />
                              <Line
                                type="monotone"
                                dataKey={chart.dataKey}
                                stroke={chart.stroke}
                                strokeWidth={2}
                                dot={{ r: 3, fill: chart.stroke }}
                                activeDot={{ r: 5 }}
                              >
                                {/* Rótulos sempre ON */}
                                <LabelList
                                  dataKey={chart.dataKey}
                                  position="top"
                                  offset={12}              // evita encostar no ponto
                                  formatter={chart.labelFmt}
                                  style={{ fill: 'rgba(255,255,255,0.85)', fontSize: 11 }}
                                />
                              </Line>
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Rankings */}
            {isVisible('rank_campaign') && (
              <div key="rank_campaign">
                <Card className={`${ui.card} h-full ${ui.cardPad}`}>
                  {isAdmin && editLayout && (
                    <div className="drag-handle cursor-move text-xs text-white/50 mb-3 flex items-center gap-2">
                      <GripVertical className="w-4 h-4" /> Arraste aqui
                    </div>
                  )}
                  <RankingTable
                    title="Campanhas em Destaque"
                    data={currentMetrics}
                    groupKey="campaign_id"
                    nameKey="campaign_name"
                    showThumbnail={false}
                    unitId={selectedUnit}
                  />
                </Card>
              </div>
            )}

            {isVisible('rank_adset') && (
              <div key="rank_adset">
                <Card className={`${ui.card} h-full ${ui.cardPad}`}>
                  {isAdmin && editLayout && (
                    <div className="drag-handle cursor-move text-xs text-white/50 mb-3 flex items-center gap-2">
                      <GripVertical className="w-4 h-4" /> Arraste aqui
                    </div>
                  )}
                  <RankingTable
                    title="Conjuntos de Anúncios em Destaque"
                    data={currentMetrics}
                    groupKey="adset_id"
                    nameKey="adset_name"
                    showThumbnail={false}
                    unitId={selectedUnit}
                  />
                </Card>
              </div>
            )}

            {isVisible('rank_ads') && (
              <div key="rank_ads">
                <Card className={`${ui.card} h-full ${ui.cardPad}`}>
                  {isAdmin && editLayout && (
                    <div className="drag-handle cursor-move text-xs text-white/50 mb-3 flex items-center gap-2">
                      <GripVertical className="w-4 h-4" /> Arraste aqui
                    </div>
                  )}
                  <RankingTable
                    title="Anúncios em Destaque"
                    data={enrichedMetrics}
                    groupKey="ad_id"
                    nameKey="ad_name"
                    showThumbnail={true}
                    unitId={selectedUnit}
                  />
                </Card>
              </div>
            )}
          </ResponsiveGridLayout>
        ))}
      </div>
    </div>
  );
}