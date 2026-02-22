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

// Sleep helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// deleteMany with retry on 429
async function deleteManyWithRetry(entity, filters, tableId, maxRetries = 5) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await entity.deleteMany(filters);
      return { ok: true, result: res };
    } catch (err) {
      lastError = err;
      const is429 = err?.message?.includes('429') || err?.message?.toLowerCase().includes('rate limit');
      console.warn(`[bulkDelete] table=${tableId} attempt=${attempt} error: ${err.message}`);
      if (is429 && attempt < maxRetries) {
        const waitMs = 2000 * attempt; // 2s, 4s, 6s, 8s, 10s
        console.log(`[bulkDelete] table=${tableId} rate limited — waiting ${waitMs}ms before retry...`);
        await sleep(waitMs);
        continue;
      }
      break;
    }
  }
  return { ok: false, error: lastError?.message || 'Erro desconhecido' };
}

// Fetch IDs in pages to avoid a single huge filter call
async function fetchAllIds(entity, filters, tableId) {
  const PAGE = 500;
  let allIds = [];
  let page = 0;
  while (true) {
    try {
      const rows = await entity.filter(filters, null, PAGE, page * PAGE);
      if (!rows || rows.length === 0) break;
      allIds = allIds.concat(rows.map(r => r.id));
      console.log(`[bulkDelete] table=${tableId} fetched page ${page+1} → ${rows.length} rows (total so far: ${allIds.length})`);
      if (rows.length < PAGE) break;
      page++;
      await sleep(300); // small pause between pages
    } catch (err) {
      const is429 = err?.message?.includes('429') || err?.message?.toLowerCase().includes('rate limit');
      if (is429) {
        console.warn(`[bulkDelete] table=${tableId} rate limit on fetch page ${page} — waiting 3s`);
        await sleep(3000);
        // retry same page
        continue;
      }
      throw err;
    }
  }
  return allIds;
}

// Delete IDs in small batches sequentially
async function deleteIdBatches(entity, ids, tableId) {
  const BATCH = 50;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    for (const id of batch) {
      let success = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await entity.delete(id);
          success = true;
          break;
        } catch (err) {
          const is429 = err?.message?.includes('429') || err?.message?.toLowerCase().includes('rate limit');
          if (is429 && attempt < 5) {
            await sleep(1500 * attempt);
            continue;
          }
          console.warn(`[bulkDelete] table=${tableId} failed to delete id=${id}: ${err.message}`);
          break;
        }
      }
      if (success) deleted++;
    }
    // small pause every batch to avoid rate limits
    if (i + BATCH < ids.length) await sleep(200);
  }
  return deleted;
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

      // Build filter
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

      console.log(`[bulkDelete] START table=${tableId} entity=${entityName} filters=${JSON.stringify(filters)}`);

      try {
        // 1. Try deleteMany first (fast path)
        const { ok, result: dmResult, error: dmError } = await deleteManyWithRetry(
          base44.asServiceRole.entities[entityName],
          filters,
          tableId
        );

        if (ok) {
          // deleteMany doesn't reliably return a count — so fetch remaining to verify
          const remaining = await base44.asServiceRole.entities[entityName].filter(filters, null, 1);
          if (remaining.length === 0) {
            console.log(`[bulkDelete] table=${tableId} deleteMany OK, 0 remaining`);
            result[tableId] = dmResult?.deleted ?? '✓';
            continue;
          }
          // Still records left — fall through to ID-batch deletion
          console.warn(`[bulkDelete] table=${tableId} deleteMany left ${remaining.length}+ records, falling back to ID-batch`);
        } else {
          console.warn(`[bulkDelete] table=${tableId} deleteMany failed: ${dmError}, falling back to ID-batch`);
        }

        // 2. Fallback: fetch all IDs then delete in small batches
        const ids = await fetchAllIds(
          base44.asServiceRole.entities[entityName],
          filters,
          tableId
        );
        console.log(`[bulkDelete] table=${tableId} fallback: ${ids.length} IDs to delete`);

        if (ids.length === 0) {
          result[tableId] = 0;
          continue;
        }

        const deleted = await deleteIdBatches(
          base44.asServiceRole.entities[entityName],
          ids,
          tableId
        );
        console.log(`[bulkDelete] table=${tableId} fallback done: ${deleted}/${ids.length} deleted`);
        result[tableId] = deleted;

      } catch (tableError) {
        console.error(`[bulkDelete] table=${tableId} FATAL: ${tableError.message}`);
        errors[tableId] = tableError.message;
        result[tableId] = 0;
      }
    }

    const total = Object.values(result).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0);
    const hasErrors = Object.keys(errors).length > 0;

    return Response.json({
      success: !hasErrors || total > 0,
      deleted: result,
      errors: hasErrors ? errors : undefined,
      total,
    });

  } catch (error) {
    console.error('Erro geral na exclusão:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});