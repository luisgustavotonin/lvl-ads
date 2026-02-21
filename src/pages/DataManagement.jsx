import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  RefreshCw, Loader2, Database, AlertTriangle, Download, Trash2, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

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
    { key: 'messaging_conversations_started', label: 'Conv. Iniciadas', render: r => fmtNum(r.messaging_conversations_started) },
    { key: 'purchases',   label: 'Compras',     render: r => fmtNum(r.purchases) },
    { key: 'purchase_value', label: 'Valor Compras', render: r => fmtCur(r.purchase_value) },
  ],
  platform: [
    { key: 'date',              label: 'Data',             render: r => fmtDate(r.date) },
    { key: 'publisher_platform',label: 'Plataforma',       render: r => r.publisher_platform || '—' },
    { key: 'platform_position', label: 'Posição',          render: r => r.platform_position || '—' },
    { key: 'ad_id',             label: 'Ad ID',            render: r => r.ad_id || '—' },
    { key: 'spend',             label: 'Gasto',            render: r => fmtCur(r.spend) },
    { key: 'impressions',       label: 'Impressões',       render: r => fmtNum(r.impressions) },
    { key: 'link_clicks',       label: 'Cliques Link',     render: r => fmtNum(r.link_clicks) },
    { key: 'ctr_link',          label: 'CTR Link',         render: r => fmtPct(r.ctr_link) },
    { key: 'cpm',               label: 'CPM',              render: r => fmtCur(r.cpm) },
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
    { key: 'name',             label: 'Nome',          render: r => r.name || '—' },
    { key: 'ad_id',            label: 'Ad ID',         render: r => r.ad_id || '—' },
    { key: 'object_type',      label: 'Tipo',          render: r => r.object_type ? <Badge variant="outline" className="text-xs">{r.object_type}</Badge> : '—' },
    { key: 'call_to_action_type', label: 'CTA',        render: r => r.call_to_action_type || '—' },
    { key: 'title',            label: 'Título',        render: r => r.title || '—' },
    { key: 'body',             label: 'Texto',         render: r => r.body ? r.body.substring(0, 60) + '…' : '—' },
    { key: 'last_updated',     label: 'Atualizado',    render: r => r.last_updated ? new Date(r.last_updated).toLocaleDateString('pt-BR') : '—' },
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
  const [confirmDelete, setConfirmDelete] = useState(false); // 'tab' | 'multi' | false
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedTabsForBulk, setSelectedTabsForBulk] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null); // {current, total, tabLabel}

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const unit = units.find(u => u.id === selectedUnit);
  const accountId = unit?.account_id || '';

  const buildFilters = (tab) => {
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
  const totalPages = Math.ceil(tabData.length / PAGE_SIZE);
  const pageData = tabData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setCurrentPage(1);
  };

  const handleDeleteAll = async () => {
    if (!selectedUnit || tabData.length === 0) return;
    setDeleting(true);
    const entity = base44.entities[tabDef.entity];
    const BATCH = 30;
    for (let i = 0; i < tabData.length; i += BATCH) {
      await Promise.all(tabData.slice(i, i + BATCH).map(r => entity.delete(r.id)));
    }
    setDeleting(false);
    setConfirmDelete(false);
    toast.success(`${tabData.length} registros excluídos`);
    queryClient.invalidateQueries({ queryKey: ['dm', activeTab] });
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
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
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                  {tabData.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportCSV(tabData, cols.filter(c => c.key !== 'thumbnail_url'), `${activeTab}_export.csv`)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      CSV
                    </Button>
                  )}
                  {tabData.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir {tabData.length}
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
              ) : tabData.length === 0 ? (
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
                            <th key={col.key} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                              {col.label}
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
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-500">
                        Página {currentPage} de {totalPages} ({tabData.length} registros)
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

      {/* Confirm delete dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Você está prestes a excluir <strong>{tabData.length} registros</strong> da tabela <strong>{tabDef?.label}</strong>.</p>
                <p>Unidade: <strong>{unit?.name}</strong></p>
                {dateFrom && <p>A partir de: <strong>{fmtDate(dateFrom)}</strong></p>}
                {dateTo && <p>Até: <strong>{fmtDate(dateTo)}</strong></p>}
                <p className="text-red-600 font-semibold">⚠️ Esta ação não pode ser desfeita!</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={handleDeleteAll}
            >
              {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</> : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}