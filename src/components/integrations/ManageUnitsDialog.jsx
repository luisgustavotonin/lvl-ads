import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

export default function ManageUnitsDialog({ open, onClose, webhook, units, onSave, isSaving }) {
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (open && webhook) {
      setSelectedIds(webhook.unit_ids || []);
    }
  }, [webhook, open]);

  const toggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const activeIds = activeUnits.map(u => u.id);
    if (selectedIds.length === activeIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(activeIds);
    }
  };

  const activeUnits = units.filter(u => u.status === 'active' || !u.status);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Unidades — {webhook?.name}
          </DialogTitle>
          <DialogDescription>
            Selecione as unidades que farão parte deste webhook. As credenciais (account ID e token) vêm do cadastro de cada unidade.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">{selectedIds.length} de {activeUnits.length} selecionada(s)</span>
            <button onClick={toggleAll} className="text-xs text-blue-600 hover:underline">
              {selectedIds.length === activeUnits.length ? 'Desmarcar todas' : 'Selecionar todas'}
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {activeUnits.map(unit => {
              const hasAccount = !!unit.account_id;
              const hasToken = !!unit.secret_token;
              return (
                <div
                  key={unit.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggle(unit.id)}
                >
                  <Checkbox
                    id={`unit-${unit.id}`}
                    checked={selectedIds.includes(unit.id)}
                    onCheckedChange={() => toggle(unit.id)}
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <Label htmlFor={`unit-${unit.id}`} className="font-medium text-sm cursor-pointer">
                      {unit.name}
                    </Label>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <Badge variant={hasAccount ? 'outline' : 'secondary'} className="text-xs">
                        {hasAccount ? unit.account_id : '⚠ Sem account ID'}
                      </Badge>
                      <Badge variant={hasToken ? 'outline' : 'secondary'} className="text-xs">
                        {hasToken ? '🔑 Token configurado' : '⚠ Sem token'}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}

            {activeUnits.length === 0 && (
              <p className="text-center text-gray-500 py-6 text-sm">
                Nenhuma unidade ativa cadastrada
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(selectedIds)} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}