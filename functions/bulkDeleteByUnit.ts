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

  console.log(`[bulkDelete] table=${table} unit=${unit_id}`);

  // Single deleteMany call — frontend will call us repeatedly until deleted=0
  const result = await entity.deleteMany(query);
  const deleted = result?.deleted || 0;

  console.log(`[bulkDelete] deleted=${deleted}`);

  // If we deleted something, tell the frontend to call again (there may be more)
  return Response.json({ success: true, table, deleted, hasMore: deleted > 0 });
});