import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TABLE_MAP = {
  base:        'MetaInsightBase',
  platform:    'MetaInsightByPlatformPosition',
  device:      'MetaInsightByDevice',
  demographic: 'MetaInsightByDemographic',
  creatives:   'MetaAdsCreative',
  jobs:        'MetaIngestRun',
};

const HAS_DATE = {
  base: true, platform: true, device: true, demographic: true,
  creatives: false, jobs: true,
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function deleteAllMatching(entity, query) {
  let total = 0;
  let rounds = 0;

  while (true) {
    rounds++;
    let result;

    try {
      result = await entity.deleteMany(query);
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.includes('429') || msg.includes('Rate limit')) {
        console.warn(`[purge] 429 rate limit, sleeping 10s (round ${rounds})`);
        await sleep(10000);
        result = await entity.deleteMany(query);
      } else {
        throw e;
      }
    }

    const deleted = result?.deleted || 0;
    total += deleted;
    console.log(`[purge] round=${rounds} deleted=${deleted} total=${total}`);

    if (deleted === 0) break;

    await sleep(1200);
  }

  return total;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
  }

  const { unit_id, date_from, date_to, tables } = await req.json();

  if (!unit_id || !tables || !tables.length) {
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
      if (date_to)   query.date.$lte = date_to;
    }

    try {
      const deleted = await deleteAllMatching(entity, query);
      results[table] = { deleted };
      console.log(`[purge] DONE table=${table} deleted=${deleted}`);
    } catch (e) {
      console.error(`[purge] ERROR table=${table}:`, e?.message);
      results[table] = { error: e?.message || String(e) };
    }

    // Pausa entre tabelas para não pressionar rate limit
    await sleep(2000);
  }

  return Response.json({ success: true, unit_id, date_from, date_to, results });
});