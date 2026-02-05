import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Link2, CheckCircle2, XCircle, AlertCircle, RefreshCw, Trash2, Settings } from 'lucide-react';
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
import { cn } from '@/lib/utils';

const PLATFORMS = [
  { id: 'META', name: 'Meta Ads', icon: '📘', color: '#1877F2', description: 'Facebook e Instagram Ads' },
  { id: 'GOOGLE_ADS', name: 'Google Ads', icon: '🔍', color: '#34A853', description: 'Search, Display e YouTube' },
  { id: 'TIKTOK_ADS', name: 'TikTok Ads', icon: '🎵', color: '#000000', description: 'Anúncios em vídeo TikTok' },
  { id: 'YOUTUBE', name: 'YouTube', icon: '▶️', color: '#FF0000', description: 'YouTube Analytics' },
];

export default function Integrations() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [formData, setFormData] = useState({
    unit_id: '',
    platform_id: '',
    account_reference: '',
    account_name: '',
    auth_type: 'token',
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: integrations = [], isLoading: integrationsLoading, refetch } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => base44.entities.Integration.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Integration.create({ ...data, connection_status: 'disconnected' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Integration.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Integration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setDeleteDialog(null);
    },
  });

  const handleOpenDialog = () => {
    setFormData({
      unit_id: units[0]?.id || '',
      platform_id: '',
      account_reference: '',
      account_name: '',
      auth_type: 'token',
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleTestConnection = async (integration) => {
    // Simulate connection test
    updateMutation.mutate({
      id: integration.id,
      data: { 
        connection_status: 'connected',
        last_test: new Date().toISOString(),
        error_message: null 
      }
    });
  };

  const filteredIntegrations = selectedUnit === 'all' 
    ? integrations 
    : integrations.filter(i => i.unit_id === selectedUnit);

  const getUnitName = (unitId) => {
    return units.find(u => u.id === unitId)?.name || 'Unidade';
  };

  const getPlatformInfo = (platformId) => {
    return PLATFORMS.find(p => p.id === platformId) || { name: platformId, icon: '📊', color: '#6B7280' };
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

  if (unitsLoading || integrationsLoading) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>
          <p className="text-gray-500 mt-1">Conecte suas contas de anúncios</p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleOpenDialog}>
          <Plus className="w-4 h-4" />
          Nova Integração
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-gray-100">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar por unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Platform Cards */}
      <div className="grid gap-6">
        {PLATFORMS.map((platform) => {
          const platformIntegrations = filteredIntegrations.filter(i => i.platform_id === platform.id);
          
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
                  <Badge variant="outline" className="text-gray-500">
                    {platformIntegrations.length} conexão(ões)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {platformIntegrations.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Link2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>Nenhuma conta conectada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {platformIntegrations.map((integration) => (
                      <div 
                        key={integration.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {integration.account_name || integration.account_reference}
                            </p>
                            <p className="text-sm text-gray-500">
                              {getUnitName(integration.unit_id)} • ID: {integration.account_reference}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(integration.connection_status)}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleTestConnection(integration)}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setDeleteDialog(integration)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Integração</DialogTitle>
            <DialogDescription>
              Conecte uma nova conta de anúncios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select
                value={formData.unit_id}
                onValueChange={(value) => setFormData({ ...formData, unit_id: value })}
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

            <div className="space-y-2">
              <Label>Plataforma *</Label>
              <Select
                value={formData.platform_id}
                onValueChange={(value) => setFormData({ ...formData, platform_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      <div className="flex items-center gap-2">
                        <span>{platform.icon}</span>
                        {platform.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_name">Nome da Conta</Label>
              <Input
                id="account_name"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                placeholder="Ex: Conta Principal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_reference">ID da Conta *</Label>
              <Input
                id="account_reference"
                value={formData.account_reference}
                onChange={(e) => setFormData({ ...formData, account_reference: e.target.value })}
                placeholder="Ex: act_123456789"
              />
              <p className="text-xs text-gray-500">
                O ID da conta de anúncios da plataforma selecionada.
              </p>
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
    </div>
  );
}