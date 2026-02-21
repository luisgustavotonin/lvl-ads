import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Play, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronUp, Image, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  queued:  { label: 'Na fila',    color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  running: { label: 'Rodando',    color: 'bg-blue-100 text-blue-700',    icon: Loader2 },
  done:    { label: 'Concluído',  color: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  failed:  { label: 'Erro',       color: 'bg-red-100 text-red-700',      icon: XCircle },
};

const BREAKDOWNS_OPTIONS = [
  { id: 'publisher_platform', label: 'Platform' },
  { id: 'platform_position',  label: 'Position' },
  { id: 'impression_device',  label: 'Device' },
  { id: 'age',                label: 'Idade' },
  { id: 'gender',             label: 'Gênero' },
];

const today = () => new Date().toISOString().split('T')[0];
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

export default function MetaIngest() {
  const [form, setForm] = useState({
    unit_id: '',
    date_from: yesterday(),
    date_to: yesterday(),
    level: 'ad',
    breakdowns: [],
    force: false,
  });
  const [loading, setLoading] = useState(false);
  const [loadingCreatives, setLoadingCreatives] = useState(false);
  const [expandedJob, setExpandedJob] = useState(null);

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: jobs = [], refetch } = useQuery({
    queryKey: ['metaIngestRuns'],
    queryFn: () => base44.entities.MetaIngestRun.list('-created_date', 50),
    refetchInterval: 5000, // polling a cada 5s
  });

  const selectedUnit = units.find(u => u.id === form.unit_id);

  const toggleBreakdown = (id) => {
    setForm(prev => ({
      ...prev,
      breakdowns: prev.breakdowns.includes(id)
        ? prev.breakdowns.filter(b => b !== id)
        : [...prev.breakdowns, id],
    }));
  };

  const handleCancel = async (job) => {
    try {
      const res = await base44.functions.invoke('cancelMetaIngest', { job_key: job.job_key });
      if (res.data.error) { toast.error(res.data.error); return; }
      toast.success('Job cancelado');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSyncCreatives = async () => {
    if (!form.unit_id) { toast.error('Selecione uma unidade'); return; }
    if (!selectedUnit?.account_id) { toast.error('Unidade sem Account ID configurado'); return; }
    if (!selectedUnit?.secret_token) { toast.error('Unidade sem Access Token (secret_token) configurado'); return; }

    setLoadingCreatives(true);
    try {
      const res = await base44.functions.invoke('syncMetaCreatives', {
        account_id: selectedUnit.account_id,
        unit_id: form.unit_id,
        meta_token: selectedUnit.secret_token,
      });
      const data = res.data;
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Criativos sincronizados: ${data.creatives_written} de ${data.ads_found} ads`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingCreatives(false);
    }
  };

  const handleEnqueue = async () => {
    if (!form.unit_id) { toast.error('Selecione uma unidade'); return; }
    if (!selectedUnit?.account_id) { toast.error('Unidade sem Account ID configurado'); return; }
    if (!selectedUnit?.secret_token) { toast.error('Unidade sem Access Token (secret_token) configurado'); return; }
    if (!form.date_from || !form.date_to) { toast.error('Informe o período'); return; }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('enqueueMetaIngest', {
        account_id: selectedUnit.account_id,
        unit_id: form.unit_id,
        date_from: form.date_from,
        date_to: form.date_to,
        job_type: 'insights',
        level: form.level,
        breakdowns: form.breakdowns,
        force: form.force,
        meta_token: selectedUnit.secret_token,
      });

      const data = res.data;
      if (data.error) { toast.error(data.error); return; }

      if (data.status === 'running') toast('⏳ Job já está rodando', { icon: '🔄' });
      else if (data.status === 'done' && !form.force) toast('✅ Job já foi concluído. Use "Forçar re-execução" para repetir.');
      else toast.success(`Job enfileirado! job_key: ${data.job_key}`);

      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
        <Icon className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`} />
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ingestão Meta Ads</h1>
        <p className="text-gray-500 mt-1 text-sm">Enfileira busca de dados diretamente da Meta Ads API</p>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Unidade */}
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

          {/* Período */}
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

          {/* Nível */}
          <div className="space-y-1">
            <Label>Nível</Label>
            <Select value={form.level} onValueChange={v => setForm(f => ({ ...f, level: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ad">Ad</SelectItem>
                <SelectItem value="adset">Adset</SelectItem>
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="account">Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Breakdowns */}
          <div className="space-y-2">
            <Label>Breakdowns (opcional)</Label>
            <div className="flex flex-wrap gap-4">
              {BREAKDOWNS_OPTIONS.map(b => (
                <div key={b.id} className="flex items-center gap-2">
                  <Checkbox
                    id={b.id}
                    checked={form.breakdowns.includes(b.id)}
                    onCheckedChange={() => toggleBreakdown(b.id)}
                  />
                  <label htmlFor={b.id} className="text-sm cursor-pointer">{b.label}</label>
                </div>
              ))}
            </div>
          </div>

          {/* Forçar re-execução */}
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

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleEnqueue} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enfileirando...</> : <><Play className="w-4 h-4 mr-2" />Enfileirar Insights</>}
            </Button>
            <Button onClick={handleSyncCreatives} disabled={loadingCreatives} variant="outline">
              {loadingCreatives ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sincronizando...</> : <><Image className="w-4 h-4 mr-2" />Sincronizar Criativos</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Jobs recentes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Jobs Recentes</h2>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1 text-gray-500">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>

        {jobs.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum job ainda</p>
        )}

        {jobs.map(job => {
          const isExpanded = expandedJob === job.id;
          const unitName = units.find(u => u.account_id === job.account_id)?.name || job.account_id;
          return (
            <Card key={job.id} className="border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={job.status} />
                      <span className="text-sm font-medium text-gray-800 truncate">{unitName}</span>
                      <span className="text-xs text-gray-400">{job.date_from} → {job.date_to}</span>
                      <Badge variant="outline" className="text-xs">{job.level}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span>Fase: <strong>{job.progress || 0}/4</strong></span>
                      <span>Rows: <strong>{job.rows_written || 0}</strong></span>
                      {job.error_message && <span className="text-red-500 truncate max-w-xs">{job.error_message}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(job.status === 'queued' || job.status === 'running') && (
                      <button
                        title="Cancelar job"
                        className="text-red-400 hover:text-red-600"
                        onClick={() => handleCancel(job)}
                      >
                        <StopCircle className="w-4 h-4" />
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
                  <div className="mt-3 pt-3 border-t text-xs text-gray-500 space-y-1 font-mono break-all">
                    <p><strong>job_key:</strong> {job.job_key}</p>
                    <p><strong>account_id:</strong> {job.account_id}</p>
                    <p><strong>breakdowns:</strong> {(job.breakdowns || []).join(', ') || '—'}</p>
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