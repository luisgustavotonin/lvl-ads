import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    const worker_id = payload?.worker_id;
    const limit = Number(payload?.limit ?? 1);
    const lock_ttl_seconds = Number(payload?.lock_ttl_seconds ?? 300);

    if (!worker_id || typeof worker_id !== 'string') {
      return Response.json({ ok: false, error: 'worker_id (string) é obrigatório' }, { status: 400 });
    }

    const now = new Date();
    const locked_until = new Date(now.getTime() + lock_ttl_seconds * 1000).toISOString();

    // Buscar 1 job elegível: queued ou processing expirado
    const candidates = await base44.asServiceRole.entities.MetaJobsQueue.filter({
      status: ['queued', 'processing'],
    });

    // Filtrar elegíveis (queued ou processing com lock expirado)
    const eligible = (candidates || []).filter((j) => {
      const status = String(j?.status ?? '');
      if (status === 'queued') return true;
      if (status === 'processing') {
        const lu = j?.locked_until ? new Date(String(j.locked_until)) : null;
        return !lu || lu.getTime() < now.getTime();
      }
      return false;
    });

    // Ordenar por created_at (se tiver) para pegar o mais antigo
    eligible.sort((a, b) => {
      const da = a?.created_at ? new Date(String(a.created_at)).getTime() : 0;
      const db = b?.created_at ? new Date(String(b.created_at)).getTime() : 0;
      return da - db;
    });

    const job = eligible[0];
    if (!job) {
      return Response.json({ ok: true, job: null });
    }

    // Claim: status -> processing + lock
    await base44.asServiceRole.entities.MetaJobsQueue.update(job.id, {
      status: 'processing',
      locked_by: worker_id,
      locked_at: now.toISOString(),
      locked_until,
      attempts: (Number(job?.attempts ?? 0) + 1),
    });

    // Retornar job em formato simples pro n8n
    return Response.json({
      ok: true,
      job: {
        id: job.id,
        job_id: String(job.job_id),
        status: 'processing',
        breakdown: job.breakdown ?? null,
      },
    });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message ?? String(error) }, { status: 500 });
  }
});