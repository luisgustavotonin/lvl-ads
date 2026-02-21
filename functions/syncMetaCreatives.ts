import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const META_API_VERSION = 'v24.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const PAGE_LIMIT = 200;
const CONCURRENCY = 6;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function normalizeActId(id) {
  return String(id || '').replace(/^act_/, '');
}

async function fetchAllAds(actId, metaToken) {
  const fields = [
    'id', 'name', 'campaign_id', 'adset_id',
    'creative{id,name,object_type,body,title,call_to_action_type,image_url,thumbnail_url,video_id}'
  ].join(',');

  const all = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const p = new URLSearchParams({
      access_token: metaToken,
      fields,
      limit: String(PAGE_LIMIT),
    });
    if (cursor) p.set('after', cursor);

    const res  = await fetch(`${META_BASE}/act_${actId}/ads?${p.toString()}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `Meta API HTTP ${res.status}`);
    }

    all.push(...(data.data || []));

    if (data.paging?.cursors?.after && data.paging?.next) {
      cursor = data.paging.cursors.after;
    } else {
      hasMore = false;
    }

    if (hasMore) await sleep(150);
  }

  return all;
}

function mapCreativeRow(ad, accountId, unitId) {
  const c = ad.creative || {};
  const adId      = ad.id || '';
  const creativeId = c.id || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${creativeId}`;
  return {
    unique_key,
    creative_id:        creativeId,
    ad_id:              adId,
    campaign_id:        ad.campaign_id || null,
    account_id:         accountId,
    unit_id:            unitId,
    name:               c.name || ad.name || null,
    image_url:          c.image_url || null,
    thumbnail_url:      c.thumbnail_url || null,
    video_id:           c.video_id || null,
    body:               c.body || null,
    title:              c.title || null,
    call_to_action_type: c.call_to_action_type || null,
    object_type:        c.object_type || null,
    last_updated:       new Date().toISOString(),
    raw:                { ad, creative: c },
  };
}

async function upsertRows(entity, rows) {
  let written = 0;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (row) => {
        try {
          await entity.create(row);
          return true;
        } catch (e) {
          const msg = (e?.message || '').toLowerCase();
          if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already')) {
            try {
              const existing = await entity.filter({ unique_key: row.unique_key }, null, 1);
              if (existing.length) { await entity.update(existing[0].id, row); return true; }
            } catch { /* ignore */ }
            return false;
          }
          throw e;
        }
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) written++;
      if (r.status === 'rejected') console.error('upsert creative failed:', r.reason?.message);
    }
  }
  return written;
}

// ─── handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { account_id, unit_id, meta_token } = await req.json();

    if (!account_id || !unit_id || !meta_token) {
      return Response.json({ error: 'account_id, unit_id e meta_token são obrigatórios' }, { status: 400 });
    }

    const actId = normalizeActId(account_id);

    console.log(`[syncMetaCreatives] account=${actId} unit=${unit_id}`);
    const ads  = await fetchAllAds(actId, meta_token);
    console.log(`[syncMetaCreatives] ${ads.length} ads encontrados`);

    const rows = ads
      .filter(ad => ad.creative?.id)
      .map(ad => mapCreativeRow(ad, account_id, unit_id));

    const written = await upsertRows(base44.asServiceRole.entities.MetaAdsCreative, rows);

    return Response.json({ success: true, ads_found: ads.length, creatives_written: written });

  } catch (error) {
    console.error('syncMetaCreatives error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});