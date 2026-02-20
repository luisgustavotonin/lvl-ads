import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, Users as UsersIcon, Mail, Shield, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function Users() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [formData, setFormData] = useState({
    profile_id: '',
    unit_ids: [],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.Profile.list(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: userProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['userProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const createUserProfileMutation = useMutation({
    mutationFn: (data) => base44.entities.UserProfile.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
      handleCloseDialog();
    },
  });

  const updateUserProfileMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserProfile.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
      handleCloseDialog();
    },
  });

  const deleteUserProfileMutation = useMutation({
    mutationFn: (id) => base44.entities.UserProfile.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
      setDeleteDialog(null);
    },
  });

  const handleOpenEditDialog = (user) => {
    const userProfile = userProfiles.find(up => up.user_id === user.id);
    setEditingUser(user);
    setFormData({
      profile_id: userProfile?.profile_id || '',
      unit_ids: userProfile?.unit_ids || [],
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = () => {
    const existingUserProfile = userProfiles.find(up => up.user_id === editingUser.id);
    
    if (existingUserProfile) {
      updateUserProfileMutation.mutate({
        id: existingUserProfile.id,
        data: { ...formData, user_id: editingUser.id }
      });
    } else {
      createUserProfileMutation.mutate({
        user_id: editingUser.id,
        ...formData
      });
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) return;
    await base44.users.inviteUser(inviteEmail, inviteRole);
    setInviteEmail('');
    setInviteRole('user');
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const toggleUnit = (unitId) => {
    const unitIds = formData.unit_ids || [];
    if (unitIds.includes(unitId)) {
      setFormData({ ...formData, unit_ids: unitIds.filter(id => id !== unitId) });
    } else {
      setFormData({ ...formData, unit_ids: [...unitIds, unitId] });
    }
  };

  const getUserProfile = (userId) => {
    const userProfile = userProfiles.find(up => up.user_id === userId);
    if (!userProfile) return null;
    return profiles.find(p => p.id === userProfile.profile_id);
  };

  const getUserUnits = (userId) => {
    const userProfile = userProfiles.find(up => up.user_id === userId);
    if (!userProfile?.unit_ids?.length) return [];
    return units.filter(u => userProfile.unit_ids.includes(u.id));
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  if (usersLoading || profilesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-500 mt-1">Gerencie os usuários do sistema</p>
        </div>
      </div>

      {/* Invite User Card */}
      <Card className="border-gray-100">
        <CardContent className="p-4 sm:p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Convidar Usuário</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              className="gap-2 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
              onClick={handleInviteUser}
              disabled={!inviteEmail}
            >
              <Mail className="w-4 h-4" />
              Convidar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-gray-100">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Usuário</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Unidades</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const profile = getUserProfile(user.id);
                const userUnits = getUserUnits(user.id);
                
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name || 'Sem nome'}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {profile ? (
                        <Badge 
                          variant="outline"
                          style={{ 
                            backgroundColor: `${profile.color}15`,
                            color: profile.color,
                            borderColor: `${profile.color}40`
                          }}
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          {profile.name}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-sm">Não atribuído</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {userUnits.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {userUnits.length === 1 
                              ? userUnits[0].name 
                              : `${userUnits.length} unidades`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Todas</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={user.role === 'admin' 
                          ? 'bg-purple-50 text-purple-700 border-purple-200' 
                          : 'bg-gray-50 text-gray-600 border-gray-200'}
                      >
                        {user.role === 'admin' ? 'Admin' : 'Usuário'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleOpenEditDialog(user)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit User Profile Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Acesso</DialogTitle>
            <DialogDescription>
              Configure o perfil e unidades de acesso para {editingUser?.full_name || editingUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select
                value={formData.profile_id}
                onValueChange={(value) => setFormData({ ...formData, profile_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: profile.color }}
                        />
                        {profile.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidades de Acesso</Label>
              <p className="text-sm text-gray-500 mb-3">
                Selecione as unidades que este usuário pode acessar. Se nenhuma for selecionada, terá acesso a todas.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-3">
                {units.map((unit) => (
                  <div 
                    key={unit.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleUnit(unit.id)}
                  >
                    <Checkbox
                      checked={formData.unit_ids?.includes(unit.id)}
                      onCheckedChange={() => toggleUnit(unit.id)}
                    />
                    <div 
                      className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-medium"
                      style={{ backgroundColor: unit.color || '#3B82F6' }}
                    >
                      {unit.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-900">{unit.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createUserProfileMutation.isPending || updateUserProfileMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}