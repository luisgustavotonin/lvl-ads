import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function unwrap(payload) {
  if (Array.isArray(payload)) return payload.length ? payload[0] : {};
  return payload || {};
}

Deno.serve(async (req) => {
  const start = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const body = unwrap(await req.json().catch(() => ({})));

    // aceita tanto "id" (PK) quanto "job_id" (string job_...)
    let id = body.id ?? null;
    let job_id = body.job_id ?? null;

    // se alguém mandar id="job_..." por engano, trata como job_id
    if (!job_id && typeof id === 'string' && id.startsWith('job_')) {
      job_id = id;
      id = null;
    }

    const worker_id = body.worker_id ?? null;
    const row_count = body.row_count;
    const payload_hash = body.payload_hash ?? null;

    if (!worker_id) {
      return Response.json({ ok: false, error: 'worker_id é obrigatório' }, { status: 400 });
    }
    if (!id && !job_id) {
      return Response.json({ ok: false, error: 'id (PK) ou job_id é obrigatório' }, { status: 400 });
    }

    // 1) Carregar job
    let job = null;

    if (id) {
      // ✅ jeito correto: buscar por PK
      // Se o SDK não tiver get(), ele vai cair no catch e tentar por filter.
      try {
        job = await base44.asServiceRole.entities.MetaJobsQueue.get(id);
      } catch (_) {
        const list = await base44.asServiceRole.entities.MetaJobsQueue.filter({ id });
        job = list?.[0] ?? null;
      }
    } else {
      const list = await base44.asServiceRole.entities.MetaJobsQueue.filter({ job_id });
      job = list?.[0] ?? null;
    }

    // idempotente: se não achou, não quebra
    if (!job) {
      return Response.json({ ok: true, message: 'Job não encontrado (idempotente)' });
    }

    // 2) Regras de idempotência/estado
    if (job.status === 'completed') {
      return Response.json({ ok: true, id: job.id, job_id: job.job_id, status: 'completed' });
    }

    // só completa se estiver processing
    if (job.status !== 'processing') {
      return Response.json({ ok: true, id: job.id, job_id: job.job_id, status: job.status });
    }

    // se está travado por outro worker, não altera
    if (job.locked_by && job.locked_by !== worker_id) {
      return Response.json({ ok: true, id: job.id, job_id: job.job_id, status: job.status });
    }

    // 3) Update
    const updateData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
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