import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays, format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import PeriodFilter from '@/components/report/PeriodFilter';

const COLORS_BLUE = ['#DBEAFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1E40AF'];

export default function Reports() {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [period, setPeriod] = useState({
    start: subDays(new Date(), 29),
    end: new Date(),
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  React.useEffect(() => {
    if (units.length > 0 && !selectedUnit) {
      setSelectedUnit(units[0].id);
    }
  }, [units, selectedUnit]);

  const days = differenceInDays(period.end, period.start) + 1;
  const compareStartDate = subDays(period.start, days);
  const compareEndDate = subDays(period.start, 1);

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
      });
    },
    enabled: !!selectedUnit,
  });

  const { data: previousMetrics = [] } = useQuery({
    queryKey: ['previousMetrics', selectedUnit, compareStartDate, compareEndDate],
    queryFn: async () => {
      if (!selectedUnit) return [];
      return base44.entities.MetaAdDaily.filter({
        unit_id: selectedUnit,
        date: { 
          $gte: format(compareStartDate, 'yyyy-MM-dd'), 
          $lte: format(compareEndDate, 'yyyy-MM-dd') 
        }
      });
    },
    enabled: !!selectedUnit,
  });

  const current = useMemo(() => {
    const spend = currentMetrics.reduce((s, m) => s + (m.spend || 0), 0);
    const impressions = currentMetrics.reduce((s, m) => s + (m.impressions || 0), 0);
    const reachSet = new Set();
    currentMetrics.forEach(m => { if (m.ad_id) reachSet.add(m.ad_id); });
    const reach = currentMetrics.reduce((max, m) => Math.max(max, m.reach || 0), 0);
    const clicks = currentMetrics.reduce((s, m) => s + (m.clicks || 0), 0);
    const linkClicks = currentMetrics.reduce((s, m) => s + (m.link_clicks || 0), 0);
    const conversations = currentMetrics.reduce((s, m) => s + (m.wa_conversations_started_7d || 0), 0);
    
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
  }, [currentMetrics]);

  const previous = useMemo(() => {
    const spend = previousMetrics.reduce((s, m) => s + (m.spend || 0), 0);
    const impressions = previousMetrics.reduce((s, m) => s + (m.impressions || 0), 0);
    const reach = previousMetrics.reduce((max, m) => Math.max(max, m.reach || 0), 0);
    const clicks = previousMetrics.reduce((s, m) => s + (m.clicks || 0), 0);
    const linkClicks = previousMetrics.reduce((s, m) => s + (m.link_clicks || 0), 0);
    const conversations = previousMetrics.reduce((s, m) => s + (m.wa_conversations_started_7d || 0), 0);
    
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
  }, [previousMetrics]);

  // Separar por plataforma (Facebook vs Instagram)
  const facebook = useMemo(() => {
    const fbAds = currentMetrics.filter(m => {
      const placement = m.placement_json;
      if (!placement) return false;
      return JSON.stringify(placement).toLowerCase().includes('facebook');
    });
    
    const spend = fbAds.reduce((s, m) => s + (m.spend || 0), 0);
    const impressions = fbAds.reduce((s, m) => s + (m.impressions || 0), 0);
    const reach = fbAds.reduce((max, m) => Math.max(max, m.reach || 0), 0);
    const clicks = fbAds.reduce((s, m) => s + (m.clicks || 0), 0);
    
    return { spend, impressions, reach, clicks };
  }, [currentMetrics]);

  const instagram = useMemo(() => {
    const igAds = currentMetrics.filter(m => {
      const placement = m.placement_json;
      if (!placement) return false;
      return JSON.stringify(placement).toLowerCase().includes('instagram');
    });
    
    const spend = igAds.reduce((s, m) => s + (m.spend || 0), 0);
    const impressions = igAds.reduce((s, m) => s + (m.impressions || 0), 0);
    const reach = igAds.reduce((max, m) => Math.max(max, m.reach || 0), 0);
    const clicks = igAds.reduce((s, m) => s + (m.clicks || 0), 0);
    
    return { spend, impressions, reach, clicks };
  }, [currentMetrics]);

  const facebookPrev = useMemo(() => {
    const fbAds = previousMetrics.filter(m => {
      const placement = m.placement_json;
      if (!placement) return false;
      return JSON.stringify(placement).toLowerCase().includes('facebook');
    });
    
    const spend = fbAds.reduce((s, m) => s + (m.spend || 0), 0);
    const impressions = fbAds.reduce((s, m) => s + (m.impressions || 0), 0);
    const reach = fbAds.reduce((max, m) => Math.max(max, m.reach || 0), 0);
    const clicks = fbAds.reduce((s, m) => s + (m.clicks || 0), 0);
    
    return { spend, impressions, reach, clicks };
  }, [previousMetrics]);

  const instagramPrev = useMemo(() => {
    const igAds = previousMetrics.filter(m => {
      const placement = m.placement_json;
      if (!placement) return false;
      return JSON.stringify(placement).toLowerCase().includes('instagram');
    });
    
    const spend = igAds.reduce((s, m) => s + (m.spend || 0), 0);
    const impressions = igAds.reduce((s, m) => s + (m.impressions || 0), 0);
    const reach = igAds.reduce((max, m) => Math.max(max, m.reach || 0), 0);
    const clicks = igAds.reduce((s, m) => s + (m.clicks || 0), 0);
    
    return { spend, impressions, reach, clicks };
  }, [previousMetrics]);

  const variation = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));
  const formatPercent = (val) => `${val.toFixed(2)}%`;

  const MetricCard = ({ label, current, previous, format, positiveIsGood = true }) => {
    const diff = variation(current, previous);
    const isPositive = diff > 0;
    const isNeutral = diff === 0;
    const color = isNeutral ? 'text-gray-500' : (isPositive === positiveIsGood ? 'text-green-600' : 'text-red-600');
    const Icon = isNeutral ? Minus : (isPositive ? TrendingUp : TrendingDown);
    
    return (
      <Card className="p-5 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="text-sm text-gray-600 font-medium mb-2">{label}</div>
        <div className="text-3xl font-bold text-gray-900 mb-3">{format(current)}</div>
        <div className={`flex items-center gap-1.5 text-sm font-semibold ${color} mb-1`}>
          <Icon className="w-4 h-4" />
          <span>{isPositive ? '+' : ''}{diff.toFixed(2)}%</span>
        </div>
        <div className="text-xs text-gray-500">{format(previous)} no período anterior</div>
      </Card>
    );
  };

  const dailyData = useMemo(() => {
    const byDate = {};
    currentMetrics.forEach(m => {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, spend: 0 };
      byDate[m.date].spend += m.spend || 0;
    });
    return Object.values(byDate).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [currentMetrics]);

  const hourlyData = useMemo(() => {
    // Simular dados por hora (agrupando por dia como placeholder)
    const byDate = {};
    currentMetrics.forEach(m => {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, impressions: 0, reach: 0 };
      byDate[m.date].impressions += m.impressions || 0;
      if (m.reach > byDate[m.date].reach) byDate[m.date].reach = m.reach;
    });
    return Object.values(byDate).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [currentMetrics]);

  const campaigns = useMemo(() => {
    const byCampaign = {};
    currentMetrics.forEach(ad => {
      if (!byCampaign[ad.campaign_id]) {
        byCampaign[ad.campaign_id] = {
          name: ad.campaign_name,
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          linkClicks: 0,
          conversations: 0,
        };
      }
      byCampaign[ad.campaign_id].spend += ad.spend || 0;
      byCampaign[ad.campaign_id].impressions += ad.impressions || 0;
      if (ad.reach > byCampaign[ad.campaign_id].reach) byCampaign[ad.campaign_id].reach = ad.reach;
      byCampaign[ad.campaign_id].clicks += ad.clicks || 0;
      byCampaign[ad.campaign_id].linkClicks += ad.link_clicks || 0;
      byCampaign[ad.campaign_id].conversations += ad.wa_conversations_started_7d || 0;
    });
    
    return Object.values(byCampaign).map(c => ({
      ...c,
      frequency: c.reach > 0 ? c.impressions / c.reach : 0,
      ctrLink: c.impressions > 0 ? (c.linkClicks / c.impressions) * 100 : 0,
      cpcLink: c.linkClicks > 0 ? c.spend / c.linkClicks : 0,
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
      costPerConversation: c.conversations > 0 ? c.spend / c.conversations : 0,
    })).sort((a, b) => b.conversations - a.conversations);
  }, [currentMetrics]);

  const adsets = useMemo(() => {
    const byAdset = {};
    currentMetrics.forEach(ad => {
      if (!byAdset[ad.adset_id]) {
        byAdset[ad.adset_id] = {
          name: ad.adset_name,
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          linkClicks: 0,
          conversations: 0,
        };
      }
      byAdset[ad.adset_id].spend += ad.spend || 0;
      byAdset[ad.adset_id].impressions += ad.impressions || 0;
      if (ad.reach > byAdset[ad.adset_id].reach) byAdset[ad.adset_id].reach = ad.reach;
      byAdset[ad.adset_id].clicks += ad.clicks || 0;
      byAdset[ad.adset_id].linkClicks += ad.link_clicks || 0;
      byAdset[ad.adset_id].conversations += ad.wa_conversations_started_7d || 0;
    });
    
    return Object.values(byAdset).map(c => ({
      ...c,
      ctrLink: c.impressions > 0 ? (c.linkClicks / c.impressions) * 100 : 0,
      cpcLink: c.linkClicks > 0 ? c.spend / c.linkClicks : 0,
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
      costPerConversation: c.conversations > 0 ? c.spend / c.conversations : 0,
    })).sort((a, b) => b.conversations - a.conversations);
  }, [currentMetrics]);

  const ads = useMemo(() => {
    const byAd = {};
    currentMetrics.forEach(ad => {
      const key = `${ad.ad_id}_${ad.date}`;
      if (!byAd[key]) {
        byAd[key] = {
          name: ad.ad_name,
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          linkClicks: 0,
          conversations: 0,
        };
      }
      byAd[key].spend += ad.spend || 0;
      byAd[key].impressions += ad.impressions || 0;
      if (ad.reach > byAd[key].reach) byAd[key].reach = ad.reach;
      byAd[key].clicks += ad.clicks || 0;
      byAd[key].linkClicks += ad.link_clicks || 0;
      byAd[key].conversations += ad.wa_conversations_started_7d || 0;
    });
    
    return Object.values(byAd).map(a => ({
      ...a,
      ctrLink: a.impressions > 0 ? (a.linkClicks / a.impressions) * 100 : 0,
      cpcLink: a.linkClicks > 0 ? a.spend / a.linkClicks : 0,
      cpm: a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0,
      costPerConversation: a.conversations > 0 ? a.spend / a.conversations : 0,
    })).sort((a, b) => b.conversations - a.conversations);
  }, [currentMetrics]);

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
              <h1 className="text-4xl font-bold text-gray-900">Relatório de {selectedUnitData?.name || 'Cliente'}</h1>
              <p className="text-lg text-gray-600 mt-2">Análise de desempenho</p>
              <p className="text-sm text-gray-500 mt-3">
                Relatório gerado dos dados analisados entre <strong>{format(period.start, "dd/MM/yyyy", { locale: ptBR })}</strong> e <strong>{format(period.end, "dd/MM/yyyy", { locale: ptBR })}</strong> comparado com os dados coletados entre <strong>{format(compareStartDate, "dd/MM/yyyy", { locale: ptBR })}</strong> e <strong>{format(compareEndDate, "dd/MM/yyyy", { locale: ptBR })}</strong>.
              </p>
            </div>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4" />
              Exportar PDF
            </Button>
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
            {/* KPI Grid - 4 colunas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Valor investido" current={current.spend} previous={previous.spend} format={formatCurrency} positiveIsGood={false} />
              <MetricCard label="CTR (Taxa de cliques no link)" current={current.ctrLink} previous={previous.ctrLink} format={formatPercent} />
              <MetricCard label="CPC médio" current={current.cpcLink} previous={previous.cpcLink} format={formatCurrency} positiveIsGood={false} />
              <MetricCard label="CPM médio" current={current.cpm} previous={previous.cpm} format={formatCurrency} positiveIsGood={false} />
              <MetricCard label="Impressões Totais" current={current.impressions} previous={previous.impressions} format={formatNumber} />
              <MetricCard label="Alcance Total" current={current.reach} previous={previous.reach} format={formatNumber} />
              <MetricCard label="Total de Cliques" current={current.clicks} previous={previous.clicks} format={formatNumber} />
              <MetricCard label="Total de cliques no link" current={current.linkClicks} previous={previous.linkClicks} format={formatNumber} />
              <MetricCard label="Frequência" current={current.frequency} previous={previous.frequency} format={(v) => v.toFixed(2)} />
              <MetricCard label="Conversas iniciadas por mensagem" current={current.conversations} previous={previous.conversations} format={formatNumber} />
              <MetricCard label="Custo por conversas iniciadas por mensagem" current={current.costPerConversation} previous={previous.costPerConversation} format={formatCurrency} positiveIsGood={false} />
            </div>

            {/* Funil + Gráfico Investimento */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Funil</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Valor investido', value: current.spend, format: formatCurrency },
                    { label: 'Impressões Totais', value: current.impressions, format: formatNumber },
                    { label: 'Alcance Total', value: current.reach, format: formatNumber },
                    { label: 'Total de Cliques', value: current.clicks, format: formatNumber },
                    { label: 'Total de cliques no link', value: current.linkClicks, format: formatNumber },
                    { label: 'Conversas iniciadas por mensagem', value: current.conversations, format: formatNumber },
                  ].map((step, idx) => {
                    const maxVal = current.spend;
                    const width = maxVal > 0 ? ((step.value / maxVal) * 100) : 0;
                    const displayWidth = Math.min(Math.max(width, 15), 100);
                    
                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{step.label}</span>
                          <span className="text-sm font-bold text-gray-900">{step.format(step.value)}</span>
                        </div>
                        <div className="w-full h-12 bg-gray-100 rounded overflow-hidden">
                          <div 
                            className="h-full flex items-center justify-center text-white text-sm font-bold transition-all"
                            style={{ 
                              width: `${displayWidth}%`,
                              backgroundColor: COLORS_BLUE[idx] || COLORS_BLUE[0]
                            }}
                          >
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Valor investido por dia</h3>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(d) => format(new Date(d), 'dd/MM/yyyy')} />
                      <Line type="monotone" dataKey="spend" stroke="#22C55E" strokeWidth={3} dot={{ fill: '#22C55E', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Impressões e Alcance por hora */}
            <Card className="p-6 bg-white border border-gray-200 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Impressões e Alcance por hora</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(d) => format(new Date(d), 'dd/MM/yyyy')} />
                    <Bar dataKey="impressions" fill="#22C55E" name="Impressões" />
                    <Bar dataKey="reach" fill="#3B82F6" name="Alcance" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Alcance e Impressões por plataforma */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Facebook */}
              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <div className="space-y-4">
                  <MetricCard label="Alcance no Facebook" current={facebook.reach} previous={facebookPrev.reach} format={formatNumber} />
                  <MetricCard label="Impressões no Facebook" current={facebook.impressions} previous={facebookPrev.impressions} format={formatNumber} />
                  <MetricCard label="Cliques no Facebook" current={facebook.clicks} previous={facebookPrev.clicks} format={formatNumber} />
                  <MetricCard label="Valor Investido no Facebook" current={facebook.spend} previous={facebookPrev.spend} format={formatCurrency} positiveIsGood={false} />
                </div>
              </Card>

              {/* Instagram */}
              <Card className="p-6 bg-white border border-gray-200 shadow-sm">
                <div className="space-y-4">
                  <MetricCard label="Alcance no Instagram" current={instagram.reach} previous={instagramPrev.reach} format={formatNumber} />
                  <MetricCard label="Impressões no Instagram" current={instagram.impressions} previous={instagramPrev.impressions} format={formatNumber} />
                  <MetricCard label="Cliques no Instagram" current={instagram.clicks} previous={instagramPrev.clicks} format={formatNumber} />
                  <MetricCard label="Valor Investido no Instagram" current={instagram.spend} previous={instagramPrev.spend} format={formatCurrency} positiveIsGood={false} />
                </div>
              </Card>
            </div>

            {/* Campaigns Table */}
            <Card className="p-6 bg-white border border-gray-200 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Campanhas em destaque</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome da Campanha</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Resultados</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo por resultados</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor investido</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPC</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPM</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Alcance</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impressões</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Frequência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {campaigns.slice(0, 10).map((c, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-gray-900">{formatNumber(c.conversations)}</div>
                          <div className="text-xs text-gray-500">Conversas iniciadas por mensagens (7d)</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-gray-900">{formatCurrency(c.costPerConversation)}</div>
                          <div className="text-xs text-gray-500">Conversas iniciadas por mensagens (7d)</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(c.spend)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatPercent(c.ctrLink)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(c.cpcLink)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(c.cpm)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(c.reach)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(c.impressions)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{c.frequency.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Adsets Table */}
            <Card className="p-6 bg-white border border-gray-200 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Conjunto de anúncios em destaque</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conjunto de anúncio</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Resultados</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo por resultados</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor investido</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPC</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPM</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Alcance</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impressões</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cliques</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {adsets.slice(0, 10).map((a, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{a.name}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-gray-900">{formatNumber(a.conversations)}</div>
                          <div className="text-xs text-gray-500">Conversas iniciadas por mensagens (7d)</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-gray-900">{formatCurrency(a.costPerConversation)}</div>
                          <div className="text-xs text-gray-500">Conversas iniciadas por mensagens (7d)</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(a.spend)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatPercent(a.ctrLink)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(a.cpcLink)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(a.cpm)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(a.reach)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(a.impressions)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(a.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Ads Table */}
            <Card className="p-6 bg-white border border-gray-200 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Anúncios em Destaque</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anúncio</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Resultados</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo por resultados</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor investido</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPC</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPM</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Alcance</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impressões</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cliques</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {ads.slice(0, 10).map((a, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{a.name}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-gray-900">{formatNumber(a.conversations)}</div>
                          <div className="text-xs text-gray-500">Conversas</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-gray-900">{formatCurrency(a.costPerConversation)}</div>
                          <div className="text-xs text-gray-500">Conversas</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(a.spend)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatPercent(a.ctrLink)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(a.cpcLink)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(a.cpm)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(a.reach)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(a.impressions)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(a.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}