import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Clock, Database, CheckCircle, XCircle, Loader2, RotateCcw, Trash2, Ban, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function QueueManagement() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    status: 'all',
    job_type: 'all',
    unit_id: 'all',
    account_id: ''
  });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: '', id: null, days: 7 });
  const [selectedJobs, setSelectedJobs] = useState([]);

  // Fetch jobs
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['metaJobsQueue', filters],
    queryFn: async () => {
      let allJobs = await base44.entities.MetaJobsQueue.list('-created_date', 500);
      
      // Apply filters
      if (filters.status !== 'all') {
        allJobs = allJobs.filter(job => job.status === filters.status);
      }
      if (filters.job_type !== 'all') {
        allJobs = allJobs.filter(job => job.job_type === filters.job_type);
      }
      if (filters.unit_id !== 'all') {
        allJobs = allJobs.filter(job => job.unit_id === filters.unit_id);
      }
      if (filters.account_id) {
        allJobs = allJobs.filter(job => job.account_id?.includes(filters.account_id));
      }
      
      return allJobs;
    }
  });

  // Fetch units for filter
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list()
  });

  // Calculate summary stats
  const stats = {
    queued: jobs.filter(j => j.status === 'queued').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    completed: jobs.filter(j => j.status === 'completed').length
  };

  // Mutations
  const resetJobMutation = useMutation({
    mutationFn: async (job) => {
      return base44.entities.MetaJobsQueue.update(job.id, {
        status: 'queued',
        attempts: 0,
        locked_until: null,
        locked_by: null,
        locked_at: null,
        last_error: null
      });
    },
    onSuccess: () => queryClient.invalidateQueries(['metaJobsQueue'])
  });

  const cancelJobMutation = useMutation({
    mutationFn: async (job) => {
      return base44.entities.MetaJobsQueue.update(job.id, {
        status: 'cancelled'
      });
    },
    onSuccess: () => queryClient.invalidateQueries(['metaJobsQueue'])
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId) => {
      return base44.entities.MetaJobsQueue.delete(jobId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['metaJobsQueue']);
      setDeleteDialog({ ...deleteDialog, open: false });
    }
  });

  const forceDeleteJobMutation = useMutation({
    mutationFn: async (jobId) => {
      return base44.entities.MetaJobsQueue.delete(jobId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['metaJobsQueue']);
      setDeleteDialog({ ...deleteDialog, open: false });
    }
  });

  const bulkDeleteQueuedMutation = useMutation({
    mutationFn: async () => {
      const queuedJobs = jobs.filter(j => j.status === 'queued');
      await Promise.all(queuedJobs.map(job => base44.entities.MetaJobsQueue.delete(job.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['metaJobsQueue']);
      setDeleteDialog({ ...deleteDialog, open: false });
    }
  });

  const bulkDeleteOldMutation = useMutation({
    mutationFn: async (days) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const oldJobs = jobs.filter(j => {
        const createdDate = new Date(j.created_date);
        return createdDate < cutoffDate && j.status !== 'processing';
      });
      
      await Promise.all(oldJobs.map(job => base44.entities.MetaJobsQueue.delete(job.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['metaJobsQueue']);
      setDeleteDialog({ ...deleteDialog, open: false });
    }
  });

  const bulkDeleteSelectedMutation = useMutation({
    mutationFn: async (jobIds) => {
      // Filtrar apenas jobs que podem ser deletados (não processing)
      const jobsToDelete = jobIds.filter(id => {
        const job = jobs.find(j => j.id === id);
        return job && canDelete(job);
      });
      
      if (jobsToDelete.length > 0) {
        await Promise.all(jobsToDelete.map(id => base44.entities.MetaJobsQueue.delete(id)));
      }
      
      return {
        deleted: jobsToDelete.length,
        skipped: jobIds.length - jobsToDelete.length
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries(['metaJobsQueue']);
      setSelectedJobs([]);
      setDeleteDialog({ ...deleteDialog, open: false });
      
      if (result.skipped > 0) {
        alert(`${result.deleted} jobs excluídos. ${result.skipped} jobs em processamento foram ignorados.`);
      }
    }
  });

  const forceDeleteSelectedMutation = useMutation({
    mutationFn: async (jobIds) => {
      await Promise.all(jobIds.map(id => base44.entities.MetaJobsQueue.delete(id)));
      return jobIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries(['metaJobsQueue']);
      setSelectedJobs([]);
      setDeleteDialog({ ...deleteDialog, open: false });
    }
  });

  const getStatusBadge = (status) => {
    const variants = {
      queued: { color: 'bg-blue-100 text-blue-800', icon: Clock },
      processing: { color: 'bg-yellow-100 text-yellow-800', icon: Loader2 },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: Ban }
    };
    const { color, icon: Icon } = variants[status] || variants.queued;
    return (
      <Badge className={color}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const canReset = (job) => ['failed', 'processing'].includes(job.status);
  const canCancel = (job) => job.status !== 'completed';
  const canDelete = (job) => job.status !== 'processing';

  // Get unique job types
  const jobTypes = [...new Set(jobs.map(j => j.job_type))].filter(Boolean);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedJobs.length === jobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(jobs.map(j => j.id));
    }
  };

  const toggleSelectJob = (jobId) => {
    if (selectedJobs.includes(jobId)) {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
    } else {
      setSelectedJobs([...selectedJobs, jobId]);
    }
  };

  const selectedDeletableCount = selectedJobs.filter(id => {
    const job = jobs.find(j => j.id === id);
    return job && canDelete(job);
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestão de Fila – Meta Jobs</h1>
        <p className="text-gray-500 mt-1">Gerenciamento completo da fila de integração com Meta</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Na Fila</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-8 h-8 text-blue-500" />
              <span className="text-3xl font-bold text-gray-900">{stats.queued}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Processando</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Loader2 className="w-8 h-8 text-yellow-500" />
              <span className="text-3xl font-bold text-gray-900">{stats.processing}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Falhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="w-8 h-8 text-red-500" />
              <span className="text-3xl font-bold text-gray-900">{stats.failed}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Completados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <span className="text-3xl font-bold text-gray-900">{stats.completed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Job</Label>
              <Select value={filters.job_type} onValueChange={(value) => setFilters({ ...filters, job_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {jobTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={filters.unit_id} onValueChange={(value) => setFilters({ ...filters, unit_id: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {units.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Account ID</Label>
              <Input
                placeholder="Buscar por account_id..."
                value={filters.account_id}
                onChange={(e) => setFilters({ ...filters, account_id: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <div className="flex gap-2">
        {selectedJobs.length > 0 && (
          <>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialog({ open: true, type: 'selected', id: null })}
              disabled={selectedDeletableCount === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir Selecionados ({selectedDeletableCount}/{selectedJobs.length})
            </Button>
            {selectedDeletableCount < selectedJobs.length && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialog({ open: true, type: 'force_selected', id: null })}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Forçar Exclusão de Todos ({selectedJobs.length})
              </Button>
            )}
          </>
        )}
        <Button
          variant="destructive"
          onClick={() => setDeleteDialog({ open: true, type: 'queued', id: null })}
          disabled={stats.queued === 0}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Limpar Jobs Queued ({stats.queued})
        </Button>
        <Button
          variant="outline"
          onClick={() => setDeleteDialog({ open: true, type: 'old', id: null, days: 7 })}
        >
          <Database className="w-4 h-4 mr-2" />
          Limpar Jobs Antigos
        </Button>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedJobs.length === jobs.length && jobs.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Job Type</TableHead>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Unit ID</TableHead>
                  <TableHead>Account ID</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Locked Until</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                      Nenhum job encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedJobs.includes(job.id)}
                          onChange={() => toggleSelectJob(job.id)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell className="font-mono text-xs">{job.job_type}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate" title={job.job_id}>
                        {job.job_id}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{job.unit_id?.substring(0, 8)}...</TableCell>
                      <TableCell className="font-mono text-xs">{job.account_id}</TableCell>
                      <TableCell className="text-xs">
                        {job.since && job.until ? (
                          <span>{job.since} → {job.until}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{job.attempts || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {job.created_date ? format(new Date(job.created_date), 'dd/MM/yyyy HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {job.locked_until ? format(new Date(job.locked_until), 'dd/MM/yyyy HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resetJobMutation.mutate(job)}
                            disabled={!canReset(job)}
                            title="Resetar Job"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelJobMutation.mutate(job)}
                            disabled={!canCancel(job)}
                            title="Cancelar Job"
                          >
                            <Ban className="w-3 h-3" />
                          </Button>
                          {canDelete(job) ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteDialog({ open: true, type: 'single', id: job.id })}
                              title="Excluir Job"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteDialog({ open: true, type: 'force_single', id: job.id })}
                              title="Forçar Exclusão (Job em Processamento)"
                            >
                              <AlertTriangle className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.type === 'queued' && (
                <span>Tem certeza que deseja excluir <strong>todos os {stats.queued} jobs com status "queued"</strong>? Esta ação não pode ser desfeita.</span>
              )}
              {deleteDialog.type === 'old' && (
                <span>Tem certeza que deseja excluir <strong>todos os jobs criados há mais de {deleteDialog.days} dias</strong> (exceto os que estão processando)? Esta ação não pode ser desfeita.</span>
              )}
              {deleteDialog.type === 'selected' && (
                <span>Tem certeza que deseja excluir <strong>{selectedDeletableCount} jobs selecionados</strong>? 
                {selectedDeletableCount < selectedJobs.length && (
                  <span className="text-yellow-600"> ({selectedJobs.length - selectedDeletableCount} jobs em processamento serão ignorados)</span>
                )}
                Esta ação não pode ser desfeita.</span>
              )}
              {deleteDialog.type === 'force_selected' && (
                <span className="text-red-600">
                  <strong>⚠️ ATENÇÃO:</strong> Você está prestes a <strong>forçar a exclusão de {selectedJobs.length} jobs</strong>, incluindo {selectedJobs.length - selectedDeletableCount} jobs em processamento. Isso pode causar inconsistências. Esta ação não pode ser desfeita.
                </span>
              )}
              {deleteDialog.type === 'single' && (
                <span>Tem certeza que deseja excluir este job? Esta ação não pode ser desfeita.</span>
              )}
              {deleteDialog.type === 'force_single' && (
                <span className="text-red-600">
                  <strong>⚠️ ATENÇÃO:</strong> Este job está em processamento. Forçar a exclusão pode causar inconsistências. Tem certeza?
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog.type === 'queued') {
                  bulkDeleteQueuedMutation.mutate();
                } else if (deleteDialog.type === 'old') {
                  bulkDeleteOldMutation.mutate(deleteDialog.days);
                } else if (deleteDialog.type === 'selected') {
                  bulkDeleteSelectedMutation.mutate(selectedJobs);
                } else if (deleteDialog.type === 'force_selected') {
                  forceDeleteSelectedMutation.mutate(selectedJobs);
                } else if (deleteDialog.type === 'single') {
                  deleteJobMutation.mutate(deleteDialog.id);
                } else if (deleteDialog.type === 'force_single') {
                  forceDeleteJobMutation.mutate(deleteDialog.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteDialog.type?.includes('force') ? 'Forçar Exclusão' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}