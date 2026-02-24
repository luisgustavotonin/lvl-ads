import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

const TABLE_MAP = {
  base: "MetaInsightBase",
  platform: "MetaInsightByPlatformPosition",
  device: "MetaInsightByDevice",
  demographic: "MetaInsightByDemographic",
  creatives: "MetaAdsCreative",
  jobs: "MetaIngestRun",
};

const HAS_DATE = {
  base: true,
  platform: true,
  device: true,
  demographic: true,
  creatives: false,
  jobs: false,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function deleteAllMatching(entity, query) {
  let total = 0;
  let rounds = 0;

  // ⛔️ 150 é MUITO alto e causa rate limit no Base44
  const CONCURRENT = 10;
  const BATCH_SIZE = 200;

  while (true) {
    rounds++;

    const records = await entity.filter(query, null, BATCH_SIZE);
    if (!records || records.length === 0) break;

    // Deleta em lotes com limite de concorrência
    for (let i = 0; i < records.length; i += CONCURRENT) {
      const chunk = records.slice(i, i + CONCURRENT);

      const results = await Promise.allSettled(
        chunk.map((rec) => entity.delete(rec.id))
      );

      for (let k = 0; k < results.length; k++) {
        const r = results[k];
        if (r.status === "rejected") {
          console.error(
            `[purge] erro ao deletar ${chunk[k]?.id}:`,
            r.reason?.message || r.reason
          );
        }
      }

      // respiro pra não tomar rate limit
      await sleep(80);
    }

    total += records.length;
    console.log(`[purge] round=${rounds} batch=${records.length} total=${total}`);

    if (records.length < BATCH_SIZE) break;

    await sleep(150);
  }

  return total;
}

// ✅ Base44-style export
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { unit_id, date_from, date_to, tables, list_units } = body;

  if (list_units) {
    const units = await base44.asServiceRole.entities.Unit.list();
    return Response.json(units.map((u) => ({ id: u.id, name: u.name, account_id: u.account_id })));
  }

  if (!unit_id || !tables || !Array.isArray(tables) || tables.length === 0) {
    return Response.json({ error: "unit_id e tables[] são obrigatórios" }, { status: 400 });
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
      if (date_to) query.date.$lte = date_to;
    }

    try {
      const deleted = await deleteAllMatching(entity, query);
      results[table] = { deleted };
      console.log(`[purge] DONE table=${table} deleted=${deleted}`);
    } catch (e) {
      console.error(`[purge] ERROR table=${table}:`, e?.message || e);
      results[table] = { error: e?.message || String(e) };
    }
  }

  return Response.json({ success: true, unit_id, date_from, date_to, results });
});