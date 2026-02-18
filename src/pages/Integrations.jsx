import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2, Link2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import WebhookCard from '../components/integrations/WebhookCard';
import WebhookFormDialog from '../components/integrations/WebhookFormDialog';
import ManageUnitsDialog from '../components/integrations/ManageUnitsDialog';
import UnifiedExecutionModal from '../components/integrations/UnifiedExecutionModal';
import EditPlatformDialog from '../components/integrations/EditPlatformDialog';
import ScheduleModal from '../components/integrations/ScheduleModal';

export default function Integrations() {
  const queryClient = useQueryClient();

  // UI State
  const [webhookFormDialog, setWebhookFormDialog] = useState(null); // null | { platform, webhook? }
  const [manageUnitsDialog, setManageUnitsDialog] = useState(null); // webhook
  const [executionModal, setExecutionModal] = useState(null); // webhook
  const [editPlatformDialog, setEditPlatformDialog] = useState(null); // platform
  const [scheduleModal, setScheduleModal] = useState(null); // webhook
  const [deleteDialog, setDeleteDialog] = useState(null); // webhook
  const [expandedPlatforms, setExpandedPlatforms] = useState({});
  const [isExecuting, setIsExecuting] = useState(false);

  // Data
  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: platforms = [], isLoading: platformsLoading } = useQuery({
    queryKey: ['platforms'],
    queryFn: () => base44.entities.Platform.list(),
  });

  const { data: integrations = [], isLoading: integrationsLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => base44.entities.Integration.list('-created_date'),
  });

  // Mutations
  const createWebhookMutation = useMutation({
    mutationFn: data => base44.entities.Integration.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const updateWebhookMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Integration.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: id => base44.entities.Integration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setDeleteDialog(null);
    },
  });

  const updatePlatformMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Platform.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
      setEditPlatformDialog(null);
    },
  });

  // Handlers
  const handleSaveWebhook = async (formData) => {
    const { platform, webhook } = webhookFormDialog;
    if (webhook) {
      await updateWebhookMutation.mutateAsync({ id: webhook.id, data: formData });
    } else {
      await createWebhookMutation.mutateAsync({
        ...formData,
        platform_id: platform.platform_id,
        connection_status: 'connected',
        unit_ids: [],
      });
    }
    setWebhookFormDialog(null);
  };

  const handleSaveUnits = async (selectedIds) => {
    await updateWebhookMutation.mutateAsync({
      id: manageUnitsDialog.id,
      data: { unit_ids: selectedIds },
    });
    setManageUnitsDialog(null);
  };

  const handleExecute = async (params) => {
    setIsExecuting(true);
    try {
      // Determine the execution type from the webhook
      const webhook = executionModal;
      const executionType = webhook.webhook_type === 'creatives' ? 'creatives' : 'insights';

      // Build unit-level payloads and send per-unit
      const selectedUnits = units.filter(u => params.selected_unit_ids.includes(u.id));

      for (const unit of selectedUnits) {
        const payload = {
          integration_id: params.integration_id,
          execution_type: executionType,
          unit_ids: [unit.id],
          run_type: 'selected',
          ...(executionType === 'insights' && {
            date_mode: params.date_mode,
            since: params.since,
            until: params.until,
          }),
        };
        await base44.functions.invoke('executeN8nWebhook', payload);
      }

      alert(`✅ Execução enviada para ${selectedUnits.length} unidade(s)`);
      setExecutionModal(null);
    } catch (error) {
      alert(`❌ Erro: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveSchedule = async (scheduleData) => {
    await updateWebhookMutation.mutateAsync({ id: scheduleModal.id, data: scheduleData });
    alert('✅ Agendamento salvo!');
    setScheduleModal(null);
  };

  const togglePlatform = (platformId) => {
    setExpandedPlatforms(prev => ({ ...prev, [platformId]: !prev[platformId] }));
  };

  if (unitsLoading || platformsLoading || integrationsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>
        <p className="text-gray-500 mt-1">Configure webhooks por plataforma e associe unidades a cada um</p>
      </div>

      {/* Platform sections */}
      <div className="space-y-4">
        {platforms.map(platform => {
          const platformWebhooks = integrations.filter(i => i.platform_id === platform.platform_id && i.name);
          const isExpanded = expandedPlatforms[platform.platform_id] !== false; // expanded by default

          return (
            <Card key={platform.id} className="overflow-hidden">
              {/* Platform header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => togglePlatform(platform.platform_id)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                    style={{ backgroundColor: `${platform.color}20` }}
                  >
                    {platform.icon_url ? (
                      <img src={platform.icon_url} alt={platform.name} className="w-7 h-7 object-contain" />
                    ) : (
                      <Link2 className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{platform.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={e => { e.stopPropagation(); setEditPlatformDialog(platform); }}
                      >
                        <Edit2 className="w-3 h-3 text-gray-400" />
                      </Button>
                    </div>
                    <span className="text-sm text-gray-500">{platformWebhooks.length} webhook(s)</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    style={{ backgroundColor: platform.color }}
                    onClick={e => {
                      e.stopPropagation();
                      setWebhookFormDialog({ platform, webhook: null });
                    }}
                    className="gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Webhook
                  </Button>
                  <ChevronRight
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>
              </div>

              {/* Webhooks list */}
              {isExpanded && (
                <CardContent className="border-t bg-gray-50/50 p-4 space-y-3">
                  {platformWebhooks.length === 0 ? (
                    <div className="text-center py-6 text-gray-400">
                      <p className="text-sm">Nenhum webhook configurado</p>
                      <button
                        className="text-sm text-blue-600 hover:underline mt-1"
                        onClick={() => setWebhookFormDialog({ platform, webhook: null })}
                      >
                        + Criar primeiro webhook
                      </button>
                    </div>
                  ) : (
                    platformWebhooks.map(webhook => (
                      <WebhookCard
                        key={webhook.id}
                        webhook={webhook}
                        units={units}
                        onExecute={setExecutionModal}
                        onManageUnits={setManageUnitsDialog}
                        onEdit={w => setWebhookFormDialog({ platform, webhook: w })}
                        onSchedule={setScheduleModal}
                        onDelete={setDeleteDialog}
                      />
                    ))
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Dialogs */}
      <WebhookFormDialog
        open={!!webhookFormDialog}
        onClose={() => setWebhookFormDialog(null)}
        webhook={webhookFormDialog?.webhook}
        platformName={webhookFormDialog?.platform?.name}
        onSave={handleSaveWebhook}
        isSaving={createWebhookMutation.isPending || updateWebhookMutation.isPending}
      />

      <ManageUnitsDialog
        open={!!manageUnitsDialog}
        onClose={() => setManageUnitsDialog(null)}
        webhook={manageUnitsDialog}
        units={units}
        onSave={handleSaveUnits}
        isSaving={updateWebhookMutation.isPending}
      />

      <UnifiedExecutionModal
        open={!!executionModal}
        onClose={() => setExecutionModal(null)}
        webhook={executionModal}
        units={units}
        onExecute={handleExecute}
        isExecuting={isExecuting}
      />

      <EditPlatformDialog
        open={!!editPlatformDialog}
        platform={editPlatformDialog}
        onClose={() => setEditPlatformDialog(null)}
        onSave={data => updatePlatformMutation.mutateAsync({ id: editPlatformDialog.id, data })}
        isSaving={updatePlatformMutation.isPending}
      />

      {scheduleModal && (
        <ScheduleModal
          open={!!scheduleModal}
          onClose={() => setScheduleModal(null)}
          integration={scheduleModal}
          onSave={handleSaveSchedule}
        />
      )}

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              O webhook "{deleteDialog?.name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteWebhookMutation.mutate(deleteDialog.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}