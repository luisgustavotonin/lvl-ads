import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TABLE_MAP = {
  base:            'MetaInsightBase',
  platform:        'MetaInsightByPlatformPosition',
  device:          'MetaInsightByDevice',
  demographic:     'MetaInsightByDemographic',
  creatives:       'MetaAdsCreative',
  jobs:            'MetaIngestRun',
  // aliases
  insights:        'MetaInsightBase',
  creatives_basic: 'MetaAdsCreative',
};

const HAS_DATE = {
  base: true, platform: true, device: true, demographic: true,
  creatives: false, jobs: true,
  insights: true, creatives_basic: false,
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function deleteAllByFilter(entity, filters) {
  let total = 0;
  while (true) {
    let rows;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        rows = await entity.filter(filters, null, 200);
        break;
      } catch (err) {
        if (attempt < 4) { await sleep(1000 * attempt); continue; }
        throw err;
      }
    }
    if (!rows || rows.length === 0) break;

    const results = await Promise.allSettled(rows.map(async (r) => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await entity.delete(r.id);
          return true;
        } catch (err) {
          if (attempt < 3) { await sleep(500 * attempt); continue; }
          return false;
        }
      }
    }));
    total += results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    await sleep(100);
  }
  return total;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { unit_id, account_id, date_from, date_to, tables } = await req.json();

    if (!account_id && !unit_id) {
      return Response.json({ error: 'account_id ou unit_id obrigatório' }, { status: 400 });
    }

    const tablesToDelete = Array.isArray(tables) && tables.length > 0
      ? tables
      : Object.keys(TABLE_MAP);

    const result = {};
    const errors = {};

    for (const tableId of tablesToDelete) {
      const entityName = TABLE_MAP[tableId];
      if (!entityName) continue;

      const filters = {};
      if (unit_id) filters.unit_id = unit_id;
      else if (account_id) filters.account_id = account_id;

      if (HAS_DATE[tableId]) {
        if (date_from) filters.date = { $gte: date_from };
        if (date_to) filters.date = { ...(filters.date || {}), $lte: date_to };
      }

      console.log(`[bulkDelete] table=${tableId} entity=${entityName} filters=${JSON.stringify(filters)}`);

      try {
        const entity = base44.asServiceRole.entities[entityName];
        const deleted = await deleteAllByFilter(entity, filters);
        result[tableId] = deleted;
        console.log(`[bulkDelete] table=${tableId} deleted=${deleted}`);
      } catch (err) {
        console.error(`[bulkDelete] table=${tableId} error: ${err.message}`);
        errors[tableId] = err.message;
        result[tableId] = 0;
      }
    }

    const total = Object.values(result).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0);
    return Response.json({ success: true, deleted: result, errors: Object.keys(errors).length > 0 ? errors : undefined, total });

  } catch (error) {
    console.error('Erro geral:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});