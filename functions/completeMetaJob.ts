import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const startTime = Date.now();
    
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const { job_id, id, worker_id, row_count, payload_hash } = payload;

        // Aceitar job_id (string job_...) OU id (PK)
        if ((!job_id && !id) || !worker_id) {
            return Response.json({ 
                ok: false, 
                error: 'job_id (ou id) e worker_id são obrigatórios'
            }, { status: 400 });
        }

        let job;

        // Buscar por ID (PK) se fornecido - mais rápido
        if (id) {
            job = await base44.asServiceRole.entities.MetaJobsQueue.get(id);
            if (!job) {
                return Response.json({ 
                    ok: false, 
                    error: 'Job não encontrado (por id)'
                }, { status: 404 });
            }
        } else {
            // Buscar por job_id (string job_...)
            const allJobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });
            
            if (allJobs.length === 0) {
                return Response.json({ 
                    ok: false, 
                    error: 'Job não encontrado (por job_id)'
                }, { status: 404 });
            }
            job = allJobs[0];
        }

        // IDEMPOTÊNCIA: Se já está completed, retornar sucesso
        if (job.status === 'completed') {
            const duration = Date.now() - startTime;
            console.log(`✅ Job já completed (idempotente): ${job.job_id} [${duration}ms]`);
            return Response.json({ 
                ok: true, 
                job_id: job.job_id,
                status: 'completed',
                message: 'Job já estava completo'
            });
        }

        // Validar se está em processamento
        if (job.status !== 'processing') {
            console.warn(`⚠️ Tentativa de completar job com status ${job.status}: ${job.job_id}`);
            return Response.json({ 
                ok: false, 
                error: `Job não está em processamento (status atual: ${job.status})`,
                current_status: job.status,
                job_id: job.job_id
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