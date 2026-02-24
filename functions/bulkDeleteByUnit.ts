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

// Run deleteMany with retry on 429
async function deleteManyWithRetry(entity, query, maxAttempts = 10) {
  let totalDeleted = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Check how many records remain first
      const rows = await entity.filter(query, null, 1);
      if (!rows || rows.length === 0) break;

      const result = await entity.deleteMany(query);
      totalDeleted += result.deleted || 0;
      console.log(`[deleteMany] attempt=${attempt} deleted=${result.deleted} total=${totalDeleted}`);

      // Keep going if there might be more
      if (!result.deleted || result.deleted === 0) break;
      await sleep(3000); // 3s between rounds to respect rate limit
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('429') || msg.includes('Rate limit')) {
        const wait = 5000 * attempt;
        console.warn(`429 on attempt ${attempt}, waiting ${wait}ms`);
        await sleep(wait);
      } else {
        console.error(`Unexpected error on attempt ${attempt}:`, msg);
        throw e;
      }
    }
  }
  return totalDeleted;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { unit_id, date_from, date_to, table } = await req.json();

  if (!unit_id || !table) {
    return Response.json({ error: 'unit_id e table são obrigatórios' }, { status: 400 });
  }

  const entityName = TABLE_MAP[table];
  if (!entityName) {
    return Response.json({ error: `Tabela inválida: ${table}` }, { status: 400 });
  }

  const entity = base44.asServiceRole.entities[entityName];
  const query = { unit_id };

  if (HAS_DATE[table] && (date_from || date_to)) {
    query.date = {};
    if (date_from) query.date.$gte = date_from;
    if (date_to) query.date.$lte = date_to;
  }

  console.log(`[bulkDelete] START table=${table} unit=${unit_id} date=${date_from}→${date_to}`);

  const totalDeleted = await deleteManyWithRetry(entity, query);

  console.log(`[bulkDelete] DONE table=${table} total=${totalDeleted}`);

  return Response.json({ success: true, table, deleted: totalDeleted, hasMore: false });
});