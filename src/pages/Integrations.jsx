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
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.unit_id || !formData.platform_id || !formData.account_reference || createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Criar Integração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Integração</DialogTitle>
            <DialogDescription>
              Configure as credenciais de acesso para {getPlatformInfo(editDialog?.platform_id).name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_account_name">Nome da Conta</Label>
              <Input
                id="edit_account_name"
                value={editFormData.account_name}
                onChange={(e) => setEditFormData({ ...editFormData, account_name: e.target.value })}
                placeholder="Ex: Conta Principal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_account_reference">ID da Conta</Label>
              <Input
                id="edit_account_reference"
                value={editFormData.account_reference}
                onChange={(e) => setEditFormData({ ...editFormData, account_reference: e.target.value })}
                placeholder="Ex: act_123456789"
              />
            </div>

            {editDialog?.auth_type === 'n8n_webhook' && (
              <div className="space-y-2">
                <Label htmlFor="edit_n8n_webhook_url">URL do Webhook N8n</Label>
                <Input
                  id="edit_n8n_webhook_url"
                  value={editFormData.settings.n8n_webhook_url}
                  onChange={(e) => setEditFormData({ 
                    ...editFormData, 
                    settings: { ...editFormData.settings, n8n_webhook_url: e.target.value }
                  })}
                  placeholder="https://seu-n8n.com/webhook/..."
                />
                <p className="text-xs text-gray-500">
                  URL do webhook do N8n que o Base44 vai chamar para testar
                </p>
              </div>
            )}

            {editDialog?.auth_type === 'n8n_webhook' && (
              <div className="space-y-2">
                <Label htmlFor="edit_integration_purpose">Propósito da Integração</Label>
                <Input
                  id="edit_integration_purpose"
                  value={editFormData.integration_purpose}
                  onChange={(e) => setEditFormData({ ...editFormData, integration_purpose: e.target.value })}
                  placeholder="Ex: Dados Gerais, Criativos, Imagens"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de Autenticação</Label>
              <Select
                value={editFormData.auth_type}
                onValueChange={(value) => setEditFormData({ ...editFormData, auth_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="token">Access Token</SelectItem>
                  <SelectItem value="oauth">OAuth 2.0</SelectItem>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="n8n_webhook">N8n Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3 text-gray-900">Credenciais</h4>
              
              {editFormData.auth_type === 'token' && (
                <div className="space-y-2">
                  <Label htmlFor="access_token">Access Token *</Label>
                  <Input
                    id="access_token"
                    type="password"
                    value={editFormData.settings.access_token}
                    onChange={(e) => setEditFormData({ 
                      ...editFormData, 
                      settings: { ...editFormData.settings, access_token: e.target.value }
                    })}
                    placeholder="Cole seu token de acesso aqui"
                  />
                  <p className="text-xs text-gray-500">
                    Token gerado no painel da plataforma
                  </p>
                </div>
              )}

              {editFormData.auth_type === 'api_key' && (
                <div className="space-y-2">
                  <Label htmlFor="api_key">API Key *</Label>
                  <Input
                    id="api_key"
                    type="password"
                    value={editFormData.settings.api_key}
                    onChange={(e) => setEditFormData({ 
                      ...editFormData, 
                      settings: { ...editFormData.settings, api_key: e.target.value }
                    })}
                    placeholder="Cole sua chave de API aqui"
                  />
                </div>
              )}

              {editFormData.auth_type === 'oauth' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_id">Client ID *</Label>
                    <Input
                      id="client_id"
                      value={editFormData.settings.client_id}
                      onChange={(e) => setEditFormData({ 
                        ...editFormData, 
                        settings: { ...editFormData.settings, client_id: e.target.value }
                      })}
                      placeholder="Client ID do app OAuth"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="client_secret">Client Secret *</Label>
                    <Input
                      id="client_secret"
                      type="password"
                      value={editFormData.settings.client_secret}
                      onChange={(e) => setEditFormData({ 
                        ...editFormData, 
                        settings: { ...editFormData.settings, client_secret: e.target.value }
                      })}
                      placeholder="Client Secret do app OAuth"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="refresh_token">Refresh Token</Label>
                    <Input
                      id="refresh_token"
                      type="password"
                      value={editFormData.settings.refresh_token}
                      onChange={(e) => setEditFormData({ 
                        ...editFormData, 
                        settings: { ...editFormData.settings, refresh_token: e.target.value }
                      })}
                      placeholder="Token de atualização (opcional)"
                    />
                  </div>
                </div>
              )}

              {editFormData.auth_type === 'n8n_webhook' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>URL do Webhook Base44 (use esta no N8n)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={webhookUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(webhookUrl);
                          alert('URL copiada!');
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Use esta URL como destino do HTTP Request no seu workflow N8n
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="n8n_secret_token">Token de Segurança *</Label>
                    <Input
                      id="n8n_secret_token"
                      type="password"
                      autoComplete="off"
                      value={editFormData.settings.n8n_secret_token}
                      onChange={(e) => setEditFormData({ 
                        ...editFormData, 
                        settings: { ...editFormData.settings, n8n_secret_token: e.target.value }
                      })}
                      placeholder="Gere um token único (ex: abc123xyz)"
                    />
                    <p className="text-xs text-gray-500">
                      Crie um token único e envie-o no corpo do POST do N8n
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="n8n_access_token">Access Token *</Label>
                    <Input
                      id="n8n_access_token"
                      type="password"
                      autoComplete="off"
                      value={editFormData.settings.access_token}
                      onChange={(e) => setEditFormData({ 
                        ...editFormData, 
                        settings: { ...editFormData.settings, access_token: e.target.value }
                      })}
                      placeholder="Cole seu access token aqui"
                    />
                    <p className="text-xs text-gray-500">
                      Token de acesso da plataforma - será enviado para o N8n
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="integration_id_display">ID da Integração</Label>
                    <Input
                      id="integration_id_display"
                      value={editDialog?.id || 'Salve primeiro para gerar'}
                      readOnly
                      className="font-mono text-xs bg-gray-50"
                    />
                    <p className="text-xs text-gray-500">
                      Use este ID no campo "integration_id" do JSON enviado pelo N8n
                    </p>
                  </div>


                </div>
              )}

              {editFormData.auth_type !== 'n8n_webhook' && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Onde encontrar:</strong> Acesse o painel da plataforma e gere as credenciais de desenvolvedor/API.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Salvar Configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir integração?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a conexão com a conta "{deleteDialog?.account_name || deleteDialog?.account_reference}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate(deleteDialog.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Data Fetch Modal */}
      {fetchDataModal && (
        <DataFetchModal
          open={!!fetchDataModal}
          onClose={() => setFetchDataModal(null)}
          integration={fetchDataModal}
          onFetch={handleFetchData}
        />
      )}

      {/* Execution Modal */}
      {executionModal && (
        <ExecutionModal
          open={!!executionModal}
          onClose={() => setExecutionModal(null)}
          integration={executionModal}
          onExecute={handleExecuteIntegration}
        />
      )}

      {/* Schedule Modal */}
      {scheduleModal && (
        <ScheduleModal
          open={!!scheduleModal}
          onClose={() => setScheduleModal(null)}
          integration={scheduleModal}
          onSave={handleSaveSchedule}
        />
      )}
    </div>
  );
}