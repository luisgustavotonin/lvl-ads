import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const start = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const id = body?.id;
    const job_id = body?.job_id;
    const worker_id = body?.worker_id;
    const row_count = body?.row_count;
    const payload_hash = body?.payload_hash;

    if (!worker_id) {
      return Response.json({ ok: false, error: 'worker_id é obrigatório' }, { status: 400 });
    }

    if (!id && !job_id) {
      return Response.json({ ok: false, error: 'id ou job_id é obrigatório' }, { status: 400 });
    }

    let jobs = [];

    if (id) {
      jobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ id });
    } else {
      jobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });
    }

    if (!jobs || jobs.length === 0) {
      return Response.json({ ok: true, message: 'Job não encontrado (idempotente)' });
    }

    const job = jobs[0];
    const status = job?.status;
    const locked_by = job?.locked_by;

    if (status === 'completed') {
      return Response.json({ ok: true, status: 'completed' });
    }

    if (status !== 'processing') {
      return Response.json({ ok: true, status });
    }

    if (locked_by && locked_by !== worker_id) {
      return Response.json({ ok: true, status });
    }

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

    return Response.json({
      ok: true,
      id: job.id,
      job_id: job.job_id,
      status: 'completed',
      duration_ms: Date.now() - start,
    });

  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
});