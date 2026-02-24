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

// Fetch a batch of IDs then delete them in parallel (5 concurrent)
async function deleteOneBatch(entity, filters) {
  const FETCH_SIZE = 200;
  const CONCURRENCY = 5;

  let rows;
  try {
    rows = await entity.filter(filters, null, FETCH_SIZE);
  } catch (e) {
    console.error('Fetch error:', e?.message);
    return { deleted: 0, hasMore: false, error: e.message };
  }

  if (!rows || rows.length === 0) {
    return { deleted: 0, hasMore: false };
  }

  // Delete in parallel chunks of CONCURRENCY
  let deleted = 0;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(row => entity.delete(row.id)));
    deleted += results.filter(r => r.status === 'fulfilled').length;
    // Small pause between chunks to avoid rate limit
    if (i + CONCURRENCY < rows.length) await sleep(100);
  }

  return { deleted, hasMore: rows.length >= FETCH_SIZE };
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

  console.log(`[bulkDelete] table=${table} entity=${entityName} unit=${unit_id} date=${date_from}→${date_to}`);

  const result = await deleteOneBatch(entity, filters);

  console.log(`[bulkDelete] deleted=${result.deleted} hasMore=${result.hasMore}`);

  return Response.json({
    success: true,
    table,
    deleted: result.deleted,
    hasMore: result.hasMore,
    error: result.error || null,
  });
});