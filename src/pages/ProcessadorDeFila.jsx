import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Play, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProcessadorDeFila() {
  const [batchSize, setBatchSize] = useState(20);
  const [delayMs, setDelayMs] = useState(1000);
  const queryClient = useQueryClient();

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['queueStats'],
    queryFn: async () => {
      const [pendentes, processando, feitos, erros] = await Promise.all([
        base44.entities.FilaDeEntrada.filter({ status: 'pendente' }),
        base44.entities.FilaDeEntrada.filter({ status: 'processando' }),
        base44.entities.FilaDeEntrada.filter({ status: 'feito' }),
        base44.entities.FilaDeEntrada.filter({ status: 'erro' })
      ]);
      
      return {
        pendentes: pendentes.length,
        processando: processando.length,
        feitos: feitos.length,
        erros: erros.length,
        total: pendentes.length + processando.length + feitos.length + erros.length
      };
    },
    refetchInterval: 5000
  });

  const { data: items } = useQuery({
    queryKey: ['queueItems'],
    queryFn: () => base44.entities.FilaDeEntrada.list('-created_date', 50),
    refetchInterval: 5000
  });

  const processMutation = useMutation({
    mutationFn: () => base44.functions.invoke('processQueue', { 
      batch_size: batchSize,
      delay_ms: delayMs
    }),
    onSuccess: (response) => {
      const data = response.data;
      toast.success(`Processados: ${data.processados} | Sucessos: ${data.sucessos} | Erros: ${data.erros}`);
      queryClient.invalidateQueries({ queryKey: ['queueStats'] });
      queryClient.invalidateQueries({ queryKey: ['queueItems'] });
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const statusConfig = {
    pendente: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: 'Pendente' },
    processando: { icon: Loader2, color: 'bg-blue-100 text-blue-800', label: 'Processando', spin: true },
    feito: { icon: CheckCircle2, color: 'bg-green-100 text-green-800', label: 'Concluído' },
    erro: { icon: AlertCircle, color: 'bg-red-100 text-red-800', label: 'Erro' }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Processador de Fila</h1>
        <Button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['queueStats'] });
            queryClient.invalidateQueries({ queryKey: ['queueItems'] });
          }}
          variant="outline"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pendentes || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Processando</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.processando || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Concluídos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.feitos || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.erros || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Processar Fila</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="batchSize">Itens por lote</Label>
              <Input
                id="batchSize"
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value))}
                min={1}
                max={100}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="delayMs">Delay entre itens (ms)</Label>
              <Input
                id="delayMs"
                type="number"
                value={delayMs}
                onChange={(e) => setDelayMs(parseInt(e.target.value))}
                min={100}
                max={10000}
                step={100}
              />
            </div>
            <Button
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending || (stats?.pendentes || 0) === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Processar Agora
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de itens */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos 50 Itens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {items?.map((item) => {
              const config = statusConfig[item.status];
              const Icon = config.icon;
              
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Icon className={`w-5 h-5 ${config.spin ? 'animate-spin' : ''}`} />
                    <div className="flex-1">
                      <div className="font-medium">{item.event_id}</div>
                      <div className="text-xs text-gray-500">
                        {item.source} • {new Date(item.created_date).toLocaleString('pt-BR')}
                      </div>
                      {item.erro_detalhes && (
                        <div className="text-xs text-red-600 mt-1">{item.erro_detalhes}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={config.color}>
                      {config.label}
                    </Badge>
                    {item.tentativas > 0 && (
                      <Badge variant="outline">
                        {item.tentativas} tentativa{item.tentativas > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}