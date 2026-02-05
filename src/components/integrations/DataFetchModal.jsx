import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar, Download } from 'lucide-react';

const META_METRICS = [
  { id: 'spend', name: 'Investimento (Spend)', default: true },
  { id: 'impressions', name: 'Impressões', default: true },
  { id: 'reach', name: 'Alcance', default: true },
  { id: 'clicks', name: 'Cliques', default: true },
  { id: 'ctr', name: 'CTR', default: true },
  { id: 'cpc', name: 'CPC', default: true },
  { id: 'cpm', name: 'CPM', default: true },
  { id: 'actions', name: 'Ações/Conversões', default: false },
  { id: 'action_values', name: 'Valor de Conversões', default: false },
  { id: 'cost_per_action_type', name: 'Custo por Ação', default: false },
  { id: 'frequency', name: 'Frequência', default: false },
  { id: 'video_views', name: 'Views de Vídeo', default: false },
];

const BREAKDOWNS = [
  { id: 'none', name: 'Apenas Total' },
  { id: 'campaign', name: 'Por Campanha' },
  { id: 'adset', name: 'Por Conjunto de Anúncios' },
  { id: 'ad', name: 'Por Anúncio' },
];

export default function DataFetchModal({ open, onClose, integration, onFetch }) {
  const [period, setPeriod] = useState('last_7_days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState(
    META_METRICS.filter(m => m.default).map(m => m.id)
  );
  const [breakdown, setBreakdown] = useState('none');
  const [isLoading, setIsLoading] = useState(false);

  const handleMetricToggle = (metricId) => {
    setSelectedMetrics(prev => 
      prev.includes(metricId)
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    );
  };

  const handleFetch = async () => {
    setIsLoading(true);
    try {
      const params = {
        integration_id: integration.id,
        period: period,
        metrics: selectedMetrics,
        breakdown: breakdown !== 'none' ? breakdown : undefined,
      };

      // Se o período for customizado, adicionar datas
      if (period === 'custom' && startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
        delete params.period;
      }

      await onFetch(params);
      onClose();
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar Dados de Anúncios</DialogTitle>
          <DialogDescription>
            Configure o período e as métricas que deseja importar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Período */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Período
            </Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="yesterday">Ontem</SelectItem>
                <SelectItem value="last_7_days">Últimos 7 dias</SelectItem>
                <SelectItem value="last_14_days">Últimos 14 dias</SelectItem>
                <SelectItem value="last_30_days">Últimos 30 dias</SelectItem>
                <SelectItem value="this_month">Este mês</SelectItem>
                <SelectItem value="last_month">Mês passado</SelectItem>
                <SelectItem value="custom">Período Customizado</SelectItem>
              </SelectContent>
            </Select>

            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="start_date" className="text-sm">Data Inicial</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date" className="text-sm">Data Final</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Breakdown */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Nível de Detalhamento</Label>
            <Select value={breakdown} onValueChange={setBreakdown}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BREAKDOWNS.map((bd) => (
                  <SelectItem key={bd.id} value={bd.id}>
                    {bd.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Escolha se deseja os dados totais ou divididos por campanha/conjunto/anúncio
            </p>
          </div>

          {/* Métricas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Métricas a Importar</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (selectedMetrics.length === META_METRICS.length) {
                    setSelectedMetrics(META_METRICS.filter(m => m.default).map(m => m.id));
                  } else {
                    setSelectedMetrics(META_METRICS.map(m => m.id));
                  }
                }}
                className="text-xs"
              >
                {selectedMetrics.length === META_METRICS.length ? 'Apenas Principais' : 'Selecionar Todas'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              {META_METRICS.map((metric) => (
                <div key={metric.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={metric.id}
                    checked={selectedMetrics.includes(metric.id)}
                    onCheckedChange={() => handleMetricToggle(metric.id)}
                  />
                  <label
                    htmlFor={metric.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {metric.name}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Selecione as métricas que deseja importar. Quanto mais métricas, mais tempo levará.
            </p>
          </div>

          {/* Informação */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ Sobre a importação:</strong> Os dados serão salvos na entidade MetricsDaily 
              e/ou MetricsEntity dependendo do nível de detalhamento escolhido. 
              Dados já existentes para o mesmo período serão atualizados.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleFetch}
            disabled={isLoading || selectedMetrics.length === 0 || (period === 'custom' && (!startDate || !endDate))}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Download className="w-4 h-4" />
            {isLoading ? 'Buscando...' : 'Buscar Dados'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}