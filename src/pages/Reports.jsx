import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays, format } from 'date-fns';
import { Download, Settings2, Edit2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import PeriodFilter from '@/components/report/PeriodFilter';
import MetaCampaignsTable from '@/components/meta/MetaCampaignsTable';
import MetaAdsetsTable from '@/components/meta/MetaAdsetsTable';
import MetaExportPDF from '@/components/meta/MetaExportPDF';
import MetaExportCSV from '@/components/meta/MetaExportCSV';
import MetaAdsRankingNew from '@/components/meta/MetaAdsRankingNew';
import FunnelChartNew from '@/components/report/FunnelChartNew';

const DEFAULT_CARD_LABELS = {
  spend: 'Investimento',
  impressions: 'Impressões',
  reach: 'Alcance',
  frequency: 'Frequência',
  clicks: 'Cliques',
  linkClicks: 'Cliques no Link',
  ctrLink: 'CTR Link',
  cpcLink: 'CPC Link',
  cpm: 'CPM',
  conversations: 'Conversas',
  totalContacts: 'Contatos Totais',
  firstReply: 'Primeira Resposta',
  costPerConversation: 'Custo/Conversa',
  costPerContact: 'Custo/Contato',
  costPerFirstReply: 'Custo/1ª Resposta',
};

export default function Reports() {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [period, setPeriod] = useState({
    start: subDays(new Date(), 6),
    end: new Date(),
  });
  const [editingCard, setEditingCard] = useState(null);
  const [customLabel, setCustomLabel] = useState('');
  
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  React.useEffect(() => {
    if (units.length > 0 && !selectedUnit) {
      setSelectedUnit(units[0].id);
    }
  }, [units, selectedUnit]);

  const { data: cardLabels = [] } = useQuery({
    queryKey: ['cardLabels', selectedUnit],
    queryFn: () => base44.entities.CardLabel.filter({ unit_id: selectedUnit || 'default' }),
    enabled: !!selectedUnit
  });

  const { data: currentMetrics = [] } = useQuery({
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

  const { data: previousMetrics = [] } = useQuery({
    queryKey: ['previousMetrics', selectedUnit, period.start, period.end],
    queryFn: async () => {
      if (!selectedUnit) return [];
      const daysDiff = Math.ceil((period.end - period.start) / (1000 * 60 * 60 * 24)) + 1;
      const prevStart = subDays(period.start, daysDiff);
      const prevEnd = subDays(period.end, daysDiff);
      
      return base44.entities.MetaAdDaily.filter({
        unit_id: selectedUnit,
        date: { 
          $gte: format(prevStart, 'yyyy-MM-dd'), 
          $lte: format(prevEnd, 'yyyy-MM-dd') 
        }
      }, '-date', 10000);
    },
    enabled: !!selectedUnit,
  });

  const { data: diagnostics } = useQuery({
    queryKey: ['diagnostics', selectedUnit, period.start],
    queryFn: async () => {
      const result = await base44.functions.invoke('runDiagnosticEngine', {
        unit_id: selectedUnit,
        provider: 'META',
        window: '7d'
      });
      return result.data;
    },
    enabled: !!selectedUnit
  });

  const saveCardLabelMutation = useMutation({
    mutationFn: async ({ card_key, label }) => {
      const existing = cardLabels.find(cl => cl.card_key === card_key);
      if (existing) {
        return base44.entities.CardLabel.update(existing.id, { custom_label: label });
      } else {
        return base44.entities.CardLabel.create({
          unit_id: selectedUnit,
          card_key,
          custom_label: label,
          default_label: DEFAULT_CARD_LABELS[card_key]
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardLabels'] });
      toast.success('Label atualizado');
      setEditingCard(null);
    }
  });

  const getCardLabel = (key) => {
    const customLabelObj = cardLabels.find(cl => cl.card_key === key);
    return customLabelObj?.custom_label || DEFAULT_CARD_LABELS[key] || key;
  };

  const current = useMemo(() => {
    const spend = currentMetrics.reduce((s, m) => s + (m.spend || 0), 0);
    const impressions = currentMetrics.reduce((s, m) => s + (m.impressions || 0), 0);
    const reach = currentMetrics.reduce((s, m) => s + (m.reach || 0), 0);
    const clicks = currentMetrics.reduce((s, m) => s + (m.clicks || 0), 0);
    const linkClicks = currentMetrics.reduce((s, m) => s + (m.link_clicks || 0), 0);
    const conversations = currentMetrics.reduce((s, m) => s + (m.wa_conversations_started_7d || 0), 0);
    const totalContacts = currentMetrics.reduce((s, m) => s + (m.wa_total_messaging_connection || 0), 0);
    const firstReply = currentMetrics.reduce((s, m) => s + (m.wa_messaging_first_reply || 0), 0);
    
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
      totalContacts,
      firstReply,
      costPerConversation: conversations > 0 ? spend / conversations : 0,
      costPerContact: totalContacts > 0 ? spend / totalContacts : 0,
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
    const totalContacts = previousMetrics.reduce((s, m) => s + (m.wa_total_messaging_connection || 0), 0);
    const firstReply = previousMetrics.reduce((s, m) => s + (m.wa_messaging_first_reply || 0), 0);
    
    return {
      spend,
      impressions,
      reach,
      conversations,
      totalContacts,
      firstReply,
      costPerConversation: conversations > 0 ? spend / conversations : 0,
      costPerContact: totalContacts > 0 ? spend / totalContacts : 0,
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
          conversations: 0,
        };
      }
      byDate[m.date].spend += m.spend || 0;
      byDate[m.date].impressions += m.impressions || 0;
      byDate[m.date].conversations += m.wa_conversations_started_7d || 0;
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [currentMetrics]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));
  const formatDateString = (dateStr) => {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}`;
  };

  const calculateVariation = (current, previous, lowerIsBetter = false) => {
    if (previous === 0) return { percent: 0, better: false };
    const percent = ((current - previous) / previous) * 100;
    const better = lowerIsBetter ? percent < 0 : percent > 0;
    return { percent, better };
  };

  const KPICard = ({ cardKey, value, format, previous, lowerIsBetter = false }) => {
    const variation = calculateVariation(value, previous, lowerIsBetter);
    const label = getCardLabel(cardKey);
    const canEdit = user?.role === 'admin';

    return (
      <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-2">
            <div className="text-sm text-gray-600 font-medium">{label}</div>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingCard(cardKey);
                  setCustomLabel(label);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">{format(value)}</div>
          {variation.percent !== 0 && (
            <div className={`flex items-center gap-1 text-sm font-medium ${variation.better ? 'text-green-600' : 'text-red-600'}`}>
              {variation.better ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {variation.percent > 0 ? '+' : ''}{variation.percent.toFixed(1)}%
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const selectedUnitData = units.find(u => u.id === selectedUnit);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto p-8 space-y-6">
        {/* Header com Logo Maior */}
        <Card className="p-8 bg-white border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-6">
              {selectedUnitData?.logo_url && (
                <img 
                  src={selectedUnitData.logo_url} 
                  alt={selectedUnitData.name}
                  className="w-24 h-24 object-contain"
                />
              )}
              <div>
                <h1 className="text-4xl font-bold text-gray-900">{selectedUnitData?.name || 'Cliente'}</h1>
                <p className="text-lg text-gray-600 mt-2">Relatório de Performance</p>
              </div>
            </div>
            <div className="flex gap-2">
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

        {/* Diagnósticos */}
        {diagnostics?.triggered_rules?.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <AlertCircle className="w-5 h-5" />
                Diagnósticos Automáticos ({diagnostics.triggered_rules.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {diagnostics.triggered_rules.map((rule, idx) => (
                <Alert key={idx} className="bg-white">
                  <AlertDescription>
                    <div className="flex items-start gap-3">
                      <Badge variant={rule.severity === 'high' ? 'destructive' : 'default'}>
                        {rule.severity}
                      </Badge>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">{rule.message_title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{rule.message_body}</p>
                        <div className="text-xs text-gray-700">
                          <strong>Ações sugeridas:</strong>
                          <ul className="list-disc ml-4 mt-1">
                            {rule.recommended_actions?.map((action, i) => (
                              <li key={i}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}

        {/* KPI Cards com Comparativo */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard cardKey="spend" value={current.spend} format={formatCurrency} previous={previous.spend} />
          <KPICard cardKey="impressions" value={current.impressions} format={formatNumber} previous={previous.impressions} />
          <KPICard cardKey="reach" value={current.reach} format={formatNumber} previous={previous.reach} />
          <KPICard cardKey="conversations" value={current.conversations} format={formatNumber} previous={previous.conversations} />
          <KPICard cardKey="costPerConversation" value={current.costPerConversation} format={formatCurrency} previous={previous.costPerConversation} lowerIsBetter />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard cardKey="linkClicks" value={current.linkClicks} format={formatNumber} previous={0} />
          <KPICard cardKey="ctrLink" value={current.ctrLink} format={(v) => `${v.toFixed(2)}%`} previous={0} />
          <KPICard cardKey="cpcLink" value={current.cpcLink} format={formatCurrency} previous={0} lowerIsBetter />
          <KPICard cardKey="totalContacts" value={current.totalContacts} format={formatNumber} previous={previous.totalContacts} />
          <KPICard cardKey="firstReply" value={current.firstReply} format={formatNumber} previous={previous.firstReply} />
        </div>

        {/* Funil Novo (sem %, gradiente azul) */}
        <Card className="p-6 bg-white border border-gray-200 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Funil de Conversão</h3>
          <FunnelChartNew data={current} />
        </Card>

        {/* Gráficos Diários */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 bg-white">
            <CardTitle className="text-lg mb-4">Investimento</CardTitle>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyCharts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Line type="monotone" dataKey="spend" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6 bg-white">
            <CardTitle className="text-lg mb-4">Impressões</CardTitle>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyCharts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatNumber(v)} />
                <Line type="monotone" dataKey="impressions" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6 bg-white">
            <CardTitle className="text-lg mb-4">Conversas</CardTitle>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyCharts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tickFormatter={formatDateString} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatNumber(v)} />
                <Line type="monotone" dataKey="conversations" stroke="#EC4899" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Ranking de Anúncios (com thumbnail + status) */}
        <MetaAdsRankingNew metaAdDaily={currentMetrics} />

        {/* Tabelas de Ranking */}
        <MetaCampaignsTable metaAdDaily={currentMetrics} />
        <MetaAdsetsTable metaAdDaily={currentMetrics} />
      </div>

      {/* Modal de Edição de Label */}
      {editingCard && (
        <Sheet open={!!editingCard} onOpenChange={() => setEditingCard(null)}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Editar Nome do Card</SheetTitle>
              <SheetDescription>Personalize o nome exibido no relatório</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div>
                <Label>Nome Personalizado</Label>
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Digite o novo nome"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveCardLabelMutation.mutate({ card_key: editingCard, label: customLabel })}>
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setEditingCard(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}