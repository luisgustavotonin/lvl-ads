import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Play, BarChart3, Image } from 'lucide-react';

const DATE_MODES = [
  { value: 'TODAY', label: 'Hoje' },
  { value: 'YESTERDAY', label: 'Ontem' },
  { value: 'LAST_7D', label: 'Últimos 7 dias' },
  { value: 'LAST_14D', label: 'Últimos 14 dias' },
  { value: 'LAST_28D', label: 'Últimos 28 dias' },
  { value: 'LAST_30D', label: 'Últimos 30 dias' },
  { value: 'CUSTOM', label: 'Período personalizado' },
];

export default function UnifiedExecutionModal({ open, onClose, webhook, units, onExecute, isExecuting }) {
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);
  const [dateMode, setDateMode] = useState('YESTERDAY');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');

  const isInsights = !webhook?.webhook_type || webhook.webhook_type === 'insights';
  const associatedUnits = units.filter(u => (webhook?.unit_ids || []).includes(u.id));

  useEffect(() => {
    if (open) {
      setSelectedUnitIds(associatedUnits.map(u => u.id));
      setDateMode('YESTERDAY');
      setSince('');
      setUntil('');
    }
  }, [open, webhook?.id]);

  const toggle = (id) => {
    setSelectedUnitIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedUnitIds.length === associatedUnits.length) {
      setSelectedUnitIds([]);
    } else {
      setSelectedUnitIds(associatedUnits.map(u => u.id));
    }
  };

  const handleExecute = () => {
    onExecute({
      integration_id: webhook.id,
      selected_unit_ids: selectedUnitIds,
      ...(isInsights && {
        date_mode: dateMode,
        since: dateMode === 'CUSTOM' ? since : undefined,
        until: dateMode === 'CUSTOM' ? until : undefined,
      }),
    });
  };

  const canExecute =
    selectedUnitIds.length > 0 &&
    (!isInsights || !!dateMode) &&
    (dateMode !== 'CUSTOM' || (since && until));

  const title = webhook?.button_label || (isInsights ? 'Executar Insights' : 'Executar Criativos');
  const TypeIcon = isInsights ? BarChart3 : Image;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {webhook?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {isInsights && (
            <div className="space-y-3">
              <Label>Período de dados</Label>
              <Select value={dateMode} onValueChange={setDateMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_MODES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dateMode === 'CUSTOM' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">De</Label>
                    <Input type="date" value={since} onChange={e => setSince(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Até</Label>
                    <Input type="date" value={until} onChange={e => setUntil(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Unidades ({selectedUnitIds.length}/{associatedUnits.length})</Label>
              <button onClick={toggleAll} className="text-xs text-blue-600 hover:underline">
                {selectedUnitIds.length === associatedUnits.length ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {associatedUnits.map(unit => (
                <div
                  key={unit.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggle(unit.id)}
                >
                  <Checkbox
                    id={`exec-${unit.id}`}
                    checked={selectedUnitIds.includes(unit.id)}
                    onCheckedChange={() => toggle(unit.id)}
                    onClick={e => e.stopPropagation()}
                  />
                  <Label htmlFor={`exec-${unit.id}`} className="flex-1 cursor-pointer">
                    <p className="text-sm font-medium">{unit.name}</p>
                    <p className="text-xs text-gray-400">{unit.account_id || 'Sem account ID'}</p>
                  </Label>
                </div>
              ))}

              {associatedUnits.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">
                  Nenhuma unidade associada a este webhook.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleExecute}
            disabled={!canExecute || isExecuting}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Play className="w-4 h-4" />
            {isExecuting ? 'Executando...' : 'Executar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}