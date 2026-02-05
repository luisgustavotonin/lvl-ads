import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Database, Trash2, AlertTriangle, Calendar, Search, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PLATFORMS = [
  { id: 'all', name: 'Todas as plataformas' },
  { id: 'META', name: 'Meta Ads', icon: '📘' },
  { id: 'GOOGLE_ADS', name: 'Google Ads', icon: '🔍' },
  { id: 'TIKTOK_ADS', name: 'TikTok Ads', icon: '🎵' },
  { id: 'YOUTUBE', name: 'YouTube', icon: '▶️' },
];

export default function DataManagement() {
  const queryClient = useQueryClient();
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [selectedWebhooks, setSelectedWebhooks] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState([]);

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: allMetrics = [], refetch: refetchMetrics } = useQuery({
    queryKey: ['allMetrics'],
    queryFn: () => base44.entities.MetricsDaily.list('-created_date', 100),
  });

  const { data: webhookLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['webhookLogs'],
    queryFn: () => base44.entities.WebhookLog.list('-created_date', 20),
  });

  const { data: allCampaigns = [] } = useQuery({
    queryKey: ['allCampaigns'],
    queryFn: () => base44.entities.MetricsEntity.filter({ entity_level: 'campaign' }, '-created_date', 50),
  });

  const deleteWebhooksMutation = useMutation({
    mutationFn: async (webhookIds) => {
      for (const id of webhookIds) {
        await base44.entities.WebhookLog.delete(id);
      }
      return webhookIds.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhookLogs'] });
      setSelectedWebhooks([]);
    },
  });

  const deleteMetricsMutation = useMutation({
    mutationFn: async (metricIds) => {
      for (const id of metricIds) {
        await base44.entities.MetricsDaily.delete(id);
      }
      return metricIds.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allMetrics'] });
      setSelectedMetrics([]);
    },
  });

  const deleteCampaignsMutation = useMutation({
    mutationFn: async (campaignIds) => {
      for (const id of campaignIds) {
        await base44.entities.MetricsEntity.delete(id);
      }
      return campaignIds.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allCampaigns'] });
      setSelectedCampaigns([]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Get metrics to delete based on filters
      const metricsToDelete = allMetrics.filter(m => {
        const matchUnit = selectedUnit === 'all' || m.unit_id === selectedUnit;
        const matchPlatform = selectedPlatform === 'all' || m.platform_id === selectedPlatform;
        const metricDate = new Date(m.date);
        const matchDate = metricDate >= dateRange.from && metricDate <= dateRange.to;
        return matchUnit && matchPlatform && matchDate;
      });

      // Delete in batches
      for (const metric of metricsToDelete) {
        await base44.entities.MetricsDaily.delete(metric.id);
      }

      return metricsToDelete.length;
    },
    onSuccess: (deletedCount) => {
      queryClient.invalidateQueries({ queryKey: ['allMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['metricsDaily'] });
      setConfirmDelete(false);
      setSearchResults({ ...searchResults, deleted: deletedCount });
    },
  });

  const handleSearch = () => {
    setIsSearching(true);
    
    const filtered = allMetrics.filter(m => {
      const matchUnit = selectedUnit === 'all' || m.unit_id === selectedUnit;
      const matchPlatform = selectedPlatform === 'all' || m.platform_id === selectedPlatform;
      const metricDate = new Date(m.date);
      const matchDate = metricDate >= dateRange.from && metricDate <= dateRange.to;
      return matchUnit && matchPlatform && matchDate;
    });

    const totalSpend = filtered.reduce((sum, m) => sum + (m.spend || 0), 0);
    
    setTimeout(() => {
      setSearchResults({
        count: filtered.length,
        totalSpend,
        deleted: null,
      });
      setIsSearching(false);
    }, 500);
  };

  const getUnitName = (unitId) => {
    if (unitId === 'all') return 'Todas as unidades';
    return units.find(u => u.id === unitId)?.name || 'Unidade';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value || 0);
  };

  if (unitsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestão de Dados</h1>
        <p className="text-gray-500 mt-1">Gerencie e limpe os dados do sistema</p>
      </div>

      {/* Warning Card */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900">Atenção</h3>
              <p className="text-sm text-amber-700">
                A exclusão de dados é permanente e não pode ser desfeita. 
                Certifique-se de ter backups antes de realizar qualquer limpeza.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-gray-100">
        <CardHeader>
          <CardTitle className="text-lg">Filtros de Busca</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Unit */}
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Platform */}
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      <div className="flex items-center gap-2">
                        {platform.icon && <span>{platform.icon}</span>}
                        {platform.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Período</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <Calendar className="w-4 h-4 mr-2" />
                    {dateRange?.from && dateRange?.to ? (
                      `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
                    ) : (
                      'Selecionar período'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange(range);
                      } else if (range?.from) {
                        setDateRange({ from: range.from, to: range.from });
                      }
                    }}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              className="gap-2"
              onClick={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Buscar Registros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searchResults && (
        <Card className="border-gray-100">
          <CardHeader>
            <CardTitle className="text-lg">Resultado da Busca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Registros Encontrados</p>
                <p className="text-3xl font-bold text-gray-900">{searchResults.count}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Investimento Total</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(searchResults.totalSpend)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Período</p>
                <p className="text-lg font-medium text-gray-900">
                  {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                </p>
              </div>
            </div>

            {searchResults.deleted !== null ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700">
                  ✓ {searchResults.deleted} registros foram excluídos com sucesso.
                </p>
              </div>
            ) : searchResults.count > 0 ? (
              <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                <div>
                  <p className="font-medium text-red-900">Excluir {searchResults.count} registros?</p>
                  <p className="text-sm text-red-700">Esta ação é irreversível.</p>
                </div>
                <Button 
                  variant="destructive"
                  className="gap-2"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Registros
                </Button>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-500">
                Nenhum registro encontrado com os filtros selecionados.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Atualizar Dados */}
      <div className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          onClick={() => {
            refetchMetrics();
            refetchLogs();
          }}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar Dados
        </Button>
      </div>

      {/* Webhook Logs */}
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              📡 Webhooks Recebidos (Últimos 20)
            </CardTitle>
            {selectedWebhooks.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{selectedWebhooks.length} selecionado(s)</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Excluir ${selectedWebhooks.length} webhook(s)?`)) {
                      deleteWebhooksMutation.mutate(selectedWebhooks);
                    }
                  }}
                  disabled={deleteWebhooksMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Excluir Selecionados
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={webhookLogs.length > 0 && selectedWebhooks.length === webhookLogs.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedWebhooks(webhookLogs.map(w => w.id));
                          } else {
                            setSelectedWebhooks([]);
                          }
                        }}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Data/Hora</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Integration ID</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Processados</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Payload</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Erro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {webhookLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-3 py-8 text-center text-gray-500">
                        Nenhum webhook recebido ainda. Envie dados do N8n.
                      </td>
                    </tr>
                  ) : (
                    webhookLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedWebhooks.includes(log.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedWebhooks([...selectedWebhooks, log.id]);
                              } else {
                                setSelectedWebhooks(selectedWebhooks.filter(id => id !== log.id));
                              }
                            }}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-900">
                          {format(new Date(log.created_date), 'dd/MM/yyyy HH:mm:ss')}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={
                            log.status === 'success' ? 'bg-green-100 text-green-700' :
                            log.status === 'error' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }>
                            {log.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 font-mono">
                          {log.integration_id?.substring(0, 8)}...
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {log.records_processed ? (
                            <div className="text-gray-600">
                              {log.records_processed.days || 0}d / {log.records_processed.metrics || 0}m / {log.records_processed.entities || 0}e
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <details className="text-xs">
                            <summary className="cursor-pointer text-blue-600 hover:text-blue-700">Ver JSON</summary>
                            <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto max-h-40">
                              {JSON.stringify(log.payload_received, null, 2)}
                            </pre>
                            {log.payload_received?.data?.[0]?.date && (
                              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                <p className="text-yellow-800 font-medium">⚠️ Data no payload:</p>
                                <p className="text-yellow-700">{log.payload_received.data[0].date}</p>
                                <p className="text-xs text-yellow-600 mt-1">
                                  Se essa data está errada (ex: 2026 ao invés de 2024), corrija no N8n!
                                </p>
                              </div>
                            )}
                          </details>
                        </td>
                        <td className="px-3 py-2 text-xs text-red-600">
                          {log.error_message || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex items-start gap-2 mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
            <div className="text-xs text-yellow-800">
              <p className="font-medium">⚠️ Problema de Data Detectado!</p>
              <p className="mt-1">Os dados estão sendo salvos com datas erradas (ex: 2026-01-06 ao invés de 2024-02-05).</p>
              <p className="mt-1 font-medium">Solução: Verifique no N8n o campo "date" que está sendo enviado. Ele deve ser a data REAL da métrica (formato: YYYY-MM-DD).</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug - Dados Recebidos */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            🐛 Debug - Dados Recebidos (Últimos 50)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Data</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Unidade</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Plataforma</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Investimento</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Impressões</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Cliques</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Conversões</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Criado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allMetrics.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-3 py-8 text-center text-gray-500">
                        Nenhum dado encontrado na base. Envie dados do N8n para popular.
                      </td>
                    </tr>
                  ) : (
                    allMetrics
                      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                      .slice(0, 50)
                      .map((metric) => (
                        <tr key={metric.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-900 font-medium">
                            {format(new Date(metric.date), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {getUnitName(metric.unit_id)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge className="text-xs">
                              {PLATFORMS.find(p => p.id === metric.platform_id)?.icon || ''} {metric.platform_id}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900 font-medium">
                            {formatCurrency(metric.spend)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {(metric.impressions || 0).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {(metric.clicks || 0).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {(metric.conversions || 0).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-3 py-2 text-center text-xs text-gray-500">
                            {format(new Date(metric.created_date), 'dd/MM HH:mm')}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Mostrando os 50 registros mais recentes ordenados por data de criação. Total: {allMetrics.length}
          </p>
        </CardContent>
      </Card>

      {/* Debug - Campanhas */}
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              🎯 Debug - Campanhas Recebidas (Últimas 50)
            </CardTitle>
            {selectedCampaigns.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{selectedCampaigns.length} selecionado(s)</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Excluir ${selectedCampaigns.length} campanha(s)?`)) {
                      deleteCampaignsMutation.mutate(selectedCampaigns);
                    }
                  }}
                  disabled={deleteCampaignsMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Excluir Selecionados
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={allCampaigns.length > 0 && selectedCampaigns.length === allCampaigns.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCampaigns(allCampaigns.map(c => c.id));
                          } else {
                            setSelectedCampaigns([]);
                          }
                        }}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Data</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Campanha ID</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Nome</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Plataforma</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Investimento</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Impressões</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Criado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-3 py-8 text-center text-gray-500">
                        Nenhuma campanha encontrada. Envie dados com campaign_data do N8n.
                      </td>
                    </tr>
                  ) : (
                    allCampaigns.map((campaign) => (
                      <tr key={campaign.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedCampaigns.includes(campaign.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCampaigns([...selectedCampaigns, campaign.id]);
                              } else {
                                setSelectedCampaigns(selectedCampaigns.filter(id => id !== campaign.id));
                              }
                            }}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-900 font-medium">
                          {format(new Date(campaign.date), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 font-mono">
                          {campaign.entity_id}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {campaign.entity_name}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className="text-xs">
                            {PLATFORMS.find(p => p.id === campaign.platform_id)?.icon || ''} {campaign.platform_id}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 font-medium">
                          {formatCurrency(campaign.spend)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {(campaign.impressions || 0).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-gray-500">
                          {format(new Date(campaign.created_date), 'dd/MM HH:mm')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Campanhas extraídas do campaign_data do N8n. Total: {allCampaigns.length}
          </p>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <Card className="border-gray-100">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-400" />
            Visão Geral do Banco de Dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600">Total de Métricas</p>
              <p className="text-2xl font-bold text-blue-900">{allMetrics.length}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600">Unidades</p>
              <p className="text-2xl font-bold text-green-900">{units.length}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600">Plataformas</p>
              <p className="text-2xl font-bold text-purple-900">
                {new Set(allMetrics.map(m => m.platform_id)).size}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-600">Investimento Total</p>
              <p className="text-2xl font-bold text-orange-900">
                {formatCurrency(allMetrics.reduce((sum, m) => sum + (m.spend || 0), 0))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Você está prestes a excluir permanentemente:</p>
              <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                <li><strong>{searchResults?.count}</strong> registros de métricas</li>
                <li>Unidade: <strong>{getUnitName(selectedUnit)}</strong></li>
                <li>Plataforma: <strong>{PLATFORMS.find(p => p.id === selectedPlatform)?.name}</strong></li>
                <li>Período: <strong>{format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}</strong></li>
              </ul>
              <p className="mt-4 font-medium text-red-600">Esta ação não pode ser desfeita!</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}