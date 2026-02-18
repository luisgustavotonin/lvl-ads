import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Database, Trash2, AlertTriangle, Calendar, Search, Loader2, RefreshCw, Settings2, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
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
import toast, { Toaster } from 'react-hot-toast';
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
   const [dateFilterType, setDateFilterType] = useState('ad_date'); // 'ad_date' ou 'job_created'
   const [confirmDelete, setConfirmDelete] = useState(false);
   const [isSearching, setIsSearching] = useState(false);
   const [searchResults, setSearchResults] = useState(null);
   const [selectedMetrics, setSelectedMetrics] = useState([]);
   const [sortField, setSortField] = useState('created_date');
   const [sortDirection, setSortDirection] = useState('desc');
   const [activeTab, setActiveTab] = useState('executions');
   const [currentPage, setCurrentPage] = useState(1);
   const [pageSize, setPageSize] = useState(25);
   const [detailedSortField, setDetailedSortField] = useState('date');
   const [detailedSortDirection, setDetailedSortDirection] = useState('desc');
   const [deletingItemId, setDeletingItemId] = useState(null);
  
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

  const { data: allRuns = [], refetch: refetchMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['runs', selectedUnit, dateFrom, dateTo],
    queryFn: async () => {
      if (selectedUnit === 'all') {
        return [];
      }

      let filters = { unit_id: selectedUnit };
      
      if (dateFrom) filters.date_start = { $gte: dateFrom };
      if (dateTo) filters.date_end = { $lte: dateTo };
      
      return base44.entities.Run.filter(filters, '-created_date', 1000);
    },
    enabled: selectedUnit !== 'all',
  });

  const { data: allJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', selectedUnit, allRuns.map(r => r.run_id)],
    queryFn: async () => {
      if (selectedUnit === 'all' || allRuns.length === 0) {
        return [];
      }

      const runIds = allRuns.map(r => r.run_id);
      return base44.entities.Job.filter({
        run_id: { $in: runIds },
        unit_id: selectedUnit
      }, '-created_date', 5000);
    },
    enabled: selectedUnit !== 'all' && allRuns.length > 0,
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

  // Funções auxiliares de filtragem e ordenação
  const getFilteredResults = () => {
    if (selectedUnit === 'all') {
      return [];
    }
    
    return allRuns.filter(r => {
      const matchUnit = r.unit_id === selectedUnit;
      const matchPlatform = selectedPlatform === 'all' || r.platform === selectedPlatform;
      
      return matchUnit && matchPlatform;
    });
  };

  const getSortedResults = () => {
    const filtered = getFilteredResults();
    return filtered.sort((a, b) => {
      if (sortField === 'created_date') {
        const aVal = new Date(a.created_date || 0).getTime();
        const bVal = new Date(b.created_date || 0).getTime();
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  };

  // Normalizar data para YYYY-MM-DD sem timezone
  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month}-${day}`;
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  const filtered = getFilteredResults();
  const sorted = getSortedResults();

  // ✅ Buscar MetaAdDaily diretamente por unit_id + date range (não depende de Run)
  const { data: consolidatedData = [] } = useQuery({
    queryKey: ['consolidatedData', selectedUnit, dateFrom, dateTo, selectedPlatform],
    queryFn: async () => {
      if (selectedUnit === 'all') return [];

      const filters = { unit_id: selectedUnit };
      if (dateFrom) filters.date = { $gte: dateFrom };
      if (dateTo) filters.date = { ...filters.date, $lte: dateTo };
      if (selectedPlatform !== 'all') filters.platform = selectedPlatform;

      return base44.entities.MetaAdDaily.filter(filters, '-date', 10000);
    },
    enabled: selectedUnit !== 'all',
  });

  const finalData = useMemo(() => {
    if (!consolidatedData || consolidatedData.length === 0) return [];
    return consolidatedData.map(row => ({
      ...row,
      _run_id: row.run_id,
      _job_id: row.job_id,
      _created_at: row.imported_at_utc || row.created_date
    }));
  }, [consolidatedData]);

  // Ordenar dados consolidados
  const sortedConsolidatedData = useMemo(() => {
    const sorted = [...finalData].sort((a, b) => {
      let aVal = a[detailedSortField];
      let bVal = b[detailedSortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return detailedSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();
      return detailedSortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sorted;
  }, [finalData, detailedSortField, detailedSortDirection]);

  // Paginação
  const totalPages = Math.ceil(sortedConsolidatedData.length / pageSize);
  const paginatedData = sortedConsolidatedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Obter colunas disponíveis dos dados consolidados
  const availableColumns = useMemo(() => {
    if (finalData.length === 0) return [];
    const firstRow = finalData[0];
    return Object.keys(firstRow).filter(k => !k.startsWith('_'));
  }, [finalData]);

  const deleteMetricsMutation = useMutation({
    mutationFn: async ({ runIds, unitId }) => {
      const response = await base44.functions.invoke('deleteRunCascade', {
        run_ids: runIds,
        unit_id: unitId
      });
      
      if (!response.data.success && response.data.errors) {
        throw new Error(`Exclusão parcial: ${response.data.errors.join(', ')}`);
      }
      
      return response.data.deleted;
    },
    onSuccess: (deleted) => {
      // Invalidar TODAS as queries
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['currentMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['previousMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['executionLogs'] });
      
      setSelectedMetrics([]);
      setDeletingItemId(null);
      
      toast.success(`✅ Exclusão completa: ${deleted.runs} runs, ${deleted.jobs} jobs, ${deleted.ad_daily} registros excluídos!`, {
        duration: 5000
      });
    },
    onError: (error) => {
      setDeletingItemId(null);
      toast.error(`Erro ao excluir: ${error.message}`);
      console.error('Erro na exclusão:', error);
    },
  });

  const handleSearch = () => {
    setIsSearching(true);
    const filtered = getFilteredResults();
    
    setTimeout(() => {
      setSearchResults({ count: filtered.length, deleted: null });
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

  const handleDetailedSort = (field) => {
    if (detailedSortField === field) {
      setDetailedSortDirection(detailedSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setDetailedSortField(field);
      setDetailedSortDirection('desc');
    }
  };

  const DetailedSortIcon = ({ field }) => {
    if (detailedSortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{detailedSortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
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
              <Label>Tipo de Data</Label>
              <Select value={dateFilterType} onValueChange={setDateFilterType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ad_date">Data do Anúncio</SelectItem>
                  <SelectItem value="job_created">Data de Criação do Job</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
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
                Resultado: {filtered.length} execuções de {getUnitName(selectedUnit)}
              </CardTitle>
              <Button 
                variant="destructive"
                onClick={() => {
                  setDeletingItemId('all');
                  setConfirmDelete(true);
                }}
                disabled={deleteMetricsMutation.isPending || deletingItemId !== null}
                className="gap-2"
              >
                {deletingItemId === 'all' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Excluir Todos ({filtered.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Execuções (RUNs)</p>
                <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Total de Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{filtered.reduce((s, r) => s + (r.total_jobs || 0), 0)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Total de Registros</p>
                <p className="text-2xl font-bold text-gray-900">{filtered.reduce((s, r) => s + (r.total_records || 0), 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Abas: Histórico de Execuções vs RUNs vs Jobs vs Dados */}
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
          onClick={() => setActiveTab('runs')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'runs'
              ? 'text-blue-600 border-b-blue-600'
              : 'text-gray-600 border-b-transparent hover:text-gray-900'
          }`}
        >
          Execuções (RUNs)
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'jobs'
              ? 'text-blue-600 border-b-blue-600'
              : 'text-gray-600 border-b-transparent hover:text-gray-900'
          }`}
        >
          Jobs
        </button>
        <button
          onClick={() => setActiveTab('detailed')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'detailed'
              ? 'text-blue-600 border-b-blue-600'
              : 'text-gray-600 border-b-transparent hover:text-gray-900'
          }`}
        >
          Dados Detalhados
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

      {activeTab === 'runs' && (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">
              Execuções (RUNs) - {filtered.length}
            </CardTitle>
            <div className="flex gap-2">
              {selectedMetrics.length > 0 && selectedUnit !== 'all' && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMetricsMutation.isPending || deletingItemId !== null}
                  onClick={() => {
                    if (confirm(`Excluir ${selectedMetrics.length} execuções selecionadas e TODOS os dados vinculados?`)) {
                      setDeletingItemId('selected');
                      deleteMetricsMutation.mutate({ 
                        runIds: selectedMetrics,
                        unitId: selectedUnit 
                      });
                    }
                  }}
                >
                  {deletingItemId === 'selected' ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-1" />
                  )}
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
                        onChange={(e) => setSelectedMetrics(e.target.checked ? sorted.map(r => r.id) : [])}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('run_id')}>
                      RUN ID <SortIcon field="run_id" />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('platform')}>
                      Plataforma <SortIcon field="platform" />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Período
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                      Status <SortIcon field="status" />
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('total_records')}>
                      Registros <SortIcon field="total_records" />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('created_date')}>
                      Criado Em <SortIcon field="created_date" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                        Nenhum resultado encontrado
                      </td>
                    </tr>
                  ) : (
                    sorted.map(run => (
                      <tr key={run.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedMetrics.includes(run.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMetrics([...selectedMetrics, run.id]);
                              } else {
                                setSelectedMetrics(selectedMetrics.filter(id => id !== run.id));
                              }
                            }}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-900 font-mono text-xs">
                          {run.run_id?.substring(0, 12)}...
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={run.platform === 'META' ? 'default' : 'secondary'}>
                            {run.platform}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">
                          {formatDateString(run.date_start)} - {formatDateString(run.date_end)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant={run.status === 'success' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                            {run.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 font-semibold">
                          {run.total_records || 0}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">
                          {new Date(run.created_date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          </CardContent>
          </Card>
          )}

      {activeTab === 'detailed' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">
                Dados Detalhados — {finalData.length} registros
              </CardTitle>
              <div className="flex gap-2 items-center">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Settings2 className="w-4 h-4" />
                      Selecionar Colunas
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Configurar Colunas</SheetTitle>
                      <SheetDescription>Selecione quais colunas deseja visualizar</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-2">
                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                        <Checkbox checked={true} disabled />
                        <label className="text-sm font-medium">Job ID (fixo)</label>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                        <Checkbox checked={true} disabled />
                        <label className="text-sm font-medium">Created At (fixo)</label>
                      </div>
                      {availableColumns.map(col => (
                        <div key={col} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                          <Checkbox 
                            checked={visibleColumns[col] !== false}
                            onCheckedChange={() => toggleColumnVisibility(col)}
                          />
                          <label className="text-sm">{col}</label>
                        </div>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 por página</SelectItem>
                    <SelectItem value="50">50 por página</SelectItem>
                    <SelectItem value="100">100 por página</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedUnit === 'all' ? (
              <div className="text-center py-12 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Selecione uma unidade para visualizar</p>
              </div>
            ) : finalData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                <p className="text-lg font-medium">Nenhum dado encontrado</p>
                <p className="text-sm mt-2">Sem registros em MetaAdDaily para esta unidade e período</p>
                <div className="mt-4 text-xs text-left max-w-md mx-auto bg-gray-50 p-3 rounded">
                  <p className="font-semibold mb-2">Verifique:</p>
                  <ul className="space-y-1 text-gray-600">
                    <li>• A unidade selecionada está correta?</li>
                    <li>• O período abrange as datas dos anúncios?</li>
                    <li>• O N8N retornou dados via saveMetaJobResult?</li>
                    <li>• Deixe Data Início e Fim em branco para ver tudo</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  Exibindo {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, sortedConsolidatedData.length)} de {sortedConsolidatedData.length} registros
                </div>
                
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleDetailedSort('id')}>
                          Record ID <DetailedSortIcon field="id" />
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleDetailedSort('_job_id')}>
                          Job ID <DetailedSortIcon field="_job_id" />
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleDetailedSort('_created_at')}>
                          Timestamp <DetailedSortIcon field="_created_at" />
                        </th>
                        {availableColumns.filter(col => visibleColumns[col] !== false).map(col => (
                          <th key={col} className="px-2 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => handleDetailedSort(col)}>
                            {col} <DetailedSortIcon field={col} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-2 py-2 text-gray-600 font-mono text-[10px]">
                            {(row.id || idx)?.toString().substring(0, 12)}...
                          </td>
                          <td className="px-2 py-2 text-gray-600 font-mono text-[10px]">
                            {row._job_id?.substring(0, 12)}...
                          </td>
                          <td className="px-2 py-2 text-gray-600 text-[10px]">
                            {new Date(row._created_at).toLocaleString('pt-BR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          {availableColumns.filter(col => visibleColumns[col] !== false).map(col => {
                            const value = row[col];
                            const colDef = CAMPAIGN_COLUMNS.find(c => c.key === col);
                            const isNumeric = colDef && ['number', 'currency', 'decimal', 'percent'].includes(colDef.type);
                            
                            return (
                              <td key={col} className={`px-2 py-2 ${isNumeric ? 'text-right' : 'text-left'}`}>
                                {colDef ? formatValue(value, colDef.type) : (typeof value === 'object' ? JSON.stringify(value).substring(0, 30) : value)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Linha de totais */}
                      <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                        <td className="px-2 py-2 text-gray-700" colSpan={3}>TOTAL</td>
                        {availableColumns.filter(col => visibleColumns[col] !== false).map(col => {
                          const colDef = CAMPAIGN_COLUMNS.find(c => c.key === col);
                          const isNumeric = colDef && ['number', 'currency', 'decimal'].includes(colDef.type);
                          
                          if (!isNumeric) {
                            return <td key={col} className="px-2 py-2 text-center">-</td>;
                          }
                          
                          const sum = paginatedData.reduce((acc, row) => {
                            const val = parseFloat(row[col]);
                            return !isNaN(val) ? acc + val : acc;
                          }, 0);
                          
                          return (
                            <td key={col} className="px-2 py-2 text-right">
                              {formatValue(sum, colDef.type)}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Página {currentPage} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
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
                <p className="font-semibold">⚠️ EXCLUSÃO DEFINITIVA EM CASCATA</p>
                <p>Você está prestes a excluir permanentemente:</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li><strong>{filtered.length} execuções (RUNs)</strong></li>
                  <li>Todos os <strong>JOBS</strong> vinculados</li>
                  <li>Todos os <strong>dados detalhados</strong> (MetaAdDaily)</li>
                  <li>Todas as <strong>métricas agregadas</strong></li>
                  <li>Unidade: <strong>{getUnitName(selectedUnit)}</strong></li>
                  <li>Total de registros: <strong>{filtered.reduce((s, r) => s + (r.total_records || 0), 0)}</strong></li>
                </ul>
                <p className="text-red-600 font-bold mt-3 text-lg">⚠️ Esta ação não pode ser desfeita!</p>
                <p className="text-sm text-gray-600 mt-2">Relatórios e Dashboard serão recalculados automaticamente.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMetricsMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMetricsMutation.isPending}
              onClick={async () => {
                await deleteMetricsMutation.mutateAsync({ 
                  runIds: filtered.map(r => r.id),
                  unitId: selectedUnit 
                });
                setConfirmDelete(false);
              }}
            >
              {deleteMetricsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo... aguarde
                </>
              ) : 'Confirmar Exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}