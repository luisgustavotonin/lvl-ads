import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

const statusBadges = {
  success: { label: 'OK', className: 'bg-green-100 text-green-800' },
  error: { label: 'Falhou', className: 'bg-red-100 text-red-800' },
  pending: { label: 'Em processamento', className: 'bg-yellow-100 text-yellow-800' },
  scheduled: { label: 'Agendado', className: 'bg-gray-100 text-gray-800' },
  running: { label: 'Executado', className: 'bg-blue-100 text-blue-800' }
};

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
    <div className="overflow-x-auto">
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
            const executionDate = new Date(log.execution_time);
            const statusBadge = statusBadges[log.status] || statusBadges.pending;
            const executionType = log.trigger_type === 'manual' ? 'Manual' : 'Agendado';
            
            return (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{getUnitName(log.unit_id)}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={log.trigger_type === 'manual' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                    {executionType}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {executionDate.toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {executionDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3">
                  <Badge className={statusBadge.className}>
                    {statusBadge.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs max-w-md truncate">
                  {log.message || '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}