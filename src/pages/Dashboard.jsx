import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Link2, FileText, ArrowUpRight, Building2, DollarSign, MessageCircle, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import MetaFunnelSection from '@/components/dashboard/MetaFunnelSection';
import PeriodFilter from '@/components/report/PeriodFilter';

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

export default function Dashboard() {
  const [period, setPeriod] = useState({
    start: subDays(new Date(), 6),
    end: new Date(),
  });

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

  const { data: userProfiles = [] } = useQuery({
    queryKey: ['userProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: !!currentUser && currentUser.role !== 'admin',
    staleTime: 5 * 60 * 1000,
  });

  // Filtra unidades conforme permissão do usuário
  const units = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return allUnits;
    const myProfile = userProfiles.find(up => up.user_id === currentUser.id);
    if (!myProfile || !myProfile.unit_ids || myProfile.unit_ids.length === 0) return allUnits;
    return allUnits.filter(u => myProfile.unit_ids.includes(u.id));
  }, [currentUser, allUnits, userProfiles]);

  const { data: metrics = [], isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboardMetrics', period.start, period.end],
    queryFn: async () => {
      const startDate = format(period.start, 'yyyy-MM-dd');
      const endDate = format(period.end, 'yyyy-MM-dd');
      const data = await base44.entities.MetaInsightBase.filter({
        date: { $gte: startDate, $lte: endDate }
      }, '-date', 5000);
      return data || [];
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });



  // Calculate totals
  const totalSpend = metrics.reduce((sum, m) => sum + (m.spend || 0), 0);
  const totalConversations = metrics.reduce((sum, m) => sum + (m.messaging_conversations_started || 0), 0);
  const totalCostPerConversation = totalConversations > 0 ? totalSpend / totalConversations : 0;
  const activeUnits = units.filter(u => u.status === 'active' || !u.status).length;

  // Prepare chart data
  const chartData = metrics
    .reduce((acc, m) => {
      const existing = acc.find(d => d.date === m.date);
      if (existing) {
        existing.spend += m.spend || 0;
      } else {
        acc.push({ date: m.date, spend: m.spend || 0 });
      }
      return acc;
    }, [])
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-14);

  if (unitsLoading) {
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
        <Link to={createPageUrl('Reports')}>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-sm">
            <FileText className="w-4 h-4" />
            Ver Relatórios
          </Button>
        </Link>
      </div>

      {/* Period Filter */}
      <Card className="p-4 bg-white border border-gray-200 shadow-sm">
        <PeriodFilter value={period} onChange={setPeriod} />
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Investimento Total', value: formatCurrency(totalSpend), sub: 'Período selecionado', icon: DollarSign, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'Total Conversas', value: formatNumber(totalConversations), sub: 'Período selecionado', icon: MessageCircle, bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'Custo/Conversa', value: formatCurrency(totalCostPerConversation), sub: 'Período selecionado', icon: TrendingDown, bg: 'bg-orange-50', color: 'text-orange-600' },
          { label: 'Unidades Ativas', value: activeUnits, sub: `Total: ${units.length}`, icon: Building2, bg: 'bg-purple-50', color: 'text-purple-600' },
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
      <MetaFunnelSection 
        unitId={null}
        period="custom"
        customStartDate={period.start}
        customEndDate={period.end}
      />

      {/* Chart and Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 border-gray-100" style={{ minHeight: 300 }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Investimento Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 18, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => format(new Date(d), 'dd/MM')}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    />
                    <YAxis
                      tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), 'Investimento']}
                      labelFormatter={(date) => format(new Date(date), "dd 'de' MMMM", { locale: ptBR })}
                    />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                      label={({ x, y, value, index }) => {
                        const anchor = index === 0 ? 'start' : index === chartData.length - 1 ? 'end' : 'middle';
                        return (
                          <text x={x} y={y - 6} fontSize={11} fontWeight="400" fill="#9CA3AF" textAnchor={anchor}>
                            {value >= 1000 ? `R$${(value/1000).toFixed(1)}k` : `R$${value.toFixed(0)}`}
                          </text>
                        );
                      }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Cards */}
        <div className="space-y-4">
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-400" />
                Unidades Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {units.slice(0, 3).map((unit) => (
                  <div key={unit.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: unit.color || '#3B82F6' }}
                    >
                      {unit.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900 truncate">{unit.name}</span>
                  </div>
                ))}
              </div>
              <Link to={createPageUrl('Units')}>
                <Button variant="outline" className="w-full mt-4 gap-2">
                  Ver todas
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}