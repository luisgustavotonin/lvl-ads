import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const startTime = Date.now();
    const LOCK_DURATION_SECONDS = 300; // 5 minutos de lock

    const json = (body, status = 200) =>
        Response.json(body, {
            status,
            headers: { 'content-type': 'application/json; charset=utf-8' },
        });

    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json().catch(() => ({}));

        const { worker_id } = payload;

        if (!worker_id || typeof worker_id !== 'string') {
            return json(
                { ok: false, error: 'worker_id (string) é obrigatório' },
                400
            );
        }

        const now = new Date();
        const lockedUntil = new Date(now.getTime() + LOCK_DURATION_SECONDS * 1000);

        // 1. Encontrar o próximo job elegível
        // Status: queued
        // locked_until: null OU no passado
        // attempts: < max_attempts
        const allQueued = await base44.asServiceRole.entities.MetaJobsQueue.filter(
            { status: 'queued' },
            'created_date',
            100
        );

        // Filtrar manualmente jobs elegíveis
        const eligibleJobs = allQueued.filter(job => {
            const attempts = job.attempts || 0;
            const maxAttempts = job.max_attempts || 3;
            
            if (attempts >= maxAttempts) return false;
            
            if (!job.locked_until) return true;
            
            const lockedUntilDate = new Date(job.locked_until);
            return lockedUntilDate <= now;
        });

        if (eligibleJobs.length === 0) {
            const duration = Date.now() - startTime;
            console.log(`No queued jobs found for worker ${worker_id} [${duration}ms]`);
            return json({ ok: true, job: null, message: 'No queued jobs found' });
        }

        const jobToClaim = eligibleJobs[0];

        // 2. Tentar atualizar o job para "processing" e bloquear
        const updatedJob = await base44.asServiceRole.entities.MetaJobsQueue.update(
            jobToClaim.id,
            {
                status: 'processing',
                locked_by: worker_id,
                locked_at: now.toISOString(),
                locked_until: lockedUntil.toISOString(),
                attempts: (jobToClaim.attempts || 0) + 1,
                started_at: now.toISOString()
            }
        );

        if (!updatedJob) {
            const duration = Date.now() - startTime;
            console.warn(`Failed to claim job ${jobToClaim.id} for worker ${worker_id}. [${duration}ms]`);
            return json({ ok: false, job: null, message: 'Failed to claim job, try again' }, 409);
        }
        
        const duration = Date.now() - startTime;
        console.log(`Job claimed: ${updatedJob.job_id} by ${worker_id} [${duration}ms]`);

        return json({ ok: true, job: updatedJob, duration_ms: duration });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Erro ao reivindicar job [${duration}ms]:`, error?.message ?? error);
        return json({ ok: false, error: error?.message ?? String(error) }, 500);
    }
});