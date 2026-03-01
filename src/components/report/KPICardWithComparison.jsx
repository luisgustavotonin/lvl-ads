import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function KPICardWithComparison({ 
  kpiKey, 
  label, 
  currentValue, 
  previousValue, 
  formatValue,
  unitId,
  isAdmin,
  thresholdStatus,
  isPDF = false
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [customLabel, setCustomLabel] = React.useState(label);
  const queryClient = useQueryClient();

  const updateLabelMutation = useMutation({
    mutationFn: async (newLabel) => {
      const existing = await base44.entities.CardLabel.filter({ unit_id: unitId, card_key: kpiKey });
      if (existing.length > 0) {
        return base44.entities.CardLabel.update(existing[0].id, { custom_label: newLabel });
      } else {
        return base44.entities.CardLabel.create({ 
          unit_id: unitId, 
          card_key: kpiKey, 
          custom_label: newLabel,
          default_label: label 
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardLabels'] });
      toast.success('Nome atualizado');
      setIsEditing(false);
    }
  });

  const variation = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
  const isPositive = variation > 0;
  const isNegative = variation < 0;

  // Determinar se maior é melhor ou menor é melhor
  const volumeMetrics = ['spend', 'impressions', 'reach', 'clicks', 'linkClicks', 'conversations'];
  const costMetrics = ['cpcLink', 'cpm', 'costPerConversation', 'costPerTotalContact', 'costPerFirstReply'];
  
  const isBetterHigher = volumeMetrics.includes(kpiKey) || kpiKey.includes('ctr') || kpiKey.includes('link');
  const isBetterLower = costMetrics.includes(kpiKey) || kpiKey.includes('cost') || kpiKey.includes('cpc') || kpiKey.includes('cpm');

  let indicatorColor = 'text-green-600';
  if (isPositive && isBetterHigher) indicatorColor = 'text-green-600';
  if (isPositive && isBetterLower) indicatorColor = 'text-red-600';
  if (isNegative && isBetterHigher) indicatorColor = 'text-red-600';
  if (isNegative && isBetterLower) indicatorColor = 'text-green-600';
  if (!isPositive && !isNegative) indicatorColor = 'text-gray-400';

  let valueColor = 'text-gray-900';
  let bgColor = 'bg-white';
  let borderColor = 'border-gray-200';

  if (thresholdStatus === 'green') {
    bgColor = 'bg-green-50';
    borderColor = 'border-green-400';
    valueColor = 'text-green-700';
  } else if (thresholdStatus === 'yellow') {
    bgColor = 'bg-yellow-50';
    borderColor = 'border-yellow-400';
    valueColor = 'text-yellow-700';
  } else if (thresholdStatus === 'red') {
    bgColor = 'bg-red-50';
    borderColor = 'border-red-400';
    valueColor = 'text-red-700';
  }

  // No PDF: sem borda colorida, fundo neutro
  const cardClass = isPDF
    ? 'bg-gray-50 border-0 shadow-none kpi-pdf-card'
    : `${bgColor} border ${borderColor} shadow-sm hover:shadow-md transition-shadow`;

  return (
    <Card className={cardClass}>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between mb-1 sm:mb-2">
          <div className="text-xs sm:text-sm text-gray-600 font-medium leading-tight">{customLabel}</div>
          {isAdmin && (
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild>
                <button className="text-gray-400 hover:text-gray-600 ml-1 flex-shrink-0">
                  <Edit2 className="w-3 h-3" />
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar nome do card</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <Input
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Nome do indicador"
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => updateLabelMutation.mutate(customLabel)}>
                      Salvar
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        <div className="flex items-center gap-2 mb-1 sm:mb-2">
          <span className={`text-xl sm:text-3xl font-bold ${valueColor}`}>
            {formatValue(currentValue)}
          </span>
          {thresholdStatus === 'green' && <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Bom ✓</span>}
          {thresholdStatus === 'yellow' && <span className="text-xs font-semibold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Atenção ⚠</span>}
          {thresholdStatus === 'red' && <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Ruim ✗</span>}
        </div>
        
        {previousValue > 0 && (
          <div className={`flex items-center gap-1 text-xs sm:text-sm font-medium ${indicatorColor}`}>
            {isPositive ? (
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
            ) : isNegative ? (
              <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
            ) : null}
            <span>
              {isPositive ? '+' : ''}{variation.toFixed(2)}%
            </span>
          </div>
        )}
        
        {previousValue > 0 && (
          <div className="text-xs text-gray-500 mt-0.5 sm:mt-1 hidden sm:block">
            {formatValue(previousValue)} no período anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}