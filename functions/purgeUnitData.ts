import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TABLE_MAP = {
  base: 'MetaInsightBase',
  platform: 'MetaInsightByPlatformPosition',
  device: 'MetaInsightByDevice',
  demographic: 'MetaInsightByDemographic',
  creatives: 'MetaAdsCreative',
  jobs: 'MetaIngestRun',
};

const HAS_DATE = {
  base: true,
  platform: true,
  device: true,
  demographic: true,
  creatives: false,
  jobs: false,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function jitter(ms) {
  return ms + Math.floor(Math.random() * 120);
}

function isTransientDeleteError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('rate') ||
    msg.includes('429') ||
    msg.includes('timeout') ||
    msg.includes('tempor') ||
    msg.includes('network') ||
    msg.includes('5') // cobre 5xx que às vezes vem em texto
  );
}

async function deleteWithRetry(entity, id, maxRetries) {
  let lastErr = null;
  const retries = typeof maxRetries === 'number' ? maxRetries : 5;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await entity.delete(id);
      return true;
    } catch (e) {
      lastErr = e;
      if (!isTransientDeleteError(e) || attempt === retries) break;

      const backoff = jitter(250 * Math.pow(2, attempt));
      console.warn(
        `[purge] transient delete error id=${id} attempt=${attempt + 1}/${retries + 1} -> retry in ${backoff}ms:`,
        String(e?.message || e)
      );
      await sleep(backoff);
    }
  }

  throw lastErr;
}

async function deleteAllMatching(entity, query, opts) {
  const BATCH_SIZE = opts?.batchSize ?? 300; // menor e estável
  const DELETE_CONCURRENCY = opts?.deleteConcurrency ?? 12; // menor e estável

  let totalDeleted = 0;
  let rounds = 0;

  while (true) {
    rounds++;

    const records = await entity.filter(query, null, BATCH_SIZE);
    if (!records || records.length === 0) break;

    // Fila de ids
    const ids = records.map((r) => r.id);

    // Concurrency fixa com "workers"
    const workers = Array.from(
      { length: Math.min(DELETE_CONCURRENCY, ids.length) },
      () => (async () => {
        while (ids.length) {
          const id = ids.pop();
          if (!id) return;
          await deleteWithRetry(entity, id, 5);
        }
      })()
    );

    const settled = await Promise.allSettled(workers);
    const rejected = settled.filter((s) => s.status === 'rejected');

    if (rejected.length) {
      const first = rejected[0].reason;
      throw new Error(`Falha ao deletar (exemplo): ${String(first?.message || first)}`);
    }

    totalDeleted += records.length;
    console.log(`[purge] round=${rounds} batch=${records.length} totalDeleted=${totalDeleted}`);

    if (records.length < BATCH_SIZE) break;

    await sleep(80);
  }

  return totalDeleted;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // IMPORTANTE: se isso for chamado via n8n, auth.me() pode vir null
  const user = await base44.auth.me().catch(() => null);

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { unit_id, date_from, date_to, tables, list_units } = body;

  if (list_units) {
    const units = await base44.asServiceRole.entities.Unit.list();
    return Response.json(units.map((u) => ({ id: u.id, name: u.name, account_id: u.account_id })));
  }

  if (!unit_id || !Array.isArray(tables) || tables.length === 0) {
    return Response.json({ error: 'unit_id e tables[] são obrigatórios' }, { status: 400 });
  }

  const results = {};

  for (const table of tables) {
    const entityName = TABLE_MAP[table];
    if (!entityName) {
      results[table] = { error: `Tabela inválida: ${table}` };
      continue;
    }

    const entity = base44.asServiceRole.entities[entityName];

    const query = { unit_id };

    if (HAS_DATE[table] && (date_from || date_to)) {
      query.date = {};
      if (date_from) query.date.$gte = date_from;
      if (date_to) query.date.$lte = date_to;
    }

    try {
      const deleted = await deleteAllMatching(entity, query, {
        batchSize: 300,
        deleteConcurrency: 12,
      });
      results[table] = { deleted };
      console.log(`[purge] DONE table=${table} deleted=${deleted}`);
    } catch (e) {
      console.error(`[purge] ERROR table=${table}:`, e?.message || e);
      results[table] = { error: e?.message || String(e) };
    }
  }

  return Response.json({ success: true, unit_id, date_from, date_to, results });
});