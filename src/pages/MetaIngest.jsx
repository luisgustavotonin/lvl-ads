import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Play, RefreshCw, CheckCircle2, XCircle, Clock, Loader2,
  ChevronDown, ChevronUp, Image, StopCircle, Trash2, ListOrdered, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  queued:  { label: 'Na fila',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  running: { label: 'Rodando',    color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Loader2 },
  done:    { label: 'Concluído',  color: 'bg-green-100 text-green-700 border-green-200',    icon: CheckCircle2 },
  failed:  { label: 'Erro',       color: 'bg-red-100 text-red-700 border-red-200',          icon: XCircle },
  skipped: { label: 'Já existe',  color: 'bg-gray-100 text-gray-500 border-gray-200',       icon: CheckCircle2 },
};

const INSIGHT_TYPES = [
  { id: 'base',        label: 'Insights (Puro)',   desc: 'Dados gerais por anúncio/dia',              mode: 'base' },
  { id: 'platform',    label: 'Plataforma',         desc: 'publisher_platform + platform_position',    mode: 'platform' },
  { id: 'device',      label: 'Dispositivos',       desc: 'impression_device',                         mode: 'device' },
  { id: 'demographic', label: 'Idade e Gênero',     desc: 'age + gender',                              mode: 'demographic' },
];

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function buildJobKey(accountId, dateFrom, dateTo, mode) {
  return djb2(`${accountId}:${dateFrom}:${dateTo}:${mode}`);
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

export default function MetaIngest() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    unit_ids: [], // multi-unit support
    date_from: yesterday(),
    date_to: yesterday(),
    force: false,
  });

  // selected types — single by default, multi with "select all"
  const [selectedTypes, setSelectedTypes] = useState(['base']);
  const [multiMode, setMultiMode] = useState(false);

  // local UI queue (for display before real jobs exist in DB)
  const [localQueue, setLocalQueue] = useState([]); // [{id, mode, label, status, rows_written, error}]
  const [runningQueue, setRunningQueue] = useState(false);
  const [loadingCreatives, setLoadingCreatives] = useState(false);
  const [creativesHistory, setCreativesHistory] = useState([]); // [{ts, unit, status, rows_written, error}]
  const [expandedJob, setExpandedJob] = useState(null);

  const runningRef = useRef(false);

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: jobs = [], refetch } = useQuery({
    queryKey: ['metaIngestRuns'],
    queryFn: () => base44.entities.MetaIngestRun.list('-created_date', 15),
    refetchInterval: 4000,
  });

  const selectedUnit = units.find(u => u.id === form.unit_ids[0]); // for creatives (single)

  // Type selection logic
  const toggleType = (id) => {
    if (!multiMode) {
      setSelectedTypes([id]);
    } else {
      setSelectedTypes(prev =>
        prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
      );
    }
  };

  const toggleMultiMode = (checked) => {
    setMultiMode(checked);
    if (!checked) {
      // revert to single — keep first selected
      setSelectedTypes(prev => prev.length ? [prev[0]] : ['base']);
    }
  };

  const selectAll = () => setSelectedTypes(INSIGHT_TYPES.map(t => t.id));

  // Cancel a job
  const handleCancel = async (job) => {
    try {
      const res = await base44.functions.invoke('cancelMetaIngest', { job_key: job.job_key });
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success('Job cancelado');
      refetch();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Erro ao cancelar job');
    }
  };

  // Delete a job record
  const handleDelete = async (job) => {
    if (!window.confirm('Excluir registro do job?\n\nOs dados já gravados nas tabelas de insights continuam existindo.')) return;
    try {
      const res = await base44.functions.invoke('deleteMetaIngestRun', { job_id: job.id });
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success('Job excluído');
      refetch();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Erro ao excluir job');
    }
  };

  // Sync creatives
  const handleSyncCreatives = async () => {
    if (!form.unit_ids.length) { toast.error('Selecione uma unidade'); return; }
    if (!selectedUnit?.account_id) { toast.error('Unidade sem Account ID cadastrado'); return; }
    if (!selectedUnit?.secret_token) { toast.error('Unidade sem Token cadastrado'); return; }

    const entry = {
      ts: new Date().toISOString(),
      unit: selectedUnit.name,
      account_id: selectedUnit.account_id,
      status: 'running',
      rows_written: null,
      error: null,
    };
    setCreativesHistory(prev => [entry, ...prev]);
    setLoadingCreatives(true);

    try {
      const res = await base44.functions.invoke('syncMetaCreatives', {
        account_id: selectedUnit.account_id,
        unit_id: form.unit_id,
        meta_token: selectedUnit.secret_token,
      });
      const data = res.data;
      if (data?.error) {
        setCreativesHistory(prev => prev.map((e, i) => i === 0 ? { ...e, status: 'error', error: data.error } : e));
        toast.error(`Erro: ${data.error}`);
      } else {
        setCreativesHistory(prev => prev.map((e, i) => i === 0 ? { ...e, status: 'done', rows_written: data.rows_written ?? 0 } : e));
        toast.success(`Criativos sincronizados: ${data.rows_written ?? 0} registros`);
      }
    } catch (err) {
      const msg = err?.message || String(err);
      setCreativesHistory(prev => prev.map((e, i) => i === 0 ? { ...e, status: 'error', error: msg } : e));
      toast.error(`Erro: ${msg}`);
    } finally {
      setLoadingCreatives(false);
    }
  };

  // Enqueue and run a single unit+mode job
  const enqueueAndRun = async (unit, mode, queueId, updateItem) => {
    const account_id = unit.account_id;
    const job_key = buildJobKey(account_id, form.date_from, form.date_to, mode);

    const enqRes = await base44.functions.invoke('enqueueMetaIngest', {
      account_id,
      unit_id: unit.id,
      date_from: form.date_from,
      date_to: form.date_to,
      job_type: 'insights',
      level: 'ad',
      breakdowns: [],
      force: form.force,
      meta_token: unit.secret_token,
      mode,
      job_key_override: job_key,
    });

    const enqData = { job_key, ...enqRes.data };

    if (enqData.status === 'running') {
      updateItem(queueId, { status: 'failed', error: 'Job ainda está rodando. Use "Forçar re-execução".' });
      return false;
    }

    if (enqData.status === 'done' && !form.force) {
      updateItem(queueId, { status: 'skipped', rows_written: enqData.rows_written || 0, error: `Dados já existem. Use "Forçar re-execução".` });
      return true;
    }

    updateItem(queueId, { job_key });

    const runResult = await base44.functions.invoke('runMetaIngest', {
      job_key,
      meta_token: unit.secret_token,
      unit_id: unit.id,
      mode,
      force: form.force,
    });

    const data = runResult.data;
    if (data.error) {
      updateItem(queueId, { status: 'failed', error: data.error });
      return false;
    }

    updateItem(queueId, { status: 'done', rows_written: data.rows_written || 0 });
    return true;
  };

  // Main: build queue (units x types) and run sequentially
  const handleRunQueue = async () => {
    if (!form.unit_ids.length) { toast.error('Selecione ao menos uma unidade'); return; }
    if (!form.date_from || !form.date_to) { toast.error('Informe o período'); return; }
    if (selectedTypes.length === 0) { toast.error('Selecione ao menos um tipo'); return; }

    const selectedUnits = units.filter(u => form.unit_ids.includes(u.id));
    const invalidUnits = selectedUnits.filter(u => !u.account_id || !u.secret_token);
    if (invalidUnits.length) {
      toast.error(`Unidades sem configuração: ${invalidUnits.map(u => u.name).join(', ')}`);
      return;
    }

    // Build flat queue: unit x type
    const queueItems = [];
    for (const unit of selectedUnits) {
      for (const typeId of selectedTypes) {
        const type = INSIGHT_TYPES.find(t => t.id === typeId);
        queueItems.push({
          id: `${unit.id}-${typeId}-${Date.now()}`,
          unitId: unit.id,
          unitName: unit.name,
          typeId,
          mode: type.mode,
          label: `${unit.name} — ${type.label}`,
          status: 'queued',
          job_key: null,
          rows_written: 0,
          error: null,
        });
      }
    }

    setLocalQueue(queueItems);
    setRunningQueue(true);
    runningRef.current = true;

    const updateItem = (id, patch) => {
      setLocalQueue(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
    };

    for (let i = 0; i < queueItems.length; i++) {
      if (!runningRef.current) break;

      const item = queueItems[i];
      const unit = units.find(u => u.id === item.unitId);

      updateItem(item.id, { status: 'running' });

      try {
        const ok = await enqueueAndRun(unit, item.mode, item.id, updateItem);
        if (!ok) {
          // stop on error
          runningRef.current = false;
          setRunningQueue(false);
          setLocalQueue(prev => prev.map((q, idx) => idx > i && q.status === 'queued'
            ? { ...q, status: 'skipped', error: 'Parado por erro anterior' }
            : q));
          toast.error(`Erro em "${item.label}". Fila interrompida.`);
          refetch();
          return;
        }
      } catch (err) {
        updateItem(item.id, { status: 'failed', error: err.message });
        runningRef.current = false;
        setRunningQueue(false);
        setLocalQueue(prev => prev.map((q, idx) => idx > i && q.status === 'queued'
          ? { ...q, status: 'skipped', error: 'Parado por erro anterior' }
          : q));
        toast.error(`Erro em "${item.label}". Fila interrompida.`);
        refetch();
        return;
      }

      refetch();
    }

    setRunningQueue(false);
    runningRef.current = false;
    toast.success('Fila concluída!');
    queryClient.invalidateQueries({ queryKey: ['metaIngestRuns'] });
  };

  const handleStopQueue = () => {
    runningRef.current = false;
    setRunningQueue(false);
    setLocalQueue(prev => prev.map(q => q.status === 'queued' ? { ...q, status: 'skipped' } : q));
    toast('Fila interrompida', { icon: '⏹' });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ingestão Meta Ads</h1>
        <p className="text-gray-500 mt-1 text-sm">Busca dados diretamente da Meta Ads API por tipo de breakdown</p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            Configurar Job
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Unit — multi-select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Unidade(s) *</Label>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setForm(f => ({ ...f, unit_ids: units.map(u => u.id) }))}
                  className="text-blue-600 hover:underline"
                >Todas</button>
                <button
                  onClick={() => setForm(f => ({ ...f, unit_ids: [] }))}
                  className="text-gray-400 hover:underline"
                >Limpar</button>
              </div>
            </div>
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {units.map(u => {
                const selected = form.unit_ids.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={checked => {
                        setForm(f => ({
                          ...f,
                          unit_ids: checked
                            ? [...f.unit_ids, u.id]
                            : f.unit_ids.filter(id => id !== u.id)
                        }));
                      }}
                    />
                    <span className={`text-sm font-medium ${selected ? 'text-blue-800' : 'text-gray-800'}`}>{u.name}</span>
                    {u.account_id
                      ? <span className="text-xs text-gray-400 ml-auto">{u.account_id}</span>
                      : <span className="text-xs text-red-400 ml-auto">⚠️ sem account_id</span>
                    }
                    {!u.secret_token && <span className="text-xs text-red-400">sem token</span>}
                  </label>
                );
              })}
            </div>
            {form.unit_ids.length > 0 && (
              <p className="text-xs text-blue-600">{form.unit_ids.length} unidade(s) selecionada(s)</p>
            )}
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data início *</Label>
              <Input type="date" value={form.date_from} onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Data fim *</Label>
              <Input type="date" value={form.date_to} onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))} />
            </div>
          </div>

          {/* Type selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Tipo de Dado *</Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <Checkbox
                    checked={multiMode}
                    onCheckedChange={toggleMultiMode}
                  />
                  Selecionar múltiplos
                </label>
                {multiMode && (
                  <button
                    onClick={selectAll}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Selecionar todos
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {INSIGHT_TYPES.map(type => {
                const selected = selectedTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    onClick={() => toggleType(type.id)}
                    className={`text-left p-3 rounded-lg border-2 transition-colors ${
                      selected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className={`text-sm font-semibold ${selected ? 'text-blue-700' : 'text-gray-800'}`}>
                      {type.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{type.desc}</div>
                  </button>
                );
              })}
            </div>
            {multiMode && selectedTypes.length > 1 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <ListOrdered className="w-3 h-3" />
                {selectedTypes.length} tipos serão executados em sequência (1 por vez)
              </p>
            )}
          </div>

          {/* Force re-run */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="force"
              checked={form.force}
              onCheckedChange={v => setForm(f => ({ ...f, force: !!v }))}
            />
            <label htmlFor="force" className="text-sm cursor-pointer text-gray-600">
              Forçar re-execução (mesmo se job já existir como done)
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {runningQueue ? (
              <Button onClick={handleStopQueue} variant="destructive">
                <StopCircle className="w-4 h-4 mr-2" />
                Parar Fila
              </Button>
            ) : (
              <Button
                onClick={handleRunQueue}
                disabled={!form.unit_id || selectedTypes.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-2" />
                {selectedTypes.length > 1 ? `Executar Fila (${selectedTypes.length})` : 'Executar'}
              </Button>
            )}
            <Button onClick={handleSyncCreatives} disabled={loadingCreatives} variant="outline">
              {loadingCreatives
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sincronizando...</>
                : <><Image className="w-4 h-4 mr-2" />Sincronizar Criativos</>
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Creatives Sync History */}
      {creativesHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="w-4 h-4 text-pink-500" />
              Histórico: Sincronização de Criativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {creativesHistory.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0 flex-wrap">
                  <span className="text-xs text-gray-400">{new Date(entry.ts).toLocaleString('pt-BR')}</span>
                  <span className="text-sm font-medium text-gray-700 flex-1">{entry.unit} ({entry.account_id})</span>
                  {entry.status === 'running' && <StatusBadge status="running" />}
                  {entry.status === 'done' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-700 border-green-200">
                      <CheckCircle2 className="w-3 h-3" /> {entry.rows_written} criativos
                    </span>
                  )}
                  {entry.status === 'error' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-red-100 text-red-700 border-red-200 max-w-xs truncate">
                      <XCircle className="w-3 h-3" /> {entry.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Local Queue Status */}
      {localQueue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-blue-500" />
              Fila em Execução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {localQueue.map((item, i) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                  <StatusBadge status={item.status} />
                  <span className="text-sm font-medium text-gray-800 flex-1">{item.label}</span>
                  {item.rows_written > 0 && (
                    <span className="text-xs text-gray-500">{item.rows_written} rows</span>
                  )}
                  {item.error && (
                    <span className={`text-xs max-w-xs truncate ${item.status === 'skipped' ? 'text-gray-400' : 'text-red-500'}`}>{item.error}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent jobs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Histórico Recente</h2>
            <p className="text-xs text-gray-400">Últimos 15 jobs · Histórico completo em <strong>Gestão de Dados → Jobs</strong></p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1 text-gray-500">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        {jobs.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum job ainda</p>
        )}

        {jobs.map(job => {
          const isExpanded = expandedJob === job.id;
          const unitName = units.find(u => u.account_id === job.account_id)?.name || job.account_id;
          const modeLabel = INSIGHT_TYPES.find(t => t.mode === job.mode)?.label || (job.mode === 'all' ? 'Todos' : job.mode) || '—';

          return (
            <Card key={job.id} className="border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={job.status} />
                      <span className="text-sm font-medium text-gray-800 truncate">{unitName}</span>
                      <Badge variant="outline" className="text-xs">{modeLabel}</Badge>
                      <span className="text-xs text-gray-400">{job.date_from} → {job.date_to}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span>Progresso: <strong>{job.progress || 0}</strong></span>
                      <span>Rows: <strong>{job.rows_written || 0}</strong></span>
                      {job.error_message && (
                        <span className="text-red-500 truncate max-w-xs">{job.error_message}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(job.status === 'queued' || job.status === 'running') && (
                      <button title="Cancelar" className="text-red-400 hover:text-red-600" onClick={() => handleCancel(job)}>
                        <StopCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button title="Excluir registro" className="text-gray-300 hover:text-red-500" onClick={() => handleDelete(job)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t text-xs text-gray-500 space-y-1 font-mono break-all bg-gray-50 rounded p-2">
                    <p><strong>job_key:</strong> {job.job_key}</p>
                    <p><strong>account_id:</strong> {job.account_id}</p>
                    <p><strong>tipo:</strong> {modeLabel}</p>
                    <p><strong>período:</strong> {job.date_from} → {job.date_to}</p>
                    <p><strong>status:</strong> {job.status}</p>
                    {job.error_message && <p className="text-red-500"><strong>erro:</strong> {job.error_message}</p>}
                    <p><strong>criado em:</strong> {new Date(job.created_date).toLocaleString('pt-BR')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}