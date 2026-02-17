import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const worker_id = body?.worker_id;
    const lock_ttl_seconds = Number(body?.lock_ttl_seconds ?? 300);

    if (!worker_id || typeof worker_id !== 'string') {
      return Response.json({ ok: false, error: 'worker_id (string) é obrigatório' }, { status: 400 });
    }

    const now = new Date();
    const locked_until = new Date(now.getTime() + lock_ttl_seconds * 1000).toISOString();

    // 1) Buscar jobs elegíveis (queued ou processing expirado)
    const candidates = await base44.asServiceRole.entities.MetaJobsQueue.filter({
      status: ['queued', 'processing'],
    });

    const eligible = (candidates || []).filter((j) => {
      const st = String(j?.status ?? '');
      if (st === 'queued') return true;
      if (st === 'processing') {
        const lu = j?.locked_until ? new Date(String(j.locked_until)) : null;
        return !lu || lu.getTime() < now.getTime();
      }
      return false;
    });

    eligible.sort((a, b) => {
      const da = a?.created_at ? new Date(String(a.created_at)).getTime() : 0;
      const db = b?.created_at ? new Date(String(b.created_at)).getTime() : 0;
      return da - db;
    });

    const job = eligible[0];
    if (!job) return Response.json({ ok: true, job: null });

    // 2) Claim (lock + processing + attempts)
    await base44.asServiceRole.entities.MetaJobsQueue.update(job.id, {
      status: 'processing',
      locked_by: worker_id,
      locked_at: now.toISOString(),
      locked_until,
      attempts: Number(job?.attempts ?? 0) + 1,
      started_at: job?.started_at ?? now.toISOString(),
    });

    // 3) Período: preset OU since/until
    const date_preset = job?.date_preset ?? null;
    const since = job?.since ?? null;
    const until = job?.until ?? null;
    const timezone = job?.timezone ?? null;

    const date_mode =
      job?.date_mode ??
      (date_preset ? 'preset' : (since || until ? 'custom' : null));

    return Response.json({
      ok: true,
      job: {
        id: job.id,
        job_id: String(job.job_id),
        status: 'processing',
        breakdown: job.breakdown ?? null,

        org_id: job.org_id ?? null,
        unit_id: job.unit_id ?? null,

        account_id: job.account_id ?? null,
        access_token: job.access_token ?? null,

        date_mode,
        date_preset,
        since,
        until,
        timezone,
      },
    });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
});