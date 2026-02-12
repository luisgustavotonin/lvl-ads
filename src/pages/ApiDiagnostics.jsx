import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Clock, Activity, TrendingUp, Zap, Settings } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function ApiDiagnosticsPage() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRoute, setFilterRoute] = useState('all');
  const [searchRequestId, setSearchRequestId] = useState('');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Buscar diagnósticos
  const { data: diagnostics = [], isLoading } = useQuery({
    queryKey: ['apiDiagnostics'],
    queryFn: () => base44.entities.ApiDiagnostics.list('-created_date', 200),
    refetchInterval: 5000, // Atualizar a cada 5s
  });

  // Buscar configurações de rate limit
  const { data: rateLimitConfigs = [] } = useQuery({
    queryKey: ['apiRateLimit'],
    queryFn: () => base44.entities.ApiRateLimit.list(),
  });

  // Mutations para configuração
  const createConfigMutation = useMutation({
    mutationFn: (data) => base44.entities.ApiRateLimit.create(data),
    onSuccess: () => queryClient.invalidateQueries(['apiRateLimit']),
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ApiRateLimit.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['apiRateLimit']),
  });

  // Análise de dados
  const stats = useMemo(() => {
    if (!diagnostics.length) return null;

    const total = diagnostics.length;
    const success = diagnostics.filter(d => d.status === 'sucesso').length;
    const errors = diagnostics.filter(d => d.status === 'erro').length;
    const rateLimitErrors = diagnostics.filter(d => d.rateLimitSuspected).length;
    const avgDuration = diagnostics
      .filter(d => d.durationMs > 0)
      .reduce((sum, d) => sum + d.durationMs, 0) / diagnostics.filter(d => d.durationMs > 0).length || 0;

    // Agrupar por minuto (últimos 60 min)
    const now = Date.now();
    const last60Min = Array.from({ length: 60 }, (_, i) => {
      const minuteStart = now - (i * 60000);
      const count = diagnostics.filter(d => {
        const time = new Date(d.created_date).getTime();
        return time >= minuteStart - 60000 && time < minuteStart;
      }).length;
      return {
        minute: 60 - i,
        count: count,
        label: `${60 - i}min`
      };
    }).reverse();

    // Detectar bursts (> 10 requests em 10s)
    const bursts = [];
    diagnostics.forEach((d, i) => {
      const time = new Date(d.created_date).getTime();
      const in10s = diagnostics.filter(dd => {
        const t = new Date(dd.created_date).getTime();
        return Math.abs(t - time) < 10000;
      }).length;
      if (in10s > 10 && !bursts.some(b => Math.abs(new Date(b.created_date).getTime() - time) < 10000)) {
        bursts.push({ ...d, burstCount: in10s });
      }
    });

    return {
      total,
      success,
      errors,
      successRate: total > 0 ? ((success / total) * 100).toFixed(1) : 0,
      errorRate: total > 0 ? ((errors / total) * 100).toFixed(1) : 0,
      rateLimitErrors,
      avgDuration: avgDuration.toFixed(0),
      last60Min,
      bursts: bursts.slice(0, 5)
    };
  }, [diagnostics]);

  // Filtrar logs
  const filteredLogs = useMemo(() => {
    return diagnostics.filter(d => {
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;
      if (filterRoute !== 'all' && d.route !== filterRoute) return false;
      if (searchRequestId && !d.requestId?.includes(searchRequestId)) return false;
      return true;
    });
  }, [diagnostics, filterStatus, filterRoute, searchRequestId]);

  // Configuração atual
  const currentConfig = rateLimitConfigs.find(c => c.route === '/receiveN8nData');

  const handleSaveConfig = async (data) => {
    if (currentConfig) {
      await updateConfigMutation.mutateAsync({ id: currentConfig.id, data });
    } else {
      await createConfigMutation.mutateAsync({ route: '/receiveN8nData', ...data });
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Acesso restrito a administradores</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-12">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Diagnóstico de API</h1>
          <p className="text-gray-600 mt-1">Monitoramento em tempo real de requests e rate limiting</p>
        </div>
      </div>

      {/* Cards de estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">Últimos 200 registros</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Taxa de Sucesso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.successRate}%</div>
              <p className="text-xs text-gray-500 mt-1">{stats.success} sucessos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Taxa de Erros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.errorRate}%</div>
              <p className="text-xs text-gray-500 mt-1">{stats.errors} erros</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Tempo Médio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgDuration}ms</div>
              <p className="text-xs text-gray-500 mt-1">Duração do request</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráfico de requests por minuto */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Requests por Minuto (Últimos 60 min)</CardTitle>
            <CardDescription>Volume de chamadas à API ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.last60Min}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#93c5fd" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Bursts detectados */}
      {stats && stats.bursts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Zap className="w-5 h-5" />
              Bursts Detectados
            </CardTitle>
            <CardDescription>Picos de requests que podem indicar problemas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.bursts.map((burst, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                  <div>
                    <p className="font-medium">{new Date(burst.created_date).toLocaleString('pt-BR')}</p>
                    <p className="text-sm text-gray-600">Request ID: {burst.requestId}</p>
                  </div>
                  <Badge variant="destructive">{burst.burstCount} requests em 10s</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuração de Rate Limit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuração de Rate Limit
          </CardTitle>
          <CardDescription>Defina limites para proteção da API</CardDescription>
        </CardHeader>
        <CardContent>
          <RateLimitConfig 
            config={currentConfig} 
            onSave={handleSaveConfig}
            isSaving={createConfigMutation.isPending || updateConfigMutation.isPending}
          />
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Logs de Requests</CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sucesso">Sucesso</SelectItem>
                  <SelectItem value="erro">Erro</SelectItem>
                  <SelectItem value="iniciado">Iniciado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Route</Label>
              <Select value={filterRoute} onValueChange={setFilterRoute}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {[...new Set(diagnostics.map(d => d.route))].map(route => (
                    <SelectItem key={route} value={route}>{route}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Request ID</Label>
              <Input 
                placeholder="Buscar por ID..." 
                value={searchRequestId}
                onChange={(e) => setSearchRequestId(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))}
            {filteredLogs.length === 0 && (
              <p className="text-center text-gray-500 py-8">Nenhum log encontrado</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RateLimitConfig({ config, onSave, isSaving }) {
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const [blockOnExceed, setBlockOnExceed] = useState(config?.block_on_exceed ?? false);
  const [max10s, setMax10s] = useState(config?.max_requests_per_10s ?? 20);
  const [max60s, setMax60s] = useState(config?.max_requests_per_60s ?? 100);

  const handleSave = () => {
    onSave({
      enabled,
      block_on_exceed: blockOnExceed,
      max_requests_per_10s: parseInt(max10s),
      max_requests_per_60s: parseInt(max60s)
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Ativar Rate Limit</Label>
          <p className="text-sm text-gray-600">Monitora e controla o volume de requests</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Máx. Requests (10s)</Label>
              <Input 
                type="number" 
                value={max10s}
                onChange={(e) => setMax10s(e.target.value)}
              />
            </div>
            <div>
              <Label>Máx. Requests (60s)</Label>
              <Input 
                type="number" 
                value={max60s}
                onChange={(e) => setMax60s(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Bloquear ao Exceder</Label>
              <p className="text-sm text-gray-600">Retorna erro 429 quando limites são excedidos</p>
            </div>
            <Switch checked={blockOnExceed} onCheckedChange={setBlockOnExceed} />
          </div>
        </>
      )}

      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? 'Salvando...' : 'Salvar Configuração'}
      </Button>
    </div>
  );
}

function LogEntry({ log }) {
  const statusConfig = {
    sucesso: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    erro: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    iniciado: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' }
  };

  const config = statusConfig[log.status] || statusConfig.iniciado;
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border ${config.border} ${config.bg}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <Icon className={`w-5 h-5 mt-0.5 ${config.color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{log.route}</span>
              <Badge variant="outline" className="text-xs">{log.method}</Badge>
              {log.rateLimitSuspected && (
                <Badge variant="destructive" className="text-xs">Rate Limit</Badge>
              )}
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Request ID: <code className="text-xs bg-white px-1 rounded">{log.requestId}</code></p>
              {log.eventId && <p>Event ID: {log.eventId}</p>}
              {log.errorMessage && (
                <p className="text-red-600">Erro: {log.errorMessage}</p>
              )}
              {log.notes && <p>{log.notes}</p>}
            </div>
          </div>
        </div>
        <div className="text-right text-sm text-gray-600 ml-4">
          <p>{new Date(log.created_date).toLocaleString('pt-BR')}</p>
          {log.durationMs > 0 && <p className="text-xs">{log.durationMs}ms</p>}
          {log.httpStatusCode && (
            <Badge variant="outline" className="mt-1">{log.httpStatusCode}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}