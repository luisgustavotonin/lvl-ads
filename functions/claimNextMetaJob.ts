import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const { worker_id, limit = 1, lock_ttl_seconds = 300 } = payload;

        if (!worker_id) {
            return Response.json({ 
                ok: false, 
                error: { message: 'worker_id é obrigatório', code: 'MISSING_WORKER_ID' } 
            }, { status: 400 });
        }

        const now = new Date().toISOString();
        const lockedUntil = new Date(Date.now() + lock_ttl_seconds * 1000).toISOString();

        // Buscar jobs elegíveis (queued ou processing com lock expirado)
        const allJobs = await base44.asServiceRole.entities.MetaJobsQueue.list('-created_at', 100);
        
        // Filtrar jobs elegíveis
        const eligibleJobs = allJobs.filter(job => {
            if (job.status === 'queued') {
                const availableAt = job.available_at || job.created_date;
                return new Date(availableAt) <= new Date(now);
            }
            if (job.status === 'processing' && job.locked_until) {
                return new Date(job.locked_until) < new Date(now);
            }
            return false;
        });

        if (eligibleJobs.length === 0) {
            return Response.json({ job: null });
        }

        // Pegar o mais antigo
        const job = eligibleJobs.sort((a, b) => 
            new Date(a.available_at || a.created_date) - new Date(b.available_at || b.created_date)
        )[0];

        // Tentar fazer claim (update condicional)
        const currentJob = await base44.asServiceRole.entities.MetaJobsQueue.get(job.id);
        
        // Verificar se ainda está elegível
        const stillEligible = 
            (currentJob.status === 'queued') || 
            (currentJob.status === 'processing' && new Date(currentJob.locked_until || 0) < new Date(now));

        if (!stillEligible) {
            return Response.json({ job: null });
        }

        // Fazer claim
        const updatedJob = await base44.asServiceRole.entities.MetaJobsQueue.update(job.id, {
            status: 'processing',
            locked_by: worker_id,
            locked_at: now,
            locked_until: lockedUntil,
            started_at: currentJob.started_at || now
        });

        console.log(`✅ Job claimed: ${updatedJob.job_id} by ${worker_id}`);

        return Response.json({
            job: {
                id: updatedJob.id,
                job_id: updatedJob.job_id,
                unit_id: updatedJob.unit_id,
                account_id: updatedJob.account_id,
                access_token: updatedJob.access_token,
                job_type: updatedJob.job_type,
                breakdown: updatedJob.breakdown,
                timezone: updatedJob.timezone,
                date_mode: updatedJob.date_mode,
                since: updatedJob.since,
                until: updatedJob.until,
                attempts: updatedJob.attempts,
                payload_json: updatedJob.payload_json,
                locked_until: updatedJob.locked_until
            }
        });

    } catch (error) {
        console.error('❌ Erro ao fazer claim:', error);
        return Response.json({ 
            ok: false, 
            error: { 
                message: error.message, 
                code: 'CLAIM_ERROR',
                details: error.stack 
            } 
        }, { status: 500 });
    }
});