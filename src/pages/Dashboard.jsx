import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Link2, FileText, ArrowUpRight, TrendingUp, DollarSign, MessageCircle, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBrasiliaToday } from '@/lib/brasiliaDate';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import MetaFunnelSection from '@/components/dashboard/MetaFunnelSection';
import PeriodFilter, { ALL_PRESETS } from '@/components/report/PeriodFilter';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
};

const formatNumber = (value) => {
  return new Intl.NumberFormat('pt-BR').format(value || 0);
};

const PRESET_ID_MAP = {
  today: 'today', yesterday: 'yesterday',
  last_7: 'last_7', last_7_days: 'last_7',
  last_14: 'last_14', last_14_days: 'last_14',
  last_28: 'last_28', last_30: 'last_30', last_30_days: 'last_30',
  mtd: 'mtd', last_month: 'last_month', custom: 'custom',
};

const getDefaultPeriodDates = (periodKey) => {
  const today = getBrasiliaToday();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  let dates;
  switch (periodKey) {
    case 'today':       dates = { start: today, end: today }; break;
    case 'yesterday':   dates = { start: subDays(today, 1), end: subDays(today, 1) }; break;
    case 'last_7':
    case 'last_7_days': dates = { start: subDays(today, 6), end: today }; break;
    case 'last_14':
    case 'last_14_days':dates = { start: subDays(today, 13), end: today }; break;
    case 'last_28':     dates = { start: subDays(today, 27), end: today }; break;
    case 'last_30':
    case 'last_30_days':dates = { start: subDays(today, 29), end: today }; break;
    case 'mtd':         dates = { start: startOfMonth, end: today }; break;
    case 'last_month':  dates = { start: startOfLastMonth, end: endOfLastMonth }; break;
    default:            dates = { start: subDays(today, 6), end: today }; break;
  }
  return { ...dates, presetId: PRESET_ID_MAP[periodKey] || 'custom' };
};

export default function Dashboard() {
  const [period, setPeriod] = useState(null);
  const [periodInitialized, setPeriodInitialized] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: allUnits = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userProfiles, isSuccess: userProfilesLoaded } = useQuery({
    queryKey: ['userProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: !!currentUser && currentUser.role !== 'admin',
    staleTime: 5 * 60 * 1000,
  });

  const { data: allProfiles, isSuccess: allProfilesLoaded } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.Profile.list(),
    enabled: !!currentUser && currentUser.role !== 'admin',
    staleTime: 5 * 60 * 1000,
  });

  const userProfileData = useMemo(() => {
    if (!currentUser || currentUser.role === 'admin') return null;
    if (!userProfiles || !allProfiles) return null;
    const myUserProfile = userProfiles.find(up => up.user_id === currentUser.id);
    if (!myUserProfile) return null;
    return allProfiles.find(p => p.id === myUserProfile.profile_id) || null;
  }, [currentUser, userProfiles, allProfiles]);

  const allowedPeriods = useMemo(() => {
    if (!userProfileData) return null;
    return userProfileData.allowed_periods?.length > 0 ? userProfileData.allowed_periods : null;
  }, [userProfileData]);

  // Inicializar período com base no perfil
  useEffect(() => {
    if (periodInitialized) return;
    if (!currentUser) return; // aguarda currentUser carregar

    if (currentUser.role === 'admin') {
      setPeriod(getDefaultPeriodDates('today'));
      setPeriodInitialized(true);
      return;
    }

    // Para não-admin: aguarda as queries terminarem com sucesso
    if (!userProfilesLoaded || !allProfilesLoaded) return;

    const defaultKey = userProfileData?.default_period || 'today';
    setPeriod(getDefaultPeriodDates(defaultKey));
    setPeriodInitialized(true);
  }, [currentUser, userProfileData, periodInitialized, userProfilesLoaded, allProfilesLoaded]);

  // Filtra unidades conforme permissão do usuário
  const units = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return allUnits;
    const myProfile = (userProfiles || []).find(up => up.user_id === currentUser.id);
    if (!myProfile || !myProfile.unit_ids || myProfile.unit_ids.length === 0) return allUnits;
    return allUnits.filter(u => myProfile.unit_ids.includes(u.id));
  }, [currentUser, allUnits, userProfiles]);

  const { data: metrics = [], isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboardMetrics', period?.start, period?.end],
    queryFn: async () => {
      if (!period) return [];
      const startDate = format(period.start, 'yyyy-MM-dd');
      const endDate = format(period.end, 'yyyy-MM-dd');
      const data = await base44.entities.MetaInsightBase.filter({
        date: { $gte: startDate, $lte: endDate }
      }, '-date', 5000);
      return data || [];
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!period,
    });



  // Totals do período selecionado (cards)
  const totalSpend = metrics.reduce((sum, m) => sum + (m.spend || 0), 0);
  const totalConversations = metrics.reduce((sum, m) => sum + (m.messaging_conversations_started || 0), 0);
  const totalImpressions = metrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
  const totalCostPerConversation = totalConversations > 0 ? totalSpend / totalConversations : 0;

  // Gráfico: sempre traz os últimos 90 dias, independentemente do período
  // selecionado nos cards — oferece um contexto histórico mais amplo.
  const { data: chartMetrics = [], isLoading: chartLoading } = useQuery({
    queryKey: ['dashboardChartMetrics'],
    queryFn: async () => {
      const today = getBrasiliaToday();
      const start = subDays(today, 89);
      const data = await base44.entities.MetaInsightBase.filter({
        date: { $gte: format(start, 'yyyy-MM-dd'), $lte: format(today, 'yyyy-MM-dd') }
      }, '-date', 10000);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const chartData = useMemo(() => {
    const byDate = {};
    for (const m of chartMetrics) {
      const d = m.date;
      if (!byDate[d]) byDate[d] = { date: d, spend: 0, conversations: 0, impressions: 0 };
      byDate[d].spend += m.spend || 0;
      byDate[d].conversations += m.messaging_conversations_started || 0;
      byDate[d].impressions += m.impressions || 0;
    }
    return Object.values(byDate).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [chartMetrics]);

  if (unitsLoading || !period) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">Visão geral da sua mídia paga</p>
        </div>

      </div>

      {/* Period Filter */}
      <Card className="p-4 bg-white border border-gray-200 shadow-sm">
        <PeriodFilter value={period} onChange={setPeriod} allowedPresets={allowedPeriods} />
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Investimento Total', value: formatCurrency(totalSpend), sub: 'Período selecionado', icon: DollarSign, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'Total Conversas', value: formatNumber(totalConversations), sub: 'Período selecionado', icon: MessageCircle, bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'Custo/Conversa', value: formatCurrency(totalCostPerConversation), sub: 'Período selecionado', icon: TrendingDown, bg: 'bg-orange-50', color: 'text-orange-600' },
          { label: 'Impressões', value: formatNumber(totalImpressions), sub: 'Período selecionado', icon: TrendingUp, bg: 'bg-purple-50', color: 'text-purple-600' },
        ].map(({ label, value, sub, icon: Icon, bg, color }) => (
          <Card key={label} className="border-gray-100">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-gray-500 text-xs sm:text-sm font-medium truncate">{label}</p>
                  <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-1 truncate">{value}</p>
                  <p className="text-gray-400 text-xs mt-1 sm:mt-2">{sub}</p>
                </div>
                <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 ml-2`}>
                  <Icon className={`w-4 h-4 sm:w-6 sm:h-6 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Meta Funnel Section */}
      {units.length > 0 && (
        <MetaFunnelSection 
          unitId={units[0]?.id || null}
          period="custom"
          customStartDate={period.start}
          customEndDate={period.end}
        />
      )}

      {/* Chart */}
      <Card className="border-gray-100" style={{ minHeight: 320 }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg font-semibold">Investimento e Conversas — últimos 90 dias</CardTitle>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#3B82F6] inline-block" />Investimento</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#10B981] inline-block" />Conversas</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 18, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => format(new Date(d), 'dd/MM')}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    minTickGap={24}
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v.toFixed(0)}`}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  />
                  <Tooltip
                    formatter={(value, name) => name === 'Investimento'
                      ? [formatCurrency(value), 'Investimento']
                      : [formatNumber(value), 'Conversas']}
                    labelFormatter={(date) => format(new Date(date), "dd 'de' MMMM", { locale: ptBR })}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="spend" name="Investimento" stroke="#3B82F6" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="conversations" name="Conversas" stroke="#10B981" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                {chartLoading ? 'Carregando...' : 'Nenhum dado disponível'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}