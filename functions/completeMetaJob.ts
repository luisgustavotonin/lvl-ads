import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const { job_id, worker_id, stats } = payload;

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

        // Validar se pode completar
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

        // Completar job
        await base44.asServiceRole.entities.MetaJobsQueue.update(job.id, {
            status: 'completed',
            completed_at: now,
            locked_by: null,
            locked_at: null,
            locked_until: null
        });

        console.log(`✅ Job completed: ${job_id}`);

        return Response.json({ ok: true });

    } catch (error) {
        console.error('❌ Erro ao completar job:', error);
        return Response.json({ 
            ok: false, 
            error: { 
                message: error.message, 
                code: 'COMPLETE_ERROR',
                details: error.stack 
            } 
        }, { status: 500 });
    }
});