import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TABLE_MAP = {
  base:            'MetaInsightBase',
  platform:        'MetaInsightByPlatformPosition',
  device:          'MetaInsightByDevice',
  demographic:     'MetaInsightByDemographic',
  creatives:       'MetaAdsCreative',
  jobs:            'MetaIngestRun',
  insights:        'MetaInsightBase',
  creatives_basic: 'MetaAdsCreative',
};

const HAS_DATE = {
  base: true, platform: true, device: true, demographic: true,
  creatives: false, jobs: true,
  insights: true, creatives_basic: false,
};

const FETCH_BATCH = 50;
const DELETE_CONCURRENCY = 2; // very conservative to avoid rate limits
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function deleteAll(entity, filters) {
  let total = 0;
  while (true) {
    const rows = await entity.filter(filters, null, FETCH_BATCH);
    if (!rows || rows.length === 0) break;

    const ids = rows.map(r => r.id);

    // Delete one-by-one in small chunks with generous pauses
    for (let i = 0; i < ids.length; i += DELETE_CONCURRENCY) {
      const chunk = ids.slice(i, i + DELETE_CONCURRENCY);
      await Promise.all(chunk.map(id => entity.delete(id)));
      total += chunk.length;
      await sleep(500); // 500ms between each micro-batch
    }

    if (rows.length < FETCH_BATCH) break;
    await sleep(1000); // 1s between fetch batches
  }
  return total;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { unit_id, account_id, date_from, date_to, tables } = await req.json();
  if (!unit_id || !tables?.length) {
    return Response.json({ error: 'unit_id e tables são obrigatórios' }, { status: 400 });
  }

  const deleted = {};
  const errors = {};
  let total = 0;

  // Process tables sequentially to avoid rate limits
  for (const tableId of tables) {
    const entityName = TABLE_MAP[tableId];
    if (!entityName) continue;

    const entity = base44.asServiceRole.entities[entityName];
    const filters = { unit_id };

    if (HAS_DATE[tableId] && (date_from || date_to)) {
      filters.date = {};
      if (date_from) filters.date.$gte = date_from;
      if (date_to) filters.date.$lte = date_to;
    }

    try {
      const count = await deleteAll(entity, filters);
      deleted[tableId] = count;
      total += count;
    } catch (e) {
      console.error(`Error deleting ${tableId}:`, e?.message);
      errors[tableId] = e.message || String(e);
    }

    await sleep(300); // pause between tables
  }

  return Response.json({ success: true, total, deleted, errors });
});