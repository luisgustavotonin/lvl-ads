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
  Clock,
  Key } from
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

const NAV_SECTIONS = [
  {
    label: 'Início',
    items: [
      { name: 'Dashboard', href: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard' },
      { name: 'Relatórios', href: 'Reports', icon: FileText, permission: 'view_reports' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { name: 'Unidades', href: 'Units', icon: Building2, permission: 'manage_units' },
      { name: 'Integrações', href: 'Integrations', icon: Link2, permission: 'manage_integrations' },
      { name: 'Agendamentos', href: 'IngestSchedules', icon: Clock, permission: 'manage_schedules' },
      { name: 'Ingestão Meta', href: 'MetaIngest', icon: Zap, permission: 'run_manual_ingest' },
      { name: 'Tokens Meta', href: 'MetaTokens', icon: Key, permission: 'manage_data' },
    ],
  },
  {
    label: 'Administração',
    items: [
      { name: 'Parâmetros & Alertas', href: 'ParametersAlerts', icon: Bell, permission: 'manage_permissions' },
      { name: 'Perfis', href: 'Profiles', icon: Shield, permission: 'manage_profiles' },
      { name: 'Usuários', href: 'Users', icon: Users, permission: 'manage_users' },
      { name: 'Gestão de Dados', href: 'DataManagement', icon: Database, permission: 'manage_data' },
      { name: 'Configurações', href: 'Settings', icon: Settings, permission: 'admin_only' },
    ],
  },
];


export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authState, setAuthState] = useState({ user: null, permissions: null, loading: true });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    async function init() {
      try {
        const me = await base44.auth.me();

        // Admin: acesso total
        if (me?.role === 'admin') {
          setAuthState({ user: me, permissions: 'ADMIN', loading: false });
          return;
        }

        // Aplica perfil pendente se houver (quando usuário loga pela primeira vez)
        await base44.functions.invoke('applyPendingUserProfile', {}).catch(() => {});

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

        // Redireciona se o usuário está no Dashboard sem ter permissão
        if (currentPageName === 'Dashboard' && !permissions?.view_dashboard) {
          if (permissions?.view_reports) {
            navigate(createPageUrl('Reports'));
          }
        }

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

  const visibleSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccess(item.permission)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {sidebarOpen &&
      <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      }

      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-background border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Brand Header */}
          <div className="px-5 py-5 border-b border-border">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-primary leading-none">Ads</span>
              <span className="text-[11px] font-medium text-muted-foreground leading-none translate-y-[-3px]">by</span>
              <span className="text-xl font-bold text-foreground leading-none">IDK</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Carregando...</div>
            ) : (
              visibleSections.map((section) => (
                <div key={section.label} className="mb-5">
                  <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = currentPageName === item.href;
                      return (
                        <Link
                          key={item.name}
                          to={createPageUrl(item.href)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            isActive
                              ? "bg-muted text-primary"
                              : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                          )}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon className={cn("w-[18px] h-[18px]", isActive ? "text-primary" : "text-muted-foreground")} />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </nav>

          {/* User */}
          <div className="p-3 border-t border-border space-y-2">
            <div className="flex items-center gap-3 px-2 py-1">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getInitials(user?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.full_name || 'Usuário'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => base44.auth.logout()}>

              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-background border-b border-border">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            {/* Logo centralizado no mobile */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-baseline gap-1 lg:hidden">
              <span className="text-base font-bold text-primary leading-none">Ads</span>
              <span className="text-[9px] font-medium text-muted-foreground leading-none translate-y-[-2px]">by</span>
              <span className="text-base font-bold text-foreground leading-none">IDK</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5 text-muted-foreground" />
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border lg:hidden">
          <div className="flex items-stretch justify-around px-4 max-w-md mx-auto">
          {BOTTOM_NAV.filter((item) => canAccess(item.permission)).map((item) => {
          const isActive = currentPageName === item.href;
          return (
            <Link
              key={item.name}
              to={createPageUrl(item.href)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground'}`
              }>
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.name}
              </Link>);
        })}
          <button
            onClick={() => base44.auth.logout()}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium text-red-500 transition-colors hover:text-red-600"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
          </div>
        </nav>
      }
    </div>);

}