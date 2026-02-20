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

const SUB_TABS = [
  { id: 'insights', label: 'Insights', entity: 'MetaAdInsights', hasDate: true },
  { id: 'platform', label: 'Por Plataforma', entity: 'MetaAdByPlatform', hasDate: true },
  { id: 'device', label: 'Por Device', entity: 'MetaAdByDevice', hasDate: true },
  { id: 'demographic', label: 'Por Demográfico', entity: 'MetaAdByDemographic', hasDate: true },
  { id: 'creatives_basic', label: 'Creatives Basic', entity: 'MetaAdsDim', hasDate: false },
];

export default function BulkDeleteModal({ unitId, dateFrom, dateTo, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(['insights', 'platform', 'device', 'demographic', 'creatives_basic']);
  const [loading, setLoading] = useState(false);

  const toggle = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selected.length === SUB_TABS.length) setSelected([]);
    else setSelected(SUB_TABS.map(t => t.id));
  };

  const deleteTabRecords = async (tab) => {
    const filters = { unit_id: unitId };
    if (tab.hasDate && dateFrom) filters.date = { $gte: dateFrom };
    if (tab.hasDate && dateTo) filters.date = { ...(filters.date || {}), $lte: dateTo };

    // Buscar IDs em lotes e deletar em paralelo
    const records = await base44.entities[tab.entity].filter(filters, '-created_date', 10000);
    if (records.length === 0) return 0;

    // Deletar em lotes paralelos de 20
    const BATCH = 20;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      await Promise.all(batch.map(r => base44.entities[tab.entity].delete(r.id)));
    }
    return records.length;
  };

  const handleDelete = async () => {
    if (!unitId || selected.length === 0) return;
    setLoading(true);

    try {
      // Deletar todas as tabelas selecionadas em paralelo
      const results = await Promise.all(
        selected.map(tabId => {
          const tab = SUB_TABS.find(t => t.id === tabId);
          return tab ? deleteTabRecords(tab) : Promise.resolve(0);
        })
      );
      const totalDeleted = results.reduce((s, n) => s + n, 0);

      toast.success(`✅ ${totalDeleted} registros excluídos!`, { duration: 4000 });
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Selecione quais tabelas deseja excluir{dateFrom || dateTo ? ` no período ${dateFrom || '...'} → ${dateTo || '...'}` : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Checkbox
              id="select-all"
              checked={selected.length === SUB_TABS.length}
              onCheckedChange={toggleAll}
            />
            <Label htmlFor="select-all" className="font-semibold cursor-pointer">Selecionar todas</Label>
          </div>
          {SUB_TABS.map(tab => (
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
        </div>

        <p className="text-red-600 font-semibold text-sm">⚠️ Esta ação não pode ser desfeita!</p>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || selected.length === 0}
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</> : `Confirmar (${selected.length} tabelas)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}