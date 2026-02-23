import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const META_API_VERSION = 'v24.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Meta paging
const PAGE_LIMIT = 500;
const DELAY_BETWEEN_PAGES = 150;

// Save tuning
const CONCURRENCY = 6; // se der rate limit no Base44, baixa pra 4
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
  const cpc_link = link_clicks > 0 ? spend / link_clicks : 0;

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

    // Mensageria / leads / compras (se existir no actions)
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
  return {
    unique_key: `${accountId}:${unitId}:${adId}:${date}`,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date,
    campaign_id: item.campaign_id || null,
    campaign_name: item.campaign_name || null,
    adset_id: item.adset_id || null,
    adset_name: item.adset_name || null,
    ad_id: adId || null,
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
  const m = metricsFromItem(item);
  return {
    unique_key: `${accountId}:${unitId}:${adId}:${date}:${pp}:${pos}`,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date,
    campaign_id: item.campaign_id || null,
    adset_id: item.adset_id || null,
    ad_id: adId || null,
    publisher_platform: pp || null,
    platform_position: pos || null,
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
  const m = metricsFromItem(item);
  return {
    unique_key: `${accountId}:${unitId}:${adId}:${date}:${dev}`,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date,
    campaign_id: item.campaign_id || null,
    adset_id: item.adset_id || null,
    ad_id: adId || null,
    impression_device: dev || null,
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
  const m = metricsFromItem(item);
  return {
    unique_key: `${accountId}:${unitId}:${adId}:${date}:${age}:${gender}`,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date,
    campaign_id: item.campaign_id || null,
    adset_id: item.adset_id || null,
    ad_id: adId || null,
    age: age || null,
    gender: gender || null,
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

/**
 * SALVAMENTO ROBUSTO (sem $in, sem bulkCreate, sem update):
 * - create em paralelo controlado
 * - se der erro de duplicado/unique_key → ignora (idempotente)
 */
async function saveBatchCreateOnly(entity, rows) {
  if (!rows?.length) return 0;

  // Dedup por unique_key dentro do batch
  const map = new Map();
  for (const r of rows) {
    if (r?.unique_key) map.set(r.unique_key, r);
  }
  const deduped = Array.from(map.values());

  let written = 0;

  for (let i = 0; i < deduped.length; i += CONCURRENCY) {
    const chunk = deduped.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      chunk.map(async (row) => {
        try {
          await entity.create(row);
          return true;
        } catch (e) {
          const msg = String(e?.message || '').toLowerCase();
          // idempotência: se já existe, ignora
          if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already')) return false;
          throw e;
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value === true) written++;
      if (r.status === 'rejected') console.error('⚠️ create falhou:', r.reason?.message || r.reason);
    }
  }

  return written;
}

async function fetchJsonWithTimeout(url, ms = 60000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } finally {
    clearTimeout(t);
  }
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

    const { res, data } = await fetchJsonWithTimeout(url, 60000);

    if (!res.ok || data?.error) {
      const msg = data?.error?.message || `Meta API HTTP ${res.status}`;
      const code = data?.error?.code;
      const sub = data?.error?.error_subcode;
      throw new Error(`${msg}${code ? ` | code=${code}` : ''}${sub ? ` | sub=${sub}` : ''}`);
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

async function markJobFailed(base44, jobKey, errorMsg) {
  try {
    const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key: jobKey }, null, 1);
    if (jobs.length) {
      await base44.asServiceRole.entities.MetaIngestRun.update(jobs[0].id, {
        status: 'failed',
        error_message: String(errorMsg).substring(0, 500),
      });
    }
  } catch (e) {
    console.error('markJobFailed error:', e?.message);
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let bodyData = {};
  try {
    bodyData = await req.json();
  } catch {
    bodyData = {};
  }

  const { job_key, meta_token, unit_id, mode } = bodyData;

  if (!job_key || !meta_token) {
    return Response.json({ error: 'job_key e meta_token obrigatórios' }, { status: 400 });
  }

  try {
    const validModes = ['base', 'platform', 'device', 'demographic'];
    const effectiveMode = validModes.includes(mode) ? mode : null;

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

    // ✅ fields fixos (breakdown NUNCA entra aqui)
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

    // BASE
    if (!effectiveMode || effectiveMode === 'base') {
      const items = await fetchAllPagesInsights(actId, meta_token, baseParams);
      const rows = items.map((i) => baseRow(i, account_id, effectiveUnitId, job_key));
      totalRows += await saveBatchCreateOnly(base44.asServiceRole.entities.MetaInsightBase, rows);
      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 1, rows_written: totalRows }).catch(() => {});
      if (effectiveMode === 'base') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { status: 'done', rows_written: totalRows });
        return Response.json({ success: true, job_key, mode: 'base', rows_written: totalRows });
      }
    }

    // PLATFORM+POSITION
    if (!effectiveMode || effectiveMode === 'platform') {
      const items = await fetchAllPagesInsights(actId, meta_token, {
        ...baseParams,
        breakdowns: 'publisher_platform,platform_position',
      });
      const rows = items.map((i) => platformRow(i, account_id, effectiveUnitId, job_key));
      totalRows += await saveBatchCreateOnly(base44.asServiceRole.entities.MetaInsightByPlatformPosition, rows);
      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 2, rows_written: totalRows }).catch(() => {});
      if (effectiveMode === 'platform') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { status: 'done', rows_written: totalRows });
        return Response.json({ success: true, job_key, mode: 'platform', rows_written: totalRows });
      }
    }

    // DEVICE
    if (!effectiveMode || effectiveMode === 'device') {
      const items = await fetchAllPagesInsights(actId, meta_token, {
        ...baseParams,
        breakdowns: 'impression_device',
      });
      const rows = items.map((i) => deviceRow(i, account_id, effectiveUnitId, job_key));
      totalRows += await saveBatchCreateOnly(base44.asServiceRole.entities.MetaInsightByDevice, rows);
      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 3, rows_written: totalRows }).catch(() => {});
      if (effectiveMode === 'device') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { status: 'done', rows_written: totalRows });
        return Response.json({ success: true, job_key, mode: 'device', rows_written: totalRows });
      }
    }

    // DEMOGRAPHIC (age+gender)
    if (!effectiveMode || effectiveMode === 'demographic') {
      const items = await fetchAllPagesInsights(actId, meta_token, {
        ...baseParams,
        breakdowns: 'age,gender',
      });
      const rows = items.map((i) => demographicRow(i, account_id, effectiveUnitId, job_key));
      totalRows += await saveBatchCreateOnly(base44.asServiceRole.entities.MetaInsightByDemographic, rows);
      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 4, rows_written: totalRows }).catch(() => {});
      if (effectiveMode === 'demographic') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { status: 'done', rows_written: totalRows });
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
    await markJobFailed(base44, job_key, error?.message || String(error));
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});