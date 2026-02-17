import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const startTime = Date.now();

    const json = (body, status = 200) =>
        Response.json(body, {
            status,
            headers: { 'content-type': 'application/json; charset=utf-8' },
        });

    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json().catch(() => ({}));

        const id = payload?.id;
        const job_id = payload?.job_id;
        const worker_id = payload?.worker_id;
        const jobError = payload?.error;

        if (!worker_id || typeof worker_id !== 'string') {
            return json(
                { ok: false, error: 'worker_id (string) é obrigatório' },
                400
            );
        }

        if (!id && !job_id) {
            return json(
                { ok: false, error: 'id ou job_id é obrigatório' },
                400
            );
        }

        // Buscar job: prioridade para id (PK), fallback para job_id
        let job = null;
        let searchKey = '';

        if (id && typeof id === 'string') {
            // Buscar diretamente por ID (chave primária)
            const jobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ id });
            job = jobs?.[0] || null;
            searchKey = `id=${id}`;
        } else if (job_id && typeof job_id === 'string') {
            // Fallback: buscar por job_id
            const jobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });
            job = jobs?.[0] || null;
            searchKey = `job_id=${job_id}`;
        }

        // Idempotente: não encontrado não derruba o worker
        if (!job) {
            const duration = Date.now() - startTime;
            console.log(`ℹ️ fail_job: job não encontrado (idempotente): ${searchKey} [${duration}ms]`);
            return json({ ok: true, job_id: job_id || id, message: 'Job não encontrado (tratado como idempotente)' });
        }
        const status = String(job?.status ?? '');
        const locked_by = job?.locked_by ? String(job.locked_by) : null;
        const canonical_job_id = String(job?.job_id ?? job_id);

        // Idempotência: já failed ou completed
        if (status === 'failed' || status === 'completed') {
            const duration = Date.now() - startTime;
            console.log(`✅ fail_job: já finalizado (idempotente): ${canonical_job_id}, status=${status} [${duration}ms]`);
            return json({
                ok: true,
                job_id: canonical_job_id,
                status,
                message: 'Job já estava finalizado',
            });
        }

        // DEFENSIVO: se não estiver processing, não quebrar o fluxo
        if (status !== 'processing') {
            const duration = Date.now() - startTime;
            console.log(`ℹ️ fail_job ignorado (status=${status}): ${canonical_job_id} [${duration}ms]`);
            return json({
                ok: true,
                job_id: canonical_job_id,
                status,
                message: 'Job não elegível para falhar',
            });
        }

        // DEFENSIVO: se travado por outro worker, não quebrar o fluxo
        if (locked_by && locked_by !== worker_id) {
            const duration = Date.now() - startTime;
            console.log(
                `ℹ️ fail_job ignorado (locked_by=${locked_by}, worker_id=${worker_id}): ${canonical_job_id} [${duration}ms]`
            );
            return json({
                ok: true,
                job_id: canonical_job_id,
                status,
                message: 'Job está/esteve travado por outro worker (idempotente)',
            });
        }

        // Transição permitida: processing -> failed ou queued (retry)
        const now = new Date().toISOString();
        const currentAttempts = job.attempts || 0;
        const maxAttempts = job.max_attempts || 3;

        // Calcular backoff
        const backoffSeconds = [60, 300, 900][currentAttempts] || 900;
        const nextAvailableAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

        const shouldRetry = currentAttempts < maxAttempts;

        const updateData = {
            last_error: JSON.stringify(jobError || 'Unknown error'),
            last_error_at: now,
            locked_by: null,
            locked_at: null,
            locked_until: null,
        };

        if (shouldRetry) {
            updateData.status = 'queued';
            updateData.available_at = nextAvailableAt;
        } else {
            updateData.status = 'failed';
        }

        await base44.asServiceRole.entities.MetaJobsQueue.update(job.id, updateData);

        const duration = Date.now() - startTime;
        console.log(
            `⚠️ fail_job: ${canonical_job_id}, attempts: ${currentAttempts}/${maxAttempts}, new_status: ${updateData.status} [${duration}ms]`
        );

        return json({
            ok: true,
            job_id: canonical_job_id,
            status: updateData.status,
            next_available_at: shouldRetry ? nextAvailableAt : null,
            attempts: currentAttempts,
            max_attempts: maxAttempts,
            duration_ms: duration,
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Erro no fail_job [${duration}ms]:`, error?.message ?? error);

        return json({ ok: false, error: error?.message ?? String(error) }, 500);
    }
});