import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  RefreshCw, Loader2, Database, AlertTriangle, Download, Trash2, Layers, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import DeleteProgressOverlay from '@/components/datamanagement/DeleteProgressOverlay';

const PAGE_SIZE_OPTIONS = [50, 100, 500, 1000, 'Todos'];
const DEFAULT_PAGE_SIZE = 50;

const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return dd ? `${dd}/${m}/${y}` : d;
};

const fmtCur = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtNum = (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v || 0));

const fmtPct = (v) => `${((v || 0) * 100).toFixed(2)}%`;

const TABS = [
  { id: 'base',        label: 'Insights (Puro)',  entity: 'MetaInsightBase',              hasDate: true },
  { id: 'platform',    label: 'Plataforma',        entity: 'MetaInsightByPlatformPosition', hasDate: true },
  { id: 'device',      label: 'Dispositivos',      entity: 'MetaInsightByDevice',           hasDate: true },
  { id: 'demographic', label: 'Idade e Gênero',    entity: 'MetaInsightByDemographic',      hasDate: true },
  { id: 'creatives',   label: 'Criativos',         entity: 'MetaAdsCreative',               hasDate: false },
  { id: 'jobs',        label: 'Jobs (Ingestão)',   entity: 'MetaIngestRun',                 hasDate: true },
];

// Column definitions per tab
const COLUMNS = {
  base: [
    { key: 'date',        label: 'Data',        render: r => fmtDate(r.date) },
    { key: 'campaign_name', label: 'Campanha',  render: r => r.campaign_name || '—' },
    { key: 'ad_name',     label: 'Anúncio',     render: r => r.ad_name || '—' },
    { key: 'spend',       label: 'Gasto',       render: r => fmtCur(r.spend) },
    { key: 'impressions', label: 'Impressões',  render: r => fmtNum(r.impressions) },
    { key: 'link_clicks', label: 'Cliques Link',render: r => fmtNum(r.link_clicks) },
    { key: 'ctr_link',    label: 'CTR Link',    render: r => fmtPct(r.ctr_link) },
    { key: 'cpm',         label: 'CPM',         render: r => fmtCur(r.cpm) },
    { key: 'messaging_conversations_started', label: 'Conversas Iniciadas', render: r => fmtNum(r.messaging_conversations_started) },
    { key: 'messaging_conversations_replied', label: 'Novos Contatos', render: r => fmtNum(r.messaging_conversations_replied) },
    { key: 'leads',       label: 'Primeira Resposta', render: r => fmtNum(r.leads) },
  ],
  platform: [
    { key: 'date',              label: 'Data',                    render: r => fmtDate(r.date) },
    { key: 'publisher_platform',label: 'Plataforma',              render: r => r.publisher_platform || '—' },
    { key: 'platform_position', label: 'Posição',                 render: r => r.platform_position || '—' },
    { key: 'ad_id',             label: 'Ad ID',                   render: r => r.ad_id || '—' },
    { key: 'spend',             label: 'Gasto',                   render: r => fmtCur(r.spend) },
    { key: 'impressions',       label: 'Impressões',              render: r => fmtNum(r.impressions) },
    { key: 'link_clicks',       label: 'Cliques Link',            render: r => fmtNum(r.link_clicks) },
    { key: 'ctr_link',          label: 'CTR Link',                render: r => fmtPct(r.ctr_link) },
    { key: 'cpm',               label: 'CPM',                     render: r => fmtCur(r.cpm) },
    { key: 'messaging_conversations_started', label: 'Contatos Iniciados',       render: r => fmtNum(r.messaging_conversations_started) },
    { key: 'messaging_conversations_replied', label: 'Novos Contatos',           render: r => fmtNum(r.messaging_conversations_replied) },
    { key: 'leads',             label: 'Primeira Mensagem',       render: r => fmtNum(r.leads) },
    { key: 'cpc_link',          label: 'Custo por Mensagem',      render: r => fmtCur(r.cpc_link) },
  ],
  device: [
    { key: 'date',             label: 'Data',          render: r => fmtDate(r.date) },
    { key: 'impression_device',label: 'Dispositivo',   render: r => r.impression_device || '—' },
    { key: 'ad_id',            label: 'Ad ID',         render: r => r.ad_id || '—' },
    { key: 'spend',            label: 'Gasto',         render: r => fmtCur(r.spend) },
    { key: 'impressions',      label: 'Impressões',    render: r => fmtNum(r.impressions) },
    { key: 'link_clicks',      label: 'Cliques Link',  render: r => fmtNum(r.link_clicks) },
    { key: 'ctr_link',         label: 'CTR Link',      render: r => fmtPct(r.ctr_link) },
    { key: 'cpm',              label: 'CPM',           render: r => fmtCur(r.cpm) },
  ],
  demographic: [
    { key: 'date',       label: 'Data',        render: r => fmtDate(r.date) },
    { key: 'age',        label: 'Faixa Etária',render: r => r.age || '—' },
    { key: 'gender',     label: 'Gênero',      render: r => r.gender || '—' },
    { key: 'ad_id',      label: 'Ad ID',       render: r => r.ad_id || '—' },
    { key: 'spend',      label: 'Gasto',       render: r => fmtCur(r.spend) },
    { key: 'impressions',label: 'Impressões',  render: r => fmtNum(r.impressions) },
    { key: 'link_clicks',label: 'Cliques Link',render: r => fmtNum(r.link_clicks) },
    { key: 'ctr_link',   label: 'CTR Link',    render: r => fmtPct(r.ctr_link) },
    { key: 'cpm',        label: 'CPM',         render: r => fmtCur(r.cpm) },
  ],
  creatives: [
    { key: 'thumbnail_url', label: 'Thumb', render: r => r.thumbnail_url
        ? <img src={r.thumbnail_url} className="w-10 h-10 object-cover rounded" alt="" />
        : '—'
    },
    { key: 'ad_id',            label: 'Ad ID',         render: r => r.ad_id || '—' },
    { key: 'object_type',      label: 'Tipo',          render: r => r.object_type ? <Badge variant="outline" className="text-xs">{r.object_type}</Badge> : '—' },
    { key: 'status',           label: 'Status',        render: r => r.status || r.effective_status || '—' },
    { key: 'last_updated',     label: 'Atualizado',    render: r => r.last_updated ? new Date(r.last_updated).toLocaleDateString('pt-BR') : '—' },
  ],
  jobs: [
    { key: 'created_date', label: 'Criado em', render: r => r.created_date ? new Date(r.created_date).toLocaleString('pt-BR') : '—' },
    { key: 'status',       label: 'Status',    render: r => {
      const colors = { queued: 'bg-yellow-100 text-yellow-700', running: 'bg-blue-100 text-blue-700', done: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' };
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[r.status] || 'bg-gray-100 text-gray-500'}`}>{r.status}</span>;
    }},
    { key: 'job_type',     label: 'Tipo',       render: r => r.job_type || '—' },
    { key: 'date_from',    label: 'De',         render: r => fmtDate(r.date_from) },
    { key: 'date_to',      label: 'Até',        render: r => fmtDate(r.date_to) },
    { key: 'progress',     label: 'Progresso',  render: r => r.progress || 0 },
    { key: 'rows_written', label: 'Rows',       render: r => fmtNum(r.rows_written) },
    { key: 'error_message',label: 'Erro',       render: r => r.error_message ? <span className="text-red-500 text-xs">{r.error_message.substring(0, 60)}</span> : '—' },
    { key: 'job_key',      label: 'Job Key',    render: r => <span className="font-mono text-xs text-gray-400">{r.job_key}</span> },
  ],
};

function exportCSV(data, columns, filename) {
  const header = columns.map(c => c.key).join(',');
  const rows = data.map(r =>
    columns.map(c => {
      const val = r[c.key];
      if (typeof val === 'object') return '';
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataManagement() {
  const queryClient = useQueryClient();

  const [selectedUnit, setSelectedUnit] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState('base');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedTabsForBulk, setSelectedTabsForBulk] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null); // {progress, total, currentLabel}
  const [deletingOldCreatives, setDeletingOldCreatives] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const unit = units.find(u => u.id === selectedUnit);
  const accountId = unit?.account_id || '';

  const buildFilters = (tab) => {
    if (tab.id === 'jobs') {
      const f = {};
      if (accountId) f.account_id = accountId;
      if (dateFrom) f.date_from = { $gte: dateFrom };
      if (dateTo) f.date_to = { ...(f.date_to || {}), $lte: dateTo };
      return f;
    }
    const f = { account_id: accountId };
    if (tab.hasDate) {
      if (dateFrom) f.date = { $gte: dateFrom };
      if (dateTo) f.date = { ...(f.date || {}), $lte: dateTo };
    } else {
      f.unit_id = selectedUnit;
    }
    return f;
  };

  const tabDef = TABS.find(t => t.id === activeTab);

  const { data: tabData = [], isLoading, refetch } = useQuery({
    queryKey: ['dm', activeTab, selectedUnit, dateFrom, dateTo],
    queryFn: () => {
      if (!selectedUnit) return Promise.resolve([]);
      const entity = base44.entities[tabDef.entity];
      const filters = buildFilters(tabDef);
      if (!filters.account_id && !filters.unit_id) return Promise.resolve([]);
      return entity.filter(filters, '-created_date', 2000);
    },
    enabled: !!selectedUnit,
  });

  const cols = COLUMNS[activeTab] || [];
  const effectivePageSize = pageSize === 'Todos' ? tabData.length : pageSize;
  
  // Apply sorting
  const sortedData = useMemo(() => {
    let sorted = [...tabData];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === 'string') {
          return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    return sorted;
  }, [tabData, sortConfig]);
  
  const totalPages = effectivePageSize > 0 ? Math.ceil(sortedData.length / effectivePageSize) : 1;
  const pageData = sortedData.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  // Totals row (numeric columns only)
  const numericKeys = cols.filter(c => {
    const sample = tabData.find(r => r[c.key] !== undefined && r[c.key] !== null);
    return sample && typeof sample[c.key] === 'number';
  }).map(c => c.key);

  const totals = numericKeys.reduce((acc, key) => {
    acc[key] = sortedData.reduce((s, r) => s + (r[key] || 0), 0);
    return acc;
  }, {});

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleTabChange = (id) => {
    setActiveTab(id);
    setCurrentPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const handleDeleteAll = async () => {
    if (!selectedUnit || tabData.length === 0) return;
    setConfirmDelete(false);
    setDeleting(true);
    setBulkDeleting(true);
    setBulkProgress({ tableIndex: 0, totalTables: 1, tableLabel: tabDef?.label || activeTab, tableDone: 0, tableTotal: 0 });

    try {
      const response = await base44.functions.invoke('purgeUnitData', {
        unit_id: selectedUnit,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        tables: [activeTab],
      });
      const results = response.data?.results || {};
      const count = results[activeTab]?.deleted || 0;
      
      if (count > 0) {
        toast.success(`✅ ${count} registros excluídos`);
      } else {
        toast('Nenhum registro encontrado para excluir.');
      }
      setCurrentPage(1);
      queryClient.invalidateQueries({ queryKey: ['dm'] });
    } catch (err) {
      toast.error(`Erro ao excluir: ${err.message}`);
    } finally {
      setDeleting(false);
      setBulkDeleting(false);
      setBulkProgress(null);
    }
  };

  const handleBulkDelete = async (tabsToDelete) => {
    const tabs = tabsToDelete || selectedTabsForBulk;
    if (!selectedUnit || tabs.length === 0) return;
    setBulkDeleteOpen(false);
    setBulkDeleting(true);
    const tabLabels = TABS.reduce((acc, t) => { acc[t.id] = t.label; return acc; }, {});

    try {
      const response = await base44.functions.invoke('purgeUnitData', {
        unit_id: selectedUnit,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        tables: tabs,
      });
      
      const apiResults = response.data?.results || {};
      let grandTotal = 0;
      const results = {};
      
      tabs.forEach(tableId => {
        const deleted = apiResults[tableId]?.deleted || 0;
        results[tableId] = deleted;
        grandTotal += deleted;
      });

      if (grandTotal > 0) {
        const lines = Object.entries(results).map(([id, n]) => `${tabLabels[id] || id}: ${n}`).join(' | ');
        toast.success(`✅ ${grandTotal} registros excluídos — ${lines}`, { duration: 8000 });
      } else {
        toast('Nenhum registro encontrado para excluir.');
      }

      tabs.forEach(tabId => queryClient.invalidateQueries({ queryKey: ['dm', tabId] }));
      queryClient.invalidateQueries({ queryKey: ['dm'] });
    } catch (err) {
      toast.error(`Erro ao excluir: ${err.message}`);
    } finally {
      setSelectedTabsForBulk([]);
      setBulkDeleting(false);
      setBulkProgress(null);
    }
  };

  const isAnyDeleting = deleting || bulkDeleting;

  const handleDeleteOldCreatives = async () => {
    if (!selectedUnit) return;
    setDeletingOldCreatives(true);
    try {
      const res = await base44.functions.invoke('deleteOldCreatives', { unit_id: selectedUnit });
      if (res.data?.success) {
        toast.success(`✅ ${res.data.deleted} criativos antigos deletados`);
        queryClient.invalidateQueries({ queryKey: ['dm', 'creatives'] });
      } else {
        toast.error(`Erro: ${res.data?.error || 'Falha ao deletar'}`);
      }
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setDeletingOldCreatives(false);
    }
  };

  return (
    <div className="space-y-6">
      {isAnyDeleting && bulkProgress && (
        <DeleteProgressOverlay progress={bulkProgress} />
      )}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestão de Dados</h1>
        <p className="text-gray-500 mt-1 text-sm">Visualize e gerencie os dados das 5 entidades Meta Ads</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Integração</Label>
              <Select defaultValue="meta" disabled>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta Ads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Unidade *</Label>
              <Select value={selectedUnit} onValueChange={v => { setSelectedUnit(v); setCurrentPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {units.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} {u.account_id ? `(${u.account_id})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data início</Label>
              <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label>Data fim</Label>
              <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }} />
            </div>
          </div>
          {unit && (
            <p className="text-xs text-gray-400 mt-2">
              Account ID: <strong>{unit.account_id || '—'}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      {!selectedUnit ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Database className="w-12 h-12 mb-3 text-gray-200" />
          <p>Selecione uma unidade para visualizar os dados</p>
        </div>
      ) : (
        <>
          {/* Tabs + Bulk delete button */}
          <div className="flex items-center justify-between border-b border-gray-200">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-blue-600'
                      : 'text-gray-500 border-transparent hover:text-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-2 mb-1 text-red-600 border-red-200 hover:bg-red-50 whitespace-nowrap"
              onClick={() => { setSelectedTabsForBulk([]); setBulkDeleteOpen(true); }}
            >
              <Layers className="w-4 h-4 mr-1" />
              Excluir múltiplas tabelas
            </Button>
          </div>

          {/* Table card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">
                  {tabDef?.label}
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    {isLoading ? '…' : `${tabData.length} registros`}
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Page size selector */}
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>Mostrar:</span>
                    {PAGE_SIZE_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => { setPageSize(opt); setCurrentPage(1); }}
                        className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${
                          pageSize === opt ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                  {sortedData.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportCSV(sortedData, cols.filter(c => c.key !== 'thumbnail_url'), `${activeTab}_export.csv`)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      CSV
                    </Button>
                  )}
                  {activeTab === 'creatives' && sortedData.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteOldCreatives}
                      disabled={deletingOldCreatives}
                      className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    >
                      {deletingOldCreatives ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
                      Deletar Antigos
                    </Button>
                  )}
                  {sortedData.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir {sortedData.length}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : sortedData.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-amber-300" />
                  <p>Nenhum dado encontrado para os filtros selecionados</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {cols.map(col => (
                            <th key={col.key} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort(col.key)}>
                              <div className="flex items-center gap-1">
                                {col.label}
                                {sortConfig.key === col.key && (
                                  <span className="text-xs">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pageData.map(row => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            {cols.map(col => (
                              <td key={col.key} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                                {col.render(row)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      {/* Sticky totals row */}
                       {numericKeys.length > 0 && (
                         <tfoot className="sticky bottom-0 bg-yellow-50 border-t-2 border-yellow-300">
                           <tr>
                             {cols.map((col, idx) => (
                               <td key={col.key} className="px-3 py-2 text-xs font-bold text-gray-800 whitespace-nowrap">
                                 {numericKeys.includes(col.key)
                                   ? col.render({ [col.key]: totals[col.key] })
                                   : idx === 0 ? 'TOTAL' : ''}
                               </td>
                             ))}
                           </tr>
                         </tfoot>
                       )}
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-500">
                        Página {currentPage} de {totalPages} ({sortedData.length} registros)
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                          ‹ Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                          Próxima ›
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Bulk delete modal */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={v => { if (!isAnyDeleting) setBulkDeleteOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Layers className="w-5 h-5" />
              Excluir Múltiplas Tabelas
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-gray-600">
                <p>Selecione quais tabelas excluir. Os filtros de <strong>período</strong> e <strong>unidade</strong> ativos serão aplicados.</p>
                {(!dateFrom && !dateTo) && (
                  <p className="text-amber-600 font-medium">⚠️ Nenhum período selecionado — serão excluídos TODOS os registros das tabelas selecionadas.</p>
                )}
                {(dateFrom || dateTo) && (
                  <p className="text-gray-500">Período: <strong>{fmtDate(dateFrom) || '—'}</strong> até <strong>{fmtDate(dateTo) || '—'}</strong></p>
                )}
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50 border-b border-gray-100 pb-3 mb-1">
                    <Checkbox
                      checked={selectedTabsForBulk.length === TABS.length}
                      onCheckedChange={checked => {
                        setSelectedTabsForBulk(checked ? TABS.map(t => t.id) : []);
                      }}
                      disabled={bulkDeleting}
                    />
                    <span className="font-semibold text-gray-800">Todas as tabelas</span>
                  </label>
                  {TABS.map(tab => (
                    <label key={tab.id} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
                      <Checkbox
                        checked={selectedTabsForBulk.includes(tab.id)}
                        onCheckedChange={checked => {
                          setSelectedTabsForBulk(prev =>
                            checked ? [...prev, tab.id] : prev.filter(t => t !== tab.id)
                          );
                        }}
                        disabled={bulkDeleting}
                      />
                      <span className="font-medium">{tab.label}</span>
                      {!tab.hasDate && <span className="text-xs text-gray-400">(ignora filtro de data)</span>}
                    </label>
                  ))}
                </div>
                <p className="text-red-600 font-semibold">⚠️ Esta ação não pode ser desfeita!</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={selectedTabsForBulk.length === 0}
              onClick={() => handleBulkDelete(selectedTabsForBulk)}
            >
              Excluir {selectedTabsForBulk.length} tabela(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete single tab */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Você está prestes a excluir <strong>{sortedData.length} registros</strong> da tabela <strong>{tabDef?.label}</strong>.</p>
                <p>Unidade: <strong>{unit?.name}</strong></p>
                {dateFrom && <p>A partir de: <strong>{fmtDate(dateFrom)}</strong></p>}
                {dateTo && <p>Até: <strong>{fmtDate(dateTo)}</strong></p>}
                <p className="text-red-600 font-semibold">⚠️ Esta ação não pode ser desfeita!</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteAll}
            >
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}