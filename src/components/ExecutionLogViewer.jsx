import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const statusBadges = {
  completed: { label: 'Realizado', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Falhou', className: 'bg-red-100 text-red-800' },
  // Backward compatibility
  success: { label: 'Realizado', className: 'bg-green-100 text-green-800' },
  error: { label: 'Falhou', className: 'bg-red-100 text-red-800' }
};

export default function ExecutionLogViewer({ unitId, logType = null, limit: defaultLimit = 25 }) {
  const [limit, setLimit] = useState(defaultLimit);
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['executionLogs', unitId, logType],
    queryFn: async () => {
      const filters = { unit_id: unitId };
      if (logType) filters.log_type = logType;
      return base44.entities.ExecutionLog.filter(filters, '-execution_time', limit);
    },
    enabled: !!unitId
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const getUnitName = (unitId) => {
    return units.find(u => u.id === unitId)?.name || 'Unidade';
  };

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500">Carregando histórico...</div>;
  }

  if (logs.length === 0) {
    return <div className="text-center py-4 text-gray-500 text-sm">Nenhuma execução registrada</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 registros</SelectItem>
            <SelectItem value="50">50 registros</SelectItem>
            <SelectItem value="100">100 registros</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Unidade</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Tipo Execução</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Data</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Hora</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Mensagem</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => {
              // Converter UTC para timezone local (America/Sao_Paulo)
              const executionDate = new Date(log.execution_time);
              const localDate = executionDate.toLocaleDateString('pt-BR', { 
                timeZone: 'America/Sao_Paulo'
              });
              const localTime = executionDate.toLocaleTimeString('pt-BR', { 
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit', 
                minute: '2-digit' 
              });
              
              // Priorizar novos campos, fallback para antigos
              const executionType = log.execution_type || log.trigger_type;
              const executionStatus = log.execution_status || log.status;
              
              const statusBadge = statusBadges[executionStatus] || statusBadges.completed;
              const typeLabel = executionType === 'manual' ? 'Manual' : 'Agendado';
              
              // Mensagem de erro ou sucesso
              let displayMessage = log.message || '';
              if (executionStatus === 'failed' || executionStatus === 'error') {
                displayMessage = log.error_details || log.message || 'Erro desconhecido na execução.';
              }
              
              return (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{getUnitName(log.unit_id)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={executionType === 'manual' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                      {typeLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {localDate}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {localTime}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusBadge.className}>
                      {statusBadge.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-md truncate" title={displayMessage}>
                    {displayMessage || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}