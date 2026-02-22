import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const META_API_VERSION = 'v24.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const PAGE_LIMIT = 500;
const CHUNK_SIZE = 200;
const DELAY_BETWEEN_PAGES = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeActId(id) {
  if (!id) return '';
  return String(id).replace(/^act_/, '');
}

async function upsertBatch(entity, rows) {
  if (!rows.length) return 0;

  // dedupe por unique_key
  const map = new Map();
  for (const r of rows) {
    if (r?.unique_key) map.set(r.unique_key, r);
  }
  const deduped = Array.from(map.values());

  let written = 0;
  for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
    const chunk = deduped.slice(i, i + CHUNK_SIZE);
    // Busca registros existentes por unique_key para decidir create vs update
    const keys = chunk.map(r => r.unique_key);
    const existing = await entity.filter({ unique_key: { $in: keys } }, null, CHUNK_SIZE);
    const existingMap = new Map(existing.map(e => [e.unique_key, e.id]));

    const toCreate = chunk.filter(r => !existingMap.has(r.unique_key));
    const toUpdate = chunk.filter(r => existingMap.has(r.unique_key));

    if (toCreate.length) await entity.bulkCreate(toCreate);
    for (const r of toUpdate) {
      await entity.update(existingMap.get(r.unique_key), r);
    }
    written += chunk.length;
  }
  return written;
}

async function fetchAllPages(url) {
  const results = [];
  let next = url;

  while (next) {
    const res = await fetch(next);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `Meta API HTTP ${res.status}`);
    }

    results.push(...(data.data || []));
    next = data.paging?.next || null;

    if (next) await sleep(DELAY_BETWEEN_PAGES);
  }

  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { job_key, meta_token, unit_id, account_id } = await req.json();

    if (!meta_token) {
      return Response.json({ error: 'meta_token obrigatório' }, { status: 400 });
    }

    let accountId, unitId;

    if (job_key) {
      // chamado via job_key (fluxo antigo)
      const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1);
      if (!jobs.length) return Response.json({ error: 'job_key não encontrado' }, { status: 404 });
      const job = jobs[0];
      accountId = job.account_id;
      unitId = unit_id || job.unit_id || '';
    } else if (account_id) {
      // chamado direto com account_id + unit_id (botão Sincronizar Criativos)
      accountId = account_id;
      unitId = unit_id || '';
    } else {
      return Response.json({ error: 'job_key ou account_id obrigatório' }, { status: 400 });
    }

    const actId = normalizeActId(accountId);

    // fields otimizados: status do anúncio + apenas campos essenciais do creative
    const fields = 'id,campaign_id,effective_status,status,creative{id,object_type,thumbnail_url,image_url,video_id}';

    const url =
      `${META_BASE}/act_${actId}/ads?` +
      `fields=${encodeURIComponent(fields)}` +
      `&limit=${PAGE_LIMIT}` +
      `&access_token=${encodeURIComponent(meta_token)}`;

    console.log(`[syncMetaCreatives] job_key=${job_key} act_${actId} unit=${unitId} fetching ads...`);

    const ads = await fetchAllPages(url);
    console.log(`[syncMetaCreatives] ads fetched=${ads.length}`);

    // Monta rows da tabela MetaAdsCreative
    // unique_key = account_id:unit_id:ad_id:creative_id
    const nowIso = new Date().toISOString();

    const rows = ads
      .filter((a) => (a?.id || a?.ad_id) && a?.creative?.id)
      .map((a) => {
        const c = a.creative;
        const adId = a.id || a.ad_id;

        return {
          unique_key: `${accountId}:${unitId}:${adId}:${c.id}`,

          creative_id: c.id,
          ad_id: adId,
          campaign_id: a.campaign_id || null,

          account_id: accountId,
          unit_id: unitId,

          // status do anúncio
          effective_status: a.effective_status || null,
          status: a.status || null,

          // campos do creative (essenciais)
          image_url: c.image_url || null,
          thumbnail_url: c.thumbnail_url || null,
          video_id: c.video_id || null,
          object_type: c.object_type || null,

          last_updated: nowIso,
          raw: { ad: a, creative: c },
        };
      });

    const written = await upsertBatch(base44.asServiceRole.entities.MetaAdsCreative, rows);

    console.log(`[syncMetaCreatives] rows to upsert=${rows.length} written=${written}`);

    return Response.json({ success: true, job_key, rows_written: written });
  } catch (error) {
    console.error('syncMetaCreatives error:', error?.message || error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});