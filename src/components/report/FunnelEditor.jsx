import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Settings2, GripVertical, X, Save } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const STAGE_COLORS = [
  '#3B82F6', '#EF4444', '#F97316', '#FBBF24', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1', '#6B7280'
];

// Cores organizadas por grupo primário com variações decrescentes de intensidade
const COLOR_GROUPS = [
  // Azul
  ['#0C2340', '#0F3460', '#1E3A8A', '#1E40AF', '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA'],
  // Vermelho
  ['#5F1313', '#7F1D1D', '#991B1B', '#B91C1C', '#DC2626', '#EF4444', '#F87171', '#FCA5A5'],
  // Laranja
  ['#5C2410', '#7C2D12', '#9A3412', '#C2410C', '#EA580C', '#F97316', '#FB923C', '#FDBA74'],
  // Amarelo
  ['#66530B', '#78350F', '#92400E', '#B45309', '#FBBF24', '#FCD34D', '#FDE047', '#FFFACD'],
  // Verde
  ['#022C22', '#064E3B', '#047857', '#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0'],
  // Teal
  ['#0F2F3F', '#164E63', '#0D9488', '#14B8A6', '#2DD4BF', '#5EEAD4', '#99F6E4', '#CCFBF1'],
  // Cyan
  ['#06202A', '#024E51', '#0891B2', '#06B6D4', '#22D3EE', '#67E8F9', '#A5F3FC', '#CFFAFE'],
  // Azul Céu
  ['#0C1E3C', '#0D47A1', '#1565C0', '#1976D2', '#1E88E5', '#2196F3', '#42A5F5', '#64B5F6'],
  // Roxo
  ['#2E0854', '#4C1D95', '#6D28D9', '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE'],
  // Magenta
  ['#3E1F47', '#5A189A', '#7209B7', '#B5179E', '#EC4899', '#F472B6', '#F8B4D6', '#FBE7F3'],
  // Rosa
  ['#4A0E4E', '#831843', '#BE185D', '#DB2777', '#EC4899', '#F472B6', '#F8B4D6', '#FCE7F3'],
  // Violeta
  ['#3C096C', '#5A189A', '#7209B7', '#9D4EDD', '#C77DFF', '#E0AAFF', '#F0E6FF', '#FAF0FF'],
  // Âmbar
  ['#5D3A1A', '#78350F', '#92400E', '#B45309', '#D97706', '#F59E0B', '#FBBF24', '#FCD34D'],
  // Marrom
  ['#3E2723', '#5D4037', '#795548', '#8D6E63', '#A1887F', '#BCB8B1', '#D7CCCC', '#EFEBE9'],
  // Cinza
  ['#0F172A', '#1E293B', '#334155', '#475569', '#64748B', '#94A3B8', '#CBD5E1', '#E2E8F0'],
];

const AVAILABLE_METRICS = [
  { key: 'spend', label: 'Investimento' },
  { key: 'impressions', label: 'Impressões' },
  { key: 'reach', label: 'Alcance' },
  { key: 'clicks', label: 'Cliques' },
  { key: 'linkClicks', label: 'Cliques no Link' },
  { key: 'conversations', label: 'Conversas Iniciadas' },
  { key: 'totalContact', label: 'Contatos por Mensagem' },
  { key: 'firstReply', label: 'Primeira Resposta' },
];

export default function FunnelEditor({ unitId, currentStages, onSave }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('editor');
  const [stages, setStages] = useState(
    (currentStages || []).map((s, i) => ({ ...s, color: s.color || STAGE_COLORS[i % STAGE_COLORS.length] }))
  );

  // Sincroniza stages internos quando o dialog abre (pega as cores salvas)
  useEffect(() => {
    if (open) {
      setStages(
        (currentStages || []).map((s, i) => ({ ...s, color: s.color || STAGE_COLORS[i % STAGE_COLORS.length] }))
      );
      setTab('editor');
    }
  }, [open]);
  const [newMetric, setNewMetric] = useState('');
  const [openColorPicker, setOpenColorPicker] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const queryClient = useQueryClient();

  // Templates são globais (sem filtro por unit_id)
  const { data: templates = [] } = useQuery({
    queryKey: ['funnelTemplates'],
    queryFn: () => base44.entities.FunnelTemplate.list(),
  });

  const saveFunnelMutation = useMutation({
    mutationFn: async (funnelConfig) => {
      const existing = await base44.entities.Unit.filter({ id: unitId });
      if (existing.length > 0) {
        return base44.entities.Unit.update(unitId, {
          settings: {
            ...existing[0].settings,
            funnel_stages: funnelConfig
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['unitFunnelConfig', unitId] });
      toast.success('Funil atualizado');
      onSave(stages);
      setOpen(false);
    }
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!templateName) {
        toast.error('Digite um nome para o template');
        return;
      }
      // Templates globais: unit_id = 'global'
      return base44.entities.FunnelTemplate.create({
        name: templateName,
        unit_id: 'global',
        stages
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnelTemplates'] });
      toast.success('Template salvo');
      setTemplateName('');
    }
  });

  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      const template = templates.find(t => t.id === templateId);
      if (!template) return;
      // Aplica e salva imediatamente na unidade
      const existing = await base44.entities.Unit.filter({ id: unitId });
      if (existing.length > 0) {
        await base44.entities.Unit.update(unitId, {
          settings: { ...existing[0].settings, funnel_stages: template.stages }
        });
      }
      return template.stages;
    },
    onSuccess: (appliedStages) => {
      if (!appliedStages) return;
      setStages(appliedStages);
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['unitFunnelConfig', unitId] });
      onSave(appliedStages);
      toast.success('Template aplicado e salvo');
      setOpen(false);
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId) => base44.entities.FunnelTemplate.delete(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnelTemplates'] });
      toast.success('Template deletado');
    }
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(stages);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setStages(items);
  };

  const addStage = () => {
    if (!newMetric) return;
    const metric = AVAILABLE_METRICS.find(m => m.key === newMetric);
    if (metric && !stages.find(s => s.key === metric.key)) {
      const color = STAGE_COLORS[stages.length % STAGE_COLORS.length];
      setStages([...stages, { ...metric, color }]);
      setNewMetric('');
    }
  };

  const setStageColor = (key, color) => {
    setStages(prev => prev.map(s => s.key === key ? { ...s, color } : s));
    setOpenColorPicker(null);
  };

  const removeStage = (key) => {
    setStages(stages.filter(s => s.key !== key));
  };

  const handleSave = () => {
    saveFunnelMutation.mutate(stages);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="w-4 h-4 mr-2" />
          Editar Funil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Personalizar Funil de Conversão</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setTab('editor')}
            className={`px-4 py-2 text-sm font-medium ${tab === 'editor' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          >
            Editor
          </button>
          <button
            onClick={() => setTab('templates')}
            className={`px-4 py-2 text-sm font-medium ${tab === 'templates' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          >
            Templates ({templates.length})
          </button>
        </div>

        {/* Tab: Editor */}
        {tab === 'editor' && (
        <div className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Select value={newMetric} onValueChange={setNewMetric}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Adicionar etapa" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_METRICS.filter(m => !stages.find(s => s.key === m.key)).map(metric => (
                  <SelectItem key={metric.key} value={metric.key}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addStage}>Adicionar</Button>
          </div>

          <div className="border rounded-lg p-3">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="funnel-stages">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 min-h-[40px]">
                    {stages.map((stage, index) => (
                      <Draggable key={stage.key} draggableId={stage.key} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.85 : 1,
                            }}
                            className="flex items-center gap-2 bg-white border border-gray-200 p-2 rounded shadow-sm"
                          >
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4 text-gray-400" />
                            </div>

                            {/* Cor inline */}
                             <div className="flex-shrink-0">
                               <button
                                 onClick={() => setOpenColorPicker(openColorPicker === stage.key ? null : stage.key)}
                                 className="w-5 h-5 rounded border border-gray-300 flex-shrink-0 block"
                                 style={{ backgroundColor: stage.color || '#3B82F6' }}
                                 title="Editar cor"
                               />
                             </div>

                             {openColorPicker === stage.key && (
                               <div className="absolute left-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-80 max-h-[50vh] overflow-y-auto"
                                 onClick={e => e.stopPropagation()}
                               >
                                 <div className="space-y-2">
                                   {COLOR_GROUPS.map((group, idx) => (
                                     <div key={idx}>
                                       <div className="grid grid-cols-8 gap-1.5">
                                         {group.map(c => (
                                           <button
                                             key={c}
                                             onClick={() => setStageColor(stage.key, c)}
                                             className="w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform flex-shrink-0"
                                             style={{ backgroundColor: c, borderColor: stage.color === c ? '#000' : '#D1D5DB' }}
                                             title={c}
                                           />
                                         ))}
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}

                            <span className="flex-1 text-sm">{stage.label}</span>
                            <button
                              onClick={() => removeStage(stage.key)}
                              className="text-gray-400 hover:text-red-600"
                            >
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

          <div className="flex gap-2">
           <Button onClick={handleSave} className="flex-1">
             Salvar na Unidade
           </Button>
           <Button
             variant="outline"
             onClick={() => setTab('templates')}
             className="flex-1"
           >
             Salvar como Template
           </Button>
          </div>
          </div>
          )}

          {/* Tab: Templates */}
          {tab === 'templates' && (
          <div className="space-y-4 mt-4">
          <div>
           <label className="text-sm font-medium block mb-2">Novo Template</label>
           <div className="flex gap-2">
             <Input
               placeholder="Nome do template (ex: Modelo 1)"
               value={templateName}
               onChange={(e) => setTemplateName(e.target.value)}
             />
             <Button
               onClick={() => saveTemplateMutation.mutate()}
               disabled={saveTemplateMutation.isPending}
               className="gap-2"
             >
               <Save className="w-4 h-4" />
               Salvar
             </Button>
           </div>
          </div>

          <div className="border-t pt-4">
           <h3 className="text-sm font-medium mb-3">Templates Existentes</h3>
           {templates.length === 0 ? (
             <p className="text-sm text-gray-500">Nenhum template criado</p>
           ) : (
             <div className="space-y-2 max-h-64 overflow-y-auto">
               {templates.map(template => (
                 <div
                   key={template.id}
                   className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                 >
                   <div className="flex-1">
                     <p className="font-medium text-sm">{template.name}</p>
                     <div className="flex items-center gap-1 mt-1">
                       {template.stages.map((s, i) => (
                         <span key={i} className="w-3 h-3 rounded-full inline-block border border-white shadow-sm" style={{ backgroundColor: s.color || '#3B82F6' }} title={s.label} />
                       ))}
                       <span className="text-xs text-gray-400 ml-1">{template.stages.length} etapas</span>
                     </div>
                   </div>
                   <div className="flex gap-2">
                     <Button
                       size="sm"
                       variant="outline"
                       onClick={() => applyTemplateMutation.mutate(template.id)}
                     >
                       Aplicar
                     </Button>
                     <Button
                       size="sm"
                       variant="ghost"
                       onClick={() => deleteTemplateMutation.mutate(template.id)}
                       className="text-red-600 hover:text-red-700"
                     >
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
          </DialogContent>
          </Dialog>
          );
          }