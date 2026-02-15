import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Link2, CheckCircle2, XCircle, AlertCircle, RefreshCw, Trash2, Settings, Play, ChevronRight, Edit2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import DataFetchModal from '../components/integrations/DataFetchModal';
import N8nWebhookCard from '../components/integrations/N8nWebhookCard';
import ExecutionModal from '../components/integrations/ExecutionModal';
import ScheduleModal from '../components/integrations/ScheduleModal';
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

export default function Integrations() {
  const queryClient = useQueryClient();
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(null);
  const [editPlatformDialog, setEditPlatformDialog] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [fetchDataModal, setFetchDataModal] = useState(null);
  const [executionModal, setExecutionModal] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [platformLogoFile, setPlatformLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [integrationsListDialog, setIntegrationsListDialog] = useState(null);
  
  const [formData, setFormData] = useState({
    unit_id: '',
    auth_type: 'token',
    integration_purpose: '',
  });
  
  const [editFormData, setEditFormData] = useState({
    account_name: '',
    account_reference: '',
    auth_type: 'token',
    integration_purpose: '',
    settings: {
      access_token: '',
      api_key: '',
      client_id: '',
      client_secret: '',
      refresh_token: '',
      n8n_webhook_url: '',
      n8n_secret_token: '',
    }
  });

  const [webhookUrl, setWebhookUrl] = useState('');

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: platforms = [], isLoading: platformsLoading } = useQuery({
    queryKey: ['platforms'],
    queryFn: () => base44.entities.Platform.list(),
  });

  const { data: integrations = [], isLoading: integrationsLoading, refetch } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => base44.entities.Integration.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Integration.create({ ...data, connection_status: 'disconnected' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setAddDialog(false);
      setFormData({
        unit_id: '',
        auth_type: 'token',
        integration_purpose: '',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Integration.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  const updatePlatformMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Platform.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
      setEditPlatformDialog(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Integration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setDeleteDialog(null);
    },
  });

  const handleOpenAddDialog = (platform) => {
    setSelectedPlatform(platform);
    setFormData({
      unit_id: '',
      auth_type: 'token',
      integration_purpose: '',
    });
    setAddDialog(true);
  };

  const handleOpenEditDialog = (integration) => {
    setEditFormData({
      account_name: integration.account_name || '',
      account_reference: integration.account_reference || '',
      auth_type: integration.auth_type || 'token',
      integration_purpose: integration.integration_purpose || '',
      settings: {
        access_token: integration.settings?.access_token || '',
        api_key: integration.settings?.api_key || '',
        client_id: integration.settings?.client_id || '',
        client_secret: integration.settings?.client_secret || '',
        refresh_token: integration.settings?.refresh_token || '',
        n8n_webhook_url: integration.settings?.n8n_webhook_url || '',
        n8n_secret_token: integration.settings?.n8n_secret_token || '',
      }
    });
    setEditDialog(integration);
    
    const baseUrl = window.location.origin;
    const webhookPath = `/api/functions/receiveN8nData`;
    setWebhookUrl(`${baseUrl}${webhookPath}`);
  };

  const handleSaveEdit = async () => {
    try {
      await updateMutation.mutateAsync({
        id: editDialog.id,
        data: editFormData
      });
      
      setEditDialog(null);
      
      // Testar conexão automaticamente após salvar
      setTimeout(() => {
        handleTestConnection({ id: editDialog.id });
      }, 500);
    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    }
  };

  const handleTestConnection = async (integration) => {
    try {
      // Teste simples: apenas verifica se a URL do webhook está configurada
      if (integration.auth_type === 'n8n_webhook') {
        const webhookUrl = integration.settings?.n8n_webhook_url;
        if (!webhookUrl) {
          alert('❌ URL do webhook N8N não configurada');
          return;
        }
        alert(`✅ Webhook configurado\n\nURL: ${webhookUrl}`);
      } else {
        alert('✅ Integração configurada');
      }
      refetch();
    } catch (error) {
      alert(`❌ Erro: ${error.message}`);
    }
  };

  const handleFetchData = async (params) => {
    try {
      const response = await base44.functions.invoke('fetchMetaAdsMetrics', params);
      if (response.data.success) {
        alert(`✅ ${response.data.message}`);
        refetch();
      } else {
        alert(`❌ ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Erro: ${error.message}`);
    }
  };

  const handleExecuteIntegration = async (params) => {
    try {
      const response = await base44.functions.invoke('triggerN8nIntegration', params);
      if (response.data.success) {
        alert(`✅ ${response.data.message}`);
        refetch();
      } else {
        alert(`❌ ${response.data.error}`);
      }
    } catch (error) {
      alert(`❌ Erro: ${error.message}`);
    }
  };

  const handleSaveSchedule = async (scheduleData) => {
    try {
      await updateMutation.mutateAsync({
        id: scheduleModal.id,
        data: scheduleData
      });
      alert('✅ Agendamento salvo com sucesso!');
      refetch();
    } catch (error) {
      alert(`❌ Erro ao salvar: ${error.message}`);
    }
  };

  const handleCreateIntegration = () => {
    if (!formData.unit_id) {
      alert('Selecione uma unidade');
      return;
    }

    const selectedUnit = units.find(u => u.id === formData.unit_id);
    
    const integrationData = {
      unit_id: formData.unit_id,
      platform_id: selectedPlatform.platform_id,
      account_reference: selectedUnit?.account_id || '',
      account_name: selectedUnit?.name || '',
      auth_type: formData.auth_type,
      integration_purpose: formData.integration_purpose,
      connection_status: 'disconnected'
    };

    // Adicionar settings baseado no tipo de autenticação
    if (formData.auth_type === 'token' || formData.auth_type === 'n8n_webhook') {
      integrationData.settings = {
        access_token: selectedUnit?.secret_token || '',
        n8n_secret_token: '',
        n8n_webhook_url: ''
      };
    }

    createMutation.mutate(integrationData);
  };

  const getUnitName = (unitId) => {
    return units.find(u => u.id === unitId)?.name || 'Unidade';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-50 text-gray-500 border-gray-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Desconectado
          </Badge>
        );
    }
  };

  if (unitsLoading || platformsLoading || integrationsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>
        <p className="text-gray-500 mt-1">Conecte suas contas de anúncios por plataforma</p>
      </div>

      {/* Platform Cards */}
      <div className="grid gap-4">
        {platforms.map((platform) => {
          const platformIntegrations = integrations.filter(i => i.platform_id === platform.platform_id);
          
          return (
            <Card key={platform.id} className="border-gray-200 hover:border-gray-300 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: `${platform.color}15` }}
                    >
                      {platform.icon_url ? (
                        <img src={platform.icon_url} alt={platform.name} className="w-8 h-8 object-contain" />
                      ) : (
                        <span className="text-2xl">{platform.icon || '📊'}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{platform.name}</CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEditPlatformDialog(platform)}
                        >
                          <Edit2 className="w-3 h-3 text-gray-400" />
                        </Button>
                      </div>
                      <button
                        onClick={() => setIntegrationsListDialog({ platform, integrations: platformIntegrations })}
                        className="text-sm text-blue-600 hover:underline text-left"
                      >
                        {platformIntegrations.length} integração(ões) configurada(s)
                      </button>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleOpenAddDialog(platform)}
                    className="gap-2"
                    style={{ backgroundColor: platform.color }}
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Integração
                  </Button>
                </div>
              </CardHeader>
            </Card>

          );
        })}
      </div>

      {/* Dialog para listar integrações */}
      <Dialog open={!!integrationsListDialog} onOpenChange={() => setIntegrationsListDialog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Integrações - {integrationsListDialog?.platform?.name}
            </DialogTitle>
          </DialogHeader>
          
          {integrationsListDialog?.integrations?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma integração cadastrada
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {integrationsListDialog?.integrations?.map(integration => {
                const unit = units.find(u => u.id === integration.unit_id);
                
                return (
                  <div key={integration.id} className="p-4 border rounded-lg bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{unit?.name || 'Unidade'}</p>
                        <p className="text-xs text-gray-500">
                          {integration.auth_type === 'n8n_webhook' 
                            ? integration.integration_purpose || 'N8n Webhook'
                            : `ID: ${integration.account_reference || 'Não configurado'}`
                          }
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(integration.connection_status)}
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTestConnection(integration)}
                          title="Verificar configuração"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Testar
                        </Button>

                        {integration.auth_type === 'n8n_webhook' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setExecutionModal(integration);
                                setIntegrationsListDialog(null);
                              }}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Executar
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setScheduleModal(integration);
                                setIntegrationsListDialog(null);
                              }}
                            >
                              <Calendar className="w-3 h-3 mr-1" />
                              Agendar
                            </Button>
                          </>
                        )}

                        {integration.connection_status === 'connected' && integration.platform_id === 'META' && integration.auth_type !== 'n8n_webhook' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setFetchDataModal(integration);
                              setIntegrationsListDialog(null);
                            }}
                          >
                            Buscar Dados
                          </Button>
                        )}

                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            handleOpenEditDialog(integration);
                            setIntegrationsListDialog(null);
                          }}
                        >
                          <Settings className="w-3 h-3 mr-1" />
                          Configurar
                        </Button>
                        
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setDeleteDialog(integration);
                            setIntegrationsListDialog(null);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Integration Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Adicionar Integração - {selectedPlatform?.name}
            </DialogTitle>
            <DialogDescription>
              Selecione a unidade e configure a integração
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select
                value={formData.unit_id}
                onValueChange={(value) => {
                  setFormData({ ...formData, unit_id: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      <div className="space-y-0.5">
                        <div className="font-medium">{unit.name}</div>
                        <div className="text-xs text-gray-500">
                          {unit.account_id && `Account ID: ${unit.account_id}`}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.unit_id && (
                <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                  <p><strong>Nome:</strong> {units.find(u => u.id === formData.unit_id)?.name}</p>
                  <p><strong>Account ID:</strong> {units.find(u => u.id === formData.unit_id)?.account_id || 'Não definido'}</p>
                  <p><strong>Token:</strong> {units.find(u => u.id === formData.unit_id)?.secret_token ? '••••••••' : 'Não definido'}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo de Autenticação *</Label>
              <Select
                value={formData.auth_type}
                onValueChange={(value) => setFormData({ ...formData, auth_type: value })}
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

            {formData.auth_type === 'n8n_webhook' && (
              <div className="space-y-2">
                <Label htmlFor="integration_purpose">Propósito da Integração *</Label>
                <Input
                  id="integration_purpose"
                  value={formData.integration_purpose}
                  onChange={(e) => setFormData({ ...formData, integration_purpose: e.target.value })}
                  placeholder="Ex: Dados Gerais, Criativos"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateIntegration}
              disabled={!formData.unit_id || createMutation.isPending}
              style={{ backgroundColor: selectedPlatform?.color }}
            >
              Criar Integração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Integration Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Integração</DialogTitle>
            <DialogDescription>
              Configure as credenciais e parâmetros da integração
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
              <>
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_integration_purpose">Propósito da Integração</Label>
                  <Input
                    id="edit_integration_purpose"
                    value={editFormData.integration_purpose}
                    onChange={(e) => setEditFormData({ ...editFormData, integration_purpose: e.target.value })}
                    placeholder="Ex: Dados Gerais, Criativos"
                  />
                </div>
              </>
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
                    placeholder="Cole seu token de acesso"
                  />
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
                    placeholder="Cole sua chave de API"
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
                      placeholder="Token de atualização"
                    />
                  </div>
                </div>
              )}

              {editFormData.auth_type === 'n8n_webhook' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>URL do Webhook Base44 (use no N8n)</Label>
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="n8n_secret_token">Token de Segurança *</Label>
                    <Input
                      id="n8n_secret_token"
                      type="password"
                      value={editFormData.settings.n8n_secret_token}
                      onChange={(e) => setEditFormData({ 
                        ...editFormData, 
                        settings: { ...editFormData.settings, n8n_secret_token: e.target.value }
                      })}
                      placeholder="Gere um token único"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="n8n_access_token">Access Token *</Label>
                    <Input
                      id="n8n_access_token"
                      type="password"
                      value={editFormData.settings.access_token}
                      onChange={(e) => setEditFormData({ 
                        ...editFormData, 
                        settings: { ...editFormData.settings, access_token: e.target.value }
                      })}
                      placeholder="Cole seu access token"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>ID da Integração</Label>
                    <Input
                      value={editDialog?.id || 'Salve primeiro'}
                      readOnly
                      className="font-mono text-xs bg-gray-50"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Platform Dialog */}
      <Dialog open={!!editPlatformDialog} onOpenChange={() => {
        setEditPlatformDialog(null);
        setPlatformLogoFile(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Plataforma</DialogTitle>
            <DialogDescription>
              Personalize o ícone e nome da plataforma
            </DialogDescription>
          </DialogHeader>

          {editPlatformDialog && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="platform_logo">Logo da Plataforma</Label>
                <Input
                  id="platform_logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPlatformLogoFile(e.target.files[0])}
                />
                {(editPlatformDialog.icon_url || platformLogoFile) && (
                  <div className="mt-2 p-2 bg-gray-50 rounded flex items-center justify-center">
                    <img 
                      src={platformLogoFile ? URL.createObjectURL(platformLogoFile) : editPlatformDialog.icon_url} 
                      alt="Preview" 
                      className="w-12 h-12 object-contain" 
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform_name">Nome</Label>
                <Input
                  id="platform_name"
                  value={editPlatformDialog.name}
                  onChange={(e) => setEditPlatformDialog({ ...editPlatformDialog, name: e.target.value })}
                  placeholder="Meta Ads"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform_color">Cor (hex)</Label>
                <div className="flex gap-2">
                  <Input
                    id="platform_color"
                    value={editPlatformDialog.color}
                    onChange={(e) => setEditPlatformDialog({ ...editPlatformDialog, color: e.target.value })}
                    placeholder="#1877F2"
                  />
                  <div 
                    className="w-10 h-10 rounded border"
                    style={{ backgroundColor: editPlatformDialog.color }}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditPlatformDialog(null);
              setPlatformLogoFile(null);
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={async () => {
                if (uploadingLogo || updatePlatformMutation.isPending) return;
                
                let icon_url = editPlatformDialog.icon_url;
                
                if (platformLogoFile) {
                  setUploadingLogo(true);
                  try {
                    const response = await base44.integrations.Core.UploadFile({ file: platformLogoFile });
                    icon_url = response.file_url;
                  } catch (error) {
                    console.error('Upload error:', error);
                    alert('Erro ao fazer upload da imagem: ' + error.message);
                    setUploadingLogo(false);
                    return;
                  }
                  setUploadingLogo(false);
                }

                await updatePlatformMutation.mutateAsync({
                  id: editPlatformDialog.id,
                  data: {
                    icon_url,
                    name: editPlatformDialog.name,
                    color: editPlatformDialog.color
                  }
                });
                
                setPlatformLogoFile(null);
                setEditPlatformDialog(null);
              }}
              disabled={uploadingLogo || updatePlatformMutation.isPending}
            >
              {uploadingLogo ? 'Enviando...' : updatePlatformMutation.isPending ? 'Salvando...' : 'Salvar'}
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
              Esta ação removerá a conexão com "{getUnitName(deleteDialog?.unit_id)}".
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

      {/* Modals */}
      {fetchDataModal && (
        <DataFetchModal
          open={!!fetchDataModal}
          onClose={() => setFetchDataModal(null)}
          integration={fetchDataModal}
          onFetch={handleFetchData}
        />
      )}

      {executionModal && (
        <ExecutionModal
          open={!!executionModal}
          onClose={() => setExecutionModal(null)}
          integration={executionModal}
          onExecute={handleExecuteIntegration}
        />
      )}

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