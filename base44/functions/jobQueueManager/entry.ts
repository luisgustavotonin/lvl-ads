import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Job Queue Manager - Gerencia a fila de jobs do sistema
 * 
 * Ações disponíveis:
 * - enqueue: Criar novos jobs na fila
 * - process: Processar próximo job disponível
 * - status: Verificar status da fila
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, ...params } = await req.json();

        if (action === 'enqueue') {
            return await enqueueJobs(base44, params);
        } else if (action === 'process') {
            return await processNextJob(base44, params);
        } else if (action === 'status') {
            return await getQueueStatus(base44, params);
        } else {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('❌ Erro no Job Queue Manager:', error);
        return Response.json({ 
            ok: false,
            error: error.message 
        }, { status: 500 });
    }
});

/**
 * Enfileira jobs para uma unidade e período
 */
async function enqueueJobs(base44, params) {
    const { unit_id, date_start, date_end, job_types } = params;

    if (!unit_id || !date_start || !date_end) {
        return Response.json({ 
            error: 'unit_id, date_start e date_end são obrigatórios' 
        }, { status: 400 });
    }

    const jobs = [];
    const typesToCreate = job_types || ['INSIGHTS', 'ADS_LIGHT', 'CREATIVE_DELTA', 'CONSOLIDATE'];

    // Criar jobs de INSIGHTS (um para cada módulo)
    if (typesToCreate.includes('INSIGHTS')) {
        const modules = ['core', 'platform', 'age', 'gender', 'device'];
        for (const module of modules) {
            jobs.push({
                unit_id,
                job_type: 'INSIGHTS',
                module,
                date_start,
                date_end,
                status: 'PENDING',
                priority: 10 // Alta prioridade para insights
            });
        }
    }

    // Criar job de ADS_LIGHT
    if (typesToCreate.includes('ADS_LIGHT')) {
        jobs.push({
            unit_id,
            job_type: 'ADS_LIGHT',
            date_start,
            date_end,
            status: 'PENDING',
            priority: 5
        });
    }

    // Criar job de CREATIVE_DELTA
    if (typesToCreate.includes('CREATIVE_DELTA')) {
        jobs.push({
            unit_id,
            job_type: 'CREATIVE_DELTA',
            date_start,
            date_end,
            status: 'PENDING',
            priority: 3
        });
    }

    // Criar job de CONSOLIDATE (baixa prioridade, roda depois)
    if (typesToCreate.includes('CONSOLIDATE')) {
        jobs.push({
            unit_id,
            job_type: 'CONSOLIDATE',
            date_start,
            date_end,
            status: 'PENDING',
            priority: 1
        });
    }

    // Criar todos os jobs
    const created = await base44.asServiceRole.entities.MetaJob.bulkCreate(jobs);

    return Response.json({
        ok: true,
        jobs_created: created.length,
        jobs: created
    });
}

/**
 * Processa o próximo job disponível
 */
async function processNextJob(base44, params) {
    const now = new Date();

    // Buscar próximo job disponível (PENDING, não travado, ordenado por prioridade)
    const pendingJobs = await base44.asServiceRole.entities.MetaJob.filter({
        status: 'PENDING'
    });

    // Filtrar jobs que não estão travados
    const availableJobs = pendingJobs.filter(job => {
        if (!job.locked_until) return true;
        return new Date(job.locked_until) < now;
    });

    if (availableJobs.length === 0) {
        return Response.json({
            ok: true,
            message: 'Nenhum job disponível para processar',
            pending_count: 0
        });
    }

    // Ordenar por prioridade (maior primeiro) e depois por unit_id para evitar paralelismo
    availableJobs.sort((a, b) => {
        const priorityDiff = (b.priority || 0) - (a.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return (a.unit_id || '').localeCompare(b.unit_id || '');
    });
    const job = availableJobs[0];

    // Aguardar 5 segundos antes de processar (para evitar rate limit com múltiplas unidades)
    const lastJob = availableJobs.find(j => j.unit_id === job.unit_id && j.id !== job.id);
    if (lastJob?.completed_at) {
        const timeSinceLastJob = now.getTime() - new Date(lastJob.completed_at).getTime();
        if (timeSinceLastJob < 5000) {
            await sleep(5000 - timeSinceLastJob);
        }
    }

    // Travar o job por 15 minutos (breakdowns podem levar mais tempo)
     const lockUntil = new Date(now.getTime() + 15 * 60 * 1000);
    await base44.asServiceRole.entities.MetaJob.update(job.id, {
        status: 'RUNNING',
        locked_until: lockUntil.toISOString(),
        started_at: now.toISOString(),
        attempts: (job.attempts || 0) + 1
    });

    try {
        // Processar job baseado no tipo
        let result;
        if (job.job_type === 'INSIGHTS') {
            result = await base44.asServiceRole.functions.invoke('processInsightsJob', {
                job_id: job.id,
                unit_id: job.unit_id,
                module: job.module,
                date_start: job.date_start,
                date_end: job.date_end
            });
        } else if (job.job_type === 'ADS_LIGHT') {
            result = await base44.asServiceRole.functions.invoke('processAdsLightJob', {
                job_id: job.id,
                unit_id: job.unit_id,
                date_start: job.date_start,
                date_end: job.date_end
            });
        } else if (job.job_type === 'CREATIVE_DELTA') {
            result = await base44.asServiceRole.functions.invoke('processCreativeDeltaJob', {
                job_id: job.id,
                unit_id: job.unit_id
            });
        } else if (job.job_type === 'CONSOLIDATE') {
            result = await base44.asServiceRole.functions.invoke('consolidateMetrics', {
                job_id: job.id,
                unit_id: job.unit_id,
                date_start: job.date_start,
                date_end: job.date_end
            });
        }

        // Marcar como concluído
        await base44.asServiceRole.entities.MetaJob.update(job.id, {
            status: 'DONE',
            completed_at: new Date().toISOString(),
            metadata: result?.data || {}
        });

        return Response.json({
            ok: true,
            job_id: job.id,
            job_type: job.job_type,
            module: job.module,
            result: result?.data
        });

    } catch (error) {
        console.error(`❌ Erro ao processar job ${job.id}:`, error);

        // Verificar se deve marcar como DEAD
        const newAttempts = (job.attempts || 0) + 1;
        const newStatus = newAttempts >= (job.max_attempts || 3) ? 'DEAD' : 'FAILED';

        await base44.asServiceRole.entities.MetaJob.update(job.id, {
            status: newStatus,
            error_message: error.message,
            error_stack: error.stack,
            locked_until: null // Liberar o lock
        });

        return Response.json({
            ok: false,
            job_id: job.id,
            error: error.message,
            new_status: newStatus
        }, { status: 500 });
    }
}

/**
 * Retorna status da fila
 */
async function getQueueStatus(base44, params) {
    const allJobs = await base44.asServiceRole.entities.MetaJob.list('-created_date', 1000);

    const stats = {
        total: allJobs.length,
        pending: allJobs.filter(j => j.status === 'PENDING').length,
        running: allJobs.filter(j => j.status === 'RUNNING').length,
        done: allJobs.filter(j => j.status === 'DONE').length,
        failed: allJobs.filter(j => j.status === 'FAILED').length,
        dead: allJobs.filter(j => j.status === 'DEAD').length,
        by_type: {}
    };

    // Contar por tipo
    ['INSIGHTS', 'ADS_LIGHT', 'CREATIVE_DELTA', 'CONSOLIDATE'].forEach(type => {
        stats.by_type[type] = allJobs.filter(j => j.job_type === type).length;
    });

    return Response.json({
        ok: true,
        stats,
        recent_jobs: allJobs.slice(0, 20)
    });
}