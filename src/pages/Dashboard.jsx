import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Building2, 
  Link2, 
  FileText, 
  ArrowUpRight,
  Building2,
  DollarSign,
  MessageCircle,
  TrendingDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, LabelList } from 'recharts';
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

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
  });

  const { data: metrics = [], isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboardMetrics', period.start, period.end],
    queryFn: async () => {
      try {
        const startDate = format(period.start, 'yyyy-MM-dd');
        const endDate = format(period.end, 'yyyy-MM-dd');
        
        // Buscar apenas runs ativos da unidade
        const runs = await base44.entities.Run.filter({
          status: { $in: ['success', 'partial'] }
        });
        
        if (runs.length === 0) return [];
        
        const runIds = runs.map(r => r.run_id);
        
        const data = await base44.entities.MetaAdInsights.filter({
          date: { 
            $gte: startDate, 
            $lte: endDate
          }
        }, '-date', 5000);
        return data || [];
      } catch (error) {
        console.error('Erro ao buscar métricas:', error);
        return [];
      }
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });



  // Calculate totals
  const totalSpend = metrics.reduce((sum, m) => sum + (m.spend || 0), 0);
  const totalConversations = metrics.reduce((sum, m) => sum + (m.wa_conversations_started_7d || 0), 0);
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Visão geral da sua mídia paga</p>
        </div>
        <Link to={createPageUrl('Reports')}>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Investimento Total</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(totalSpend)}</p>
                <p className="text-gray-400 text-sm mt-2">Período selecionado</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Conversas Iniciadas</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{formatNumber(totalConversations)}</p>
                <p className="text-gray-400 text-sm mt-2">Período selecionado</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Custo por Conversa</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(totalCostPerConversation)}</p>
                <p className="text-gray-400 text-sm mt-2">Período selecionado</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Unidades Ativas</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{activeUnits}</p>
                <p className="text-gray-400 text-sm mt-2">Total cadastradas: {units.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meta Funnel Section */}
      <MetaFunnelSection 
        unitId={null}
        period="custom"
        customStart={period.start}
        customEnd={period.end}
      />

      {/* Chart and Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 border-gray-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Investimento Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSpendDash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(d) => format(new Date(d), 'dd/MM')}
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(value), 'Investimento']}
                      labelFormatter={(date) => format(new Date(date), "dd 'de' MMMM", { locale: ptBR })}
                    />
                    <Area 
                     type="monotone" 
                     dataKey="spend" 
                     stroke="#3B82F6" 
                     strokeWidth={2}
                     fill="url(#colorSpendDash)"
                    >
                     <LabelList 
                       dataKey="spend" 
                       position="top" 
                       formatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`}
                       style={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                     />
                    </Area>
                  </AreaChart>
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