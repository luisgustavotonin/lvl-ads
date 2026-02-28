import React, { useState } from 'react';
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
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#6366F1'
];

const COLOR_OPTIONS = [
  '#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#06B6D4',
  '#EF4444','#6366F1','#EAB308','#84CC16','#14B8A6','#D946EF',
  '#F97316','#1D4ED8','#7C3AED','#059669','#D97706','#6B7280',
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
  const [tab, setTab] = useState('editor'); // 'editor' ou 'templates'
  const [stages, setStages] = useState(() =>
    (currentStages || []).map((s, i) => ({ ...s, color: s.color || STAGE_COLORS[i % STAGE_COLORS.length] }))
  );
  const [newMetric, setNewMetric] = useState('');
  const [openColorPicker, setOpenColorPicker] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['funnelTemplates', unitId],
    queryFn: () => base44.entities.FunnelTemplate.filter({ unit_id: unitId }),
    enabled: !!unitId,
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
      return base44.entities.FunnelTemplate.create({
        name: templateName,
        unit_id: unitId,
        stages
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnelTemplates', unitId] });
      toast.success('Template salvo');
      setTemplateName('');
    }
  });

  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setStages(template.stages);
        setSelectedTemplateId(templateId);
      }
    },
    onSuccess: () => {
      toast.success('Template aplicado');
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId) => base44.entities.FunnelTemplate.delete(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnelTemplates', unitId] });
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar Funil de Conversão</DialogTitle>
        </DialogHeader>
        
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
                            <div className="relative flex-shrink-0">
                              <button
                                onClick={() => setOpenColorPicker(openColorPicker === stage.key ? null : stage.key)}
                                className="w-5 h-5 rounded border border-gray-300 flex-shrink-0 block"
                                style={{ backgroundColor: stage.color || '#3B82F6' }}
                                title="Editar cor"
                              />
                              {openColorPicker === stage.key && (
                                <div
                                  className="absolute left-0 top-7 z-[9999] bg-white border border-gray-200 rounded-lg shadow-2xl p-3"
                                  style={{ minWidth: 160 }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <div className="grid grid-cols-6 gap-2">
                                    {COLOR_OPTIONS.map(c => (
                                      <button
                                        key={c}
                                        onClick={() => setStageColor(stage.key, c)}
                                        className="w-6 h-6 rounded-full border-2 hover:scale-125 transition-transform flex-shrink-0"
                                        style={{ backgroundColor: c, borderColor: stage.color === c ? '#111' : 'transparent' }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

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

          <Button onClick={handleSave} className="w-full">
            Salvar Configuração
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}