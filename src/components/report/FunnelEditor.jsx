import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Settings2, GripVertical, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  const [stages, setStages] = useState(currentStages || []);
  const [newMetric, setNewMetric] = useState('');
  const queryClient = useQueryClient();

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
      toast.success('Funil atualizado');
      onSave(stages);
      setOpen(false);
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
      setStages([...stages, metric]);
      setNewMetric('');
    }
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
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {stages.map((stage, index) => (
                      <Draggable key={stage.key} draggableId={stage.key} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="flex items-center gap-2 bg-gray-50 p-2 rounded"
                          >
                            <div {...provided.dragHandleProps}>
                              <GripVertical className="w-4 h-4 text-gray-400" />
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