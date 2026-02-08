import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUp, ArrowDown, Facebook, Instagram } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import UnitSelector from '@/components/report/UnitSelector';
import PeriodSelector from '@/components/report/PeriodSelector';

export default function ReportModel() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [selectedUnit, setSelectedUnit] = useState(null);
  const [period, setPeriod] = useState({
    periodId: 'last_30_days',
    start: subDays(today, 29),
    end: today,
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

  // Período atual
  const { data: currentMetrics = [] } = useQuery({
    queryKey: ['currentMetrics', selectedUnit, period.start, period.end],
    queryFn: async () => {
      if (!selectedUnit) return [];
      const startStr = period.start.toISOString().split('T')[0];
      const endStr = period.end.toISOString().split('T')[0];
      return base44.entities.MetricsDaily.filter({
        unit_id: selectedUnit,
        platform_id: 'META',
        date: { $gte: startStr, $lte: endStr }
      });
    },
    enabled: !!selectedUnit,
  });

  // Período anterior (para comparação)
  const daysInPeriod = Math.floor((period.end - period.start) / (1000 * 60 * 60 * 24)) + 1;
  const previousStart = subDays(period.start, daysInPeriod);
  const previousEnd = subDays(period.end, daysInPeriod);

  const { data: previousMetrics = [] } = useQuery({
    queryKey: ['previousMetrics', selectedUnit, previousStart, previousEnd],
    queryFn: async () => {
      if (!selectedUnit) return [];
      const startStr = previousStart.toISOString().split('T')[0];
      const endStr = previousEnd.toISOString().split('T')[0];
      return base44.entities.MetricsDaily.filter({
        unit_id: selectedUnit,
        platform_id: 'META',
        date: { $gte: startStr, $lte: endStr }
      });
    },
    enabled: !!selectedUnit,
  });

  // Calcular totais
  const current = useMemo(() => {
    return currentMetrics.reduce((acc, m) => ({
      spend: (acc.spend || 0) + (m.spend || 0),
      impressions: (acc.impressions || 0) + (m.impressions || 0),
      reach: (acc.reach || 0) + (m.reach || 0),
      clicks: (acc.clicks || 0) + (m.clicks || 0),
      link_clicks: (acc.link_clicks || 0) + (m.link_clicks || 0),
      whatsapp_conversations: (acc.whatsapp_conversations || 0) + (m.whatsapp_conversations_started || 0),
    }), {});
  }, [currentMetrics]);

  const previous = useMemo(() => {
    return previousMetrics.reduce((acc, m) => ({
      spend: (acc.spend || 0) + (m.spend || 0),
      impressions: (acc.impressions || 0) + (m.impressions || 0),
      reach: (acc.reach || 0) + (m.reach || 0),
      clicks: (acc.clicks || 0) + (m.clicks || 0),
      link_clicks: (acc.link_clicks || 0) + (m.link_clicks || 0),
      whatsapp_conversations: (acc.whatsapp_conversations || 0) + (m.whatsapp_conversations_started || 0),
    }), {});
  }, [previousMetrics]);

  // Calcular métricas derivadas
  current.ctr = current.impressions > 0 ? (current.link_clicks / current.impressions) * 100 : 0;
  current.cpc = current.clicks > 0 ? current.spend / current.clicks : 0;
  current.cpm = current.impressions > 0 ? (current.spend / current.impressions) * 1000 : 0;
  current.frequency = current.reach > 0 ? current.impressions / current.reach : 0;
  current.cost_per_conversation = current.whatsapp_conversations > 0 ? current.spend / current.whatsapp_conversations : 0;

  previous.ctr = previous.impressions > 0 ? (previous.link_clicks / previous.impressions) * 100 : 0;
  previous.cpc = previous.clicks > 0 ? previous.spend / previous.clicks : 0;
  previous.cpm = previous.impressions > 0 ? (previous.spend / previous.impressions) * 1000 : 0;
  previous.frequency = previous.reach > 0 ? previous.impressions / previous.reach : 0;
  previous.cost_per_conversation = previous.whatsapp_conversations > 0 ? previous.spend / previous.whatsapp_conversations : 0;

  // Calcular variações percentuais
  const getVariation = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const KPICard = ({ title, currentValue, previousValue, format = 'currency', showPercent = true }) => {
    const variation = getVariation(currentValue, previousValue);
    const isPositive = variation >= 0;
    
    const formatValue = (val) => {
      if (format === 'currency') return `R$${val.toFixed(2).replace('.', ',')}`;
      if (format === 'percent') return `${val.toFixed(2)}%`;
      if (format === 'number') return Math.round(val).toLocaleString('pt-BR');
      return val;
    };

    return (
      <Card className="border-gray-200">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-gray-900">{formatValue(currentValue)}</span>
            {showPercent && (
              <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                <span>{Math.abs(variation).toFixed(2)}%</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {formatValue(previousValue)} no período anterior
          </p>
        </CardContent>
      </Card>
    );
  };

  if (unitsLoading) {
    return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  }

  const selectedUnitData = units.find(u => u.id === selectedUnit);

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatório de {selectedUnitData?.name || 'Cliente'}</h1>
            <p className="text-sm text-gray-500 mt-1">Análise de desempenho</p>
          </div>
          <div className="flex items-center gap-2">
            <UnitSelector 
              units={units} 
              value={selectedUnit} 
              onChange={setSelectedUnit}
            />
            <PeriodSelector 
              value={period} 
              onChange={setPeriod}
            />
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Relatório gerado dos dados analisados entre{' '}
          <strong>{format(period.start, 'dd/MM/yyyy', { locale: ptBR })}</strong> e{' '}
          <strong>{format(period.end, 'dd/MM/yyyy', { locale: ptBR })}</strong> comparado
          com os dados coletados entre{' '}
          <strong>{format(previousStart, 'dd/MM/yyyy', { locale: ptBR })}</strong> e{' '}
          <strong>{format(previousEnd, 'dd/MM/yyyy', { locale: ptBR })}</strong>.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Logo Meta Ads */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 inline-block">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xl">M</div>
            <span className="text-lg font-semibold text-gray-900">Meta Ads</span>
          </div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          <KPICard title="Valor investido" currentValue={current.spend} previousValue={previous.spend} format="currency" />
          <KPICard title="CTR (Taxa de cliques no link)" currentValue={current.ctr} previousValue={previous.ctr} format="percent" />
          <KPICard title="CPC médio" currentValue={current.cpc} previousValue={previous.cpc} format="currency" />
          <KPICard title="CPM médio" currentValue={current.cpm} previousValue={previous.cpm} format="currency" />
          <KPICard title="Impressões Totais" currentValue={current.impressions} previousValue={previous.impressions} format="number" />
          <KPICard title="Alcance Total" currentValue={current.reach} previousValue={previous.reach} format="number" />
          <KPICard title="Total de Cliques" currentValue={current.clicks} previousValue={previous.clicks} format="number" />
          <KPICard title="Total de cliques no link" currentValue={current.link_clicks} previousValue={previous.link_clicks} format="number" />
          <KPICard title="ROAS de Compras no Site" currentValue={0} previousValue={0} format="number" showPercent={false} />
          <KPICard title="Frequência" currentValue={current.frequency} previousValue={previous.frequency} format="number" />
          <KPICard title="Todos os cadastros (leads)" currentValue={0} previousValue={0} format="number" showPercent={false} />
          <KPICard title="Custo por Todos os cadastros" currentValue={0} previousValue={0} format="currency" showPercent={false} />
          <KPICard title="Conversas iniciadas por mensagem" currentValue={current.whatsapp_conversations} previousValue={previous.whatsapp_conversations} format="number" />
          <KPICard title="Custo por conversas iniciadas" currentValue={current.cost_per_conversation} previousValue={previous.cost_per_conversation} format="currency" />
        </div>

        {/* Funil */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Funil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-4 bg-blue-600 text-white rounded-lg">
                <span className="font-medium">Valor investido</span>
                <span className="font-bold">R${current.spend.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-500 text-white rounded-lg ml-4">
                <span className="font-medium">Impressões Totais</span>
                <span className="font-bold">{Math.round(current.impressions).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-400 text-white rounded-lg ml-8">
                <span className="font-medium">Alcance Total</span>
                <span className="font-bold">{Math.round(current.reach).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-300 text-white rounded-lg ml-12">
                <span className="font-medium">Total de Cliques</span>
                <span className="font-bold">{Math.round(current.clicks).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-200 text-blue-900 rounded-lg ml-16">
                <span className="font-medium">Total de cliques no link</span>
                <span className="font-bold">{Math.round(current.link_clicks).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-100 text-blue-900 rounded-lg ml-20">
                <span className="font-medium">Conversas iniciadas por mensagem</span>
                <span className="font-bold">{Math.round(current.whatsapp_conversations).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder para gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Valor investido por dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">Gráfico de linha temporal</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Impressões e Alcance por hora</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">Gráfico de barras por hora</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Métricas por Plataforma */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Facebook */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center">
                  <Facebook className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Facebook</CardTitle>
                  <p className="text-sm text-gray-600">Métricas do Facebook</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-xs text-gray-600">Alcance no Facebook</p>
                  <p className="text-xl font-bold text-gray-900">--</p>
                  <p className="text-xs text-gray-500">-- no período anterior</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-xs text-gray-600">Impressões no Facebook</p>
                  <p className="text-xl font-bold text-gray-900">--</p>
                  <p className="text-xs text-gray-500">-- no período anterior</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-xs text-gray-600">Cliques no Facebook</p>
                  <p className="text-xl font-bold text-gray-900">--</p>
                  <p className="text-xs text-gray-500">-- no período anterior</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-xs text-gray-600">Valor Investido</p>
                  <p className="text-xl font-bold text-gray-900">--</p>
                  <p className="text-xs text-gray-500">-- no período anterior</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instagram */}
          <Card className="border-pink-200 bg-pink-50/30">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded flex items-center justify-center">
                  <Instagram className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Instagram</CardTitle>
                  <p className="text-sm text-gray-600">Métricas do Instagram</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-xs text-gray-600">Alcance no Instagram</p>
                  <p className="text-xl font-bold text-gray-900">--</p>
                  <p className="text-xs text-gray-500">-- no período anterior</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-xs text-gray-600">Impressões no Instagram</p>
                  <p className="text-xl font-bold text-gray-900">--</p>
                  <p className="text-xs text-gray-500">-- no período anterior</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-xs text-gray-600">Cliques no Instagram</p>
                  <p className="text-xl font-bold text-gray-900">--</p>
                  <p className="text-xs text-gray-500">-- no período anterior</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-xs text-gray-600">Valor Investido</p>
                  <p className="text-xl font-bold text-gray-900">--</p>
                  <p className="text-xs text-gray-500">-- no período anterior</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabelas */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Campanhas em destaque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Nenhuma campanha encontrada no período
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Conjunto de anúncios em destaque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Nenhum conjunto de anúncios encontrado no período
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anúncios em Destaque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Nenhum anúncio encontrado no período
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}