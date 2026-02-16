import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, ChevronDown, ChevronRight, Trash2, Search } from 'lucide-react';
import moment from 'moment';

export default function DebugEnqueue() {
  const [expandedRun, setExpandedRun] = useState(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['metaEnqueueRuns'],
    queryFn: () => base44.entities.MetaEnqueueRuns.list('-received_at'),
    refetchInterval: 10000,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['metaEnqueueRunItems', expandedRun],
    queryFn: () => 
      expandedRun 
        ? base44.entities.MetaEnqueueRunItems.filter({ run_id: expandedRun })
        : Promise.resolve([]),
    enabled: !!expandedRun,
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ['metaEnqueueRunItemsAll'],
    queryFn: () => base44.entities.MetaEnqueueRunItems.list('-created_date'),
    enabled: showDuplicates,
  });

  const deleteAllRunsMutation = useMutation({
    mutationFn: async () => {
      const allRuns = await base44.asServiceRole.entities.MetaEnqueueRuns.list();
      const allItems = await base44.asServiceRole.entities.MetaEnqueueRunItems.list();
      
      await Promise.all(allItems.map(item => 
        base44.asServiceRole.entities.MetaEnqueueRunItems.delete(item.id)
      ));
      
      await Promise.all(allRuns.map(run => 
        base44.asServiceRole.entities.MetaEnqueueRuns.delete(run.id)
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['metaEnqueueRuns']);
      queryClient.invalidateQueries(['metaEnqueueRunItems']);
      queryClient.invalidateQueries(['metaEnqueueRunItemsAll']);
      setDeleteDialog(false);
    },
  });

  // Detectar duplicados
  const duplicateKeys = allItems.reduce((acc, item) => {
    acc[item.job_key] = (acc[item.job_key] || 0) + 1;
    return acc;
  }, {});

  const duplicatesList = Object.entries(duplicateKeys)
    .filter(([_, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Debug – Enqueue Jobs (Meta)</h1>
          <p className="text-gray-500 mt-1">Auditoria de jobs recebidos do N8n</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDuplicates(true)}
          >
            <Search className="w-4 h-4 mr-2" />
            Ver Duplicados ({duplicatesList.length})
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Limpar Tudo
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Total de Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Jobs Esperados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runs.reduce((sum, r) => sum + (r.expected_jobs || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Jobs Recebidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runs.reduce((sum, r) => sum + (r.received_jobs_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Duplicados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{duplicatesList.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Runs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Runs Recebidos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : runs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Nenhum run registrado ainda</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead>Esperado</TableHead>
                  <TableHead>Recebido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Unit/Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const isDivergent = run.expected_jobs !== run.received_jobs_count;
                  const isExpanded = expandedRun === run.run_id;
                  
                  return (
                    <React.Fragment key={run.id}>
                      <TableRow 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedRun(isExpanded ? null : run.run_id)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {moment(run.received_at).format('DD/MM/YY HH:mm:ss')}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{run.run_id}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {run.payload_hash?.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{run.expected_jobs}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isDivergent ? 'destructive' : 'default'}>
                            {run.received_jobs_count}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isDivergent ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Divergência
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-600">OK</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {run.unit_id && <div>Unit: {run.unit_id}</div>}
                          {run.account_id && <div>Account: {run.account_id}</div>}
                        </TableCell>
                      </TableRow>
                      
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-gray-50 p-4">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Items deste Run:</h4>
                              {items.length === 0 ? (
                                <p className="text-gray-500 text-sm">Nenhum item encontrado</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left p-2">Job Key</th>
                                        <th className="text-left p-2">Type</th>
                                        <th className="text-left p-2">Breakdown</th>
                                        <th className="text-left p-2">Período</th>
                                        <th className="text-left p-2">Job ID</th>
                                        <th className="text-left p-2">Duplicado?</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {items.map((item, idx) => (
                                        <tr key={idx} className="border-b">
                                          <td className="p-2 font-mono text-xs">{item.job_key}</td>
                                          <td className="p-2">{item.job_type}</td>
                                          <td className="p-2">{item.breakdown || '-'}</td>
                                          <td className="p-2">{item.since} a {item.until}</td>
                                          <td className="p-2 font-mono">{item.job_id_sent}</td>
                                          <td className="p-2">
                                            {item.is_duplicate ? (
                                              <Badge variant="destructive" className="text-xs">SIM</Badge>
                                            ) : (
                                              <Badge variant="outline" className="text-xs">NÃO</Badge>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Duplicates Dialog */}
      <Dialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Jobs Duplicados por Job Key</DialogTitle>
            <DialogDescription>
              Job Keys que aparecem mais de uma vez no sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {duplicatesList.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhum duplicado encontrado! 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Key</TableHead>
                    <TableHead>Contagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicatesList.map((dup, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{dup.key}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{dup.count}x</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar Todos os Dados de Debug?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir TODOS os runs e items de debug registrados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllRunsMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}