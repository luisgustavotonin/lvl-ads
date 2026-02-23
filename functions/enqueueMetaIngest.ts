import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Simple deterministic hash (djb2)
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { account_id, unit_id, date_from, date_to, job_type = 'insights', level = 'ad', breakdowns = [], force = false, meta_token, mode, job_key_override } = body;

    if (!account_id || !date_from || !date_to) {
      return Response.json({ error: 'account_id, date_from, date_to obrigatórios' }, { status: 400 });
    }
    if (!meta_token) {
      return Response.json({ error: 'meta_token obrigatório' }, { status: 400 });
    }

    const modeStr = mode || 'all';
    const job_key = job_key_override || `${account_id}:${job_type}:${level}:${date_from}:${date_to}:${modeStr}:${simpleHash(modeStr)}`;

    console.log(`📥 enqueueMetaIngest job_key=${job_key} force=${force}`);

    // Verificar job existente
    const existing = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1);

    if (existing.length > 0 && !force) {
      const job = existing[0];
      if (job.status === 'running') return Response.json({ status: 'running', job_key });
      if (job.status === 'done') return Response.json({ status: 'done', job_key, rows_written: job.rows_written });
    }

    // Criar ou resetar job
    let jobId;
    if (existing.length > 0) {
      await base44.asServiceRole.entities.MetaIngestRun.update(existing[0].id, {
        status: 'queued', progress: 0, rows_written: 0, error_message: null,
        meta_token_hint: meta_token.substring(0, 8)
      });
      jobId = existing[0].id;
    } else {
      const created = await base44.asServiceRole.entities.MetaIngestRun.create({
        job_key, account_id, unit_id: unit_id || '', date_from, date_to, job_type, level,
        breakdowns, status: 'queued', progress: 0, rows_written: 0,
        meta_token_hint: meta_token.substring(0, 8),
        mode: modeStr,
      });
      jobId = created.id;
    }

    // NOTE: runMetaIngest is now called directly from the frontend queue (not fire-and-forget)
    // so we just return the queued job here.
    return Response.json({ status: 'queued', job_key, job_id: jobId });

  } catch (error) {
    console.error('❌ enqueueMetaIngest:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});