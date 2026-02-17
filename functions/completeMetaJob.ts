import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const startTime = Date.now();
    
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const { job_id, worker_id, row_count, payload_hash } = payload;

        if (!job_id || !worker_id) {
            return Response.json({ 
                ok: false, 
                error: 'job_id e worker_id são obrigatórios'
            }, { status: 400 });
        }

        // Buscar job
        const allJobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });
        
        if (allJobs.length === 0) {
            return Response.json({ 
                ok: false, 
                error: 'Job não encontrado'
            }, { status: 404 });
        }

        const job = allJobs[0];

        // IDEMPOTÊNCIA: Se já está completed, retornar sucesso
        if (job.status === 'completed') {
            const duration = Date.now() - startTime;
            console.log(`✅ Job já completed (idempotente): ${job_id} [${duration}ms]`);
            return Response.json({ 
                ok: true, 
                job_id: job.job_id,
                status: 'completed',
                message: 'Job já estava completo'
            });
        }

        // Validar se está em processamento
        if (job.status !== 'processing') {
            return Response.json({ 
                ok: false, 
                error: `Status inválido: ${job.status}`
            }, { status: 400 });
        }

        if (job.locked_by !== worker_id) {
            return Response.json({ 
                ok: false, 
                error: 'Job travado por outro worker'
            }, { status: 403 });
        }

        const now = new Date().toISOString();

        // Atualização RÁPIDA e MÍNIMA
        const updateData = {
            status: 'completed',
            completed_at: now,
            locked_by: null,
            locked_at: null,
            locked_until: null
        };

        // Incluir metadados opcionais se fornecidos
        if (row_count !== undefined) updateData.row_count = row_count;
        if (payload_hash) updateData.payload_hash = payload_hash;

        await base44.asServiceRole.entities.MetaJobsQueue.update(job.id, updateData);

        const duration = Date.now() - startTime;
        
        if (duration > 500) {
            console.warn(`⚠️ Complete job demorado: ${job_id} [${duration}ms]`);
        } else {
            console.log(`✅ Job completed: ${job_id} [${duration}ms]`);
        }

        return Response.json({ 
            ok: true, 
            job_id: job.job_id,
            status: 'completed',
            duration_ms: duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Erro ao completar job [${duration}ms]:`, error.message);
        
        return Response.json({ 
            ok: false, 
            error: error.message
        }, { status: 500 });
    }
});