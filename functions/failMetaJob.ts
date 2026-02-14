import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const { job_id, worker_id, error: jobError } = payload;

        if (!job_id || !worker_id) {
            return Response.json({ 
                ok: false, 
                error: { message: 'job_id e worker_id são obrigatórios', code: 'MISSING_PARAMS' } 
            }, { status: 400 });
        }

        // Buscar job
        const allJobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });
        
        if (allJobs.length === 0) {
            return Response.json({ 
                ok: false, 
                error: { message: 'Job não encontrado', code: 'JOB_NOT_FOUND' } 
            }, { status: 404 });
        }

        const job = allJobs[0];

        // Validar se pode falhar
        if (job.status !== 'processing') {
            return Response.json({ 
                ok: false, 
                error: { message: 'Job não está em processamento', code: 'INVALID_STATUS' } 
            }, { status: 400 });
        }

        if (job.locked_by !== worker_id) {
            return Response.json({ 
                ok: false, 
                error: { message: 'Job travado por outro worker', code: 'WRONG_WORKER' } 
            }, { status: 403 });
        }

        const now = new Date().toISOString();
        const newAttempts = (job.attempts || 0) + 1;
        const maxAttempts = job.max_attempts || 3;

        // Calcular backoff
        const backoffSeconds = [60, 300, 900][newAttempts - 1] || 900;
        const nextAvailableAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

        const shouldRetry = newAttempts < maxAttempts;

        // Atualizar job
        const updateData = {
            attempts: newAttempts,
            last_error: JSON.stringify(jobError),
            last_error_at: now,
            locked_by: null,
            locked_at: null,
            locked_until: null
        };

        if (shouldRetry) {
            updateData.status = 'queued';
            updateData.available_at = nextAvailableAt;
        } else {
            updateData.status = 'failed';
        }

        await base44.asServiceRole.entities.MetaJobsQueue.update(job.id, updateData);

        console.log(`⚠️ Job failed: ${job_id}, attempts: ${newAttempts}/${maxAttempts}, status: ${updateData.status}`);

        return Response.json({ 
            ok: true,
            status: updateData.status,
            next_available_at: shouldRetry ? nextAvailableAt : null,
            attempts: newAttempts,
            max_attempts: maxAttempts
        });

    } catch (error) {
        console.error('❌ Erro ao falhar job:', error);
        return Response.json({ 
            ok: false, 
            error: { 
                message: error.message, 
                code: 'FAIL_ERROR',
                details: error.stack 
            } 
        }, { status: 500 });
    }
});