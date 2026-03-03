import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Copy, Download, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WebhookLogViewer() {
  const [jobKeySearch, setJobKeySearch] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: logs = [] } = useQuery({
    queryKey: ['webhookLogs', jobKeySearch, statusFilter],
    queryFn: async () => {
      const result = await base44.entities.WebhookLog.list('-created_date', 200);
      return jobKeySearch.trim() 
        ? result.filter(log => log.payload_received?.job_key?.includes(jobKeySearch.trim()) || log.integration_id?.includes(jobKeySearch.trim()))
        : result;
    },
    enabled: true,
  });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(JSON.stringify(text, null, 2));
    toast.success('Copiado!');
  };

  const downloadJSON = (data, filename) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const filteredLogs = useMemo(() => {
    if (statusFilter === 'all') return logs;
    return logs.filter(log => log.status === statusFilter);
  }, [logs, statusFilter]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-700';
      case 'error': return 'bg-red-100 text-red-700';
      case 'warning': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Logs de Webhook</h1>
        <p className="text-gray-500 mt-1 text-sm">Visualize o payload completo e os registros processados de cada webhook</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Buscar por Job Key</Label>
              <Input 
                placeholder="Ex: 16ec9dff, abc123def..." 
                value={jobKeySearch}
                onChange={e => setJobKeySearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-2 flex-wrap">
                {['all', 'success', 'warning', 'error'].map(status => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === 'all' ? 'Todos' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">Total: {filteredLogs.length} registros</p>
        </CardContent>
      </Card>

      {/* Logs List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Nenhum log encontrado</p>
        ) : (
          filteredLogs.map(log => {
            const isExpanded = expandedLog === log.id;
            const recordsCount = log.records_processed 
              ? Object.values(log.records_processed).reduce((a, b) => a + b, 0)
              : 0;

            return (
              <Card key={log.id} className="overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 flex items-start justify-between gap-3"
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={getStatusColor(log.status)}>
                        {log.status}
                      </Badge>
                      <span className="text-sm font-medium text-gray-800">
                        {log.source.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {log.integration_id}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      <span>{new Date(log.created_date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                      {recordsCount > 0 && (
                        <>
                          <span className="mx-2">·</span>
                          <span>{recordsCount} registros processados</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpanded ? 
                      <ChevronUp className="w-4 h-4 text-gray-400" /> : 
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4 space-y-4">
                    {/* Records Processed */}
                    {log.records_processed && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Registros Processados</h3>
                        <div className="bg-white rounded p-3 text-xs font-mono space-y-1 border">
                          {Object.entries(log.records_processed).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-600">{key}:</span>
                              <span className="font-semibold text-gray-900">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {log.error_message && (
                      <div>
                        <h3 className="text-sm font-semibold text-red-700 mb-2">Erro</h3>
                        <div className="bg-red-50 rounded p-3 text-xs border border-red-200 text-red-800 font-mono break-all">
                          {log.error_message}
                        </div>
                      </div>
                    )}

                    {/* Payload */}
                    {log.payload_received && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-gray-700">Payload Recebido</h3>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(log.payload_received)}
                              className="gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              Copiar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadJSON(log.payload_received, `webhook-${log.id}.json`)}
                              className="gap-1"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </Button>
                          </div>
                        </div>
                        <div className="bg-white rounded p-3 text-xs font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-96 overflow-y-auto border">
                          {JSON.stringify(log.payload_received, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}