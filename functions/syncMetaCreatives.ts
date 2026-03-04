import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const META_API_VERSION = 'v24.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const PAGE_LIMIT = 200;
const CHUNK_SIZE = 50;
const DELAY_BETWEEN_PAGES = 500;
const DELAY_BETWEEN_CHUNKS = 500;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeActId(id) {
  if (!id) return '';
  return String(id).replace(/^act_/, '');
}

async function upsertBatch(entity, rows) {
  if (!rows.length) return 0;

  const map = new Map();
  for (const r of rows) {
    if (r?.unique_key) map.set(r.unique_key, r);
  }
  const deduped = Array.from(map.values());

  let written = 0;
  for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
    const chunk = deduped.slice(i, i + CHUNK_SIZE);
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

    if (i + CHUNK_SIZE < deduped.length) {
      await sleep(DELAY_BETWEEN_CHUNKS);
    }
  }
  return written;
}

async function fetchAllPages(url) {
  const results = [];
  let next = url;

  while (next) {
    let res, data;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        res = await fetch(next);
        data = await res.json();
        if (res.ok && !data.error) break;
        // Rate limit or server error — wait and retry
        const waitMs = data?.error?.code === 17 || res.status === 429 ? 60000 : 5000;
        console.warn(`[fetchAllPages] attempt ${attempt + 1} failed (${res.status}): ${data?.error?.message}. Retrying in ${waitMs}ms...`);
        await sleep(waitMs);
        attempt++;
      } catch (e) {
        console.warn(`[fetchAllPages] attempt ${attempt + 1} network error: ${e.message}. Retrying in 5000ms...`);
        await sleep(5000);
        attempt++;
      }
    }

    if (!res?.ok || data?.error) {
      throw new Error(data?.error?.message || `Meta API HTTP ${res?.status}`);
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
    const { job_key, unit_id, account_id } = await req.json();

    let accountId, unitId;

    if (job_key) {
      const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1);
      if (!jobs.length) return Response.json({ error: 'job_key não encontrado' }, { status: 404 });
      const job = jobs[0];
      accountId = job.account_id;
      unitId = unit_id || job.unit_id || '';
    } else if (account_id && unit_id) {
      accountId = account_id;
      unitId = unit_id;
    } else {
      return Response.json({ error: 'job_key ou (account_id + unit_id) obrigatório' }, { status: 400 });
    }

    // Busca token pelo unit_id na MetaToken
    const allTokens = await base44.asServiceRole.entities.MetaToken.list();
    const tokenRecord = allTokens.find(t => t.status === 'active' && Array.isArray(t.unit_ids) && t.unit_ids.includes(unitId));
    if (!tokenRecord) return Response.json({ error: `Nenhum token ativo encontrado para a unidade ${unitId}` }, { status: 404 });
    const meta_token = tokenRecord.token;

    const actId = normalizeActId(accountId);

    const fields = 'id,campaign_id,effective_status,status,creative{id,object_type,thumbnail_url,image_url,video_id}';

    const url =
      `${META_BASE}/act_${actId}/ads?` +
      `fields=${encodeURIComponent(fields)}` +
      `&effective_status=["ACTIVE"]` +
      `&limit=${PAGE_LIMIT}` +
      `&access_token=${encodeURIComponent(meta_token)}`;

    console.log(`[syncMetaCreatives] job_key=${job_key} act_${actId} unit=${unitId} fetching ads...`);

    const ads = await fetchAllPages(url);
    console.log(`[syncMetaCreatives] ads fetched=${ads.length}`);

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
          effective_status: a.effective_status || null,
          status: a.status || null,
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