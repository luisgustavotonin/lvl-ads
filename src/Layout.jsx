import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Settings,
  Building2,
  Link2,
  Users,
  Shield,
  Database,
  ChevronDown,
  Menu,
  X,
  LogOut,
  Bell,
  Zap,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navigation = [
  { name: 'Dashboard', href: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard' },
  { name: 'Relatórios', href: 'Reports', icon: FileText, permission: 'view_reports' },
  { name: 'Unidades', href: 'Units', icon: Building2, permission: 'manage_units' },
  { name: 'Integrações', href: 'Integrations', icon: Link2, permission: 'manage_integrations' },
  { name: 'Ingestão Meta', href: 'MetaIngest', icon: Zap, permission: 'manage_data' },
  { name: 'Parâmetros & Alertas', href: 'ParametersAlerts', icon: Bell, permission: 'manage_permissions' },
  { name: 'Perfis', href: 'Profiles', icon: Shield, permission: 'manage_profiles' },
  { name: 'Usuários', href: 'Users', icon: Users, permission: 'manage_users' },
  { name: 'Agendamentos', href: 'IngestSchedules', icon: Clock, permission: 'manage_schedules' },
  { name: 'Gestão de Dados', href: 'DataManagement', icon: Database, permission: 'manage_data' },
  { name: 'Configurações', href: 'Settings', icon: Settings, permission: 'admin_only' },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Aplicar modo escuro e sidebar compacta com base nas settings salvas
  const userSettings = user?.settings || {};
  const darkMode = userSettings.darkMode || false;
  const compactSidebar = userSettings.compactSidebar || false;

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const { data: userProfile } = useQuery({
    queryKey: ['myUserProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Busca o UserProfile do usuário atual
      const userProfiles = await base44.entities.UserProfile.filter({ user_id: user.id });
      if (!userProfiles || userProfiles.length === 0) return null;
      const up = userProfiles[0];
      if (!up.profile_id) return null;
      // Busca todos os perfis e encontra o correto pelo id
      const allProfiles = await base44.entities.Profile.list();
      return allProfiles.find(p => p.id === up.profile_id) || null;
    },
    enabled: !!user?.id,
  });

  const canAccess = (permission) => {
    // admins têm acesso a tudo
    if (user?.role === 'admin') return true;
    // itens admin_only: só admin
    if (permission === 'admin_only') return false;
    // se não tem perfil carregado ainda, não mostra nada (aguarda)
    if (!userProfile) return false;
    // verifica a permissão no perfil
    return userProfile.permissions?.[permission] === true;
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50'}`}>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">Unified Ads</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.filter(item => canAccess(item.permission)).map((item) => {
              const isActive = currentPageName === item.href;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.href)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-blue-50 text-blue-600" 
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-blue-600" : "text-gray-400")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="p-3 border-t border-gray-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                      {getInitials(user?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name || 'Usuário'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => base44.auth.logout()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5 text-gray-500" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}