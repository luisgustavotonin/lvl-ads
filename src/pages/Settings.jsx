import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Settings as SettingsIcon, User, Bell, Palette, Shield, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function Settings() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 mt-1">Gerencie as configurações do sistema</p>
      </div>

      {/* Profile Section */}
      <Card className="border-gray-100">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-gray-400" />
            Perfil
          </CardTitle>
          <CardDescription>Suas informações pessoais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="w-20 h-20">
              <AvatarFallback className="bg-blue-100 text-blue-600 text-2xl">
                {getInitials(user?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">{user?.full_name || 'Usuário'}</h3>
              <p className="text-gray-500">{user?.email}</p>
              <p className="text-sm text-gray-400 mt-1">
                {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={user?.full_name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-gray-100">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-400" />
            Notificações
          </CardTitle>
          <CardDescription>Configure suas preferências de notificação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Relatórios por Email</p>
              <p className="text-sm text-gray-500">Receber relatórios semanais por email</p>
            </div>
            <Switch />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Alertas de Erro</p>
              <p className="text-sm text-gray-500">Notificar quando uma integração falhar</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Atualizações do Sistema</p>
              <p className="text-sm text-gray-500">Receber notificações sobre novas funcionalidades</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="border-gray-100">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="w-5 h-5 text-gray-400" />
            Aparência
          </CardTitle>
          <CardDescription>Personalize a interface do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Modo Escuro</p>
              <p className="text-sm text-gray-500">Usar tema escuro na interface</p>
            </div>
            <Switch />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Sidebar Compacta</p>
              <p className="text-sm text-gray-500">Reduzir tamanho do menu lateral</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Regional */}
      <Card className="border-gray-100">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-400" />
            Regional
          </CardTitle>
          <CardDescription>Configurações de idioma e moeda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Input value="Português (Brasil)" disabled />
            </div>
            <div className="space-y-2">
              <Label>Moeda Padrão</Label>
              <Input value="BRL (R$)" disabled />
            </div>
            <div className="space-y-2">
              <Label>Fuso Horário</Label>
              <Input value="America/Sao_Paulo (UTC-3)" disabled />
            </div>
            <div className="space-y-2">
              <Label>Formato de Data</Label>
              <Input value="DD/MM/YYYY" disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-gray-100">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-400" />
            Segurança
          </CardTitle>
          <CardDescription>Configurações de segurança da conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Autenticação em Dois Fatores</p>
              <p className="text-sm text-gray-500">Adicionar uma camada extra de segurança</p>
            </div>
            <Button variant="outline">Configurar</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Sessões Ativas</p>
              <p className="text-sm text-gray-500">Gerenciar dispositivos conectados</p>
            </div>
            <Button variant="outline">Ver Sessões</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Sair de Todas as Sessões</p>
              <p className="text-sm text-gray-500">Desconectar de todos os dispositivos</p>
            </div>
            <Button variant="destructive" onClick={() => base44.auth.logout()}>
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}