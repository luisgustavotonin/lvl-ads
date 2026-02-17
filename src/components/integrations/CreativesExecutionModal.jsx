import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Image } from 'lucide-react';

export default function CreativesExecutionModal({ open, onClose, integration, onExecute }) {
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const handleToggleUnit = (unitId) => {
    setSelectedUnits(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  const handleSelectAll = () => {
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
        unit_ids_to_send = undefined; // Não enviar unit_ids quando for "all"
      } else if (selectedUnits.length === 1) {
        run_type = 'single';
        unit_ids_to_send = selectedUnits;
      } else {
        run_type = 'selected';
        unit_ids_to_send = selectedUnits;
      }

      await onExecute({
        integration_id: integration.id,
        execution_type: 'creatives',
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

  const isValid = selectedUnits.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="w-5 h-5 text-purple-600" />
            Executar Criativos
          </DialogTitle>
          <DialogDescription>
            Buscar criativos de campanhas ativas das unidades selecionadas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Unidades</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSelectAll}
                className="h-8 text-xs"
              >
                {selectedUnits.length === units.length ? 'Desmarcar todas' : 'Selecionar todas'}
              </Button>
            </div>

            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {units.map((unit) => (
                <div 
                  key={unit.id} 
                  className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-gray-50"
                >
                  <Checkbox
                    id={unit.id}
                    checked={selectedUnits.includes(unit.id)}
                    onCheckedChange={() => handleToggleUnit(unit.id)}
                  />
                  <label 
                    htmlFor={unit.id}
                    className="flex-1 cursor-pointer"
                  >
                    <p className="font-medium text-sm">{unit.name}</p>
                    {unit.account_id && (
                      <p className="text-xs text-gray-500">{unit.account_id}</p>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-xs text-purple-800">
              <Image className="w-3 h-3 inline mr-1" />
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
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? 'Executando...' : 'Executar Agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}