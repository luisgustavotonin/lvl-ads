import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Settings, Play, Calendar, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

const PLATFORMS = [
  { id: 'META', name: 'Meta Ads', icon: '📘', color: '#1877F2', description: 'Facebook e Instagram Ads' },
  { id: 'GOOGLE_ADS', name: 'Google Ads', icon: '🔍', color: '#34A853', description: 'Search, Display e YouTube' },
  { id: 'TIKTOK_ADS', name: 'TikTok Ads', icon: '🎵', color: '#000000', description: 'Anúncios em vídeo TikTok' },
];

export default function Integrations() {
  const queryClient = useQueryClient();
  const [configDialog, setConfigDialog] = useState(null);
  const [addUnitDialog, setAddUnitDialog] = useState(null);
  const [editUnitDialog, setEditUnitDialog] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [scheduleDialog, setScheduleDialog] = useState(null);
  
  const [configForm, setConfigForm] = useState({
    n8n_webhook_url: '',
    n8n_secret_token: '',
  });
  
  const [unitForm, setUnitForm] = useState({
    unit_id: '',
    account_id: '',
    access_token: '',
  });
  
  const [scheduleForm, setScheduleForm] = useState({
    schedule_enabled: false,
    schedule_frequency: 'daily',
    schedule_time: '09:00',
    schedule_date_mode: 'YESTERDAY',
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: integrations = [], isLoading: integrationsLoading, refetch } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => base44.entities.Integration.filter({ is_global: true }),
  });

  const { data: unitLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ['integrationUnitLinks'],
    queryFn: () => base44.entities.IntegrationUnitLink.list(),
  });

  const updateIntegrationMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Integration.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setConfigDialog(null);
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: (data) => base44.entities.IntegrationUnitLink.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationUnitLinks'] });
      setAddUnitDialog(null);
    },
  });

  const updateLinkMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.IntegrationUnitLink.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationUnitLinks'] });
      setEditUnitDialog(null);
      setScheduleDialog(null);
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (id) => base44.entities.IntegrationUnitLink.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationUnitLinks'] });
      setDeleteDialog(null);
    },
  });

  const handleOpenConfig = (integration) => {
    setConfigForm({
      n8n_webhook_url: integration.settings?.n8n_webhook_url || '',
      n8n_secret_token: integration.settings?.n8n_secret_token || '',
    });
    setConfigDialog(integration);
  };

  const handleSaveConfig = () => {
    updateIntegrationMutation.mutate({
      id: configDialog.id,
      data: {
        settings: {
          n8n_webhook_url: configForm.n8n_webhook_url,
          n8n_secret_token: configForm.n8n_secret_token,
        }
      }
    });
  };

  const handleOpenAddUnit = (integration) => {
    setUnitForm({
      unit_id: '',
      account_id: '',
      access_token: '',
    });
    setAddUnitDialog(integration);
  };

  const handleAddUnit = () => {
    createLinkMutation.mutate({
      integration_id: addUnitDialog.id,
      unit_id: unitForm.unit_id,
      account_id: unitForm.account_id,
      is_active: true,
    });
  };

  const handleExecute = async (link) => {
    try {
      const integration = integrations.find(i => i.id === link.integration_id);
      const unit = units.find(u => u.id === link.unit_id);
      
      const response = await base44.functions.invoke('triggerN8nIntegration', {
        integration_id: link.integration_id,
        unit_id: link.unit_id,
        account_id: link.account_id,
      });
      
      if (response.data.success) {
        alert(`✅ Execução iniciada para ${unit?.name}`);
      } else {
        alert(`❌ ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Erro: ${error.message}`);
    }
  };

  const handleOpenSchedule = (link) => {
    setScheduleForm({
      schedule_enabled: link.schedule_enabled || false,
      schedule_frequency: link.schedule_frequency || 'daily',
      schedule_time: link.schedule_time || '09:00',
      schedule_date_mode: link.schedule_date_mode || 'YESTERDAY',
    });
    setScheduleDialog(link);
  };

  const handleSaveSchedule = () => {
    updateLinkMutation.mutate({
      id: scheduleDialog.id,
      data: scheduleForm
    });
  };

  const getUnitName = (unitId) => {
    return units.find(u => u.id === unitId)?.name || 'Unidade';
  };

  const getPlatformInfo = (platformId) => {
    return PLATFORMS.find(p => p.id === platformId) || { name: platformId, icon: '📊', color: '#6B7280' };
  };

  const getLinksForIntegration = (integrationId) => {
    return unitLinks.filter(l => l.integration_id === integrationId);
  };

  if (unitsLoading || integrationsLoading || linksLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const webhookUrl = `${window.location.origin}/api/functions/receiveN8nData`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>
          <p className="text-gray-500 mt-1">Configure integrações globais por plataforma</p>
        </div>
      </div>

      {/* Platform Cards */}
      <div className="grid gap-6">
        {PLATFORMS.map((platform) => {
          const integration = integrations.find(i => i.platform_id === platform.id);
          const links = integration ? getLinksForIntegration(integration.id) : [];
          
          return (
            <Card key={platform.id} className="border-gray-100">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${platform.color}15` }}
                    >
                      {platform.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{platform.name}</CardTitle>
                      <p className="text-sm text-gray-500">{platform.description}</p>
                    </div>
                  </div>
                  {integration && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleOpenConfig(integration)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configurar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!integration ? (
                  <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                    <p>Integração não configurada</p>
                  </div>
                ) : (
                  <>
                    {/* Global config display */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium text-green-800">✓ Configurado</p>
                      </div>
                      <div className="space-y-1 text-xs text-green-700">
                        <div className="flex gap-2">
                          <span className="font-medium">URL do Webhook N8n:</span>
                          <span className="font-mono">{integration.settings?.n8n_webhook_url || 'Não configurado'}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-medium">URL para N8n enviar dados (POST):</span>
                          <button 
                            className="font-mono underline hover:text-green-900"
                            onClick={() => {
                              navigator.clipboard.writeText(webhookUrl);
                              alert('✓ URL copiada');
                            }}
                          >
                            {webhookUrl}
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-medium">Integration ID (enviar no JSON):</span>
                          <button 
                            className="font-mono underline hover:text-green-900"
                            onClick={() => {
                              navigator.clipboard.writeText(integration.id);
                              alert('✓ ID copiado');
                            }}
                          >
                            {integration.id}
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-medium">Secret Token:</span>
                          <span className="font-mono">••••••••••</span>
                        </div>
                      </div>
                    </div>

                    {/* Unit links */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Unidades Configuradas</h4>
                        <Button 
                          size="sm" 
                          onClick={() => handleOpenAddUnit(integration)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Adicionar Unidade
                        </Button>
                      </div>
                      
                      {links.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg">
                          <p className="text-sm">Nenhuma unidade vinculada</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {links.map((link) => (
                            <div 
                              key={link.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="font-medium text-gray-900">{getUnitName(link.unit_id)}</p>
                                  <p className="text-xs text-gray-500">
                                    Account ID: {link.account_id || 'Configurar na unidade'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleExecute(link)}
                                  title="Executar agora"
                                >
                                  <Play className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleOpenSchedule(link)}
                                  title="Configurar agendamento"
                                >
                                  <Calendar className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => setDeleteDialog(link)}
                                  title="Remover"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Config Dialog */}
      <Dialog open={!!configDialog} onOpenChange={() => setConfigDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar {getPlatformInfo(configDialog?.platform_id).name}</DialogTitle>
            <DialogDescription>
              Configure as credenciais globais desta plataforma.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="n8n_webhook_url">URL do Webhook N8n *</Label>
              <Input
                id="n8n_webhook_url"
                value={configForm.n8n_webhook_url}
                onChange={(e) => setConfigForm({ ...configForm, n8n_webhook_url: e.target.value })}
                placeholder="https://seu-n8n.com/webhook/..."
              />
              <p className="text-xs text-gray-500">
                URL do webhook do N8n que será chamado para buscar dados
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="n8n_secret_token">Secret Token *</Label>
              <Input
                id="n8n_secret_token"
                type="password"
                value={configForm.n8n_secret_token}
                onChange={(e) => setConfigForm({ ...configForm, n8n_secret_token: e.target.value })}
                placeholder="Token de segurança (ex: abc123xyz)"
              />
              <p className="text-xs text-gray-500">
                Token único para validação de requisições
              </p>
            </div>

            <div className="space-y-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-900">URLs para configurar no N8n:</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-700">URL para enviar dados (POST):</span>
                  <button 
                    type="button"
                    className="text-xs text-blue-600 underline font-mono"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      alert('✓ URL copiada');
                    }}
                  >
                    {webhookUrl}
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      alert('✓ URL copiada');
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialog(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveConfig}
              disabled={!configForm.n8n_webhook_url || !configForm.n8n_secret_token || updateIntegrationMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Salvar Configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Unit Dialog */}
      <Dialog open={!!addUnitDialog} onOpenChange={() => setAddUnitDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Unidade ao {getPlatformInfo(addUnitDialog?.platform_id).name}</DialogTitle>
            <DialogDescription>
              Vincule uma unidade a esta integração.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select
                value={unitForm.unit_id}
                onValueChange={(value) => setUnitForm({ ...unitForm, unit_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                <strong>Importante:</strong> O Account ID e Access Token devem ser configurados diretamente na edição da unidade.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUnitDialog(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddUnit}
              disabled={!unitForm.unit_id || createLinkMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={!!scheduleDialog} onOpenChange={() => setScheduleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendamento - {getUnitName(scheduleDialog?.unit_id)}</DialogTitle>
            <DialogDescription>
              Configure a execução automática desta integração.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={scheduleForm.schedule_enabled}
                onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_enabled: e.target.checked })}
                className="w-4 h-4"
              />
              <Label>Ativar agendamento automático</Label>
            </div>

            {scheduleForm.schedule_enabled && (
              <>
                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <Select
                    value={scheduleForm.schedule_frequency}
                    onValueChange={(value) => setScheduleForm({ ...scheduleForm, schedule_frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">A cada hora</SelectItem>
                      <SelectItem value="daily">Diariamente</SelectItem>
                      <SelectItem value="weekly">Semanalmente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    value={scheduleForm.schedule_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_time: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Período de Dados</Label>
                  <Select
                    value={scheduleForm.schedule_date_mode}
                    onValueChange={(value) => setScheduleForm({ ...scheduleForm, schedule_date_mode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODAY">Hoje</SelectItem>
                      <SelectItem value="YESTERDAY">Ontem</SelectItem>
                      <SelectItem value="LAST_7D">Últimos 7 dias</SelectItem>
                      <SelectItem value="LAST_30D">Últimos 30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialog(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveSchedule}
              disabled={updateLinkMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover unidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o vínculo da unidade "{getUnitName(deleteDialog?.unit_id)}" com esta integração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteLinkMutation.mutate(deleteDialog.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}