import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import WebhookCard from '../components/integrations/WebhookCard';
import WebhookFormDialog from '../components/integrations/WebhookFormDialog';
import ManageUnitsDialog from '../components/integrations/ManageUnitsDialog';
import UnifiedExecutionModal from '../components/integrations/UnifiedExecutionModal';
import ScheduleModal from '../components/integrations/ScheduleModal';
import toast, { Toaster } from 'react-hot-toast';

const PLATFORM_LABELS = {
  META: 'Meta',
  GOOGLE_ADS: 'Google Ads',
  TIKTOK_ADS: 'TikTok Ads',
  YOUTUBE: 'YouTube',
};

const PLATFORM_COLORS = {
  META: 'bg-blue-600',
  GOOGLE_ADS: 'bg-red-500',
  TIKTOK_ADS: 'bg-black',
  YOUTUBE: 'bg-red-600',
};

const ALL_PLATFORMS = ['META', 'GOOGLE_ADS', 'TIKTOK_ADS', 'YOUTUBE'];

export default function Integrations() {
  const queryClient = useQueryClient();

  const [formDialog, setFormDialog] = useState({ open: false, webhook: null, platformId: null });
  const [manageUnits, setManageUnits] = useState({ open: false, webhook: null });
  const [execModal, setExecModal] = useState({ open: false, webhook: null });
  const [scheduleModal, setScheduleModal] = useState({ open: false, webhook: null });
  const [isExecuting, setIsExecuting] = useState(false);

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => base44.entities.Integration.list(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: platforms = [] } = useQuery({
    queryKey: ['platforms'],
    queryFn: () => base44.entities.Platform.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (id) return base44.entities.Integration.update(id, data);
      return base44.entities.Integration.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setFormDialog({ open: false, webhook: null, platformId: null });
      toast.success('Webhook salvo!');
    },
    onError: (e) => toast.error('Erro ao salvar: ' + e.message),
  });

  const updateUnitsMutation = useMutation({
    mutationFn: ({ id, unit_ids }) => base44.entities.Integration.update(id, { unit_ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setManageUnits({ open: false, webhook: null });
      toast.success('Unidades atualizadas!');
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Integration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Webhook excluído');
    },
    onError: (e) => toast.error('Erro ao excluir: ' + e.message),
  });

  const handleExecute = async ({ integration_id, selected_unit_ids, date_mode, since, until }) => {
    setIsExecuting(true);
    const webhook = execModal.webhook;
    const isInsights = !webhook?.webhook_type || webhook.webhook_type === 'insights';
    try {
      const payload = {
        integration_id,
        execution_type: isInsights ? 'insights' : 'creatives',
        unit_ids: selected_unit_ids,
        ...(isInsights && { date_mode, since, until }),
      };
      const res = await base44.functions.invoke('executeN8nWebhook', payload);
      if (res.data?.success) {
        toast.success('Webhook disparado com sucesso!');
        setExecModal({ open: false, webhook: null });
      } else {
        toast.error(res.data?.error || 'Erro ao executar');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveForm = (form) => {
    const data = {
      ...form,
      ...(formDialog.platformId && !formDialog.webhook ? { platform_id: formDialog.platformId } : {}),
    };
    saveMutation.mutate({ id: formDialog.webhook?.id, data });
  };

  const handleDelete = (webhook) => {
    if (confirm(`Excluir o webhook "${webhook.name}"?`)) {
      deleteMutation.mutate(webhook.id);
    }
  };

  return (
    <div className="space-y-8">
      <Toaster position="top-right" />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>
        <p className="text-gray-500 mt-1">Gerencie os webhooks por plataforma e associe as unidades</p>
      </div>

      {isLoading ? (
        <div className="text-gray-500 text-sm">Carregando...</div>
      ) : (
        ALL_PLATFORMS.map(platformId => {
          const platformWebhooks = integrations.filter(i => i.platform_id === platformId);
          const platformMeta = platforms.find(p => p.platform_id === platformId);
          const label = platformMeta?.name || PLATFORM_LABELS[platformId] || platformId;

          return (
            <div key={platformId}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${PLATFORM_COLORS[platformId] || 'bg-gray-400'}`} />
                  <h2 className="text-lg font-semibold text-gray-800">{label}</h2>
                  <Badge variant="outline" className="text-xs">
                    {platformWebhooks.length} webhook{platformWebhooks.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setFormDialog({ open: true, webhook: null, platformId })}
                >
                  <Plus className="w-4 h-4" />
                  Novo Webhook
                </Button>
              </div>

              {platformWebhooks.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 text-sm">
                  Nenhum webhook configurado para {label}
                </div>
              ) : (
                <div className="space-y-3">
                  {platformWebhooks.map(webhook => (
                    <WebhookCard
                      key={webhook.id}
                      webhook={webhook}
                      units={units}
                      onExecute={(w) => setExecModal({ open: true, webhook: w })}
                      onManageUnits={(w) => setManageUnits({ open: true, webhook: w })}
                      onEdit={(w) => setFormDialog({ open: true, webhook: w, platformId: w.platform_id })}
                      onSchedule={(w) => setScheduleModal({ open: true, webhook: w })}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      <WebhookFormDialog
        open={formDialog.open}
        onClose={() => setFormDialog({ open: false, webhook: null, platformId: null })}
        onSave={handleSaveForm}
        webhook={formDialog.webhook}
        platformName={PLATFORM_LABELS[formDialog.platformId] || formDialog.platformId}
        isSaving={saveMutation.isPending}
      />

      <ManageUnitsDialog
        open={manageUnits.open}
        onClose={() => setManageUnits({ open: false, webhook: null })}
        webhook={manageUnits.webhook}
        units={units}
        onSave={(unit_ids) => updateUnitsMutation.mutate({ id: manageUnits.webhook?.id, unit_ids })}
        isSaving={updateUnitsMutation.isPending}
      />

      <UnifiedExecutionModal
        open={execModal.open}
        onClose={() => setExecModal({ open: false, webhook: null })}
        webhook={execModal.webhook}
        units={units}
        onExecute={handleExecute}
        isExecuting={isExecuting}
      />

      {scheduleModal.open && scheduleModal.webhook && (
        <ScheduleModal
          open={scheduleModal.open}
          onClose={() => setScheduleModal({ open: false, webhook: null })}
          integration={scheduleModal.webhook}
        />
      )}
    </div>
  );
}