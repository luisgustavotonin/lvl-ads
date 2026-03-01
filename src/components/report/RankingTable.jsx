import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const STATUS_COLORS = {
  'ACTIVE': 'bg-green-100 text-green-700',
  'PAUSED': 'bg-gray-100 text-gray-700',
  'DISAPPROVED': 'bg-red-100 text-red-700',
  'ARCHIVED': 'bg-gray-100 text-gray-500'
};

const ALL_COLUMNS = [
{ key: 'name', label: 'Nome', format: (v) => v, sortable: true },
{ key: 'status', label: 'Status', format: (v) => v, sortable: true },
{ key: 'spend', label: 'Investimento', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), sortable: true },
{ key: 'impressions', label: 'Impressões', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), sortable: true },
{ key: 'reach', label: 'Alcance', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), sortable: true },
{ key: 'link_clicks', label: 'Cliques Link', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), sortable: true },
{ key: 'ctr_link', label: 'CTR Link', format: (v) => `${v.toFixed(2)}%`, sortable: true },
{ key: 'cpc_link', label: 'CPC Link', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), sortable: true },
{ key: 'cpm', label: 'CPM', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), sortable: true },
{ key: 'conversations', label: 'Conversas', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), sortable: true },
{ key: 'cost_per_conversation', label: 'Custo/Conversa', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v), sortable: true }];


export default function RankingTable({
  title,
  data,
  groupKey,
  nameKey,
  showThumbnail = false,
  unitId,
  isPDF = false
}) {
  const [limit, setLimit] = useState(isPDF ? '5' : '10');
  const [statusFilter, setStatusFilter] = useState('all');
  const [columnOrder, setColumnOrder] = useState(ALL_COLUMNS.map((c) => c.key));
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS.map((c) => c.key));
  const [sortConfig, setSortConfig] = useState({ key: 'conversations', direction: 'desc' });
  const [colWidths, setColWidths] = useState({});
  const configLoadedRef = useRef(false);
  const resizingRef = useRef(null);

  const startResize = useCallback((e, colKey) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = resizingRef.current?.startWidth || (colWidths[colKey] || 150);
    resizingRef.current = { colKey, startX, startWidth };

    const onMouseMove = (moveEvt) => {
      const diff = moveEvt.clientX - startX;
      const newWidth = Math.max(60, startWidth + diff);
      setColWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  // Carregar configurações salvas
  const { data: config } = useQuery({
    queryKey: ['rankingTableConfig', unitId, groupKey],
    queryFn: () => {
      if (!unitId) return null;
      return base44.entities.ReportPreference.filter({ unit_id: unitId }).then(d => d[0]);
    },
    enabled: !!unitId
  });

  // Carregar configurações salvas (apenas uma vez por unitId/groupKey)
  useEffect(() => {
    configLoadedRef.current = false;
  }, [unitId, groupKey]);

  useEffect(() => {
    if (config?.ranking_table_configs?.[groupKey] && !configLoadedRef.current) {
      configLoadedRef.current = true;
      const saved = config.ranking_table_configs[groupKey];
      if (saved.columnOrder) setColumnOrder(saved.columnOrder);
      if (saved.visibleColumns) setVisibleColumns(saved.visibleColumns);
      if (saved.limit) setLimit(saved.limit);
    }
  }, [config, groupKey]);

  // Salvar configurações quando mudam (só após o carregamento inicial)
  useEffect(() => {
    if (!unitId || !configLoadedRef.current) return;
    const saveConfig = async () => {
      try {
        const existing = await base44.entities.ReportPreference.filter({ unit_id: unitId }).then(d => d[0]);
        const newConfig = {
          ...existing?.ranking_table_configs,
          [groupKey]: { columnOrder, visibleColumns, limit }
        };
        if (existing) {
          await base44.entities.ReportPreference.update(existing.id, { ranking_table_configs: newConfig });
        } else {
          await base44.entities.ReportPreference.create({ unit_id: unitId, ranking_table_configs: newConfig });
        }
      } catch (err) {
        console.error('Erro ao salvar config de ranking table:', err);
      }
    };
    const timeoutId = setTimeout(saveConfig, 800);
    return () => clearTimeout(timeoutId);
  }, [columnOrder, visibleColumns, limit, unitId, groupKey]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(columnOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setColumnOrder(items);
  };

  const orderedColumns = columnOrder.
  map((key) => ALL_COLUMNS.find((c) => c.key === key)).
  filter((c) => c && visibleColumns.includes(c.key));

  const aggregated = useMemo(() => {
    const groups = {};

    data.forEach((item) => {
      const key = item[groupKey];
      if (!key) return;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          name: item[nameKey] || key,
          status: item.ad_effective_status || 'UNKNOWN',
          thumbnail: item.creative_thumbnail_url || null,
          spend: 0,
          impressions: 0,
          reach: 0,
          link_clicks: 0,
          clicks: 0,
          conversations: 0,
          ctr_link_sum: 0,
          cpc_link_sum: 0,
          cpm_sum: 0,
          cost_per_conversation_sum: 0,
          count: 0
        };
      }

      groups[key].spend += item.spend || 0;
       groups[key].impressions += item.impressions || 0;
       groups[key].reach += item.reach || 0;
       groups[key].link_clicks += item.link_clicks || 0;
       groups[key].clicks += item.clicks || 0;
       groups[key].conversations += item.messaging_conversations_started || 0;
       groups[key].ctr_link_sum += item.ctr_link || 0;
       groups[key].cpc_link_sum += item.cpc_link || 0;
       groups[key].cpm_sum += item.cpm || 0;
       groups[key].cost_per_conversation_sum += item.cost_per_conversation || 0;
       groups[key].count += 1;
    });

    Object.values(groups).forEach((g) => {
      g.ctr_link = g.count > 0 ? g.ctr_link_sum / g.count : 0;
      g.cpc_link = g.count > 0 ? g.cpc_link_sum / g.count : 0;
      g.cpm = g.count > 0 ? g.cpm_sum / g.count : 0;
      g.cost_per_conversation = g.count > 0 ? g.cost_per_conversation_sum / g.count : 0;
    });

    let filtered = Object.values(groups);

    if (statusFilter !== 'all') {
      filtered = filtered.filter((g) => g.status === statusFilter);
    }

    filtered.sort((a, b) => {
      const aVal = a[sortConfig.key] || 0;
      const bVal = b[sortConfig.key] || 0;
      return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return filtered.slice(0, parseInt(limit));
  }, [data, groupKey, nameKey, limit, statusFilter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const uniqueStatuses = [...new Set(data.map((d) => d.ad_effective_status).filter(Boolean))];

  // Colunas de métricas para exibir nos cards mobile (excluindo name e status)
  const metricColumns = orderedColumns.filter((c) => c.key !== 'name' && c.key !== 'status');

  return (
    <div data-pdf-element={isPDF ? '' : undefined}>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
            {!isPDF && <div className="flex flex-wrap gap-2">
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="w-24 sm:w-32 h-8 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Top 5</SelectItem>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="15">Top 15</SelectItem>
                <SelectItem value="30">Top 30</SelectItem>
                <SelectItem value="50">Top 50</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 sm:w-40 h-8 text-xs sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueStatuses.map((s) =>
                <SelectItem key={s} value={s}>{s}</SelectItem>
                )}
              </SelectContent>
            </Select>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm">
                  <Settings2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Colunas</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Selecionar Colunas</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="columns">
                      {(provided) =>
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                          {columnOrder.map((key, index) => {
                          const col = ALL_COLUMNS.find((c) => c.key === key);
                          if (!col) return null;
                          return (
                            <Draggable key={col.key} draggableId={col.key} index={index}>
                                {(provided, snapshot) =>
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-2 p-2 rounded-md border ${
                                snapshot.isDragging ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`
                                }>

                                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                      <GripVertical className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <Checkbox
                                  checked={visibleColumns.includes(col.key)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setVisibleColumns([...visibleColumns, col.key]);
                                    } else {
                                      setVisibleColumns(visibleColumns.filter((k) => k !== col.key));
                                    }
                                  }} />

                                    <label className="text-sm flex-1">{col.label}</label>
                                  </div>
                              }
                              </Draggable>);

                        })}
                          {provided.placeholder}
                        </div>
                      }
                    </Droppable>
                  </DragDropContext>
                </div>
              </SheetContent>
            </Sheet>
            </div>}
            </div>
            </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {/* Mobile: card list */}
        <div className="sm:hidden divide-y divide-gray-100">
          {aggregated.map((item, idx) =>
          <div key={item.id} className="p-4">
              <div className="flex items-start gap-3 mb-3">
                {showThumbnail && (
                item.thumbnail ?
                <img src={item.thumbnail} alt="Criativo" className="w-16 h-16 object-cover rounded flex-shrink-0 border border-gray-200" /> :

                <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs flex-shrink-0">N/D</div>)

                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm leading-tight line-clamp-2">{item.name}</p>
                    <Badge className={`${STATUS_COLORS[item.status] || 'bg-gray-100'} flex-shrink-0 text-xs`}>
                      {item.status}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {metricColumns.slice(0, 6).map((col) =>
              <div key={col.key} className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500 mb-0.5">{col.label}</p>
                    <p className="text-sm font-semibold text-gray-800">{col.format(item[col.key])}</p>
                  </div>
              )}
              </div>
            </div>
          )}
          {aggregated.length === 0 &&
          <p className="text-center text-gray-500 text-sm py-8">Nenhum dado disponível</p>
          }
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="text-sm" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr className="border-b">
                {showThumbnail && <th className="text-left py-3 px-2 font-medium text-gray-700" style={{ width: 96, minWidth: 96 }}>Criativo</th>}
                {orderedColumns.map((col) => {
                  const w = colWidths[col.key] || (col.key === 'name' ? 200 : 120);
                  return (
                    <th
                      key={col.key}
                      className={`text-left py-3 px-2 font-medium text-gray-700 relative select-none ${col.sortable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                      style={{ width: w, minWidth: 60 }}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1 overflow-hidden">
                        <span className="truncate">{col.label}</span>
                        {col.sortable && sortConfig.key === col.key && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronUp className="w-4 h-4 flex-shrink-0" />
                        )}
                      </div>
                      {/* Resize handle */}
                      <div
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => { e.stopPropagation(); startResize(e, col.key); }}
                        onClick={e => e.stopPropagation()}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {aggregated.map((item, idx) =>
              <tr key={item.id} className="border-b hover:bg-gray-50">
                  {showThumbnail &&
                  <td className="py-3 px-2">
                      {item.thumbnail ?
                  <img src={item.thumbnail} alt="Criativo" className="w-20 h-20 object-cover rounded border border-gray-200" /> :

                  <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">N/D</div>
                  }
                    </td>
                  }
                  {orderedColumns.map((col) =>
                <td
                  key={col.key}
                  className={`py-3 px-2 ${isPDF ? '' : 'overflow-hidden'}`}
                  style={isPDF ? { wordBreak: 'break-word', whiteSpace: 'normal' } : { maxWidth: colWidths[col.key] || (col.key === 'name' ? 200 : 120) }}
                >
                      {col.key === 'name' ?
                  <span className={`font-medium text-gray-900 block ${isPDF ? 'whitespace-normal break-words' : 'truncate'}`}>{item.name}</span> :
                  col.key === 'status' ?
                  <Badge className="bg-slate-600 text-primary-foreground px-2.5 py-0.5 text-xs font-semibold rounded-md inline-flex items-center border-transparent shadow">
                          {item.status}
                        </Badge> :

                  <span className={`text-gray-700 block ${isPDF ? 'whitespace-normal break-words' : 'truncate'}`}>{col.format(item[col.key])}</span>
                  }
                    </td>
                )}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </CardContent>
        </Card>
        </div>);

        }