import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const META_API_VERSION = 'v24.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const PAGE_LIMIT = 500;
const BATCH_SIZE = 200;
const DELAY_BETWEEN_PAGES = 120;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function normalizeActId(id) {
  if (!id) return '';
  return String(id).replace(/^act_/, '');
}

function parseNum(v) {
  return v != null ? (parseFloat(v) || 0) : 0;
}

function actionsToMap(arr) {
  const m = {};
  if (!Array.isArray(arr)) return m;
  for (const a of arr) {
    if (a?.action_type) m[a.action_type] = parseNum(a.value);
  }
  return m;
}

function fromMap(m, key) {
  return m && m[key] ? parseNum(m[key]) : 0;
}

function sumActionsContaining(actionsMap, keyword) {
  return Object.entries(actionsMap || {})
    .filter(([key]) => key.includes(keyword))
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);
}

function metricsFromItem(item) {
  const actionsMap = actionsToMap(item.actions || []);
  const actionValuesMap = actionsToMap(item.action_values || []);

  const spend = parseNum(item.spend);
  const impressions = parseNum(item.impressions);
  const link_clicks = fromMap(actionsMap, 'link_click');
  const ctr_link = impressions > 0 ? (link_clicks / impressions) * 100 : 0;
  const cpc_link = link_clicks > 0 ? (spend / link_clicks) : 0;

  return {
    spend,
    impressions,
    link_clicks,
    ctr_link,
    cpc_link,
    reach: parseNum(item.reach),
    frequency: parseNum(item.frequency),
    clicks: parseNum(item.clicks),
    cpm: parseNum(item.cpm),

    messaging_conversations_started: sumActionsContaining(actionsMap, 'messaging_conversation_started'),
    messaging_conversations_replied: sumActionsContaining(actionsMap, 'messaging_first_reply'),
    leads: sumActionsContaining(actionsMap, 'lead'),
    purchases: sumActionsContaining(actionsMap, 'purchase'),
    purchase_value: sumActionsContaining(actionValuesMap, 'purchase')
  };
}

function baseRow(item, accountId, unitId, jobKey) {
  const date = item.date_start || '';
  const adId = item.ad_id || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${date}`;

  return {
    unique_key,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date,
    campaign_id: item.campaign_id || null,
    campaign_name: item.campaign_name || null,
    adset_id: item.adset_id || null,
    adset_name: item.adset_name || null,
    ad_id: adId,
    ad_name: item.ad_name || null,
    ...metricsFromItem(item),
    raw: item
  };
}

async function upsertBatch(entity, rows) {
  if (!rows.length) return 0;

  const map = new Map();
  for (const row of rows) {
    if (row.unique_key) map.set(row.unique_key, row);
  }

  const deduped = Array.from(map.values());
  let written = 0;

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const chunk = deduped.slice(i, i + BATCH_SIZE);
    await entity.upsert(chunk);
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
      throw new Error(data.error?.message || `Meta API error`);
    }

    results.push(...(data.data || []));
    next = data.paging?.next || null;

    if (next) await sleep(DELAY_BETWEEN_PAGES);
  }

  return results;
}

async function syncMetaCreatives(base44, actId, token, accountId, unitId) {
  const url =
    `${META_BASE}/act_${actId}/ads?` +
    `fields=ad_id,campaign_id,name,creative{id,name,body,title,object_type,call_to_action_type,thumbnail_url,image_url,video_id}` +
    `&limit=${PAGE_LIMIT}&access_token=${token}`;

  const ads = await fetchAllPages(url);

  const rows = ads
    .filter(a => a.creative?.id)
    .map(a => {
      const c = a.creative;
      return {
        unique_key: `${accountId}:${unitId}:${a.ad_id}:${c.id}`,
        creative_id: c.id,
        ad_id: a.ad_id,
        campaign_id: a.campaign_id || null,
        account_id: accountId,
        unit_id: unitId,
        name: c.name || null,
        image_url: c.image_url || null,
        thumbnail_url: c.thumbnail_url || null,
        video_id: c.video_id || null,
        body: c.body || null,
        title: c.title || null,
        call_to_action_type: c.call_to_action_type || null,
        object_type: c.object_type || null,
        last_updated: new Date().toISOString(),
        raw: c
      };
    });

  return upsertBatch(base44.asServiceRole.entities.MetaAdsCreative, rows);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { job_key, meta_token, unit_id, sync_creatives } = await req.json();

    const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1);
    if (!jobs.length) return Response.json({ error: 'job not found' }, { status: 404 });

    const job = jobs[0];
    const actId = normalizeActId(job.account_id);
    const accountId = job.account_id;
    const unitId = unit_id || job.unit_id || '';

    const baseUrl =
      `${META_BASE}/act_${actId}/insights?` +
      `fields=campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,frequency,clicks,cpm,actions,action_values,date_start` +
      `&level=ad&time_increment=1` +
      `&time_range=${encodeURIComponent(JSON.stringify({ since: job.date_from, until: job.date_to }))}` +
      `&limit=${PAGE_LIMIT}&access_token=${meta_token}`;

    const items = await fetchAllPages(baseUrl);
    console.log("INSIGHTS COUNT:", items.length);

    const rows = items.map(i => baseRow(i, accountId, unitId, job_key));
    const written = await upsertBatch(base.base44.asServiceRole.entities.MetaInsightBase, rows);

    if (sync_creatives) {
      await syncMetaCreatives(base44, actId, meta_token, accountId, unitId);
    }

    return Response.json({ success: true, rows_written: written });

  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});