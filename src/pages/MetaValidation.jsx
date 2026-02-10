import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function MetaValidation() {
  const [selectedDate, setSelectedDate] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: metaAdDaily = [], isLoading: loadingAds, refetch: refetchAds } = useQuery({
    queryKey: ['metaAdDailyValidation', selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      return base44.entities.MetaAdDaily.filter({ date: selectedDate }, '-created_date', 1000);
    },
    enabled: !!selectedDate,
  });

  const { data: metricsDaily = [], isLoading: loadingMetrics, refetch: refetchMetrics } = useQuery({
    queryKey: ['metricsDailyValidation', selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      return base44.entities.MetricsDaily.filter({ date: selectedDate });
    },
    enabled: !!selectedDate,
  });

  const { data: availableDates = [] } = useQuery({
    queryKey: ['availableDates'],
    queryFn: async () => {
      const ads = await base44.entities.MetaAdDaily.list('-date', 100);
      const dates = [...new Set(ads.map(a => a.date))].sort().reverse();
      return dates;
    },
  });

  React.useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-900">Acesso Negado</h3>
                <p className="text-red-700">Esta página é restrita a administradores.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const manualSums = {
    spend: metaAdDaily.reduce((s, m) => s + (m.spend || 0), 0),
    impressions: metaAdDaily.reduce((s, m) => s + (m.impressions || 0), 0),
    reach: metaAdDaily.reduce((s, m) => s + (m.reach || 0), 0),
    clicks: metaAdDaily.reduce((s, m) => s + (m.clicks || 0), 0),
    link_clicks: metaAdDaily.reduce((s, m) => s + (m.link_clicks || 0), 0),
    conversations: metaAdDaily.reduce((s, m) => s + (m.wa_conversations_started_7d || 0), 0),
  };

  const aggregatedSums = metricsDaily.reduce((acc, m) => ({
    spend: acc.spend + (m.spend_sum || 0),
    impressions: acc.impressions + (m.impressions_sum || 0),
    reach: acc.reach + (m.reach_sum || 0),
    clicks: acc.clicks + (m.clicks_sum || 0),
    link_clicks: acc.link_clicks + (m.link_clicks_sum || 0),
    conversations: acc.conversations + (m.wa_conversations_started_7d_sum || 0),
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, link_clicks: 0, conversations: 0 });

  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));
  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getVariance = (manual, aggregated) => {
    if (manual === 0 && aggregated === 0) return 0;
    if (manual === 0) return 100;
    return Math.abs(((aggregated - manual) / manual) * 100);
  };

  const isMatch = (manual, aggregated) => {
    const variance = getVariance(manual, aggregated);
    return variance < 0.01; // < 0.01% de diferença
  };

  const metrics = [
    { label: 'Investimento', field: 'spend', format: 'currency' },
    { label: 'Impressões', field: 'impressions', format: 'number' },
    { label: 'Alcance', field: 'reach', format: 'number' },
    { label: 'Cliques', field: 'clicks', format: 'number' },
    { label: 'Cliques no Link', field: 'link_clicks', format: 'number' },
    { label: 'Conversas', field: 'conversations', format: 'number' },
  ];

  const handleRefresh = () => {
    refetchAds();
    refetchMetrics();
  };

  const handleReaggregate = async () => {
    if (!selectedDate) return;
    try {
      await base44.functions.invoke('aggregateMetaToMetricsDaily', {
        date_from: selectedDate,
        date_to: selectedDate,
      });
      refetchMetrics();
      alert('Reagregação concluída!');
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  };

  if (loadingAds || loadingMetrics) {
    return <div className="p-6 space-y-4"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Validação de Dados Meta</h1>
        <p className="text-gray-600 mt-1">Verificação de consistência entre MetaAdDaily e MetricsDaily</p>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium">Como funciona esta validação:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Soma manual: agregação direta dos registros MetaAdDaily do dia</li>
                <li>Soma agregada: valores salvos na entidade MetricsDaily</li>
                <li>Se os valores não batem, pode haver erro na agregação ou dados faltando</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Selecionar Data para Validação</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
              <Button variant="default" size="sm" onClick={handleReaggregate}>
                Reagregar Data
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecione uma data" />
            </SelectTrigger>
            <SelectContent>
              {availableDates.map(date => (
                <SelectItem key={date} value={date}>{date}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedDate && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Resumo da Validação - {selectedDate}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Registros MetaAdDaily</p>
                  <p className="text-2xl font-bold text-gray-900">{metaAdDaily.length}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Registros MetricsDaily</p>
                  <p className="text-2xl font-bold text-gray-900">{metricsDaily.length}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Métrica</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Soma Manual (MetaAdDaily)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Soma Agregada (MetricsDaily)</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Diferença (%)</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {metrics.map(metric => {
                      const manual = manualSums[metric.field];
                      const aggregated = aggregatedSums[metric.field];
                      const variance = getVariance(manual, aggregated);
                      const match = isMatch(manual, aggregated);
                      
                      return (
                        <tr key={metric.field} className={match ? 'bg-green-50' : 'bg-red-50'}>
                          <td className="px-4 py-3 font-medium text-gray-900">{metric.label}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-900">
                            {metric.format === 'currency' ? formatCurrency(manual) : formatNumber(manual)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-900">
                            {metric.format === 'currency' ? formatCurrency(aggregated) : formatNumber(aggregated)}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold">
                            {variance.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-center">
                            {match ? (
                              <Badge className="bg-green-100 text-green-700 gap-1">
                                <CheckCircle className="w-3 h-3" />
                                OK
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Divergência
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registros MetaAdDaily (Amostra - 20 primeiros)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Ad ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Ad Name</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Spend</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Impressions</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Reach</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Conversas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {metaAdDaily.slice(0, 20).map((ad, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-600 font-mono">{ad.ad_id}</td>
                        <td className="px-4 py-3 text-gray-900">{ad.ad_name}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(ad.spend)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(ad.impressions)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(ad.reach)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNumber(ad.wa_conversations_started_7d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}