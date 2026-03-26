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

  // Delete up to 5 batches of deleteMany per call (~500 records)
  // Each deleteMany deletes up to 100 records, so 5 rounds = ~500 max
  let totalDeleted = 0;
  let hasMore = true;

  for (let i = 0; i < 5; i++) {
    let result;
    try {
      result = await entity.deleteMany(query);
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('429') || msg.includes('Rate limit')) {
        console.warn(`[bulkDelete] 429 on round ${i + 1}, pausing 8s`);
        await sleep(8000);
        try {
          result = await entity.deleteMany(query);
        } catch (_) {
          break;
        }
      } else {
        break;
      }
    }

    const deleted = result?.deleted || 0;
    totalDeleted += deleted;
    console.log(`[bulkDelete] round=${i + 1} deleted=${deleted} total=${totalDeleted}`);

    if (deleted === 0) {
      hasMore = false;
      break;
    }

    // Small pause between rounds to avoid rate limit
    if (i < 4) await sleep(1500);
  }

  return Response.json({ success: true, table, deleted: totalDeleted, hasMore });
});