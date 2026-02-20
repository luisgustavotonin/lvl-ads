import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, Edit2 } from 'lucide-react';
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
  const costMetrics = ['cpcLink', 'cpm', 'costPerConversation', 'costPerTotalContact', 'costPerFirstReply', 'frequency'];
  const isBetterLower = costMetrics.includes(kpiKey);

  // Cor da variação: verde = bom, vermelho = ruim
  let varColor = 'text-gray-400';
  if (hasPrevious && variation !== 0) {
    const isGood = (isPositive && !isBetterLower) || (isNegative && isBetterLower);
    varColor = isGood ? 'text-green-500' : 'text-red-500';
  }

  // Borda do card baseada em threshold
  const borderClass = thresholdStatus === 'green'
    ? 'border-l-4 border-l-green-400'
    : thresholdStatus === 'yellow'
    ? 'border-l-4 border-l-yellow-400'
    : thresholdStatus === 'red'
    ? 'border-l-4 border-l-red-400'
    : '';

  return (
    <Card className={`bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${borderClass}`}>
      <CardContent className="p-3 sm:p-4">
        {/* Label row */}
        <div className="flex items-start justify-between mb-1">
          <div className="text-xs text-gray-400 font-medium leading-tight pr-1 uppercase tracking-wide">
            {customLabel}
          </div>
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

        {/* Current value */}
        <div className="text-xl sm:text-2xl font-bold text-gray-900 leading-none mb-1">
          {formatValue(currentValue)}
        </div>

        {/* Variation row — idêntico ao Reportei */}
        {hasPrevious && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${varColor}`}>
            {isPositive
              ? <ArrowUpRight className="w-3.5 h-3.5" />
              : isNegative
              ? <ArrowDownRight className="w-3.5 h-3.5" />
              : null
            }
            <span>{isPositive ? '+' : ''}{variation.toFixed(2)}%</span>
          </div>
        )}

        {/* Previous period value */}
        {hasPrevious && (
          <div className="text-xs text-gray-400 mt-0.5">
            {formatValue(previousValue)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}