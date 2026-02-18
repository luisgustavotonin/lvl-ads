import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Settings, Trash2, Plus, Calendar, CheckCircle2,
  AlertCircle, XCircle, ChevronDown, ChevronUp, Building2
} from 'lucide-react';
import ScheduleModal from './ScheduleModal';

function StatusBadge({ status }) {
  if (status === 'connected') return (
    <Badge className="bg-green-50 text-green-700 border-green-200">
      <CheckCircle2 className="w-3 h-3 mr-1" /> Conectado
    </Badge>
  );
  if (status === 'error') return (
    <Badge className="bg-red-50 text-red-700 border-red-200">
      <XCircle className="w-3 h-3 mr-1" /> Erro
    </Badge>
  );
  return (
    <Badge className="bg-gray-50 text-gray-500 border-gray-200">
      <AlertCircle className="w-3 h-3 mr-1" /> Desconectado
    </Badge>
  );
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const WEBHOOK_TYPE_OPTIONS = [
  { value: 'insights', label: 'Insights' },
  { value: 'creatives', label: 'Criativos' },
  { value: 'general', label: 'Geral' },
];

function WebhookConfigForm({ integration, units, onSave, onCancel, isSaving }) {
  // Detecta o tipo atual: se só tem creatives_url = creatives, else insights/general
  const detectType = () => {
    if (integration?.webhook_type) return integration.webhook_type;
    if (integration?.n8n_webhook_creatives_url && !integration?.n8n_webhook_insights_url) return 'creatives';
    return 'insights';
  };

  const getUrlForType = (type) => {
    if (type === 'creatives') return integration?.n8n_webhook_creatives_url || '';
    return integration?.n8n_webhook_insights_url || '';
  };

  const [webhookType, setWebhookType] = useState(detectType());
  const [form, setForm] = useState({
    integration_purpose: integration?.integration_purpose || '',
    webhook_url: getUrlForType(detectType()),
    unit_ids: integration?.unit_ids || (integration?.unit_id ? [integration.unit_id] : []),
    settings: {
      access_token: integration?.settings?.access_token || '',
      n8n_secret_token: integration?.settings?.n8n_secret_token || '',
    }
  });

  const handleTypeChange = (type) => {
    setWebhookType(type);
    // ao trocar o tipo, pré-preenche a URL com o valor já salvo para esse tipo
    setForm(f => ({
      ...f,
      webhook_url: getUrlForType(type),
    }));
  };

  const toggleUnit = (id) => {
    setForm(f => ({
      ...f,
      unit_ids: f.unit_ids.includes(id) ? f.unit_ids.filter(u => u !== id) : [...f.unit_ids, id]
    }));
  };

  const handleSave = () => {
    const saveData = {
      ...form,
      webhook_type: webhookType,
      n8n_webhook_insights_url: webhookType === 'insights' ? form.webhook_url : (integration?.n8n_webhook_insights_url || ''),
      n8n_webhook_creatives_url: webhookType === 'creatives' ? form.webhook_url : (integration?.n8n_webhook_creatives_url || ''),
    };
    delete saveData.webhook_url;
    onSave(saveData);
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1">
        <Label>Nome do Webhook</Label>
        <Input
          value={form.integration_purpose}
          onChange={e => setForm(f => ({ ...f, integration_purpose: e.target.value }))}
          placeholder="Ex: Dados Gerais, Criativos"
        />
      </div>

      <div className="space-y-1">
        <Label>Tipo do Webhook</Label>
        <Select value={webhookType} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEBHOOK_TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-400">Define qual botão de execução este webhook aciona</p>
      </div>

      <div className="space-y-1">
        <Label>URL do Webhook N8n</Label>
        <Input
          value={form.webhook_url}
          onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
          placeholder="https://seu-n8n.com/webhook/..."
        />
      </div>

      <div className="space-y-1">
        <Label>Access Token</Label>
        <Input
          type="password"
          value={form.settings.access_token}
          onChange={e => setForm(f => ({ ...f, settings: { ...f.settings, access_token: e.target.value } }))}
          placeholder="Cole seu access token"
        />
      </div>

      <div className="space-y-2">
        <Label>Unidades associadas</Label>
        <div className="border rounded-lg max-h-40 overflow-y-auto">
          {units.map(unit => (
            <div key={unit.id} className="flex items-center gap-3 p-2 border-b last:border-b-0 hover:bg-gray-50">
              <Checkbox
                id={`unit-cfg-${unit.id}`}
                checked={form.unit_ids.includes(unit.id)}
                onCheckedChange={() => toggleUnit(unit.id)}
              />
              <label htmlFor={`unit-cfg-${unit.id}`} className="flex-1 cursor-pointer text-sm">
                <span className="font-medium">{unit.name}</span>
                {unit.account_id && <span className="text-gray-400 ml-2 text-xs">{unit.account_id}</span>}
              </label>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">{form.unit_ids.length} unidade(s) selecionada(s)</p>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}

export default function PlatformConfigDialog({ open, onClose, platform }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [addingNew, setAddingNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: allIntegrations = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => base44.entities.Integration.list(),
  });

  const webhooks = allIntegrations.filter(
    i => i.platform_id === platform?.platform_id && i.auth_type === 'n8n_webhook'
  );

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Integration.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setAddingNew(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Integration.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setExpandedId(null);
      setSavingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Integration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setDeleteTarget(null);
    }
  });

  const handleSaveExisting = async (id, form) => {
    setSavingId(id);
    await updateMutation.mutateAsync({ id, data: { ...form, connection_status: 'connected' } });
  };

  const handleSaveNew = async (form) => {
    await createMutation.mutateAsync({
      ...form,
      platform_id: platform.platform_id,
      auth_type: 'n8n_webhook',
      connection_status: 'disconnected'
    });
  };

  const handleSaveSchedule = async (scheduleData) => {
    if (!scheduleTarget) return;
    await updateMutation.mutateAsync({ id: scheduleTarget.id, data: scheduleData });
    setScheduleTarget(null);
  };

  const getUnitNames = (unit_ids = []) => {
    return unit_ids.map(id => units.find(u => u.id === id)?.name).filter(Boolean).join(', ') || '—';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {platform?.icon_url && <img src={platform.icon_url} className="w-5 h-5" />}
              Configuração - {platform?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {webhooks.map(wh => (
              <div key={wh.id} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{wh.integration_purpose || 'Webhook'}</p>
                    <p className="text-xs text-gray-400 truncate">
                      <Building2 className="w-3 h-3 inline mr-1" />
                      {getUnitNames(wh.unit_ids || (wh.unit_id ? [wh.unit_id] : []))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <StatusBadge status={wh.connection_status} />
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => { setScheduleTarget(wh); }}
                      title="Agendar"
                    >
                      <Calendar className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id)}
                    >
                      <Settings className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => setDeleteTarget(wh)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id)}
                    >
                      {expandedId === wh.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {expandedId === wh.id && (
                  <div className="p-4 border-t">
                    <WebhookConfigForm
                      integration={wh}
                      units={units}
                      onSave={(form) => handleSaveExisting(wh.id, form)}
                      onCancel={() => setExpandedId(null)}
                      isSaving={savingId === wh.id}
                    />
                  </div>
                )}
              </div>
            ))}

            {webhooks.length === 0 && !addingNew && (
              <p className="text-center text-sm text-gray-400 py-4">Nenhum webhook configurado</p>
            )}

            {addingNew && (
              <div className="border rounded-lg p-4">
                <p className="font-medium text-sm mb-3">Novo Webhook</p>
                <WebhookConfigForm
                  integration={null}
                  units={units}
                  onSave={handleSaveNew}
                  onCancel={() => setAddingNew(false)}
                  isSaving={createMutation.isPending}
                />
              </div>
            )}

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setAddingNew(true)}
              disabled={addingNew}
            >
              <Plus className="w-4 h-4" />
              Adicionar Webhook
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteTarget?.integration_purpose || 'webhook'}". Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {scheduleTarget && (
        <ScheduleModal
          open={!!scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          integration={scheduleTarget}
          onSave={handleSaveSchedule}
        />
      )}
    </>
  );
}