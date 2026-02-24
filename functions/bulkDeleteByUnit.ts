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

const BATCH = 100;
const CONCURRENCY = 20;

async function deleteAll(entity, filters) {
  let total = 0;
  while (true) {
    const rows = await entity.filter(filters, null, 500);
    if (!rows || rows.length === 0) break;

    // delete in parallel chunks
    const ids = rows.map(r => r.id);
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const chunk = ids.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(id => entity.delete(id)));
      total += chunk.length;
    }

    if (rows.length < 500) break;
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

  for (const tableId of tables) {
    const entityName = TABLE_MAP[tableId];
    if (!entityName) continue;

    const entity = base44.asServiceRole.entities[entityName];
    const filters = { unit_id };

    if (HAS_DATE[tableId]) {
      if (date_from || date_to) {
        filters.date = {};
        if (date_from) filters.date.$gte = date_from;
        if (date_to) filters.date.$lte = date_to;
      }
    }

    try {
      const count = await deleteAll(entity, filters);
      deleted[tableId] = count;
      total += count;
    } catch (e) {
      errors[tableId] = e.message || String(e);
    }
  }

  return Response.json({ success: true, total, deleted, errors });
});