import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, X, Save, Settings2, LayoutTemplate } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function KPICustomizer({ allKpis, selectedKPIs, onChange, unitId }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('editor');
  const [templateName, setTemplateName] = useState('');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['kpiTemplates'],
    queryFn: () => base44.entities.KpiTemplate.list(),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!templateName) {
        toast.error('Digite um nome para o template');
        return;
      }
      return base44.entities.KpiTemplate.create({
        name: templateName,
        unit_id: 'global',
        selected_kpis: selectedKPIs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpiTemplates'] });
      toast.success('Template salvo');
      setTemplateName('');
    },
  });

  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      const template = templates.find((t) => t.id === templateId);
      if (!template) return;
      return template.selected_kpis || [];
    },
    onSuccess: (applied) => {
      if (!applied) return;
      onChange(applied);
      toast.success('Template aplicado');
      setOpen(false);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => base44.entities.KpiTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpiTemplates'] });
      toast.success('Template deletado');
    },
  });

  // KPIs disponíveis (não selecionados), agrupados por categoria
  const selectedSet = new Set(selectedKPIs);
  const available = allKpis.filter((k) => !selectedSet.has(k.id));
  const availableGrouped = available.reduce((acc, k) => {
    (acc[k.category] = acc[k.category] || []).push(k);
    return acc;
  }, {});

  // KPIs selecionados na ordem correta
  const selectedList = selectedKPIs
    .map((id) => allKpis.find((k) => k.id === id))
    .filter(Boolean);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(selectedKPIs);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    onChange(items);
  };

  const addKpi = (id) => {
    if (id && !selectedKPIs.includes(id)) onChange([...selectedKPIs, id]);
  };

  const removeKpi = (id) => {
    onChange(selectedKPIs.filter((k) => k !== id));
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings2 className="w-4 h-4" />
          KPIs
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Personalizar KPIs</SheetTitle>
          <SheetDescription>Escolha os indicadores e salve como template para reutilizar</SheetDescription>
        </SheetHeader>

        <div className="flex gap-2 border-b mt-2">
          <button
            onClick={() => setTab('editor')}
            className={`px-4 py-2 text-sm font-medium ${tab === 'editor' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          >
            KPIs
          </button>
          <button
            onClick={() => setTab('templates')}
            className={`px-4 py-2 text-sm font-medium ${tab === 'templates' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          >
            <LayoutTemplate className="w-4 h-4 inline mr-1" />
            Templates ({templates.length})
          </button>
        </div>

        {tab === 'editor' && (
          <div className="mt-4 space-y-5">
            {/* Selecionados (reordenável) */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Ativos ({selectedList.length})
              </h4>
              {selectedList.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum KPI ativo. Adicione abaixo.</p>
              ) : (
                <div className="border rounded-lg p-2 max-h-56 overflow-y-auto">
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="kpi-selected">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1.5">
                          {selectedList.map((kpi, index) => (
                            <Draggable key={kpi.id} draggableId={kpi.id} index={index}>
                              {(p) => (
                                <div
                                  ref={p.innerRef}
                                  {...p.draggableProps}
                                  className="flex items-center gap-2 bg-white border border-gray-200 p-2 rounded shadow-sm"
                                >
                                  <span {...p.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-4 h-4 text-gray-400" />
                                  </span>
                                  <span className="flex-1 text-sm">{kpi.label}</span>
                                  <button onClick={() => removeKpi(kpi.id)} className="text-gray-400 hover:text-red-600">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              )}
            </div>

            {/* Adicionar */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Adicionar KPI <span className="text-xs font-normal text-gray-400">({available.length} disponíveis)</span>
              </h4>
              <Input
                placeholder="Buscar indicador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
              {available.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">
                  {search ? 'Nenhum KPI encontrado para a busca.' : 'Todos os KPIs já estão ativos.'}
                </p>
              ) : (
                <div className="border rounded-lg max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {Object.entries(availableGrouped)
                    .filter(([cat, kpis]) =>
                      !search ||
                      cat.toLowerCase().includes(search.toLowerCase()) ||
                      kpis.some((k) => k.label.toLowerCase().includes(search.toLowerCase()))
                    )
                    .map(([cat, kpis]) => {
                      const filtered = !search
                        ? kpis
                        : kpis.filter((k) => k.label.toLowerCase().includes(search.toLowerCase()));
                      if (!filtered.length) return null;
                      return (
                        <div key={cat}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase sticky top-0 bg-white">
                            {cat}
                          </div>
                          {filtered.map((k) => (
                            <button
                              key={k.id}
                              onClick={() => addKpi(k.id)}
                              className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                              <span className="flex-1">{k.label}</span>
                              <span className="text-xs text-blue-500 font-medium">+ Adicionar</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-1.5">
                KPIs dinâmicos são descobertos automaticamente a partir dos dados da Meta.
              </p>
            </div>
          </div>
        )}

        {tab === 'templates' && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">Salvar KPIs atuais como template</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome (ex: Modelo WhatsApp)"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
                <Button onClick={() => saveTemplateMutation.mutate()} disabled={saveTemplateMutation.isPending} className="gap-2">
                  <Save className="w-4 h-4" />
                  Salvar
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">Templates existentes</h3>
              {templates.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum template criado</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{t.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{(t.selected_kpis || []).length} KPIs</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => applyTemplateMutation.mutate(t.id)}>
                          Aplicar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteTemplateMutation.mutate(t.id)} className="text-red-600 hover:text-red-700">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}