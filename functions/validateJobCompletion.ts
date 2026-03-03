import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * VALIDAR SE JOB REALMENTE PERSISTIU DADOS
 * Só marca como sucesso se count > 0
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const { job_id, unit_id } = await req.json();

        if (!job_id || !unit_id) {
            return Response.json({ 
                error: 'job_id e unit_id são obrigatórios' 
            }, { status: 400 });
        }

        console.log(`🔍 Validando job ${job_id}...`);

        // 1️⃣ BUSCAR O JOB
        const jobs = await base44.asServiceRole.entities.Job.filter({
            job_id,
            unit_id
        });

        if (jobs.length === 0) {
            return Response.json({ 
                error: 'Job não encontrado' 
            }, { status: 404 });
        }

        const job = jobs[0];

        // 2️⃣ CONTAR REGISTROS GRAVADOS PARA ESTE JOB
        const records = await base44.asServiceRole.entities.MetaAdDaily.filter({
            job_id,
            unit_id
        }, null, 1);

        const count = records.length;

        console.log(`📊 Job ${job_id}: ${count} registros encontrados`);

        // 3️⃣ ATUALIZAR STATUS DO JOB
        if (count === 0 && job.status === 'success') {
            // Job marcado como sucesso MAS não gravou dados - CORRIGIR
            await base44.asServiceRole.entities.Job.update(job.id, {
                status: 'failed',
                error_message: `Job finalizou sem persistir dados (count = 0)`,
                records_processed: 0,
                finished_at_utc: new Date().toISOString()
            });

            console.log(`❌ Job corrigido para FAILED (sem dados)`);

            // Atualizar contador do RUN
            const runs = await base44.asServiceRole.entities.Run.filter({
                run_id: job.run_id,
                unit_id
            });

            if (runs.length > 0) {
                const run = runs[0];
                await base44.asServiceRole.entities.Run.update(run.id, {
                    failed_jobs: (run.failed_jobs || 0) + 1,
                    status: run.failed_jobs + 1 >= run.total_jobs ? 'failed' : 'partial'
                });
            }

            return Response.json({
                success: false,
                job_id,
                count: 0,
                status: 'corrected_to_failed',
                message: 'Job não persistiu dados e foi marcado como failed'
            });
        }

        if (count > 0 && job.status !== 'success') {
            // Job tem dados MAS não está marcado como sucesso - CORRIGIR
            await base44.asServiceRole.entities.Job.update(job.id, {
                status: 'success',
                records_processed: count,
                error_message: null,
                finished_at_utc: new Date().toISOString()
            });

            console.log(`✅ Job corrigido para SUCCESS (${count} registros)`);

            // Atualizar contador do RUN
            const runs = await base44.asServiceRole.entities.Run.filter({
                run_id: job.run_id,
                unit_id
            });

            if (runs.length > 0) {
                const run = runs[0];
                await base44.asServiceRole.entities.Run.update(run.id, {
                    completed_jobs: (run.completed_jobs || 0) + 1,
                    total_records: (run.total_records || 0) + count,
                    status: run.completed_jobs + 1 >= run.total_jobs ? 'success' : 'partial'
                });
            }

            return Response.json({
                success: true,
                job_id,
                count,
                status: 'corrected_to_success',
                message: `Job tinha ${count} registros e foi corrigido`
            });
        }

        // Job está correto
        return Response.json({
            success: true,
            job_id,
            count,
            status: job.status,
            message: 'Job está consistente'
        });

    } catch (error) {
        console.error('❌ Erro na validação:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});