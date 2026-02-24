import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Play, Clock, CheckCircle2, XCircle, Loader2, Edit2, ChevronDown, ChevronUp, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';

const MODES = [
  { id: 'base',        label: 'Insights (Puro)' },
  { id: 'platform',    label: 'Plataforma' },
  { id: 'device',      label: 'Dispositivos' },
  { id: 'demographic', label: 'Idade e Gênero' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

const DATE_MODES = [
  { value: 'yesterday',          label: 'Ontem' },
  { value: 'today',              label: 'Hoje (até agora)' },
  { value: 'yesterday_and_today', label: 'Ontem + Hoje' },
];

const STATUS_ICON = {
  success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  error:   <XCircle className="w-4 h-4 text-red-500" />,
  running: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
};

function emptyForm() {
  return {
    name: '',
    unit_ids: [],
    modes: ['base'],
    schedule_times: ['08:00'],
    date_mode: 'yesterday',
    force: false,
    is_active: true,
    sync_creatives: false,
    creatives_day_of_week: 1, // Segunda por padrão
  };
}

export default function IngestSchedules() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);
  const [newTime, setNewTime] = useState('');

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: schedules = [], refetch } = useQuery({
    queryKey: ['ingestSchedules'],
    queryFn: () => base44.entities.IngestSchedule.list('-created_date'),
    refetchInterval: 10000,
  });

  const openNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (s) => {
    setForm({
      name: s.name,
      unit_ids: s.unit_ids || [],
      modes: s.modes || ['base'],
      schedule_times: s.schedule_times || ['08:00'],
      date_mode: s.date_mode || 'yesterday',
      force: s.force || false,
      is_active: s.is_active !== false,
      sync_creatives: s.sync_creatives || false,
      creatives_day_of_week: s.creatives_day_of_week ?? 1,
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const toggleUnit = (uid) => {
    setForm(f => ({
      ...f,
      unit_ids: f.unit_ids.includes(uid)
        ? f.unit_ids.filter(id => id !== uid)
        : [...f.unit_ids, uid]
    }));
  };

  const toggleMode = (mid) => {
    setForm(f => ({
      ...f,
      modes: f.modes.includes(mid)
        ? f.modes.filter(m => m !== mid)
        : [...f.modes, mid]
    }));
  };

  const addTime = () => {
    const t = newTime.trim();
    if (!t || form.schedule_times.includes(t)) return;
    setForm(f => ({ ...f, schedule_times: [...f.schedule_times, t].sort() }));
    setNewTime('');
  };

  const removeTime = (t) => {
    setForm(f => ({ ...f, schedule_times: f.schedule_times.filter(x => x !== t) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return; }
    if (!form.unit_ids.length) { toast.error('Selecione ao menos uma unidade'); return; }
    if (!form.modes.length) { toast.error('Selecione ao menos um tipo de dado'); return; }
    if (!form.schedule_times.length) { toast.error('Adicione ao menos um horário'); return; }

    setSaving(true);
    try {
      if (editingId) {
        await base44.entities.IngestSchedule.update(editingId, form);
        toast.success('Agendamento atualizado');
      } else {
        await base44.entities.IngestSchedule.create(form);
        toast.success('Agendamento criado');
      }
      setShowForm(false);
      refetch();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este agendamento?')) return;
    await base44.entities.IngestSchedule.delete(id);
    toast.success('Excluído');
    refetch();
  };

  const handleToggleActive = async (s) => {
    await base44.entities.IngestSchedule.update(s.id, { is_active: !s.is_active });
    queryClient.invalidateQueries({ queryKey: ['ingestSchedules'] });
  };

  const handleRunNow = async (s) => {
    setRunningId(s.id);
    try {
      const res = await base44.functions.invoke('runScheduledIngest', { schedule_id: s.id, force_all: true });
      const data = res.data;
      if (data?.ok) {
        const total = data.results?.[0]?.jobs?.reduce((a, j) => a + (j.rows || 0), 0) || 0;
        toast.success(`Executado! ${total} rows processados`);
      } else {
        toast.error('Erro ao executar');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRunningId(null);
      refetch();
    }
  };

  const unitName = (uid) => units.find(u => u.id === uid)?.name || uid;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agendamentos de Ingestão</h1>
          <p className="text-sm text-gray-500 mt-1">Horários no fuso de Brasília (UTC-3)</p>
        </div>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Novo Agendamento
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-blue-200 shadow-md">
          <CardHeader>
            <CardTitle className="text-base">{editingId ? 'Editar Agendamento' : 'Novo Agendamento'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Name */}
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Relatório Diário — Grupo A"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Units */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Unidades *</Label>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => setForm(f => ({ ...f, unit_ids: units.map(u => u.id) }))} className="text-blue-600 hover:underline">Todas</button>
                  <button onClick={() => setForm(f => ({ ...f, unit_ids: [] }))} className="text-gray-400 hover:underline">Limpar</button>
                </div>
              </div>
              <div className="border rounded-lg divide-y max-h-44 overflow-y-auto">
                {units.map(u => (
                  <label key={u.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${form.unit_ids.includes(u.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <Checkbox checked={form.unit_ids.includes(u.id)} onCheckedChange={() => toggleUnit(u.id)} />
                    <span className="text-sm font-medium flex-1">{u.name}</span>
                    {!u.account_id && <span className="text-xs text-red-400">sem account_id</span>}
                    {!u.secret_token && <span className="text-xs text-red-400">sem token</span>}
                  </label>
                ))}
              </div>
              {form.unit_ids.length > 0 && <p className="text-xs text-blue-600">{form.unit_ids.length} unidade(s)</p>}
            </div>

            {/* Modes */}
            <div className="space-y-2">
              <Label>Tipos de Dado *</Label>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map(m => (
                  <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${form.modes.includes(m.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                    <Checkbox checked={form.modes.includes(m.id)} onCheckedChange={() => toggleMode(m.id)} />
                    <span className="text-sm">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Period */}
            <div className="space-y-1">
              <Label>Período a buscar</Label>
              <Select value={form.date_mode} onValueChange={v => setForm(f => ({ ...f, date_mode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATE_MODES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Schedule times */}
            <div className="space-y-2">
              <Label>Horários de execução (Brasília) *</Label>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="w-36"
                />
                <Button type="button" variant="outline" onClick={addTime}>Adicionar</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.schedule_times.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3" />
                    {t}
                    <button onClick={() => removeTime(t)} className="ml-1 hover:text-red-600">×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Creatives */}
            <div className="space-y-2 border rounded-lg p-3 bg-purple-50 border-purple-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.sync_creatives} onCheckedChange={v => setForm(f => ({ ...f, sync_creatives: !!v }))} />
                <span className="text-sm font-medium text-purple-800 flex items-center gap-1">
                  <Image className="w-3.5 h-3.5" /> Sincronizar Criativos
                </span>
              </label>
              {form.sync_creatives && (
                <div className="ml-6 space-y-1">
                  <Label className="text-xs text-purple-700">Dia da semana para sincronizar</Label>
                  <Select
                    value={String(form.creatives_day_of_week ?? '')}
                    onValueChange={v => setForm(f => ({ ...f, creatives_day_of_week: v === '' ? null : Number(v) }))}
                  >
                    <SelectTrigger className="w-40 h-8 text-sm">
                      <SelectValue placeholder="Sempre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Sempre que rodar</SelectItem>
                      {DAYS_OF_WEEK.map(d => (
                        <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-purple-600">Criativos serão sincronizados somente neste dia da semana.</p>
                </div>
              )}
            </div>

            {/* Force */}
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.force} onCheckedChange={v => setForm(f => ({ ...f, force: !!v }))} />
              <span className="text-sm text-gray-600">Forçar re-execução (mesmo se dados já existirem)</span>
            </label>

            {/* Active */}
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <span className="text-sm text-gray-600">Ativo</span>
            </label>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingId ? 'Salvar alterações' : 'Criar agendamento'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {schedules.length === 0 && !showForm && (
        <p className="text-center text-gray-400 py-12">Nenhum agendamento criado ainda</p>
      )}

      {schedules.map(s => {
        const isExpanded = expandedLog === s.id;
        const unitNames = (s.unit_ids || []).map(unitName);
        const modeLabels = (s.modes || []).map(m => MODES.find(x => x.id === m)?.label || m);

        return (
          <Card key={s.id} className={s.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{s.name}</span>
                    <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-xs">
                      {s.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {s.last_status && (
                      <span className="flex items-center gap-1">
                        {STATUS_ICON[s.last_status]}
                        <span className="text-xs text-gray-500">{s.last_status}</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {(s.schedule_times || []).join(', ')} (Brasília)
                    </span>
                    <span>·</span>
                    <span>{DATE_MODES.find(d => d.value === s.date_mode)?.label || 'Ontem'}</span>
                    <span>·</span>
                    <span>{unitNames.join(', ')}</span>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-1">
                    {modeLabels.map(l => (
                      <span key={l} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{l}</span>
                    ))}
                  </div>

                  {s.last_run && (
                    <p className="text-xs text-gray-400 mt-1">
                      Última execução: {new Date(s.last_run).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={s.is_active} onCheckedChange={() => handleToggleActive(s)} />
                  <button title="Executar agora" className="text-green-500 hover:text-green-700" onClick={() => handleRunNow(s)} disabled={runningId === s.id}>
                    {runningId === s.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Play className="w-4 h-4" />
                    }
                  </button>
                  <button title="Editar" className="text-gray-400 hover:text-blue-500" onClick={() => openEdit(s)}>
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button title="Excluir" className="text-gray-300 hover:text-red-500" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {s.last_log && (
                    <button className="text-gray-400 hover:text-gray-600" onClick={() => setExpandedLog(isExpanded ? null : s.id)}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && s.last_log && (
                <div className="mt-3 pt-3 border-t bg-gray-50 rounded p-3">
                  <p className="text-xs font-mono text-gray-600 whitespace-pre-wrap">{s.last_log}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}