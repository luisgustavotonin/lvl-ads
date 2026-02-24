import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, RefreshCw } from 'lucide-react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

export default function RawIngestData() {
  const [selectedEntity, setSelectedEntity] = useState('MetaInsightBase');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 50;

  const entities = [
    { name: 'MetaInsightBase', label: 'Meta Insights Base' },
    { name: 'MetaAdDaily', label: 'Meta Ad Daily' },
    { name: 'MetaIngestRun', label: 'Meta Ingest Run' },
    { name: 'MetaIngestPage', label: 'Meta Ingest Page' },
    { name: 'MetaIngestInsight', label: 'Meta Ingest Insight' },
  ];

  // Fetch units
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  // Fetch raw data
  const { data: allData = [], isLoading, refetch } = useQuery({
    queryKey: ['rawIngestData', selectedEntity, selectedUnit],
    queryFn: async () => {
      const query = selectedUnit ? { unit_id: selectedUnit } : {};
      return await base44.entities[selectedEntity].filter(query, '-created_date', 1000);
    },
  });

  // Filter data based on search
  const filteredData = allData.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return Object.values(item).some(val =>
      val && String(val).toLowerCase().includes(searchLower)
    );
  });

  // Paginate
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Export to CSV
  const handleExport = () => {
    if (filteredData.length === 0) return;

    const keys = Object.keys(filteredData[0]);
    const csv = [
      keys.join(','),
      ...filteredData.map(row =>
        keys.map(key => {
          const val = row[key];
          if (typeof val === 'object') return JSON.stringify(val).replace(/,/g, ';');
          if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
          return val || '';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedEntity}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const getEntityLabel = () => entities.find(e => e.name === selectedEntity)?.label || selectedEntity;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dados Brutos de Ingestão</h1>
        <p className="text-gray-500 mt-1">Visualize os dados brutos capturados pelas integrações</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Entidade</label>
              <Select value={selectedEntity} onValueChange={(val) => { setSelectedEntity(val); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entities.map(e => (
                    <SelectItem key={e.name} value={e.name}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Unidade</label>
              <Select value={selectedUnit} onValueChange={(val) => { setSelectedUnit(val); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas as unidades</SelectItem>
                  {units.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Buscar</label>
              <Input
                placeholder="Buscar nos dados..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
            <Button onClick={handleExport} disabled={filteredData.length === 0} className="gap-2">
              <Download className="w-4 h-4" />
              Exportar CSV ({filteredData.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{getEntityLabel()}</CardTitle>
          <CardDescription>
            {isLoading ? 'Carregando...' : `${filteredData.length} registros encontrados`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando dados...</div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Nenhum dado encontrado</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(paginatedData[0] || {}).map(key => (
                        <TableHead key={key} className="text-xs">{key}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((row, idx) => (
                      <TableRow key={row.id || idx}>
                        {Object.entries(row).map(([key, val]) => (
                          <TableCell key={key} className="text-xs">
                            {val === null ? (
                              <Badge variant="outline">null</Badge>
                            ) : typeof val === 'object' ? (
                              <code className="text-gray-500 bg-gray-100 px-2 py-1 rounded text-xs">
                                {JSON.stringify(val).slice(0, 50)}...
                              </code>
                            ) : typeof val === 'boolean' ? (
                              <Badge variant={val ? 'default' : 'outline'}>{String(val)}</Badge>
                            ) : String(val).length > 100 ? (
                              <span className="text-gray-600">{String(val).slice(0, 100)}...</span>
                            ) : (
                              <span>{String(val)}</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}