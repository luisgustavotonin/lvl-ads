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

  console.log(`[bulkDelete] START table=${table} unit=${unit_id}`);

  let totalDeleted = 0;
  let round = 0;

  // Keep calling deleteMany until 0 records remain, with pauses to avoid 429
  while (true) {
    round++;
    // Check if there's anything left first
    let check;
    try {
      check = await entity.filter(query, null, 1);
    } catch (e) {
      console.warn(`Check failed round ${round}:`, e?.message);
      await sleep(5000);
      continue;
    }

    if (!check || check.length === 0) {
      console.log(`[bulkDelete] No more records after round ${round}`);
      break;
    }

    // Wait before deleteMany to give the rate limit bucket time to refill
    await sleep(2000);

    let result;
    try {
      result = await entity.deleteMany(query);
      totalDeleted += result.deleted || 0;
      console.log(`[bulkDelete] round=${round} deleted=${result.deleted} total=${totalDeleted}`);
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('429') || msg.includes('Rate limit')) {
        console.warn(`[bulkDelete] 429 on round ${round}, waiting 10s`);
        await sleep(10000);
        continue; // retry same round
      }
      console.error(`[bulkDelete] Error on round ${round}:`, msg);
      break;
    }

    if (!result.deleted || result.deleted === 0) break;

    // Pause before next round
    await sleep(3000);
  }

  console.log(`[bulkDelete] DONE table=${table} totalDeleted=${totalDeleted}`);

  return Response.json({ success: true, table, deleted: totalDeleted, hasMore: false });
});