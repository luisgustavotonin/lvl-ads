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
  thresholdStatus 
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

  const hasPrevious = previousValue !== null && previousValue !== undefined && previousValue > 0;
  const variation = hasPrevious ? ((currentValue - previousValue) / previousValue) * 100 : 0;
  const isPositive = variation > 0;
  const isNegative = variation < 0;

  // Determinar se maior é melhor ou menor é melhor
  const volumeMetrics = ['spend', 'impressions', 'reach', 'clicks', 'linkClicks', 'conversations', 'totalContact', 'firstReply'];
  const costMetrics = ['cpcLink', 'cpm', 'costPerConversation', 'costPerTotalContact', 'costPerFirstReply', 'frequency'];
  
  const isBetterHigher = volumeMetrics.includes(kpiKey) || kpiKey === 'ctrLink';
  const isBetterLower = costMetrics.includes(kpiKey);

  // Badge color: green = good, red = bad
  let badgeBg = 'bg-gray-100 text-gray-500';
  if (hasPrevious && variation !== 0) {
    const isGood = (isPositive && isBetterHigher) || (isNegative && isBetterLower);
    const isBad = (isNegative && isBetterHigher) || (isPositive && isBetterLower);
    if (isGood) badgeBg = 'bg-green-100 text-green-700';
    else if (isBad) badgeBg = 'bg-red-100 text-red-700';
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4">
        {/* Label */}
        <div className="flex items-start justify-between mb-2">
          <div className="text-xs sm:text-sm text-gray-500 font-medium leading-tight pr-1">{customLabel}</div>
          {isAdmin && (
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild>
                <button className="text-gray-300 hover:text-gray-500 flex-shrink-0">
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
                    <Button onClick={() => updateLabelMutation.mutate(customLabel)}>Salvar</Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Current value + variation badge inline */}
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <div className="text-xl sm:text-2xl font-bold text-gray-900">
            {formatValue(currentValue)}
          </div>
          {hasPrevious && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${badgeBg}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
              {isPositive ? '+' : ''}{variation.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Previous value */}
        {hasPrevious && (
          <div className="text-xs text-gray-400">
            {formatValue(previousValue)} no período anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}