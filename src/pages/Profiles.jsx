import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, Shield, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const PERMISSION_CATEGORIES = {
  dashboard: {
    label: 'Dashboard',
    permissions: [
      { id: 'view_dashboard', label: 'Visualizar Dashboard', description: 'Acesso ao painel principal' },
    ]
  },
  relatorios: {
    label: 'Relatórios',
    permissions: [
      { id: 'view_reports', label: 'Visualizar Relatórios', description: 'Acesso à página de relatórios' },
      { id: 'reports_tab_overview', label: 'Aba Visão Geral', description: 'Ver aba de visão geral / funil' },
      { id: 'reports_tab_platforms', label: 'Aba Plataformas', description: 'Ver aba de plataformas' },
      { id: 'reports_tab_device', label: 'Aba Dispositivos', description: 'Ver aba de dispositivos' },
      { id: 'reports_tab_demographic', label: 'Aba Demográfico', description: 'Ver aba de dados demográficos' },
      { id: 'reports_tab_creatives', label: 'Aba Criativos', description: 'Ver aba de criativos' },
      { id: 'export_reports', label: 'Exportar PDF', description: 'Exportar relatórios em PDF' },
      { id: 'edit_report_kpis', label: 'Editar KPIs', description: 'Customizar quais KPIs são exibidos' },
      { id: 'edit_report_funnel', label: 'Editar Funil', description: 'Personalizar estágios do funil' },
      { id: 'edit_report_columns', label: 'Editar Colunas das Tabelas', description: 'Reorganizar colunas das tabelas de campanhas/anúncios' },
    ]
  },
  integracoes: {
    label: 'Integrações & Dados',
    permissions: [
      { id: 'manage_integrations', label: 'Gerenciar Integrações', description: 'Conectar contas de anúncios' },
      { id: 'manage_schedules', label: 'Gerenciar Agendamentos', description: 'Configurar importações automáticas' },
      { id: 'refresh_data', label: 'Atualizar Dados', description: 'Forçar atualização de dados' },
      { id: 'manage_data', label: 'Gestão de Dados', description: 'Limpeza e manutenção de dados' },
    ]
  },
  cadastros: {
    label: 'Cadastros',
    permissions: [
      { id: 'manage_units', label: 'Gerenciar Unidades', description: 'Criar e editar unidades' },
    ]
  },
  administracao: {
    label: 'Administração',
    permissions: [
      { id: 'manage_users', label: 'Gerenciar Usuários', description: 'Criar e editar usuários' },
      { id: 'manage_profiles', label: 'Gerenciar Perfis', description: 'Criar e editar perfis de acesso' },
      { id: 'manage_permissions', label: 'Gerenciar Parâmetros & Alertas', description: 'Configurar KPIs e alertas' },
      { id: 'view_audit_log', label: 'Ver Auditoria', description: 'Visualizar logs de auditoria' },
    ]
  },
};

const COLORS = ['#DC2626', '#2563EB', '#059669', '#7C3AED', '#EA580C', '#0891B2', '#4F46E5', '#DB2777'];

export default function Profiles() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(['operacao']);
  const [formData, setFormData] = useState({
    name: '',
    level: 1,
    description: '',
    color: COLORS[0],
    permissions: {},
    status: 'active',
  });

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.Profile.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Profile.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Profile.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Profile.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setDeleteDialog(null);
    },
  });

  const handleOpenDialog = (profile = null) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        name: profile.name,
        level: profile.level,
        description: profile.description || '',
        color: profile.color || COLORS[0],
        permissions: profile.permissions || {},
        status: profile.status || 'active',
      });
    } else {
      setEditingProfile(null);
      setFormData({
        name: '',
        level: (profiles.length || 0) + 1,
        description: '',
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        permissions: {},
        status: 'active',
      });
    }
    setExpandedCategories(['operacao']);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProfile(null);
  };

  const handleSubmit = () => {
    // Garante que TODAS as permissões conhecidas estejam explicitamente definidas (true ou false)
    const allPermissions = {};
    Object.values(PERMISSION_CATEGORIES).forEach(category => {
      category.permissions.forEach(p => {
        allPermissions[p.id] = formData.permissions?.[p.id] === true;
      });
    });
    const dataToSave = { ...formData, permissions: allPermissions };

    if (editingProfile) {
      updateMutation.mutate({ id: editingProfile.id, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  const togglePermission = (permissionId) => {
    const newPermissions = { ...formData.permissions };
    newPermissions[permissionId] = !newPermissions[permissionId];
    setFormData({ ...formData, permissions: newPermissions });
  };

  const toggleAllInCategory = (categoryKey, select) => {
    const newPermissions = { ...formData.permissions };
    PERMISSION_CATEGORIES[categoryKey].permissions.forEach(p => {
      newPermissions[p.id] = select;
    });
    setFormData({ ...formData, permissions: newPermissions });
  };

  const countPermissions = (permissions) => {
    return Object.values(permissions || {}).filter(Boolean).length;
  };

  const countCategoryPermissions = (categoryKey, permissions) => {
    return PERMISSION_CATEGORIES[categoryKey].permissions.filter(p => permissions?.[p.id]).length;
  };

  const hasPermission = (profile, permissionId) => {
    return profile.permissions?.[permissionId] === true;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const sortedProfiles = [...profiles].sort((a, b) => (a.level || 0) - (b.level || 0));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Perfis e Permissões</h1>
          <p className="text-gray-500 mt-1">Configure os níveis de acesso do sistema</p>
        </div>
        <Button className="gap-2 bg-red-600 hover:bg-red-700" onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4" />
          Novo Perfil
        </Button>
      </div>

      {/* Profile Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedProfiles.map((profile) => (
          <Card key={profile.id} className="group hover:shadow-lg transition-shadow border-gray-100">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${profile.color}15` }}
                  >
                    <Shield className="w-5 h-5" style={{ color: profile.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{profile.name}</h3>
                    <p className="text-xs text-gray-500">Nível {profile.level}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(profile)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteDialog(profile)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                {profile.description || 'Sem descrição'}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {countPermissions(profile.permissions)} permissões
                </span>
                <Badge 
                  variant="outline" 
                  className={profile.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500'}
                >
                  {profile.status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permissions Matrix */}
      {profiles.length > 0 && (
        <Card className="border-gray-100">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Matriz de Permissões</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Permissão</th>
                    {sortedProfiles.map(profile => (
                      <th key={profile.id} className="text-center py-3 px-4 font-medium" style={{ color: profile.color }}>
                        {profile.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => (
                    <React.Fragment key={categoryKey}>
                      <tr className="bg-gray-50">
                        <td colSpan={sortedProfiles.length + 1} className="py-2 px-4 font-semibold text-gray-700">
                          {category.label}
                        </td>
                      </tr>
                      {category.permissions.map(permission => (
                        <tr key={permission.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{permission.label}</p>
                              <p className="text-xs text-gray-500">{permission.description}</p>
                            </div>
                          </td>
                          {sortedProfiles.map(profile => (
                            <td key={profile.id} className="text-center py-3 px-4">
                              {hasPermission(profile, permission.id) ? (
                                <Check className="w-5 h-5 mx-auto text-green-500" />
                              ) : (
                                <X className="w-5 h-5 mx-auto text-gray-300" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Editar Perfil' : 'Novo Perfil'}</DialogTitle>
            <DialogDescription>
              {editingProfile ? 'Atualize as informações do perfil.' : 'Configure um novo perfil de acesso.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Perfil *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Admin"
                />
              </div>
              <div className="space-y-2">
                <Label>Nível Hierárquico</Label>
                <Select
                  value={String(formData.level)}
                  onValueChange={(value) => setFormData({ ...formData, level: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(level => (
                      <SelectItem key={level} value={String(level)}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do perfil"
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "w-8 h-8 rounded-lg transition-transform",
                        formData.color === color && 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-4">
              <Label className="text-base">Permissões</Label>
              
              {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => {
                const isExpanded = expandedCategories.includes(categoryKey);
                const categoryCount = countCategoryPermissions(categoryKey, formData.permissions);
                const totalCount = category.permissions.length;

                return (
                  <Collapsible
                    key={categoryKey}
                    open={isExpanded}
                    onOpenChange={(open) => {
                      if (open) {
                        setExpandedCategories([...expandedCategories, categoryKey]);
                      } else {
                        setExpandedCategories(expandedCategories.filter(c => c !== categoryKey));
                      }
                    }}
                  >
                    <div className="border border-gray-200 rounded-lg">
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
                        <span className="font-medium text-gray-900">{category.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">{categoryCount}/{totalCount}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="border-t border-gray-100 p-4 space-y-3">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => toggleAllInCategory(categoryKey, categoryCount < totalCount)}
                          >
                            {categoryCount < totalCount ? 'Marcar Todos' : 'Desmarcar Todos'}
                          </Button>
                          
                          {category.permissions.map(permission => (
                            <div 
                              key={permission.id}
                              className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50"
                            >
                              <Checkbox
                                id={permission.id}
                                checked={formData.permissions?.[permission.id] || false}
                                onCheckedChange={() => togglePermission(permission.id)}
                              />
                              <div className="flex-1">
                                <label 
                                  htmlFor={permission.id}
                                  className="text-sm font-medium text-gray-900 cursor-pointer"
                                >
                                  {permission.label}
                                </label>
                                <p className="text-xs text-gray-500">{permission.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
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
            <AlertDialogTitle>Excluir perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O perfil "{deleteDialog?.name}" será removido.
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