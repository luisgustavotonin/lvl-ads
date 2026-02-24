import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import toast from 'react-hot-toast';

const ALL_TABLES = [
  { id: 'base',        label: 'Insights (Puro)',     hasDate: true },
  { id: 'platform',    label: 'Por Plataforma',      hasDate: true },
  { id: 'device',      label: 'Por Device',          hasDate: true },
  { id: 'demographic', label: 'Por Demográfico',     hasDate: true },
  { id: 'creatives',   label: 'Criativos',           hasDate: false },
  { id: 'jobs',        label: 'Jobs (Ingestão)',     hasDate: true },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default function BulkDeleteModal({ unitId, dateFrom, dateTo, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(ALL_TABLES.map(t => t.id));
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState({ table: '', batch: 0, total: 0, done: [], tableTotal: 0 });

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelected(selected.length === ALL_TABLES.length ? [] : ALL_TABLES.map(t => t.id));
  };

  // Deletes all records for one table by calling the function in a loop until hasMore = false
  const deleteTable = async (tableId) => {
    let batchCount = 0;
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      batchCount++;
      setStatus(s => ({ ...s, table: tableId, batch: batchCount }));

      let res;
      try {
        const response = await base44.functions.invoke('bulkDeleteByUnit', {
          unit_id: unitId,
          date_from: dateFrom || null,
          date_to: dateTo || null,
          table: tableId,
        });
        res = response.data;
      } catch (e) {
        console.error(`Batch ${batchCount} error for ${tableId}:`, e.message);
        await sleep(2000);
        // Try one more time then give up
        try {
          const response = await base44.functions.invoke('bulkDeleteByUnit', {
            unit_id: unitId,
            date_from: dateFrom || null,
            date_to: dateTo || null,
            table: tableId,
          });
          res = response.data;
        } catch (_) {
          break;
        }
      }

      totalDeleted += res?.deleted || 0;
      hasMore = res?.hasMore === true;

      setStatus(s => ({ ...s, total: s.total + (res?.deleted || 0) }));

      if (hasMore) {
        await sleep(500); // brief pause between batches
      }
    }

    return totalDeleted;
  };

  const handleDelete = async () => {
    if (!unitId || selected.length === 0) return;

    setRunning(true);
    setStatus({ table: '', batch: 0, total: 0, done: [] });

    let grandTotal = 0;

    for (const tableId of selected) {
      const count = await deleteTable(tableId);
      grandTotal += count;
      setStatus(s => ({ ...s, done: [...s.done, tableId], total: grandTotal }));
      await sleep(1000); // pause between tables
    }

    setRunning(false);
    toast.success(`✅ ${grandTotal} registros excluídos!`, { duration: 5000 });
    setOpen(false);
    onSuccess?.();
  };

  const tableName = (id) => ALL_TABLES.find(t => t.id === id)?.label || id;

  const pctDone = running && selected.length > 0
    ? Math.round((status.done.length / selected.length) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!running) setOpen(v); }}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="gap-2" disabled={!unitId}>
          <Trash2 className="w-4 h-4" />
          Excluir Dados
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Excluir Dados por Tabela
          </DialogTitle>
          <DialogDescription>
            Selecione quais tabelas deseja excluir
            {dateFrom || dateTo ? ` no período ${dateFrom || '...'} → ${dateTo || '...'}` : ''}.
          </DialogDescription>
        </DialogHeader>

        {!running ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                id="select-all"
                checked={selected.length === ALL_TABLES.length}
                onCheckedChange={toggleAll}
              />
              <Label htmlFor="select-all" className="font-semibold cursor-pointer">Selecionar todas</Label>
            </div>
            {ALL_TABLES.map(tab => (
              <div key={tab.id} className="flex items-center gap-2">
                <Checkbox
                  id={tab.id}
                  checked={selected.includes(tab.id)}
                  onCheckedChange={() => toggle(tab.id)}
                />
                <Label htmlFor={tab.id} className="cursor-pointer">{tab.label}</Label>
                {!tab.hasDate && <span className="text-xs text-gray-400">(ignora filtro de data)</span>}
              </div>
            ))}
            <p className="text-red-600 font-semibold text-sm pt-2">⚠️ Esta ação não pode ser desfeita!</p>
          </div>
        ) : (
          <div className="py-6 space-y-4">
            <div className="flex justify-center">
              <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-gray-800">Excluindo dados...</p>
              {status.table && (
                <p className="text-sm text-gray-500">
                  Tabela atual: <strong>{tableName(status.table)}</strong>
                  {status.batch > 1 ? ` (lote ${status.batch})` : ''}
                </p>
              )}
              <p className="text-sm text-gray-500">{status.total} registros excluídos até agora</p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Progresso geral</span>
                <span>{status.done.length} de {selected.length} tabelas ({pctDone}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${pctDone}%` }}
                />
              </div>
            </div>
            {status.done.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {status.done.map(id => (
                  <span key={id} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    ✓ {tableName(id)}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 text-center">Por favor, não feche esta janela.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>Cancelar</Button>
          {!running && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={selected.length === 0}
            >
              Confirmar ({selected.length} tabelas)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}