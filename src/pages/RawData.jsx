import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, X } from 'lucide-react';
import { format } from 'date-fns';

export default function RawData() {
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedJobType, setSelectedJobType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedPayload, setSelectedPayload] = useState(null);

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['rawEvents', selectedUnit, selectedJobType, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedUnit) return [];

      const query = { unit_id: selectedUnit };

      if (selectedJobType) {
        query.job_type = selectedJobType;
      }

      if (dateFrom || dateTo) {
        query.received_at_utc = {};
        if (dateFrom) query.received_at_utc.$gte = `${dateFrom}T00:00:00Z`;
        if (dateTo) query.received_at_utc.$lte = `${dateTo}T23:59:59Z`;
      }

      return base44.entities.RawEvent.filter(query, '-received_at_utc', 100);
    },
    enabled: !!selectedUnit,
  });

  const jobTypes = [...new Set(events.map(e => e.job_type))].sort();

  const handleReset = () => {
    setSelectedUnit('');
    setSelectedJobType('');
    setDateFrom('');
    setDateTo('');
  };

  const getSourceBadgeColor = (source) => {
    const colors = {
      'n8n': 'bg-purple-100 text-purple-800',
      'manual': 'bg-blue-100 text-blue-800',
      'api': 'bg-green-100 text-green-800',
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dados Brutos</h1>
        <p className="text-gray-600 mt-1">Visualize eventos brutos recebidos da ingestão de dados</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Unit */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Unidade</label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {units.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Job Type */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Tipo de Job</label>
              <Select value={selectedJobType} onValueChange={setSelectedJobType}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {jobTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                De
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date To */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Até
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Eventos {selectedUnit && `(${events.length})`}
          </CardTitle>
          <CardDescription>
            {isLoading ? 'Carregando...' : `${events.length} registros encontrados`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedUnit ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Selecione uma unidade para visualizar dados</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Carregando...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhum evento encontrado com esses filtros</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Job Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map(event => (
                    <TableRow key={event.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm font-mono">
                        {format(new Date(event.received_at_utc), 'dd/MM HH:mm:ss')}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-gray-600">
                        {event.job_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline">{event.job_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge className={getSourceBadgeColor(event.source)}>
                          {event.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPayload(event)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Ver JSON
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payload Modal */}
      {selectedPayload && (
        <Dialog open={!!selectedPayload} onOpenChange={() => setSelectedPayload(null)}>
          <DialogContent className="max-w-3xl max-h-96 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Payload JSON</DialogTitle>
              <DialogDescription>
                Job ID: {selectedPayload.job_id}
              </DialogDescription>
            </DialogHeader>
            <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-sm overflow-x-auto">
              <pre>{JSON.stringify(selectedPayload.payload, null, 2)}</pre>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}