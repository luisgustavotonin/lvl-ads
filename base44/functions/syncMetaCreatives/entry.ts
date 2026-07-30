import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const META_API_VERSION = 'v24.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const PAGE_LIMIT = 100;
const CHUNK_SIZE = 25;
const DELAY_BETWEEN_PAGES = 3000;
const DELAY_BETWEEN_CHUNKS = 1500;
const MAX_RETRIES = 6;
const MAX_BACKOFF_MS = 60000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Baixa a imagem e retorna como data URI (base64). Thumbnails do Meta são 64x64 (~1-3KB),
// então isso é leve e carrega no <img>/PDF sem precisar de auth nem proxy.
async function mirrorImage(base44, url, accessToken) {
  if (!url) return null;
  try {
    const isGraphUrl = url.includes('graph.facebook.com');
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
    if (accessToken && isGraphUrl) headers['Authorization'] = `Bearer ${accessToken}`;
    let resp = await fetch(url, { headers });
    if (!resp.ok && accessToken && isGraphUrl) {
      const urlWithToken = url.includes('?') ? `${url}&access_token=${accessToken}` : `${url}?access_token=${accessToken}`;
      resp = await fetch(urlWithToken, { headers });
    }
    if (!resp.ok) {
      console.warn(`[mirrorImage] HTTP ${resp.status} for ${url}`);
      return null;
    }
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.warn(`[mirrorImage] failed to mirror ${url}: ${e.message}`);
    return null;
  }
}

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
        // Rate limit or server error — wait and retry com backoff exponencial (com teto)
        const baseWait = data?.error?.code === 17 || res.status === 429 ? 30000 : 10000;
        const waitMs = Math.min(baseWait * Math.pow(2, attempt), MAX_BACKOFF_MS);
        console.warn(`[fetchAllPages] attempt ${attempt + 1} failed (${res.status}): ${data?.error?.message}. Retrying in ${(waitMs/1000).toFixed(1)}s...`);
        await sleep(waitMs);
        attempt++;
      } catch (e) {
        const waitMs = Math.min(10000 * Math.pow(2, attempt), MAX_BACKOFF_MS);
        console.warn(`[fetchAllPages] attempt ${attempt + 1} network error: ${e.message}. Retrying in ${(waitMs/1000).toFixed(1)}s...`);
        await sleep(waitMs);
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

async function fetchJson(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Mapa image_hash -> URL pública, construído a partir do edge adimages da conta.
async function buildAdImagesHashMap(actId, accessToken) {
  const map = {};
  let url = `${META_BASE}/act_${actId}/adimages?fields=hash,url&limit=200&access_token=${encodeURIComponent(accessToken)}`;
  let pages = 0;
  while (url && pages < 25) {
    const json = await fetchJson(url);
    const data = json?.data || [];
    for (const img of data) {
      if (img.hash && img.url) map[img.hash] = img.url;
    }
    url = json?.paging?.next || null;
    pages++;
    if (url) await sleep(500);
  }
  return map;
}

// Resolve a URL de imagem de um criativo (carrossel/link/photo) quando não há thumbnail_url direta.
async function resolveCreativeImageUrl(creativeId, actId, accessToken, hashMap) {
  const url = `${META_BASE}/${creativeId}?fields=object_type,object_story_spec,thumbnail_url,image_url&access_token=${encodeURIComponent(accessToken)}`;
  const c = await fetchJson(url);
  if (!c) return null;
  if (c.thumbnail_url || c.image_url) return c.thumbnail_url || c.image_url;
  const oss = c.object_story_spec || {};
  const children = oss.carousel_children || [];
  for (const child of children) {
    if (child.image_hash && hashMap[child.image_hash]) return hashMap[child.image_hash];
    if (child.image_url) return child.image_url;
  }
  const linkData = oss.link_data || {};
  if (linkData.image_hash && hashMap[linkData.image_hash]) return hashMap[linkData.image_hash];
  if (linkData.image_url) return linkData.image_url;
  const photoData = oss.photo_data || {};
  if (photoData.image_hash && hashMap[photoData.image_hash]) return hashMap[photoData.image_hash];
  if (photoData.url) return photoData.url;
  return null;
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

    // Sempre busca TODOS os anúncios (ativos, pausados, arquivados)
    // Não filtra por período — criativos são dados estáticos e precisam estar todos disponíveis
    console.log(`[syncMetaCreatives] fetching ALL ads for account=${actId}`);
    const effectiveStatuses = encodeURIComponent(JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"]));
    const url =
      `${META_BASE}/act_${actId}/ads?` +
      `fields=${encodeURIComponent(fields)}` +
      `&effective_status=${effectiveStatuses}` +
      `&limit=${PAGE_LIMIT}` +
      `&access_token=${encodeURIComponent(meta_token)}`;

    ads = await fetchAllPages(url);

    console.log(`[syncMetaCreatives] ads fetched=${ads.length}`);

    const nowIso = new Date().toISOString();

    // Busca todos os registros existentes para esta conta
    const adIds = [...new Set(ads.filter(a => a?.id || a?.ad_id).map(a => a.id || a.ad_id))];
    const existingCreatives = await base44.asServiceRole.entities.MetaAdsCreative.filter(
      { account_id: accountId }, null, 5000
    ).catch(() => []);

    // Mapas: ad_id -> registro existente
    const existingMap = {}; // ad_id -> { id, thumbnail_url }
    for (const ec of existingCreatives) {
      if (ec.ad_id) existingMap[ec.ad_id] = ec;
    }

    const isPermanent = (url) => url && (url.includes('supabase') || url.includes('base44') || url.startsWith('data:'));

    // Separa: já completos (pula), precisam de mirror, novos sem imagem
    const toMirrorExisting = []; // já no banco mas sem URL permanente (prioridade)
    const toMirrorNew = [];      // novos anuncios
    const toCreateNoImage = [];
    let skipped = 0;

    for (const a of ads) {
      const adId = a.id || a.ad_id;
      if (!adId || !a.creative?.id) continue;
      const existing = existingMap[adId];
      if (existing && isPermanent(existing.thumbnail_url)) {
        skipped++;
        continue; // já tem URL permanente, pula completamente
      }
      const rawUrl = a.creative?.thumbnail_url || a.creative?.image_url || null;
      if (rawUrl) {
        if (existing) toMirrorExisting.push(a); // já no banco, prioridade
        else toMirrorNew.push(a);
      } else {
        toCreateNoImage.push(a);
      }
    }

    // Existentes sem URL permanente vêm primeiro
    const toMirror = [...toMirrorExisting, ...toMirrorNew];

    console.log(`[syncMetaCreatives] total=${ads.length} skipped=${skipped} to_mirror=${toMirror.length} no_image=${toCreateNoImage.length}`);

    // Espelha apenas um lote por execução (sequencial com delay) para respeitar rate limits
    const MIRROR_CAP = 120;
    const toMirrorSlice = toMirror.slice(0, MIRROR_CAP);

    const mirroredMap = {};
    for (const a of toMirrorSlice) {
      const c = a.creative;
      const adId = a.id || a.ad_id;
      const rawUrl = c.thumbnail_url || c.image_url;
      const mirrored = await mirrorImage(base44, rawUrl, meta_token);
      if (mirrored) mirroredMap[adId] = mirrored;
      await sleep(150);
    }

    // Resolve thumbnails para anúncios sem URL direta (carrosséis, etc.):
    // busca o detalhe do criativo e extrai a imagem do primeiro card via hash -> adimages.
    if (toCreateNoImage.length > 0) {
      const RESOLVE_CAP = 40;
      const hashMap = await buildAdImagesHashMap(actId, meta_token).catch(() => ({}));
      let resolved = 0;
      for (const a of toCreateNoImage) {
        if (resolved >= RESOLVE_CAP) break;
        const c = a.creative;
        const adId = a.id || a.ad_id;
        if (!c?.id) continue;
        const resolvedUrl = await resolveCreativeImageUrl(c.id, actId, meta_token, hashMap);
        if (resolvedUrl) {
          const mirrored = await mirrorImage(base44, resolvedUrl, meta_token);
          if (mirrored) { mirroredMap[adId] = mirrored; resolved++; }
        }
        await sleep(300);
      }
      console.log(`[syncMetaCreatives] no_image=${toCreateNoImage.length} resolved+mirrored=${resolved}`);
    }

    // Monta rows para:
    //  - Todos os anúncios NOVOS (garantir 1 registro por ad, já com a URL pública do Meta)
    //  - Anúncios existentes que foram espelhados nesta execução (upgrade p/ URL permanente)
    // Anúncios existentes ainda não espelhados mantêm o registro atual e são atualizados em execuções futuras.
    const toProcess = [
      ...toMirror.filter(a => {
        const adId = a.id || a.ad_id;
        return !existingMap[adId] || mirroredMap[adId];
      }),
      ...toCreateNoImage,
    ];

    const rows = toProcess
      .filter(a => (a?.id || a?.ad_id) && a?.creative?.id)
      .map(a => {
        const c = a.creative;
        const adId = a.id || a.ad_id;
        const permanentUrl = mirroredMap[adId] || null;
        // thumbnail_url é a URL pública (CDN) do Meta, carrega no <img> sem access_token;
        // image_url pode exigir token, então priorizamos thumbnail para exibição no relatório.
        const fallbackUrl = c.thumbnail_url || c.image_url || null;
        return {
          unique_key: `${accountId}:${unitId}:${adId}:${c.id}`,
          creative_id: c.id,
          ad_id: adId,
          campaign_id: a.campaign_id || null,
          account_id: accountId,
          unit_id: unitId,
          effective_status: a.effective_status || null,
          status: a.status || null,
          image_url: permanentUrl || fallbackUrl,
          thumbnail_url: permanentUrl || fallbackUrl,
          video_id: c.video_id || null,
          object_type: c.object_type || null,
          last_updated: nowIso,
          raw: { ad: a, creative: c },
        };
      });

    const written = rows.length > 0 ? await upsertBatch(base44.asServiceRole.entities.MetaAdsCreative, rows) : 0;
    const remaining = toMirror.length - toMirrorSlice.length;

    console.log(`[syncMetaCreatives] skipped=${skipped} written=${written} remaining_for_next_run=${remaining}`);

    return Response.json({ success: true, job_key, skipped, rows_written: written, remaining_for_next_run: remaining });
  } catch (error) {
    console.error('syncMetaCreatives error:', error?.message || error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});