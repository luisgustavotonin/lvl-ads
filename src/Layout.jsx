import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
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
  Clock } from
'lucide-react';

const BOTTOM_NAV = [
{ name: 'Dashboard', href: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard' },
{ name: 'Relatórios', href: 'Reports', icon: FileText, permission: 'view_reports' }];

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
'@/components/ui/dropdown-menu';
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
{ name: 'Configurações', href: 'Settings', icon: Settings, permission: 'admin_only' }];


export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authState, setAuthState] = useState({ user: null, permissions: null, loading: true });
  const location = useLocation();

  useEffect(() => {
    async function init() {
      try {
        const me = await base44.auth.me();

        // Admin: acesso total
        if (me?.role === 'admin') {
          setAuthState({ user: me, permissions: 'ADMIN', loading: false });
          return;
        }

        // Busca todos UserProfiles e filtra pelo user_id = me.id
        const allUserProfiles = await base44.entities.UserProfile.list();
        const myUserProfile = allUserProfiles.find((up) => up.user_id === me.id);

        if (!myUserProfile || !myUserProfile.profile_id) {
          // Usuário sem perfil atribuído = pendente
          setAuthState({ user: me, permissions: null, loading: false });
          return;
        }

        // Busca todos Profiles e filtra pelo id = profile_id
        const allProfiles = await base44.entities.Profile.list();
        const myProfile = allProfiles.find((p) => p.id === myUserProfile.profile_id);

        const permissions = myProfile?.permissions || {};
        setAuthState({ user: me, permissions, loading: false });

      } catch (e) {
        console.error('[Layout] Erro ao inicializar:', e);
        setAuthState({ user: null, permissions: {}, loading: false });
      }
    }
    init();
  }, []);

  const { user, permissions, loading } = authState;

  const darkMode = user?.settings?.darkMode || false;
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Usuário sem perfil atribuído: mostra tela de acesso pendente
  if (!loading && user && permissions === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-yellow-100">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Acesso Pendente</h1>
          <p className="text-slate-600 mb-6">
            Seu acesso ainda não foi configurado. Solicite ao administrador que atribua um perfil à sua conta para que você possa utilizar a plataforma.
          </p>
          <div className="p-4 bg-slate-50 rounded-md text-sm text-slate-500">
            Logado como: <span className="font-medium text-slate-700">{user.email}</span>
          </div>
          <button
            onClick={() => base44.auth.logout()}
            className="mt-4 text-sm text-slate-400 hover:text-slate-600 underline">

            Sair
          </button>
        </div>
      </div>);

  }

  const canAccess = (permission) => {
    if (loading) return false;
    if (permissions === 'ADMIN') return true;
    if (permission === 'admin_only') return false;
    return permissions?.[permission] === true;
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const visibleNav = navigation.filter((item) => canAccess(item.permission));

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50'}`}>
      {sidebarOpen &&
      <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      }

      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              
              
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {loading ?
            <div className="px-3 py-2 text-sm text-gray-400">Carregando...</div> :

            visibleNav.map((item) => {
              const isActive = currentPageName === item.href;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.href)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive ?
                    "bg-blue-50 text-blue-600" :
                    "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                  onClick={() => setSidebarOpen(false)}>

                    <item.icon className={cn("w-5 h-5", isActive ? "text-blue-600" : "text-gray-400")} />
                    {item.name}
                  </Link>);

            })
            }
          </nav>

          {/* User */}
          <div className="p-3 border-t border-gray-100 space-y-2">
            <div className="flex items-center gap-3 px-2 py-1">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                  {getInitials(user?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name || 'Usuário'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => base44.auth.logout()}>

              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
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

        <main className="p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      {!loading &&
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex lg:hidden">
          {BOTTOM_NAV.filter((item) => canAccess(item.permission)).map((item) => {
          const isActive = currentPageName === item.href;
          return (
            <Link
              key={item.name}
              to={createPageUrl(item.href)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
              isActive ? 'text-blue-600' : 'text-gray-500'}`
              }>

                <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.name}
              </Link>);

        })}
        </nav>
      }
    </div>);

}