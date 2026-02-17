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

    // Busca candidatos (queued ou processing expirado)
    // OBS: como o SDK filter é simples, filtramos status e depois refinamos elegibilidade aqui
    const candidates = await base44.asServiceRole.entities.MetaJobsQueue.filter({
      status: ['queued', 'processing'],
    });

    const eligible = (candidates || []).filter((j) => {
      const st = String(j?.status ?? '');
      if (st === 'queued') return true;

      if (st === 'processing') {
        const lu = j?.locked_until ? new Date(String(j.locked_until)) : null;
        // processing com lock expirado (ou sem lock) pode ser reprocessado
        return !lu || lu.getTime() < now.getTime();
      }

      return false;
    });

    // Ordena por created_at (mais antigo primeiro) e limita
    eligible.sort((a, b) => {
      const da = a?.created_at ? new Date(String(a.created_at)).getTime() : 0;
      const db = b?.created_at ? new Date(String(b.created_at)).getTime() : 0;
      return da - db;
    });

    const job = eligible[0];
    if (!job) {
      return Response.json({ ok: true, job: null });
    }

    // Claim: marca processing + lock + attempts
    await base44.asServiceRole.entities.MetaJobsQueue.update(job.id, {
      status: 'processing',
      locked_by: worker_id,
      locked_at: now.toISOString(),
      locked_until,
      attempts: (Number(job?.attempts ?? 0) + 1),
    });

    // Padroniza período: se tiver date_preset, usa; senão usa since/until
    // (mantém exatamente como estava antes: preset OU custom)
    const date_preset =
      job?.date_preset ?? job?.payload_json?.date_preset ?? null;

    const since =
      job?.since ?? job?.payload_json?.since ?? null;

    const until =
      job?.until ?? job?.payload_json?.until ?? null;

    const date_mode =
      job?.date_mode ?? job?.payload_json?.date_mode ?? (date_preset ? 'preset' : (since || until ? 'custom' : null));

    const timezone =
      job?.timezone ?? job?.payload_json?.timezone ?? null;

    // Retorno COMPLETO (igual você precisa no n8n)
    return Response.json({
      ok: true,
      job: {
        // chaves do job
        id: job.id,
        job_id: String(job.job_id),
        status: 'processing',
        breakdown: job.breakdown ?? null,

        // identidades/config
        org_id: job.org_id ?? null,
        unit_id: job.unit_id ?? null,
        account_id: job.account_id ?? null,
        access_token: job.access_token ?? null,

        // período (preset OU custom)
        date_mode,
        date_preset,
        since,
        until,
        timezone,

        // opcional: devolve payload_json inteiro se existir
        payload_json: job.payload_json ?? null,
      },
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
});