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
  creatives: false, jobs: false,
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function deleteAllMatching(entity, query) {
  let total = 0;
  let rounds = 0;
  const CONCURRENT = 5; // max 5 deletes simultâneos

  while (true) {
    rounds++;
    let records;
    try {
      records = await entity.filter(query, null, 200);
    } catch (e) {
      throw e;
    }

    if (!records || records.length === 0) break;

    // Processa em chunks de CONCURRENT deletions
    for (let i = 0; i < records.length; i += CONCURRENT) {
      const chunk = records.slice(i, i + CONCURRENT);
      const promises = chunk.map(rec => 
        entity.delete(rec.id).catch(err => {
          console.error(`[purge] erro ao deletar ${rec.id}:`, err?.message);
        })
      );
      await Promise.all(promises);
      // Pausa entre chunks
      if (i + CONCURRENT < records.length) {
        await sleep(200);
      }
    }
    
    total += records.length;
    console.log(`[purge] round=${rounds} batch=${records.length} total=${total}`);

    if (records.length < 200) break;

    // Pausa maior entre batches
    await sleep(300);
  }

  return total;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
  }

  const body = await req.json();
  const { unit_id, date_from, date_to, tables, list_units } = body;

  // Se pedir listagem de unidades
  if (list_units) {
    const units = await base44.asServiceRole.entities.Unit.list();
    return Response.json(units.map(u => ({ id: u.id, name: u.name, account_id: u.account_id })));
  }

  if (!unit_id || !tables || !tables.length) {
    return Response.json({ error: 'unit_id e tables[] são obrigatórios' }, { status: 400 });
  }

  const results = {};

  for (const table of tables) {
    const entityName = TABLE_MAP[table];
    if (!entityName) {
      results[table] = { error: `Tabela inválida: ${table}` };
      continue;
    }

    const entity = base44.asServiceRole.entities[entityName];
    const query = { unit_id };

    if (HAS_DATE[table] && (date_from || date_to)) {
      query.date = {};
      if (date_from) query.date.$gte = date_from;
      if (date_to)   query.date.$lte = date_to;
    }

    try {
      const deleted = await deleteAllMatching(entity, query);
      results[table] = { deleted };
      console.log(`[purge] DONE table=${table} deleted=${deleted}`);
    } catch (e) {
      console.error(`[purge] ERROR table=${table}:`, e?.message);
      results[table] = { error: e?.message || String(e) };
    }
  }

  return Response.json({ success: true, unit_id, date_from, date_to, results });
});