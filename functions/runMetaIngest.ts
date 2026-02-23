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
  return m && Object.prototype.hasOwnProperty.call(m, key) ? parseNum(m[key]) : 0;
}

function sumActionsContaining(actionsMap, keyword) {
  return Object.entries(actionsMap || {})
    .filter(([k]) => k.includes(keyword))
    .reduce((sum, [, v]) => sum + Number(v || 0), 0);
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
    reach: parseNum(item.reach),
    frequency: parseNum(item.frequency),
    clicks: parseNum(item.clicks),
    link_clicks,
    ctr_link,
    cpc_link,
    cpm: parseNum(item.cpm),

    messaging_conversations_started: sumActionsContaining(actionsMap, 'messaging_conversation_started'),
    messaging_conversations_replied: sumActionsContaining(actionsMap, 'messaging_first_reply'),

    leads: sumActionsContaining(actionsMap, 'lead'),
    purchases: sumActionsContaining(actionsMap, 'purchase'),
    purchase_value: sumActionsContaining(actionValuesMap, 'purchase'),
  };
}

function getDate(item) {
  return item.date_start || item.date_stop || '';
}

function baseRow(item, accountId, unitId, jobKey) {
  const date = getDate(item);
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
    raw: item,
  };
}

function platformRow(item, accountId, unitId, jobKey) {
  const date = getDate(item);
  const adId = item.ad_id || '';
  const pp = item.publisher_platform || '';
  const pos = item.platform_position || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${date}:${pp}:${pos}`;
  const m = metricsFromItem(item);

  return {
    unique_key,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date,

    campaign_id: item.campaign_id || null,
    adset_id: item.adset_id || null,
    ad_id: adId,

    publisher_platform: pp,
    platform_position: pos,

    spend: m.spend,
    impressions: m.impressions,
    reach: m.reach,
    frequency: m.frequency,
    clicks: m.clicks,
    link_clicks: m.link_clicks,
    ctr_link: m.ctr_link,
    cpc_link: m.cpc_link,
    cpm: m.cpm,

    raw: item,
  };
}

function deviceRow(item, accountId, unitId, jobKey) {
  const date = getDate(item);
  const adId = item.ad_id || '';
  const dev = item.impression_device || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${date}:${dev}`;
  const m = metricsFromItem(item);

  return {
    unique_key,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date,

    campaign_id: item.campaign_id || null,
    adset_id: item.adset_id || null,
    ad_id: adId,

    impression_device: dev,

    spend: m.spend,
    impressions: m.impressions,
    reach: m.reach,
    frequency: m.frequency,
    clicks: m.clicks,
    link_clicks: m.link_clicks,
    ctr_link: m.ctr_link,
    cpc_link: m.cpc_link,
    cpm: m.cpm,

    raw: item,
  };
}

function demographicRow(item, accountId, unitId, jobKey) {
  const date = getDate(item);
  const adId = item.ad_id || '';
  const age = item.age || '';
  const gender = item.gender || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${date}:${age}:${gender}`;
  const m = metricsFromItem(item);

  return {
    unique_key,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date,

    campaign_id: item.campaign_id || null,
    adset_id: item.adset_id || null,
    ad_id: adId,

    age,
    gender,

    spend: m.spend,
    impressions: m.impressions,
    reach: m.reach,
    frequency: m.frequency,
    clicks: m.clicks,
    link_clicks: m.link_clicks,
    ctr_link: m.ctr_link,
    cpc_link: m.cpc_link,
    cpm: m.cpm,

    raw: item,
  };
}

// force=true: deleta registros existentes e recria tudo
// force=false: apenas insere registros novos (skip se já existe)
async function upsertBatch(entity, rows, force) {
  if (!rows.length) return 0;

  // Deduplicate by unique_key
  const map = new Map();
  for (const r of rows) {
    if (r?.unique_key) map.set(r.unique_key, r);
  }
  const deduped = Array.from(map.values());

  let written = 0;

  for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
    const chunk = deduped.slice(i, i + CHUNK_SIZE);
    const keys = chunk.map(r => r.unique_key);

    if (force) {
      // Delete existing records for these keys, then recreate
      const existingList = await entity.filter({ unique_key: { '$in': keys } }, null, CHUNK_SIZE);
      if (existingList.length > 0) {
        await Promise.all(existingList.map(r => entity.delete(r.id)));
      }
      await entity.bulkCreate(chunk);
      written += chunk.length;
    } else {
      // Only insert rows that don't already exist
      const existingList = await entity.filter({ unique_key: { '$in': keys } }, null, CHUNK_SIZE);
      const existingKeys = new Set(existingList.map(r => r.unique_key));
      const toCreate = chunk.filter(row => !existingKeys.has(row.unique_key));
      if (toCreate.length > 0) {
        await entity.bulkCreate(toCreate);
        written += toCreate.length;
      }
    }
  }

  return written;
}

async function fetchAllPagesInsights(actId, metaToken, params) {
  const results = [];
  let cursor = null;

  while (true) {
    const p = new URLSearchParams({
      ...params,
      access_token: metaToken,
      limit: String(PAGE_LIMIT),
    });
    if (cursor) p.set('after', cursor);

    const url = `${META_BASE}/act_${actId}/insights?${p.toString()}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `Meta API HTTP ${res.status}`);
    }

    results.push(...(data.data || []));

    if (data.paging?.cursors?.after && data.paging?.next) {
      cursor = data.paging.cursors.after;
      await sleep(DELAY_BETWEEN_PAGES);
      continue;
    }
    break;
  }

  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { job_key, meta_token, unit_id, mode, force } = await req.json();

    if (!job_key || !meta_token) {
      return Response.json({ error: 'job_key e meta_token obrigatórios' }, { status: 400 });
    }

    // mode: 'base' | 'platform' | 'device' | 'demographic' | undefined (all)
    const validModes = ['base', 'platform', 'device', 'demographic'];
    const effectiveMode = validModes.includes(mode) ? mode : null; // null = run all

    const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1);
    if (!jobs.length) return Response.json({ error: 'job_key não encontrado' }, { status: 404 });
    const job = jobs[0];

    if (job.status === 'running') return Response.json({ status: 'already_running', job_key });

    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
      status: 'running',
      progress: 0,
      rows_written: 0,
      error_message: null,
    });

    const { account_id, date_from, date_to } = job;
    const actId = normalizeActId(account_id);
    const effectiveUnitId = unit_id || job.unit_id || '';

    const baseParams = {
      time_range: JSON.stringify({ since: date_from, until: date_to }),
      fields:
        'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,' +
        'spend,impressions,reach,frequency,clicks,cpm,' +
        'actions,action_values,date_start,date_stop',
      level: 'ad',
      time_increment: '1',
    };

    let totalRows = 0;

    // Run only the requested mode (or all if mode not specified)
    if (!effectiveMode || effectiveMode === 'base') {
      const baseItems = await fetchAllPagesInsights(actId, meta_token, baseParams);
      const baseRows = baseItems.map((i) => baseRow(i, account_id, effectiveUnitId, job_key));
      totalRows += await upsertBatch(base44.asServiceRole.entities.MetaInsightBase, baseRows);
      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 1, rows_written: totalRows }).catch(() => {});
      if (effectiveMode === 'base') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { status: 'done', progress: 1, rows_written: totalRows });
        return Response.json({ success: true, job_key, mode: 'base', rows_written: totalRows });
      }
    }

    if (!effectiveMode || effectiveMode === 'platform') {
      const ppItems = await fetchAllPagesInsights(actId, meta_token, {
        ...baseParams,
        breakdowns: 'publisher_platform,platform_position',
      });
      const ppRows = ppItems.map((i) => platformRow(i, account_id, effectiveUnitId, job_key));
      totalRows += await upsertBatch(base44.asServiceRole.entities.MetaInsightByPlatformPosition, ppRows);
      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 2, rows_written: totalRows }).catch(() => {});
      if (effectiveMode === 'platform') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { status: 'done', progress: 2, rows_written: totalRows });
        return Response.json({ success: true, job_key, mode: 'platform', rows_written: totalRows });
      }
    }

    if (!effectiveMode || effectiveMode === 'device') {
      const devItems = await fetchAllPagesInsights(actId, meta_token, { ...baseParams, breakdowns: 'impression_device' });
      const devRows = devItems.map((i) => deviceRow(i, account_id, effectiveUnitId, job_key));
      totalRows += await upsertBatch(base44.asServiceRole.entities.MetaInsightByDevice, devRows);
      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 3, rows_written: totalRows }).catch(() => {});
      if (effectiveMode === 'device') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { status: 'done', progress: 3, rows_written: totalRows });
        return Response.json({ success: true, job_key, mode: 'device', rows_written: totalRows });
      }
    }

    if (!effectiveMode || effectiveMode === 'demographic') {
      const demoItems = await fetchAllPagesInsights(actId, meta_token, { ...baseParams, breakdowns: 'age,gender' });
      const demoRows = demoItems.map((i) => demographicRow(i, account_id, effectiveUnitId, job_key));
      totalRows += await upsertBatch(base44.asServiceRole.entities.MetaInsightByDemographic, demoRows);
      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 4, rows_written: totalRows }).catch(() => {});
      if (effectiveMode === 'demographic') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { status: 'done', progress: 4, rows_written: totalRows });
        return Response.json({ success: true, job_key, mode: 'demographic', rows_written: totalRows });
      }
    }

    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
      status: 'done',
      progress: 4,
      rows_written: totalRows,
    });

    return Response.json({ success: true, job_key, rows_written: totalRows });
  } catch (error) {
    console.error('runMetaIngest error:', error?.message || error);

    try {
      const base44b = createClientFromRequest(req);
      const body = await req.clone().json().catch(() => ({}));
      if (body.job_key) {
        const jobs = await base44b.asServiceRole.entities.MetaIngestRun.filter({ job_key: body.job_key }, null, 1);
        if (jobs.length) {
          await base44b.asServiceRole.entities.MetaIngestRun.update(jobs[0].id, {
            status: 'failed',
            error_message: String(error?.message || error),
          });
        }
      }
    } catch {
      // ignore
    }

    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});