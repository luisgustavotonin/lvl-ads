import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, X } from 'lucide-react';
import { format } from 'date-fns';

export default function RawDataViewer() {
  const [selectedUnit, setSelectedUnit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [jobId, setJobId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dataType, setDataType] = useState('insights');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Fetch units
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  // Build query for data filtering
  const buildQuery = () => {
    const query = {};
    if (selectedUnit) query.unit_id = selectedUnit;
    if (jobId) query.job_id = jobId;
    if (startDate && endDate) {
      query.created_date = {
        $gte: new Date(startDate).toISOString(),
        $lte: new Date(endDate).toISOString(),
      };
    }
    return Object.keys(query).length > 0 ? query : null;
  };

  // Fetch raw data (insights or raw events)
  const { data: rawData = [], isLoading, error } = useQuery({
    queryKey: ['rawData', dataType, selectedUnit, startDate, endDate, jobId, page],
    queryFn: async () => {
      const query = buildQuery();
      const entityName = dataType === 'insights' ? 'MetaIngestInsight' : 'RawEvent';
      
      if (query) {
        const results = await base44.entities[entityName].filter(query, '-created_date', pageSize);
        return results;
      } else {
        const results = await base44.entities[entityName].list('-created_date', pageSize);
        return results;
      }
    },
  });

  // Fetch jobs for dropdown
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs', selectedUnit],
    queryFn: async () => {
      if (!selectedUnit) return [];
      const results = await base44.entities.Job.filter({ unit_id: selectedUnit }, '-created_date', 100);
      return results;
    },
  });

  const handleReset = () => {
    setSelectedUnit('');
    setStartDate('');
    setEndDate('');
    setJobId('');
    setSearchTerm('');
    setPage(0);
  };

  const filteredData = rawData.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return JSON.stringify(item).toLowerCase().includes(searchLower);
  });

  const getStatusColor = (status) => {
    if (!status) return 'secondary';
    if (status === 'success' || status === 'completed') return 'default';
    if (status === 'error' || status === 'failed') return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dados Brutos da Ingestão</h1>
        <p className="text-gray-500 mt-2">Visualize e analise os dados brutos recebidos da ingestão Meta</p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de dados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="insights">Insights</SelectItem>
                <SelectItem value="events">Eventos Brutos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione unidade" />
              </SelectTrigger>
              <SelectContent>
                {units.map(unit => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="Data início"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <Input
              type="date"
              placeholder="Data fim"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />

            <Select value={jobId} onValueChange={setJobId} disabled={!selectedUnit}>
              <SelectTrigger>
                <SelectValue placeholder="ID do Job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.id.substring(0, 8)}...
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleReset} className="w-full">
              <X className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </div>

          <div className="mt-4 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar em todos os campos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados ({filteredData.length})</CardTitle>
          <CardDescription>
            {isLoading ? 'Carregando dados...' : `Exibindo ${Math.min(pageSize, filteredData.length)} de ${filteredData.length} registros`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">Erro ao carregar dados</div>
          ) : filteredData.length === 0 ? (
            <div className="text-center text-gray-500 py-8">Nenhum dado encontrado</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.slice(0, pageSize).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">
                        {item.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>{item.unit_id || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.job_id ? item.job_id.substring(0, 8) + '...' : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.created_date ? format(new Date(item.created_date), 'dd/MM/yyyy HH:mm:ss') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(item.status)}>
                          {item.status || 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <details className="cursor-pointer">
                          <summary className="text-blue-600 text-sm hover:underline">
                            Ver
                          </summary>
                          <pre className="mt-2 bg-gray-100 p-2 rounded text-xs overflow-auto max-h-48">
                            {JSON.stringify(item, null, 2)}
                          </pre>
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {filteredData.length > pageSize && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <span className="text-sm text-gray-500">
                Página {page + 1} de {Math.ceil(filteredData.length / pageSize)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * pageSize >= filteredData.length}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}