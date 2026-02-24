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

// Delete records one at a time with generous pauses to avoid rate limits
async function deleteAllSerial(entity, filters) {
  let total = 0;
  let attempts = 0;
  const MAX_ATTEMPTS = 200; // safety cap per table

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    // Fetch a small batch
    let rows;
    try {
      rows = await entity.filter(filters, null, 10);
    } catch (e) {
      console.error('Fetch error:', e?.message);
      await sleep(2000);
      continue;
    }

    if (!rows || rows.length === 0) break;

    // Delete each one individually with pause
    for (const row of rows) {
      let deleted = false;
      let retries = 0;
      while (!deleted && retries < 5) {
        try {
          await entity.delete(row.id);
          deleted = true;
          total++;
        } catch (e) {
          retries++;
          console.warn(`Delete retry ${retries} for ${row.id}:`, e?.message);
          await sleep(1000 * retries); // exponential backoff
        }
      }
      await sleep(300); // 300ms between each delete
    }

    await sleep(1000); // 1s between fetch batches
  }

  return total;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { unit_id, date_from, date_to, tables } = await req.json();
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

    if (HAS_DATE[tableId] && (date_from || date_to)) {
      filters.date = {};
      if (date_from) filters.date.$gte = date_from;
      if (date_to) filters.date.$lte = date_to;
    }

    console.log(`Deleting ${tableId} (${entityName}) for unit=${unit_id} date=${date_from}→${date_to}`);

    try {
      const count = await deleteAllSerial(entity, filters);
      deleted[tableId] = count;
      total += count;
      console.log(`Done ${tableId}: ${count} deleted`);
    } catch (e) {
      console.error(`Error deleting ${tableId}:`, e?.message);
      errors[tableId] = e.message || String(e);
    }

    await sleep(2000); // 2s pause between tables
  }

  return Response.json({ success: true, total, deleted, errors });
});