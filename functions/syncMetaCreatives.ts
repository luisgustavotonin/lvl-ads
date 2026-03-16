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
    const { job_key, unit_id, account_id, date_from, date_to } = await req.json();

    let accountId, unitId, dateFrom, dateTo;

    if (job_key) {
      const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1);
      if (!jobs.length) return Response.json({ error: 'job_key não encontrado' }, { status: 404 });
      const job = jobs[0];
      accountId = job.account_id;
      unitId = unit_id || job.unit_id || '';
      dateFrom = date_from || job.date_from;
      dateTo = date_to || job.date_to;
    } else if (account_id && unit_id) {
      accountId = account_id;
      unitId = unit_id;
      dateFrom = date_from;
      dateTo = date_to;
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

    let ads = [];

    if (dateFrom && dateTo) {
      // Estratégia: buscar via insights do período para pegar exatamente os ad_ids que rodaram
      // A API de insights com breakdown por ad retorna todos os anúncios que tiveram impressões no período
      console.log(`[syncMetaCreatives] fetching ad_ids from insights period=${dateFrom}→${dateTo}`);

      const insightsUrl =
        `${META_BASE}/act_${actId}/insights?` +
        `fields=${encodeURIComponent('ad_id')}` +
        `&level=ad` +
        `&time_range=${encodeURIComponent(JSON.stringify({ since: dateFrom, until: dateTo }))}` +
        `&limit=${PAGE_LIMIT}` +
        `&access_token=${encodeURIComponent(meta_token)}`;

      const insightPages = await fetchAllPages(insightsUrl);
      const adIds = [...new Set(insightPages.map(r => r.ad_id).filter(Boolean))];

      console.log(`[syncMetaCreatives] ad_ids from insights=${adIds.length}`);

      if (adIds.length === 0) {
        return Response.json({ success: true, job_key, rows_written: 0, message: 'Nenhum anúncio com dados no período' });
      }

      // Busca os detalhes dos anúncios em lotes de 50 (batch requests via ?ids=)
      const BATCH = 50;
      for (let i = 0; i < adIds.length; i += BATCH) {
        const batch = adIds.slice(i, i + BATCH);
        const batchUrl =
          `${META_BASE}?ids=${encodeURIComponent(batch.join(','))}` +
          `&fields=${encodeURIComponent(fields)}` +
          `&access_token=${encodeURIComponent(meta_token)}`;

        let res, data;
        let attempt = 0;
        while (attempt < MAX_RETRIES) {
          try {
            res = await fetch(batchUrl);
            data = await res.json();
            if (res.ok && !data.error) break;
            const waitMs = data?.error?.code === 17 || res.status === 429 ? 60000 : 5000;
            console.warn(`[syncMetaCreatives] batch attempt ${attempt + 1} failed: ${data?.error?.message}. Retrying in ${waitMs}ms...`);
            await sleep(waitMs);
            attempt++;
          } catch (e) {
            console.warn(`[syncMetaCreatives] batch network error: ${e.message}. Retrying...`);
            await sleep(5000);
            attempt++;
          }
        }

        if (!res?.ok || data?.error) {
          throw new Error(data?.error?.message || `Meta API HTTP ${res?.status}`);
        }

        // Response é um objeto { ad_id: adObject, ... }
        const batchAds = Object.values(data).filter(a => a?.id && a?.creative?.id);
        ads.push(...batchAds);

        if (i + BATCH < adIds.length) await sleep(DELAY_BETWEEN_PAGES);
      }
    } else {
      // Fallback sem período: busca todos os anúncios ativos/pausados/arquivados
      const effectiveStatuses = encodeURIComponent(JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"]));
      const url =
        `${META_BASE}/act_${actId}/ads?` +
        `fields=${encodeURIComponent(fields)}` +
        `&effective_status=${effectiveStatuses}` +
        `&limit=${PAGE_LIMIT}` +
        `&access_token=${encodeURIComponent(meta_token)}`;

      ads = await fetchAllPages(url);
    }

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