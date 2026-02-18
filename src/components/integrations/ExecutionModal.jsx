import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Play, Building2 } from 'lucide-react';
import { format } from 'date-fns';

const DATE_MODES = [
  { value: 'TODAY', label: 'Hoje' },
  { value: 'TODAY_AND_YESTERDAY', label: 'Hoje e Ontem' },
  { value: 'YESTERDAY', label: 'Ontem' },
  { value: 'LAST_7D', label: 'Últimos 7 dias' },
  { value: 'LAST_14D', label: 'Últimos 14 dias' },
  { value: 'LAST_28D', label: 'Últimos 28 dias' },
  { value: 'LAST_30D', label: 'Últimos 30 dias' },
  { value: 'CUSTOM', label: 'Período personalizado' }
];

export default function ExecutionModal({ open, onClose, integration, onExecute }) {
  const [dateMode, setDateMode] = useState('TODAY_AND_YESTERDAY');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState([]);

  const { data: allUnits = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  // Só mostrar unidades associadas ao webhook
  const webhookUnitIds = integration?.unit_ids || (integration?.unit_id ? [integration.unit_id] : []);
  const units = allUnits.filter(u => webhookUnitIds.includes(u.id));

  const handleToggleUnit = (unitId) => {
    setSelectedUnits(prev =>
      prev.includes(unitId)
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  const handleToggleAll = () => {
    if (selectedUnits.length === units.length) {
      setSelectedUnits([]);
    } else {
      setSelectedUnits(units.map(u => u.id));
    }
  };

  const handleExecute = async () => {
    setIsLoading(true);
    try {
      // Determinar run_type baseado na seleção
      let run_type;
      let unit_ids_to_send;
      
      if (selectedUnits.length === units.length) {
        run_type = 'all';
        unit_ids_to_send = undefined;
      } else if (selectedUnits.length === 1) {
        run_type = 'single';
        unit_ids_to_send = selectedUnits;
      } else {
        run_type = 'selected';
        unit_ids_to_send = selectedUnits;
      }

      await onExecute({
        integration_id: integration.id,
        date_mode: dateMode,
        since: dateMode === 'CUSTOM' ? since : null,
        until: dateMode === 'CUSTOM' ? until : null,
        execution_type: integration?.executionType || 'insights',
        mode: 'manual',
        run_type: run_type,
        unit_ids: unit_ids_to_send
      });
      onClose();
      setSelectedUnits([]);
    } catch (error) {
      console.error('Erro ao executar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = (dateMode !== 'CUSTOM' || (since && until)) && selectedUnits.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-blue-600" />
            Executar {integration?.executionType === 'creatives' ? 'Criativos' : 'Insights'}
          </DialogTitle>
          <DialogDescription>
            Configure o período de dados para buscar de {integration?.account_name || 'integração'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date_mode">Período</Label>
            <Select value={dateMode} onValueChange={setDateMode}>
              <SelectTrigger id="date_mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_MODES.map(mode => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {dateMode === 'CUSTOM' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="since">Data Inicial</Label>
                <Input
                  id="since"
                  type="date"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                  max={until || format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="until">Data Final</Label>
                <Input
                  id="until"
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  min={since}
                  max={format(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })), 'yyyy-MM-dd')}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Unidades</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleAll}
                className="h-8 text-xs"
              >
                {selectedUnits.length === units.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
              </Button>
            </div>
            <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
              {units.map(unit => (
                <div key={unit.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                  <Checkbox
                    id={`unit-${unit.id}`}
                    checked={selectedUnits.includes(unit.id)}
                    onCheckedChange={() => handleToggleUnit(unit.id)}
                  />
                  <label
                    htmlFor={`unit-${unit.id}`}
                    className="flex-1 text-sm cursor-pointer flex items-center gap-2"
                  >
                    <Building2 className="w-4 h-4 text-gray-400" />
                    {unit.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              <Calendar className="w-3 h-3 inline mr-1" />
              {selectedUnits.length === units.length 
                ? 'Modo: all - Todas as unidades'
                : selectedUnits.length === 1
                ? 'Modo: single - 1 unidade'
                : `Modo: selected - ${selectedUnits.length} unidades`}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleExecute} 
            disabled={!isValid || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Executando...' : 'Executar Agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}