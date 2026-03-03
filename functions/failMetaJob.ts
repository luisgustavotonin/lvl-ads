import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const id = body?.id;
    const worker_id = body?.worker_id;
    const error_text = body?.error ?? body?.errorText ?? body?.message ?? 'failed';

    if (!id || !worker_id) {
      return Response.json({ ok: false, error: 'id e worker_id são obrigatórios' }, { status: 400 });
    }

    const job = await base44.asServiceRole.entities.MetaJobsQueue.get(id).catch(() => null);

    if (!job) {
      return Response.json({ ok: true, message: 'Job não encontrado (idempotente)' });
    }

    const status = String(job?.status ?? '');
    const locked_by = job?.locked_by ? String(job.locked_by) : null;

    if (status === 'failed') {
      return Response.json({ ok: true, status: 'failed', message: 'Job já estava failed' });
    }
    if (status === 'completed') {
      return Response.json({ ok: true, status: 'completed', message: 'Job já estava completed' });
    }

    // DEFENSIVO: não derruba o fluxo
    if (status !== 'processing') {
      return Response.json({ ok: true, status, message: 'Job não elegível para falhar (idempotente)' });
    }

    // DEFENSIVO: não derruba o fluxo
    if (locked_by && locked_by !== worker_id) {
      return Response.json({ ok: true, status, message: 'Job travado por outro worker (idempotente)' });
    }

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.MetaJobsQueue.update(id, {
      status: 'failed',
      completed_at: now,
      last_error: String(error_text).slice(0, 2000),
      locked_by: null,
      locked_at: null,
      locked_until: null,
    });

    return Response.json({ ok: true, status: 'failed' });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
});