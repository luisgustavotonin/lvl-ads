import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Calendar, Clock, Play, Pause, Trash2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PLATFORMS = [
  { id: 'META', name: 'Meta Ads', icon: '📘' },
  { id: 'GOOGLE_ADS', name: 'Google Ads', icon: '🔍' },
  { id: 'TIKTOK_ADS', name: 'TikTok Ads', icon: '🎵' },
  { id: 'YOUTUBE', name: 'YouTube', icon: '▶️' },
];

const TIME_OPTIONS = [
  '00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'
];

export default function Schedules() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [formData, setFormData] = useState({
    unit_id: '',
    platform_id: '',
    frequency: 'daily',
    times: ['09:00'],
    is_active: true,
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => base44.entities.Schedule.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Schedule.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Schedule.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Schedule.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setDeleteDialog(null);
    },
  });

  const handleOpenDialog = () => {
    setFormData({
      unit_id: units[0]?.id || '',
      platform_id: '',
      frequency: 'daily',
      times: ['09:00'],
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleToggleActive = (schedule) => {
    updateMutation.mutate({
      id: schedule.id,
      data: { is_active: !schedule.is_active }
    });
  };

  const getUnitName = (unitId) => {
    return units.find(u => u.id === unitId)?.name || 'Unidade';
  };

  const getPlatformInfo = (platformId) => {
    return PLATFORMS.find(p => p.id === platformId) || { name: platformId, icon: '📊' };
  };

  const getStatusBadge = (schedule) => {
    if (!schedule.is_active) {
      return (
        <Badge className="bg-gray-50 text-gray-500 border-gray-200">
          <Pause className="w-3 h-3 mr-1" />
          Pausado
        </Badge>
      );
    }
    if (schedule.last_status === 'success') {
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Sucesso
        </Badge>
      );
    }
    if (schedule.last_status === 'error') {
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Erro
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-50 text-blue-700 border-blue-200">
        <AlertCircle className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  if (unitsLoading || schedulesLoading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
          <p className="text-gray-500 mt-1">Configure a importação automática de dados</p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleOpenDialog}>
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </Button>
      </div>

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum agendamento configurado</h3>
            <p className="text-gray-500 text-center mb-4">
              Configure agendamentos para importar dados automaticamente.
            </p>
            <Button onClick={handleOpenDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Agendamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => {
            const platform = getPlatformInfo(schedule.platform_id);
            
            return (
              <Card key={schedule.id} className="border-gray-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl">
                        {platform.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{platform.name}</h3>
                        <p className="text-sm text-gray-500">{getUnitName(schedule.unit_id)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          {schedule.times?.join(', ') || 'Não configurado'}
                        </div>
                        {schedule.last_run && (
                          <p className="text-xs text-gray-400 mt-1">
                            Última execução: {format(new Date(schedule.last_run), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>

                      {getStatusBadge(schedule)}

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={schedule.is_active}
                          onCheckedChange={() => handleToggleActive(schedule)}
                        />
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setDeleteDialog(schedule)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>
              Configure a importação automática de dados.
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
              <Label>Frequência</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) => setFormData({ ...formData, frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">A cada hora</SelectItem>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Horários de Execução</Label>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map((time) => (
                  <Button
                    key={time}
                    type="button"
                    variant={formData.times?.includes(time) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const times = formData.times || [];
                      if (times.includes(time)) {
                        setFormData({ ...formData, times: times.filter(t => t !== time) });
                      } else {
                        setFormData({ ...formData, times: [...times, time] });
                      }
                    }}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.unit_id || !formData.platform_id || createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Criar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o agendamento de importação configurado.
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