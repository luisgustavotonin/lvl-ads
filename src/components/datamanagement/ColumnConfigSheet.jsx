import React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings2, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function ColumnConfigSheet({ columnOrder, visibleColumns, campaignColumns, onDragEnd, onToggle }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          Configurar Colunas
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Configurar Colunas</SheetTitle>
          <SheetDescription>Arraste para reordenar. Marque/desmarque para mostrar ou ocultar.</SheetDescription>
        </SheetHeader>

        {/* Colunas fixas */}
        <div className="mt-4 space-y-1">
          {['Record ID', 'Job ID', 'Timestamp'].map(label => (
            <div key={label} className="flex items-center gap-2 px-2 py-2 bg-gray-50 rounded text-sm text-gray-500">
              <GripVertical className="w-4 h-4 opacity-30" />
              <Checkbox checked disabled />
              <span>{label} (fixo)</span>
            </div>
          ))}
        </div>

        {/* Colunas reordenáveis */}
        <div className="flex-1 overflow-y-auto mt-2 pr-1">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="columns">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-1"
                >
                  {columnOrder.map((key, index) => {
                    const col = campaignColumns.find(c => c.key === key);
                    if (!col) return null;
                    const isVisible = visibleColumns[key] !== false;

                    return (
                      <Draggable key={key} draggableId={key} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-2 px-2 py-2 rounded border transition-colors ${
                              snapshot.isDragging
                                ? 'bg-blue-50 border-blue-300 shadow-lg'
                                : 'bg-white border-transparent hover:bg-gray-50'
                            }`}
                          >
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4 text-gray-400" />
                            </div>
                            <Checkbox
                              id={`col-${key}`}
                              checked={isVisible}
                              onCheckedChange={() => onToggle(key)}
                            />
                            <label
                              htmlFor={`col-${key}`}
                              className="text-sm cursor-pointer flex-1 select-none"
                            >
                              {col.label}
                            </label>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </SheetContent>
    </Sheet>
  );
}