import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Exclusão em massa por unidade e filtro de data.
 * Recebe: { unit_id, date_from, date_to, tables: string[] }
 * tables pode conter: 'insights', 'platform', 'device', 'demographic', 'creatives_basic'
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TABLE_MAP = {
  insights: 'MetaAdInsights',
  platform: 'MetaAdByPlatform',
  device: 'MetaAdByDevice',
  demographic: 'MetaAdByDemographic',
  creatives_basic: 'MetaAdsDim',
};

const HAS_DATE = {
  insights: true,
  platform: true,
  device: true,
  demographic: true,
  creatives_basic: false,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { unit_id, date_from, date_to, tables } = await req.json();

    if (!unit_id) {
      return Response.json({ error: 'unit_id obrigatório' }, { status: 400 });
    }

    const tablesToDelete = Array.isArray(tables) && tables.length > 0
      ? tables
      : Object.keys(TABLE_MAP);

    console.log(`🗑️ Excluindo tabelas [${tablesToDelete.join(', ')}] da unidade ${unit_id}`);

    const result = {};

    for (const tableId of tablesToDelete) {
      const entityName = TABLE_MAP[tableId];
      if (!entityName) continue;

      const filters = { unit_id };
      if (HAS_DATE[tableId]) {
        if (date_from) filters.date = { $gte: date_from };
        if (date_to) filters.date = { ...(filters.date || {}), $lte: date_to };
      }

      console.log(`📊 Buscando registros de ${entityName}...`);
      const records = await base44.asServiceRole.entities[entityName].filter(filters, null, 50000);
      console.log(`📊 ${records.length} registros encontrados em ${entityName}`);

      if (records.length === 0) {
        result[tableId] = 0;
        continue;
      }

      // Deletar em lotes de 20 com pausa para evitar rate limit
      const BATCH = 20;
      let deleted = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(r => base44.asServiceRole.entities[entityName].delete(r.id))
        );
        deleted += results.filter(r => r.status === 'fulfilled').length;
        if (i + BATCH < records.length) await sleep(200);
      }

      result[tableId] = deleted;
      console.log(`✅ ${deleted} registros excluídos de ${entityName}`);
    }

    const total = Object.values(result).reduce((s, n) => s + n, 0);
    console.log(`✅ Total excluído: ${total}`);

    return Response.json({ success: true, deleted: result, total });

  } catch (error) {
    console.error('❌ Erro na exclusão:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});