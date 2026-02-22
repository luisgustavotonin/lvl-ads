import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Exclusão em massa por unidade e filtro de data.
 * Estratégia: 
 *  1. Conta os registros primeiro (para barra de progresso real)
 *  2. Tenta deleteMany (fast path)
 *  3. Se falhar ou sobrar registros, deleta por IDs em lotes com retry
 * 
 * Retorna progresso via streaming de NDJSON (newline-delimited JSON)
 * para o frontend poder atualizar a barra conforme execução.
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function safeDeleteMany(entity, filters, tableId, maxRetries = 4) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await entity.deleteMany(filters);
      return { ok: true, result: res };
    } catch (err) {
      const is429 = err?.message?.includes('429') || err?.message?.toLowerCase().includes('rate limit');
      console.warn(`[bulkDelete] ${tableId} deleteMany attempt=${attempt} err=${err.message}`);
      if (attempt < maxRetries) {
        await sleep(is429 ? 3000 * attempt : 1000);
        continue;
      }
      return { ok: false, error: err.message };
    }
  }
}

async function fetchIds(entity, filters, tableId) {
  const PAGE = 500;
  let allIds = [];
  let page = 0;
  while (true) {
    let rows;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        rows = await entity.filter(filters, null, PAGE, page * PAGE);
        break;
      } catch (err) {
        const is429 = err?.message?.includes('429') || err?.message?.toLowerCase().includes('rate limit');
        if (attempt < 4) { await sleep(is429 ? 3000 : 1000); continue; }
        throw err;
      }
    }
    if (!rows || rows.length === 0) break;
    allIds = allIds.concat(rows.map(r => r.id));
    if (rows.length < PAGE) break;
    page++;
    await sleep(150);
  }
  return allIds;
}

async function deleteIds(entity, ids, tableId, onProgress) {
  const BATCH = 30;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    // Try parallel delete within batch
    const results = await Promise.allSettled(batch.map(async (id) => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          await entity.delete(id);
          return true;
        } catch (err) {
          const is429 = err?.message?.includes('429') || err?.message?.toLowerCase().includes('rate limit');
          if (attempt < 4) { await sleep(is429 ? 2000 * attempt : 500); continue; }
          return false;
        }
      }
    }));
    deleted += results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    if (onProgress) onProgress(deleted, ids.length);
    if (i + BATCH < ids.length) await sleep(100);
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

    // Use a TransformStream to stream progress updates as NDJSON
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const send = async (obj) => {
      await writer.write(encoder.encode(JSON.stringify(obj) + '\n'));
    };

    (async () => {
      try {
        for (let t = 0; t < tablesToDelete.length; t++) {
          const tableId = tablesToDelete[t];
          const entityName = TABLE_MAP[tableId];
          if (!entityName) continue;

          const filters = {};
          if (unit_id) filters.unit_id = unit_id;
          else if (account_id) filters.account_id = account_id;

          if (HAS_DATE[tableId]) {
            if (tableId === 'jobs') {
              if (date_from) filters.date_from = { $gte: date_from };
              if (date_to) filters.date_to = { ...(filters.date_to || {}), $lte: date_to };
            } else {
              if (date_from) filters.date = { $gte: date_from };
              if (date_to) filters.date = { ...(filters.date || {}), $lte: date_to };
            }
          }

          await send({ type: 'table_start', tableId, tableIndex: t, total: tablesToDelete.length });
          console.log(`[bulkDelete] START table=${tableId} filters=${JSON.stringify(filters)}`);

          try {
            const entity = base44.asServiceRole.entities[entityName];

            // Count records
            let ids = await fetchIds(entity, filters, tableId);
            const count = ids.length;
            console.log(`[bulkDelete] table=${tableId} found=${count}`);
            await send({ type: 'table_count', tableId, count });

            if (count === 0) {
              result[tableId] = 0;
              await send({ type: 'table_done', tableId, deleted: 0, tableIndex: t, total: tablesToDelete.length });
              continue;
            }

            // Try deleteMany first
            const { ok } = await safeDeleteMany(entity, filters, tableId);
            if (ok) {
              // Verify
              const remaining = await fetchIds(entity, filters, tableId);
              if (remaining.length === 0) {
                result[tableId] = count;
                await send({ type: 'table_done', tableId, deleted: count, tableIndex: t, total: tablesToDelete.length });
                continue;
              }
              // Still have records — use remaining IDs as the list to delete
              ids = remaining;
              console.warn(`[bulkDelete] table=${tableId} deleteMany incomplete, ${ids.length} remaining — fallback to ID-batch`);
            } else {
              console.warn(`[bulkDelete] table=${tableId} deleteMany failed — fallback to ID-batch`);
            }

            // Fallback: delete by ID with progress
            const deleted = await deleteIds(entity, ids, tableId, async (done, total) => {
              await send({ type: 'table_progress', tableId, done, total });
            });

            result[tableId] = deleted;
            await send({ type: 'table_done', tableId, deleted, tableIndex: t, total: tablesToDelete.length });

          } catch (tableError) {
            console.error(`[bulkDelete] table=${tableId} FATAL: ${tableError.message}`);
            errors[tableId] = tableError.message;
            result[tableId] = 0;
            await send({ type: 'table_error', tableId, error: tableError.message, tableIndex: t, total: tablesToDelete.length });
          }
        }

        const total = Object.values(result).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0);
        await send({ type: 'done', deleted: result, errors: Object.keys(errors).length > 0 ? errors : undefined, total });
      } catch (err) {
        await send({ type: 'fatal_error', error: err.message });
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});