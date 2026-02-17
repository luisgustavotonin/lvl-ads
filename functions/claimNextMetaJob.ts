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

    const job_id = payload?.job_id;
    const worker_id = payload?.worker_id;
    const row_count = payload?.row_count;
    const payload_hash = payload?.payload_hash;

    if (!job_id || typeof job_id !== 'string' || !worker_id || typeof worker_id !== 'string') {
      return json(
        { ok: false, error: 'job_id (string) e worker_id (string) são obrigatórios' },
        400
      );
    }

    // Buscar job
    const jobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });

    // Idempotente: não encontrado não derruba o worker
    if (!jobs || jobs.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`ℹ️ complete_job: job não encontrado (idempotente): ${job_id} [${duration}ms]`);
      return json({ ok: true, job_id, message: 'Job não encontrado (tratado como idempotente)' });
    }

    const job = jobs[0];

    const status = String(job?.status ?? '');
    const locked_by = job?.locked_by ? String(job.locked_by) : null;
    const canonical_job_id = String(job?.job_id ?? job_id);

    // Idempotência: já completado
    if (status === 'completed') {
      const duration = Date.now() - startTime;
      console.log(`✅ complete_job: já completed (idempotente): ${canonical_job_id} [${duration}ms]`);
      return json({
        ok: true,
        job_id: canonical_job_id,
        status: 'completed',
        message: 'Job já estava completo',
      });
    }

    // DEFENSIVO: se não estiver processing, não quebrar o fluxo
    if (status !== 'processing') {
      const duration = Date.now() - startTime;
      console.log(`ℹ️ complete_job ignorado (status=${status}): ${canonical_job_id} [${duration}ms]`);
      return json({
        ok: true,
        job_id: canonical_job_id,
        status,
        message: 'Job já finalizado ou não elegível para completar',
      });
    }

    // DEFENSIVO: se travado por outro worker, não quebrar o fluxo
    if (locked_by && locked_by !== worker_id) {
      const duration = Date.now() - startTime;
      console.log(
        `ℹ️ complete_job ignorado (locked_by=${locked_by}, worker_id=${worker_id}): ${canonical_job_id} [${duration}ms]`
      );
      return json({
        ok: true,
        job_id: canonical_job_id,
        status,
        message: 'Job está/esteve travado por outro worker (idempotente)',
      });
    }

    // Transição permitida: processing -> completed
    const now = new Date().toISOString();

    const updateData = {
      status: 'completed',
      completed_at: now,
      locked_by: null,
      locked_at: null,
      locked_until: null,
    };

    if (row_count !== undefined) updateData.row_count = row_count;
    if (payload_hash) updateData.payload_hash = payload_hash;

    await base44.asServiceRole.entities.MetaJobsQueue.update(job.id, updateData);

    const duration = Date.now() - startTime;
    console.log(`✅ complete_job: completed: ${canonical_job_id} [${duration}ms]`);

    return json({
      ok: true,
      job_id: canonical_job_id,
      status: 'completed',
      duration_ms: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Erro no complete_job [${duration}ms]:`, error?.message ?? error);

    return json({ ok: false, error: error?.message ?? String(error) }, 500);
  }
});