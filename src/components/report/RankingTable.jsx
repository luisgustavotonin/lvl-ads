import React, { useState, useMemo } from 'react';
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
  'ARCHIVED': 'bg-gray-100 text-gray-500',
};

const ALL_COLUMNS = [
  { key: 'name', label: 'Nome', format: (v) => v },
  { key: 'status', label: 'Status', format: (v) => v },
  { key: 'spend', label: 'Investimento', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) },
  { key: 'impressions', label: 'Impressões', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
  { key: 'reach', label: 'Alcance', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
  { key: 'link_clicks', label: 'Cliques Link', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
  { key: 'ctr_link', label: 'CTR Link', format: (v) => `${v.toFixed(2)}%` },
  { key: 'cpc_link', label: 'CPC Link', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) },
  { key: 'cpm', label: 'CPM', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) },
  { key: 'conversations', label: 'Conversas', format: (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)) },
  { key: 'cost_per_conversation', label: 'Custo/Conversa', format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) },
];

export default function RankingTable({ 
  title, 
  data, 
  groupKey,
  nameKey,
  showThumbnail = false 
}) {
  const [limit, setLimit] = useState('10');
  const [statusFilter, setStatusFilter] = useState('all');
  const [columnOrder, setColumnOrder] = useState(ALL_COLUMNS.map(c => c.key));
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS.map(c => c.key));
  const [sortConfig, setSortConfig] = useState({ key: 'spend', direction: 'desc' });

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(columnOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setColumnOrder(items);
  };

  const orderedColumns = columnOrder
    .map(key => ALL_COLUMNS.find(c => c.key === key))
    .filter(c => c && visibleColumns.includes(c.key));

  const aggregated = useMemo(() => {
    const groups = {};
    
    data.forEach(item => {
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
          count: 0,
        };
      }
      
      groups[key].spend += item.spend || 0;
      groups[key].impressions += item.impressions || 0;
      groups[key].reach += item.reach || 0;
      groups[key].link_clicks += item.link_clicks || 0;
      groups[key].clicks += item.clicks || 0;
      groups[key].conversations += item.wa_conversations_started_7d || 0;
      groups[key].ctr_link_sum += item.ctr_link || 0;
      groups[key].cpc_link_sum += item.cpc_link || 0;
      groups[key].cpm_sum += item.cpm || 0;
      groups[key].cost_per_conversation_sum += item.cost_per_conversation || 0;
      groups[key].count += 1;
    });

    Object.values(groups).forEach(g => {
      g.ctr_link = g.count > 0 ? g.ctr_link_sum / g.count : 0;
      g.cpc_link = g.count > 0 ? g.cpc_link_sum / g.count : 0;
      g.cpm = g.count > 0 ? g.cpm_sum / g.count : 0;
      g.cost_per_conversation = g.count > 0 ? g.cost_per_conversation_sum / g.count : 0;
    });

    let filtered = Object.values(groups);
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(g => g.status === statusFilter);
    }

    filtered.sort((a, b) => {
      const aVal = a[sortConfig.key] || 0;
      const bVal = b[sortConfig.key] || 0;
      return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return filtered.slice(0, parseInt(limit));
  }, [data, groupKey, nameKey, limit, statusFilter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const uniqueStatuses = [...new Set(data.map(d => d.ad_effective_status).filter(Boolean))];

  // Colunas de métricas para exibir nos cards mobile (excluindo name e status)
  const metricColumns = orderedColumns.filter(c => c.key !== 'name' && c.key !== 'status');

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          <div className="flex flex-wrap gap-2">
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
                {uniqueStatuses.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
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
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                          {columnOrder.map((key, index) => {
                            const col = ALL_COLUMNS.find(c => c.key === key);
                            if (!col) return null;
                            return (
                              <Draggable key={col.key} draggableId={col.key} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`flex items-center gap-2 p-2 rounded-md border ${
                                      snapshot.isDragging ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                                    }`}
                                  >
                                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                      <GripVertical className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <Checkbox
                                      checked={visibleColumns.includes(col.key)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setVisibleColumns([...visibleColumns, col.key]);
                                        } else {
                                          setVisibleColumns(visibleColumns.filter(k => k !== col.key));
                                        }
                                      }}
                                    />
                                    <label className="text-sm flex-1">{col.label}</label>
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {/* Mobile: card list */}
        <div className="sm:hidden divide-y divide-gray-100">
          {aggregated.map((item, idx) => (
            <div key={item.id} className="p-4">
              <div className="flex items-start gap-3 mb-3">
                {showThumbnail && (
                  item.thumbnail ? (
                    <img src={item.thumbnail} alt="Criativo" className="w-12 h-12 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs flex-shrink-0">N/D</div>
                  )
                )}
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
                {metricColumns.slice(0, 6).map(col => (
                  <div key={col.key} className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500 mb-0.5">{col.label}</p>
                    <p className="text-sm font-semibold text-gray-800">{col.format(item[col.key])}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {aggregated.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">Nenhum dado disponível</p>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {showThumbnail && <th className="text-left py-3 px-2 font-medium text-gray-700 w-16">Criativo</th>}
                {orderedColumns.map(col => (
                  <th 
                    key={col.key} 
                    className="text-left py-3 px-2 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                    onClick={() => col.key !== 'name' && col.key !== 'status' && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortConfig.key === col.key && (
                        sortConfig.direction === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aggregated.map((item, idx) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  {showThumbnail && (
                    <td className="py-3 px-2">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="Criativo" className="w-12 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">N/D</div>
                      )}
                    </td>
                  )}
                  {orderedColumns.map(col => (
                    <td key={col.key} className="py-3 px-2">
                      {col.key === 'name' ? (
                        <span className="font-medium text-gray-900 max-w-xs truncate">{item.name}</span>
                      ) : col.key === 'status' ? (
                        <Badge className={STATUS_COLORS[item.status] || 'bg-gray-100'}>
                          {item.status}
                        </Badge>
                      ) : (
                        <span className="text-gray-700">{col.format(item[col.key])}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}