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
    unit_id: '',
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

  const selectedUnit = units.find(u => u.id === form.unit_id);

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
    const res = await base44.functions.invoke('cancelMetaIngest', { job_key: job.job_key });
    if (res.data.error) { toast.error(res.data.error); return; }
    toast.success('Job cancelado');
    refetch();
  };

  // Delete a job record
  const handleDelete = async (job) => {
    if (!window.confirm('Excluir registro do job?\n\nOs dados já gravados nas tabelas de insights continuam existindo.')) return;
    const res = await base44.functions.invoke('deleteMetaIngestRun', { job_id: job.id });
    if (res.data.error) { toast.error(res.data.error); return; }
    toast.success('Job excluído');
    refetch();
  };

  // Sync creatives
  const handleSyncCreatives = async () => {
    if (!form.unit_id) { toast.error('Selecione uma unidade'); return; }
    if (!selectedUnit?.account_id) { toast.error('Unidade sem Account ID'); return; }
    if (!selectedUnit?.secret_token) { toast.error('Unidade sem Token'); return; }
    setLoadingCreatives(true);
    const res = await base44.functions.invoke('syncMetaCreatives', {
      account_id: selectedUnit.account_id,
      unit_id: form.unit_id,
      meta_token: selectedUnit.secret_token,
    });
    setLoadingCreatives(false);
    const data = res.data;
    if (data.error) { toast.error(data.error); return; }
    toast.success(`Criativos sincronizados: ${data.creatives_written ?? 0}`);
  };

  // Enqueue a single mode job and return job_key
  const enqueueOne = async (mode) => {
    const account_id = selectedUnit.account_id;
    const job_key = buildJobKey(account_id, form.date_from, form.date_to, mode);

    const res = await base44.functions.invoke('enqueueMetaIngest', {
      account_id,
      unit_id: form.unit_id,
      date_from: form.date_from,
      date_to: form.date_to,
      job_type: 'insights',
      level: 'ad',
      breakdowns: [],
      force: form.force,
      meta_token: selectedUnit.secret_token,
      mode,
      job_key_override: job_key,
    });

    return { job_key, ...res.data };
  };

  // Run single job (fire and wait)
  const runOne = async (job_key) => {
    const res = await base44.functions.invoke('runMetaIngest', {
      job_key,
      meta_token: selectedUnit.secret_token,
      unit_id: form.unit_id,
      mode: INSIGHT_TYPES.find(t => job_key.includes(t.mode))?.mode,
    });
    return res.data;
  };

  // Main: build queue and run sequentially
  const handleRunQueue = async () => {
    if (!form.unit_id) { toast.error('Selecione uma unidade'); return; }
    if (!selectedUnit?.account_id) { toast.error('Unidade sem Account ID'); return; }
    if (!selectedUnit?.secret_token) { toast.error('Unidade sem Token'); return; }
    if (!form.date_from || !form.date_to) { toast.error('Informe o período'); return; }
    if (selectedTypes.length === 0) { toast.error('Selecione ao menos um tipo'); return; }

    const queueItems = selectedTypes.map(typeId => {
      const type = INSIGHT_TYPES.find(t => t.id === typeId);
      return {
        id: `${typeId}-${Date.now()}`,
        typeId,
        mode: type.mode,
        label: type.label,
        status: 'queued',
        job_key: null,
        rows_written: 0,
        error: null,
      };
    });

    setLocalQueue(queueItems);
    setRunningQueue(true);
    runningRef.current = true;

    for (let i = 0; i < queueItems.length; i++) {
      if (!runningRef.current) break;

      const item = queueItems[i];

      // Mark as running
      setLocalQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'running' } : q));

      try {
        // 1. enqueue
        const enqueueResult = await enqueueOne(item.mode);
        const job_key = enqueueResult.job_key;
        setLocalQueue(prev => prev.map((q, idx) => idx === i ? { ...q, job_key } : q));

        // Se job já estava rodando (travado), reportar erro
        if (enqueueResult.status === 'running') {
          setLocalQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'failed', error: 'Job ainda está rodando. Use "Forçar re-execução" para reiniciar.' } : q));
          continue;
        }

        // Se job já estava concluído e não foi forçado, pular com aviso
        if (enqueueResult.status === 'done' && !form.force) {
          setLocalQueue(prev => prev.map((q, idx) => idx === i ? {
            ...q,
            status: 'skipped',
            rows_written: enqueueResult.rows_written || 0,
            error: `Dados já existem (${enqueueResult.rows_written || 0} rows). Use "Forçar re-execução" para atualizar.`
          } : q));
          continue;
        }

        // 2. run (blocking)
        const runResult = await base44.functions.invoke('runMetaIngest', {
          job_key,
          meta_token: selectedUnit.secret_token,
          unit_id: form.unit_id,
          mode: item.mode,
        });

        const data = runResult.data;
        if (data.error) {
          setLocalQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'failed', error: data.error } : q));
        } else {
          setLocalQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'done', rows_written: data.rows_written || 0 } : q));
        }
      } catch (err) {
        setLocalQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'failed', error: err.message } : q));
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
          {/* Unit */}
          <div className="space-y-1">
            <Label>Unidade *</Label>
            <Select value={form.unit_id} onValueChange={v => setForm(f => ({ ...f, unit_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} {u.account_id ? `— ${u.account_id}` : '⚠️ sem account_id'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedUnit && (
              <p className="text-xs text-gray-400 mt-1">
                Token: {selectedUnit.secret_token ? '••••••••' : <span className="text-red-500">não configurado</span>}
              </p>
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
                    <span className="text-xs text-red-500 max-w-xs truncate">{item.error}</span>
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
          const modeLabel = INSIGHT_TYPES.find(t => t.mode === job.mode)?.label || job.mode || '—';

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
                    {(job.status === 'done' || job.status === 'failed') && (
                      <button title="Excluir registro" className="text-gray-300 hover:text-red-500" onClick={() => handleDelete(job)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
                    <p><strong>mode:</strong> {job.mode || 'all'}</p>
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