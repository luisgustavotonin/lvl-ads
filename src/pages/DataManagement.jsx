import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Database, Trash2, AlertTriangle, Calendar, Search, Loader2, RefreshCw, Settings2 } from 'lucide-react';
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
  
  // Auto-colunas: carregar preferências do localStorage
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('dataManagement_visibleColumns');
    return saved ? JSON.parse(saved) : {
      date: true,
      unit_id: true,
      ad_name: true,
      spend: true,
      impressions: true,
      reach: true,
      clicks: true,
      link_clicks: true,
      wa_conversations_started_7d: true,
      wa_messaging_first_reply: true,
      created_date: true,
    };
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: allMetrics = [], refetch: refetchMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['allMetrics', selectedUnit, dateFrom, dateTo],
    queryFn: async () => {
      const filters = {};
      
      if (selectedUnit !== 'all') {
        filters.unit_id = selectedUnit;
      }
      
      if (dateFrom || dateTo) {
        filters.date = {};
        if (dateFrom) filters.date.$gte = dateFrom;
        if (dateTo) filters.date.$lte = dateTo;
      }
      
      // Se houver filtros, busca TUDO do período, senão busca os últimos 100
      const hasFilters = Object.keys(filters).length > 0;
      return hasFilters 
        ? base44.entities.MetaAdDaily.filter(filters, '-date', 10000)
        : base44.entities.MetaAdDaily.list('-created_date', 100);
    },
  });

  const { data: webhookLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['webhookLogs'],
    queryFn: () => base44.entities.WebhookLog.list('-created_date', 20),
  });

  // Detectar colunas dinâmicas baseadas no payload
  const dynamicColumns = useMemo(() => {
    if (allMetrics.length === 0) return [];
    
    const allKeys = new Set();
    allMetrics.forEach(metric => {
      Object.keys(metric).forEach(key => {
        // Ignorar campos fixos e complexos
        if (!['id', 'created_date', 'updated_date', 'created_by', 'demographics_json', 'placement_json', 'devices_json'].includes(key)) {
          allKeys.add(key);
        }
      });
    });

    return Array.from(allKeys).map(key => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: typeof allMetrics[0][key] === 'number' ? 'number' : 'string'
    }));
  }, [allMetrics]);

  const deleteMetricsMutation = useMutation({
    mutationFn: async (metricIds) => {
      // Exclusão em lote - coletar todas as datas afetadas ANTES
      const affectedDates = new Set();
      metricIds.forEach(id => {
        const record = allMetrics.find(m => m.id === id);
        if (record) affectedDates.add(`${record.unit_id}_${record.date}`);
      });
      
      // Deletar tudo em paralelo (sem await em loop)
      await Promise.all(metricIds.map(id => base44.entities.MetaAdDaily.delete(id)));
      
      // Reagregar ou limpar em paralelo
      await Promise.all(
        Array.from(affectedDates).map(async (key) => {
          const [unit_id, date] = key.split('_');
          const remaining = await base44.entities.MetaAdDaily.filter({ unit_id, date });
          
          if (remaining.length === 0) {
            const metricsDaily = await base44.entities.MetricsDaily.filter({ unit_id, date, provider: 'meta' });
            await Promise.all(metricsDaily.map(m => base44.entities.MetricsDaily.delete(m.id)));
          } else {
            await base44.functions.invoke('aggregateMetaToMetricsDaily', { unit_id, date_from: date, date_to: date });
          }
        })
      );
      
      return metricIds.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allMetrics'] });
      setSelectedMetrics([]);
    },
  });

  const getFilteredMetrics = () => {
    return allMetrics.filter(m => {
      const matchUnit = selectedUnit === 'all' || m.unit_id === selectedUnit;
      const matchPlatform = selectedPlatform === 'all' || selectedPlatform === 'META'; // MetaAdDaily é sempre META
      
      // Comparação de STRING (lexicográfica funciona para YYYY-MM-DD)
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
              <Label>Unidade</Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
      {filtered.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Resultado: {filtered.length} registros</CardTitle>
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
                Excluir {filtered.length}
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

      {/* Tabela com Auto-Colunas */}
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
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Selecionar Colunas</SheetTitle>
                    <SheetDescription>Escolha quais colunas exibir</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-3 max-h-[calc(100vh-150px)] overflow-y-auto pr-2">
                    {dynamicColumns.map(col => (
                      <div key={col.key} className="flex items-center gap-2">
                        <Checkbox 
                          checked={visibleColumns[col.key] !== false}
                          onCheckedChange={() => toggleColumnVisibility(col.key)}
                        />
                        <label className="text-sm">{col.label}</label>
                      </div>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>

              {selectedMetrics.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Excluir ${selectedMetrics.length} selecionados?`)) {
                      deleteMetricsMutation.mutate(selectedMetrics);
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
                  {dynamicColumns.filter(col => visibleColumns[col.key] !== false).map(col => (
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
                    <td colSpan={dynamicColumns.length + 1} className="px-3 py-8 text-center text-gray-500">
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
                      {dynamicColumns.filter(col => visibleColumns[col.key] !== false).map(col => {
                        let value = metric[col.key];
                        
                        // Formatação especial
                        if (col.key === 'date') {
                          value = formatDateString(value);
                        } else if (col.key === 'created_date') {
                          value = formatDateString(String(value).split('T')[0]);
                        } else if (col.key.includes('spend') || col.key.includes('cost') || col.key.includes('cpc') || col.key.includes('cpm')) {
                          value = formatCurrency(value);
                        } else if (col.type === 'number') {
                          value = new Intl.NumberFormat('pt-BR').format(Math.round(value || 0));
                        }
                        
                        return (
                          <td key={col.key} className={`px-3 py-2 ${col.type === 'number' ? 'text-right' : 'text-left'} text-gray-900`}>
                            {value || '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
                {sorted.length > 0 && (
                  <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                    <td className="px-3 py-3"></td>
                    {dynamicColumns.filter(col => visibleColumns[col.key] !== false).map(col => {
                      if (col.type !== 'number') {
                        return <td key={col.key} className="px-3 py-3"></td>;
                      }
                      
                      const total = filtered.reduce((sum, m) => sum + (m[col.key] || 0), 0);
                      let formattedTotal = total;
                      
                      if (col.key.includes('spend') || col.key.includes('cost') || col.key.includes('cpc') || col.key.includes('cpm')) {
                        formattedTotal = formatCurrency(total);
                      } else {
                        formattedTotal = new Intl.NumberFormat('pt-BR').format(Math.round(total));
                      }
                      
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
          <p className="text-xs text-gray-500 mt-2">
            💡 Colunas dinâmicas: novos campos do payload aparecem automaticamente
          </p>
        </CardContent>
      </Card>

      {/* Dialog de Confirmação */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Excluir {filtered.length} registros permanentemente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMetricsMutation.isPending}
              onClick={async () => {
                await deleteMetricsMutation.mutateAsync(filtered.map(m => m.id));
                setConfirmDelete(false);
              }}
            >
              {deleteMetricsMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}