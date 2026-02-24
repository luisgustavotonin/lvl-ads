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

// Retry a single delete with backoff on 429
async function deleteWithRetry(entity, id, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await entity.delete(id);
      return true;
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('429') || msg.includes('Rate limit')) {
        // Wait longer on rate limit: 2s, 4s, 8s...
        const wait = 2000 * attempt;
        console.warn(`429 on ${id}, waiting ${wait}ms (attempt ${attempt})`);
        await sleep(wait);
      } else {
        console.warn(`Delete failed for ${id}:`, msg);
        return false;
      }
    }
  }
  return false;
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
  const filters = { unit_id };

  if (HAS_DATE[table] && (date_from || date_to)) {
    filters.date = {};
    if (date_from) filters.date.$gte = date_from;
    if (date_to) filters.date.$lte = date_to;
  }

  console.log(`[bulkDelete] table=${table} unit=${unit_id} date=${date_from}→${date_to}`);

  // Fetch a batch of 50
  let rows;
  try {
    rows = await entity.filter(filters, null, 50);
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return Response.json({ success: true, table, deleted: 0, hasMore: false });
  }

  // Delete sequentially with 300ms pause between each to avoid 429
  let deleted = 0;
  for (const row of rows) {
    const ok = await deleteWithRetry(entity, row.id);
    if (ok) deleted++;
    await sleep(300); // steady 300ms between deletes
  }

  const hasMore = rows.length >= 50;
  console.log(`[bulkDelete] deleted=${deleted}/${rows.length} hasMore=${hasMore}`);

  return Response.json({ success: true, table, deleted, hasMore });
});