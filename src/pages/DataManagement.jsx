import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Database, Trash2, AlertTriangle, Calendar, Search, Loader2, RefreshCw, Settings2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ExecutionLogViewer from '../components/ExecutionLogViewer';

// HELPER: Formatar data STRING (YYYY-MM-DD) para DD/MM/YYYY SEM criar Date()
const formatDateString = (dateStr) => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const PLATFORMS = [
  { id: 'all', name: 'Todas as plataformas' },
  { id: 'META', name: 'Meta Ads', icon: '📘' },
  { id: 'GOOGLE_ADS', name: 'Google Ads', icon: '🔍' },
  { id: 'TIKTOK_ADS', name: 'TikTok Ads', icon: '🎵' },
  { id: 'YOUTUBE', name: 'YouTube', icon: '▶️' },
];

// Colunas permitidas (apenas dados da campanha, não dados técnicos)
const CAMPAIGN_COLUMNS = [
  { key: 'date', label: 'date', type: 'date' },
  { key: 'campaign_name', label: 'campaign_name', type: 'string' },
  { key: 'campaign_id', label: 'campaign_id', type: 'string' },
  { key: 'adset_name', label: 'adset_name', type: 'string' },
  { key: 'adset_id', label: 'adset_id', type: 'string' },
  { key: 'ad_name', label: 'ad_name', type: 'string' },
  { key: 'ad_id', label: 'ad_id', type: 'string' },
  { key: 'ad_effective_status', label: 'ad_effective_status', type: 'string' },
  { key: 'creative_id', label: 'creative_id', type: 'string' },
  { key: 'spend', label: 'spend', type: 'currency' },
  { key: 'impressions', label: 'impressions', type: 'number' },
  { key: 'reach', label: 'reach', type: 'number' },
  { key: 'frequency', label: 'frequency', type: 'decimal' },
  { key: 'clicks', label: 'clicks', type: 'number' },
  { key: 'link_clicks', label: 'link_clicks', type: 'number' },
  { key: 'ctr_link', label: 'ctr_link', type: 'percent' },
  { key: 'cpc_link', label: 'cpc_link', type: 'currency' },
  { key: 'cpm', label: 'cpm', type: 'currency' },
  { key: 'wa_conversations_started_7d', label: 'wa_conversations_started_7d', type: 'number' },
  { key: 'wa_total_messaging_connection', label: 'wa_total_messaging_connection', type: 'number' },
  { key: 'wa_messaging_first_reply', label: 'wa_messaging_first_reply', type: 'number' },
  { key: 'cost_per_conversation', label: 'cost_per_conversation', type: 'currency' },
  { key: 'cost_per_total_contact', label: 'cost_per_total_contact', type: 'currency' },
  { key: 'cost_per_first_reply', label: 'cost_per_first_reply', type: 'currency' },
];

export default function DataManagement() {
   const queryClient = useQueryClient();
   const [selectedUnit, setSelectedUnit] = useState('all');
   const [selectedPlatform, setSelectedPlatform] = useState('all');
   const [dateFrom, setDateFrom] = useState('');
   const [dateTo, setDateTo] = useState('');
   const [confirmDelete, setConfirmDelete] = useState(false);
   const [isSearching, setIsSearching] = useState(false);
   const [searchResults, setSearchResults] = useState(null);
   const [selectedMetrics, setSelectedMetrics] = useState([]);
   const [sortField, setSortField] = useState('created_date');
   const [sortDirection, setSortDirection] = useState('desc');
   const [activeTab, setActiveTab] = useState('executions');
  
  // Carregar ordem e visibilidade das colunas do localStorage
  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem('dataManagement_columnOrder');
    const order = saved ? JSON.parse(saved) : CAMPAIGN_COLUMNS.map(c => c.key);
    // Garantir que novas colunas sejam adicionadas
    const allKeys = CAMPAIGN_COLUMNS.map(c => c.key);
    const missingKeys = allKeys.filter(k => !order.includes(k));
    return [...order, ...missingKeys];
  });

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('dataManagement_visibleColumns');
    const defaultVisible = {
      date: true,
      campaign_name: true,
      adset_name: true,
      ad_name: true,
      ad_effective_status: true,
      spend: true,
      impressions: true,
      reach: true,
      frequency: true,
      clicks: true,
      link_clicks: true,
      ctr_link: true,
      cpc_link: true,
      cpm: true,
      wa_conversations_started_7d: true,
      wa_total_messaging_connection: true,
      wa_messaging_first_reply: true,
      cost_per_conversation: true,
    };
    
    if (!saved) return defaultVisible;
    
    const parsed = JSON.parse(saved);
    // Mesclar com valores padrão para novas colunas
    return { ...defaultVisible, ...parsed };
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: allMetrics = [], refetch: refetchMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['allMetrics', selectedUnit, dateFrom, dateTo],
    queryFn: async () => {
      // NUNCA buscar sem unidade selecionada
      if (selectedUnit === 'all') {
        return [];
      }

      const filters = { unit_id: selectedUnit };
      
      if (dateFrom || dateTo) {
        filters.date = {};
        if (dateFrom) filters.date.$gte = dateFrom;
        if (dateTo) filters.date.$lte = dateTo;
      }
      
      // Buscar TODOS os registros da unidade selecionada no período
      return base44.entities.MetaAdDaily.filter(filters, '-date', 50000);
    },
    enabled: selectedUnit !== 'all',
  });

  const { data: webhookLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['webhookLogs'],
    queryFn: () => base44.entities.WebhookLog.list('-created_date', 20),
  });

  // Ordenar colunas conforme a ordem salva
  const orderedColumns = useMemo(() => {
    return columnOrder
      .map(key => CAMPAIGN_COLUMNS.find(col => col.key === key))
      .filter(Boolean);
  }, [columnOrder]);

  const deleteMetricsMutation = useMutation({
    mutationFn: async ({ metricIds, unitId }) => {
      // VALIDAÇÃO DE SEGURANÇA: Garantir que todos os registros são da unidade correta
      const recordsToDelete = allMetrics.filter(m => 
        metricIds.includes(m.id) && m.unit_id === unitId
      );
      
      if (recordsToDelete.length !== metricIds.length) {
        throw new Error('Tentativa de excluir registros de outra unidade bloqueada');
      }
      
      // Coletar datas afetadas
      const affectedDates = new Set();
      recordsToDelete.forEach(record => {
        affectedDates.add(`${record.unit_id}_${record.date}`);
      });
      
      // Deletar em lotes de 100 para evitar timeout
      const batchSize = 100;
      let deletedCount = 0;
      
      for (let i = 0; i < recordsToDelete.length; i += batchSize) {
        const batch = recordsToDelete.slice(i, i + batchSize);
        const deleteResults = await Promise.allSettled(
          batch.map(record => base44.entities.MetaAdDaily.delete(record.id))
        );
        deletedCount += deleteResults.filter(r => r.status === 'fulfilled').length;
      }
      
      // Reagregar ou limpar
      await Promise.all(
        Array.from(affectedDates).map(async (key) => {
          const [unit_id, date] = key.split('_');
          
          try {
            const remaining = await base44.entities.MetaAdDaily.filter({ unit_id, date });
            
            if (remaining.length === 0) {
              const metricsDaily = await base44.entities.MetricsDaily.filter({ unit_id, date, provider: 'meta' });
              await Promise.allSettled(metricsDaily.map(m => base44.entities.MetricsDaily.delete(m.id)));
            } else {
              await base44.functions.invoke('aggregateMetaToMetricsDaily', { unit_id, date_from: date, date_to: date });
            }
          } catch (error) {
            console.warn(`Erro ao processar agregação para ${key}:`, error);
          }
        })
      );
      
      return deletedCount;
    },
    onSuccess: (deletedCount) => {
      queryClient.invalidateQueries({ queryKey: ['allMetrics'] });
      setSelectedMetrics([]);
    },
  });

  const getFilteredMetrics = () => {
    // VALIDAÇÃO: Só retorna dados se uma unidade específica estiver selecionada
    if (selectedUnit === 'all') {
      return [];
    }
    
    return allMetrics.filter(m => {
      // Garantir que é da unidade selecionada
      const matchUnit = m.unit_id === selectedUnit;
      const matchPlatform = selectedPlatform === 'all' || selectedPlatform === 'META';
      const matchDate = (!dateFrom || m.date >= dateFrom) && (!dateTo || m.date <= dateTo);
      
      return matchUnit && matchPlatform && matchDate;
    });
  };

  const getSortedMetrics = () => {
    const filtered = getFilteredMetrics();
    return filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Para datas STRING (YYYY-MM-DD), comparação lexicográfica funciona
      if (sortField === 'date' || sortField === 'created_date') {
        return sortDirection === 'asc' 
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  };

  const handleSearch = () => {
    setIsSearching(true);
    const filtered = getFilteredMetrics();
    const totalSpend = filtered.reduce((s, m) => s + (m.spend || 0), 0);
    
    setTimeout(() => {
      setSearchResults({ count: filtered.length, totalSpend, deleted: null });
      setIsSearching(false);
    }, 500);
  };

  const getUnitName = (unitId) => {
    if (unitId === 'all') return 'Todas as unidades';
    return units.find(u => u.id === unitId)?.name || 'Unidade';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const toggleColumnVisibility = (colKey) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [colKey]: !prev[colKey] };
      localStorage.setItem('dataManagement_visibleColumns', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(columnOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setColumnOrder(items);
    localStorage.setItem('dataManagement_columnOrder', JSON.stringify(items));
  };

  const formatValue = (value, type) => {
    if (value == null || value === '') return '-';
    
    switch (type) {
      case 'date':
        return formatDateString(value);
      case 'currency':
        return formatCurrency(value);
      case 'percent':
        return `${(value * 100).toFixed(2)}%`;
      case 'decimal':
        return typeof value === 'number' ? value.toFixed(2) : value;
      case 'number':
        return new Intl.NumberFormat('pt-BR').format(Math.round(value));
      default:
        return value;
    }
  };

  if (unitsLoading) {
    return <div className="space-y-6"><Skeleton className="h-96 w-full" /></div>;
  }

  const filtered = getFilteredMetrics();
  const sorted = getSortedMetrics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestão de Dados</h1>
        <p className="text-gray-500 mt-1">Gerencie e visualize os dados do sistema</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger><SelectValue placeholder="Selecione uma unidade" /></SelectTrigger>
                <SelectContent>
                  {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedUnit === 'all' && (
                <p className="text-xs text-amber-600">⚠️ Selecione uma unidade para visualizar e gerenciar dados</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Data Início (DD/MM/AAAA)</Label>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="DD/MM/AAAA"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Data Fim (DD/MM/AAAA)</Label>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="DD/MM/AAAA"
              />
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={refetchMetrics} disabled={metricsLoading} className="w-full gap-2">
                {metricsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo dos dados filtrados */}
      {selectedUnit !== 'all' && filtered.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">
                Resultado: {filtered.length} registros de {getUnitName(selectedUnit)}
              </CardTitle>
              <Button 
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={deleteMetricsMutation.isPending}
                className="gap-2"
              >
                {deleteMetricsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Excluir Todos ({filtered.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Registros</p>
                <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Investimento Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(filtered.reduce((s, m) => s + (m.spend || 0), 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Abas: Histórico de Execuções vs Dados */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('executions')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'executions'
              ? 'text-blue-600 border-b-blue-600'
              : 'text-gray-600 border-b-transparent hover:text-gray-900'
          }`}
        >
          Histórico de Execuções
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'data'
              ? 'text-blue-600 border-b-blue-600'
              : 'text-gray-600 border-b-transparent hover:text-gray-900'
          }`}
        >
          Dados (Últimos 100)
        </button>
      </div>

      {/* Conteúdo das Abas */}
      {activeTab === 'executions' && (
        <Card>
          <CardContent className="pt-6">
            {selectedUnit === 'all' ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Selecione uma unidade para visualizar o histórico</p>
              </div>
            ) : (
              <ExecutionLogViewer unitId={selectedUnit} limit={15} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'data' && (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">
              {dateFrom || dateTo ? `Dados do período - ${filtered.length} registros` : `Dados (últimos 100) - ${filtered.length} filtrados`}
            </CardTitle>
            <div className="flex gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="w-4 h-4" />
                    Colunas
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[540px]">
                  <SheetHeader>
                    <SheetTitle>Configurar Colunas</SheetTitle>
                    <SheetDescription>Arraste para reordenar e marque para exibir</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-2 max-h-[calc(100vh-150px)] overflow-y-auto pr-2">
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="columns">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef}>
                            {orderedColumns.map((col, index) => (
                              <Draggable key={col.key} draggableId={col.key} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`flex items-center gap-3 p-3 mb-2 bg-white border rounded-lg ${
                                      snapshot.isDragging ? 'shadow-lg border-blue-400' : 'border-gray-200'
                                    }`}
                                  >
                                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                      <GripVertical className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <Checkbox 
                                      checked={visibleColumns[col.key] !== false}
                                      onCheckedChange={() => toggleColumnVisibility(col.key)}
                                    />
                                    <label className="text-sm font-medium flex-1 cursor-pointer" onClick={() => toggleColumnVisibility(col.key)}>
                                      {col.label}
                                    </label>
                                    <Badge variant="outline" className="text-xs">{col.type}</Badge>
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
                </SheetContent>
              </Sheet>

              {selectedMetrics.length > 0 && selectedUnit !== 'all' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Excluir ${selectedMetrics.length} selecionados de ${getUnitName(selectedUnit)}?`)) {
                      deleteMetricsMutation.mutate({ 
                        metricIds: selectedMetrics,
                        unitId: selectedUnit 
                      });
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Excluir ({selectedMetrics.length})
                </Button>
              )}
              
              <Button variant="outline" size="sm" onClick={refetchMetrics} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedUnit === 'all' ? (
            <div className="text-center py-12 text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Selecione uma unidade para visualizar os dados</p>
              <p className="text-sm mt-2">Use o filtro acima para escolher a unidade que deseja gerenciar</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={sorted.length > 0 && selectedMetrics.length === sorted.length}
                        onChange={(e) => setSelectedMetrics(e.target.checked ? sorted.map(m => m.id) : [])}
                        className="w-4 h-4"
                      />
                    </th>
                  {orderedColumns.filter(col => visibleColumns[col.key] !== false).map(col => (
                    <th 
                      key={col.key}
                      className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label} <SortIcon field={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={orderedColumns.length + 1} className="px-3 py-8 text-center text-gray-500">
                      Nenhum dado encontrado
                    </td>
                  </tr>
                ) : (
                  sorted.map(metric => (
                    <tr key={metric.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedMetrics.includes(metric.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMetrics([...selectedMetrics, metric.id]);
                            } else {
                              setSelectedMetrics(selectedMetrics.filter(id => id !== metric.id));
                            }
                          }}
                          className="w-4 h-4"
                        />
                      </td>
                      {orderedColumns.filter(col => visibleColumns[col.key] !== false).map(col => {
                        const value = formatValue(metric[col.key], col.type);
                        const isNumeric = ['number', 'currency', 'percent'].includes(col.type);
                        
                        return (
                          <td key={col.key} className={`px-3 py-2 ${isNumeric ? 'text-right' : 'text-left'} text-gray-900`}>
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
                {sorted.length > 0 && (
                  <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                    <td className="px-3 py-3"></td>
                    {orderedColumns.filter(col => visibleColumns[col.key] !== false).map(col => {
                      if (!['number', 'currency'].includes(col.type)) {
                        return <td key={col.key} className="px-3 py-3"></td>;
                      }
                      
                      const total = filtered.reduce((sum, m) => sum + (m[col.key] || 0), 0);
                      const formattedTotal = col.type === 'currency' ? formatCurrency(total) : new Intl.NumberFormat('pt-BR').format(Math.round(total));
                      
                      return (
                        <td key={col.key} className="px-3 py-3 text-right text-gray-900">
                          {formattedTotal}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
          {selectedUnit !== 'all' && (
            <p className="text-xs text-gray-500 mt-2">
              💡 Clique em "Colunas" para reordenar com drag & drop e escolher quais exibir
            </p>
          )}
          </CardContent>
          </Card>
          )}

          {/* Dialog de Confirmação */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>Você está prestes a excluir permanentemente:</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li><strong>{filtered.length} registros</strong></li>
                  <li>Da unidade: <strong>{getUnitName(selectedUnit)}</strong></li>
                  {dateFrom && <li>A partir de: <strong>{formatDateString(dateFrom)}</strong></li>}
                  {dateTo && <li>Até: <strong>{formatDateString(dateTo)}</strong></li>}
                </ul>
                <p className="text-red-600 font-semibold mt-3">Esta ação não pode ser desfeita!</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMetricsMutation.isPending}
              onClick={async () => {
                await deleteMetricsMutation.mutateAsync({ 
                  metricIds: filtered.map(m => m.id),
                  unitId: selectedUnit 
                });
                setConfirmDelete(false);
              }}
            >
              {deleteMetricsMutation.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}