import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig = {
  success: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Sucesso' },
  error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Erro' },
  pending: { icon: Loader2, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Pendente' },
  scheduled: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Agendado' }
};

const triggerConfig = {
  manual: { label: '🖱️ Manual', color: 'bg-purple-100 text-purple-800' },
  scheduled: { label: '⏰ Agendado', color: 'bg-blue-100 text-blue-800' },
  webhook: { label: '🔗 Webhook', color: 'bg-green-100 text-green-800' }
};

function formatDateBR(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function ExecutionLogViewer({ unitId, logType = null, limit = 10 }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['executionLogs', unitId, logType],
    queryFn: async () => {
      const filters = { unit_id: unitId };
      if (logType) filters.log_type = logType;
      return base44.entities.ExecutionLog.filter(filters, '-execution_time', limit);
    },
    enabled: !!unitId
  });

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500">Carregando logs...</div>;
  }

  if (logs.length === 0) {
    return <div className="text-center py-4 text-gray-500 text-sm">Nenhuma execução registrada</div>;
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const statusCfg = statusConfig[log.status];
        const triggerCfg = triggerConfig[log.trigger_type];
        const Icon = statusCfg.icon;

        return (
          <div
            key={log.id}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border',
              statusCfg.bg
            )}
          >
            <div className="flex items-center gap-3 flex-1">
              <Icon className={cn('w-4 h-4', statusCfg.color)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900">
                    {log.log_type === 'integration_execution' && '📊 Integração'}
                    {log.log_type === 'alert_sent' && '📢 Alerta'}
                    {log.log_type === 'alert_scheduled' && '⏱️ Alerta Agendado'}
                  </p>
                  <Badge variant="outline" className={triggerCfg.color} style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem' }}>
                    {triggerCfg.label}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {formatDateBR(log.execution_time)}
                  </span>
                </div>
                {log.message && <p className="text-xs text-gray-600 mt-1 truncate">{log.message}</p>}
              </div>
            </div>
            <Badge className={statusCfg.color.replace('text-', 'bg-').replace('-600', '-100')} variant="outline">
              {statusCfg.label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}