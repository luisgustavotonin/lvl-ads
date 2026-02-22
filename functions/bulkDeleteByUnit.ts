import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Exclusão em massa por unidade e filtro de data.
 * Recebe: { unit_id, account_id, date_from, date_to, tables: string[] }
 * tables pode conter: 'base', 'platform', 'device', 'demographic', 'creatives', 'jobs'
 */

const TABLE_MAP = {
  base:        'MetaInsightBase',
  platform:    'MetaInsightByPlatformPosition',
  device:      'MetaInsightByDevice',
  demographic: 'MetaInsightByDemographic',
  creatives:   'MetaAdsCreative',
  jobs:        'MetaIngestRun',
};

const HAS_DATE = {
  base: true, platform: true, device: true, demographic: true, creatives: false, jobs: true,
};

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

    for (const tableId of tablesToDelete) {
      const entityName = TABLE_MAP[tableId];
      if (!entityName) continue;

      // Build filter — always filter by unit_id when available, fallback to account_id
      const filters = {};
      if (unit_id) {
        filters.unit_id = unit_id;
      } else if (account_id) {
        filters.account_id = account_id;
      }

      if (HAS_DATE[tableId]) {
        if (tableId === 'jobs') {
          if (date_from) filters.date_from = { $gte: date_from };
          if (date_to) filters.date_to = { ...(filters.date_to || {}), $lte: date_to };
        } else {
          if (date_from) filters.date = { $gte: date_from };
          if (date_to) filters.date = { ...(filters.date || {}), $lte: date_to };
        }
      }

      const records = await base44.asServiceRole.entities[entityName].filter(filters, null, 50000);

      if (records.length === 0) {
        result[tableId] = 0;
        continue;
      }

      // Delete sequentially in small batches to avoid rate limits
      const BATCH = 10;
      const DELAY = 300; // ms between batches
      let deleted = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(r => base44.asServiceRole.entities[entityName].delete(r.id))
        );
        deleted += results.filter(r => r.status === 'fulfilled').length;
        if (i + BATCH < records.length) {
          await new Promise(r => setTimeout(r, DELAY));
        }
      }

      result[tableId] = deleted;
    }

    const total = Object.values(result).reduce((s, n) => s + n, 0);
    return Response.json({ success: true, deleted: result, total });

  } catch (error) {
    console.error('Erro na exclusão:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});