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

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'];

export default function ReporteiStyle() {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const today = new Date();
  const [endDate] = useState(today);
  const [startDate] = useState(subDays(today, 29));

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  React.useEffect(() => {
    if (units.length > 0 && !selectedUnit) {
      setSelectedUnit(units[0].id);
    }
  }, [units, selectedUnit]);

  const days = differenceInDays(endDate, startDate) + 1;
  const compareStartDate = subDays(startDate, days);
  const compareEndDate = subDays(startDate, 1);

  // Current period
  const { data: currentMetrics = [], isLoading } = useQuery({
    queryKey: ['currentMetrics', selectedUnit, startDate, endDate],
    queryFn: async () => {
      if (!selectedUnit) return [];
      return base44.entities.MetricsDaily.filter({
        unit_id: selectedUnit,
        platform_id: 'META',
        date: { 
          $gte: format(startDate, 'yyyy-MM-dd'), 
          $lte: format(endDate, 'yyyy-MM-dd') 
        }
      });
    },
    enabled: !!selectedUnit,
  });

  // Previous period
  const { data: previousMetrics = [] } = useQuery({
    queryKey: ['previousMetrics', selectedUnit, compareStartDate, compareEndDate],
    queryFn: async () => {
      if (!selectedUnit) return [];
      return base44.entities.MetricsDaily.filter({
        unit_id: selectedUnit,
        platform_id: 'META',
        date: { 
          $gte: format(compareStartDate, 'yyyy-MM-dd'), 
          $lte: format(compareEndDate, 'yyyy-MM-dd') 
        }
      });
    },
    enabled: !!selectedUnit,
  });

  // Ad-level data for tables
  const { data: adData = [] } = useQuery({
    queryKey: ['adData', selectedUnit, startDate, endDate],
    queryFn: async () => {
      if (!selectedUnit) return [];
      return base44.entities.MetaAdDaily.filter({
        unit_id: selectedUnit,
        date: { 
          $gte: format(startDate, 'yyyy-MM-dd'), 
          $lte: format(endDate, 'yyyy-MM-dd') 
        }
      });
    },
    enabled: !!selectedUnit,
  });

  const current = useMemo(() => {
    const spend = currentMetrics.reduce((s, m) => s + (m.spend || 0), 0);
    const impressions = currentMetrics.reduce((s, m) => s + (m.impressions || 0), 0);
    const maxReach = Math.max(...currentMetrics.map(m => m.reach || 0), 0);
    const clicks = currentMetrics.reduce((s, m) => s + (m.clicks || 0), 0);
    const linkClicks = currentMetrics.reduce((s, m) => s + (m.link_clicks || 0), 0);
    const conversations = currentMetrics.reduce((s, m) => s + (m.whatsapp_conversations_started || 0), 0);
    
    return {
      spend,
      impressions,
      reach: maxReach,
      clicks,
      linkClicks,
      ctrLink: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
      cpcLink: linkClicks > 0 ? spend / linkClicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      frequency: maxReach > 0 ? impressions / maxReach : 0,
      conversations,
      costPerConversation: conversations > 0 ? spend / conversations : 0,
    };
  }, [currentMetrics]);

  const previous = useMemo(() => {
    const spend = previousMetrics.reduce((s, m) => s + (m.spend || 0), 0);
    const impressions = previousMetrics.reduce((s, m) => s + (m.impressions || 0), 0);
    const maxReach = Math.max(...previousMetrics.map(m => m.reach || 0), 0);
    const clicks = previousMetrics.reduce((s, m) => s + (m.clicks || 0), 0);
    const linkClicks = previousMetrics.reduce((s, m) => s + (m.link_clicks || 0), 0);
    const conversations = previousMetrics.reduce((s, m) => s + (m.whatsapp_conversations_started || 0), 0);
    
    return {
      spend,
      impressions,
      reach: maxReach,
      clicks,
      linkClicks,
      ctrLink: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
      cpcLink: linkClicks > 0 ? spend / linkClicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      frequency: maxReach > 0 ? impressions / maxReach : 0,
      conversations,
      costPerConversation: conversations > 0 ? spend / conversations : 0,
    };
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
      <Card className="p-4 bg-white border border-gray-200">
        <div className="text-sm text-gray-600 mb-1">{label}</div>
        <div className="text-2xl font-bold text-gray-900 mb-2">{format(current)}</div>
        <div className={`flex items-center gap-1 text-sm ${color}`}>
          <Icon className="w-4 h-4" />
          <span className="font-medium">{isPositive ? '+' : ''}{diff.toFixed(2)}%</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">{format(previous)} no período anterior</div>
      </Card>
    );
  };

  // Daily chart data
  const dailyData = useMemo(() => {
    const byDate = {};
    currentMetrics.forEach(m => {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, spend: 0 };
      byDate[m.date].spend += m.spend || 0;
    });
    return Object.values(byDate).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [currentMetrics]);

  // Campaigns
  const campaigns = useMemo(() => {
    const byCampaign = {};
    adData.forEach(ad => {
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
  }, [adData]);

  const selectedUnitData = units.find(u => u.id === selectedUnit);

  if (unitsLoading) {
    return <div className="space-y-4"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Relatório de {selectedUnitData?.name || 'Cliente'}</h1>
              <p className="text-sm text-gray-500 mt-1">Análise de desempenho</p>
            </div>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4" />
              Exportar PDF
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-gray-600">
              {format(startDate, "dd/MM/yyyy", { locale: ptBR })} - {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
              <span className="text-gray-400 ml-2">
                (comparado com {format(compareStartDate, "dd/MM/yyyy", { locale: ptBR })} - {format(compareEndDate, "dd/MM/yyyy", { locale: ptBR })})
              </span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <MetricCard label="Custo por conversas iniciadas" current={current.costPerConversation} previous={previous.costPerConversation} format={formatCurrency} positiveIsGood={false} />
            </div>

            {/* Funnel */}
            <Card className="p-6 bg-white border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Funil</h3>
              <div className="space-y-2">
                {[
                  { label: 'Valor investido', value: current.spend, format: formatCurrency },
                  { label: 'Impressões Totais', value: current.impressions, format: formatNumber },
                  { label: 'Alcance Total', value: current.reach, format: formatNumber },
                  { label: 'Total de Cliques', value: current.clicks, format: formatNumber },
                  { label: 'Total de cliques no link', value: current.linkClicks, format: formatNumber },
                  { label: 'Conversas iniciadas por mensagem', value: current.conversations, format: formatNumber },
                ].map((step, idx) => {
                  const maxVal = current.impressions;
                  const width = maxVal > 0 ? (typeof step.value === 'number' ? (step.value / maxVal) * 100 : 100) : 0;
                  return (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-48 text-sm text-gray-700">{step.label}</div>
                      <div className="flex-1 h-10 bg-gray-100 rounded-lg overflow-hidden">
                        <div 
                          className="h-full flex items-center justify-end px-4 text-white text-sm font-medium"
                          style={{ 
                            width: `${Math.max(width, 5)}%`,
                            backgroundColor: COLORS[idx] || COLORS[0]
                          }}
                        >
                          {step.format(step.value)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Daily Chart */}
            <Card className="p-6 bg-white border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Valor investido por dia</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Bar dataKey="spend" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Campaigns Table */}
            <Card className="p-6 bg-white border border-gray-200 overflow-hidden">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Campanhas em destaque</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome da Campanha</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor investido</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPC</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPM</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Alcance</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impressões</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Frequência</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conversas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {campaigns.slice(0, 10).map((c, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{c.name}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(c.spend)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatPercent(c.ctrLink)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(c.cpcLink)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(c.cpm)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(c.reach)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(c.impressions)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{c.frequency.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">{formatNumber(c.conversations)}</td>
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