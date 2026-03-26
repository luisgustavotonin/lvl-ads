import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const META_API_VERSION = 'v24.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// -----------------------
// Tuning
// -----------------------
const PAGE_LIMIT = 250;
const DELAY_BETWEEN_PAGES = 2000;
const DELAY_BETWEEN_MODES = 6000;

const CHUNK_SIZE = 200;
const BULK_CHUNK_BASE = 200;
const BULK_CHUNK_BREAKDOWN = 100;
const DELETE_BATCH = 200;
const DELETE_CONCURRENCY = 10;

const META_TIMEOUT_MS = 120000;
const META_MAX_RETRIES = 6;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const jitter = (ms) => ms + Math.floor(Math.random() * 250);

// -----------------------
// Basic helpers
// -----------------------
function normalizeActId(id) {
  if (!id) return '';
  return String(id).replace(/^act_/, '');
}

function parseNum(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function actionsToMap(arr) {
  const out = {};
  if (!Array.isArray(arr)) return out;

  for (const item of arr) {
    if (item && item.action_type) {
      out[item.action_type] = parseNum(item.value);
    }
  }
  return out;
}

function fromMap(map, key) {
  if (!map) return 0;
  if (Object.prototype.hasOwnProperty.call(map, key)) {
    return parseNum(map[key]);
  }
  return 0;
}

function sumActionsContaining(actionsMap, keyword) {
  if (!actionsMap) return 0;
  let total = 0;
  for (const key of Object.keys(actionsMap)) {
    if (key.indexOf(keyword) !== -1) {
      total += parseNum(actionsMap[key]);
    }
  }
  return total;
}

function getDate(item) {
  return item.date_start || item.date_stop || '';
}

// -----------------------
// Date helpers
// -----------------------
function parseDateOnly(str) {
  const parts = String(str || '').split('-');
  if (parts.length !== 3) throw new Error(`Data inválida: ${str}`);
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function splitDateRange(dateFrom, dateTo, chunkDays) {
  const out = [];
  let start = parseDateOnly(dateFrom);
  const end = parseDateOnly(dateTo);

  while (start <= end) {
    const chunkEnd = addDays(start, chunkDays - 1);
    const finalEnd = chunkEnd <= end ? chunkEnd : end;

    out.push({
      since: formatDateOnly(start),
      until: formatDateOnly(finalEnd),
    });

    start = addDays(finalEnd, 1);
  }

  return out;
}

// -----------------------
// Metrics
// -----------------------
function metricsFromItem(item) {
  const actionsMap = actionsToMap(item.actions || []);
  const actionValuesMap = actionsToMap(item.action_values || []);

  const spend = parseNum(item.spend);
  const impressions = parseNum(item.impressions);

  const inlineLinkClicks = parseNum(item.inline_link_clicks);
  const linkClicksFromActions = fromMap(actionsMap, 'link_click');
  const link_clicks = inlineLinkClicks || linkClicksFromActions;

  const ctr_link = impressions > 0 ? (link_clicks / impressions) * 100 : 0;
  const cpc_link = link_clicks > 0 ? spend / link_clicks : 0;

  return {
    spend: spend,
    impressions: impressions,
    reach: parseNum(item.reach),
    frequency: parseNum(item.frequency),
    clicks: parseNum(item.clicks),
    link_clicks: link_clicks,
    ctr_link: ctr_link,
    cpc_link: cpc_link,
    cpm: parseNum(item.cpm),

    messaging_conversations_started: fromMap(actionsMap, 'onsite_conversion.messaging_conversation_started_7d'),
    messaging_conversations_replied: fromMap(actionsMap, 'onsite_conversion.total_messaging_connection'),
    leads: fromMap(actionsMap, 'onsite_conversion.messaging_first_reply'),

    purchases: sumActionsContaining(actionsMap, 'purchase'),
    purchase_value: sumActionsContaining(actionValuesMap, 'purchase'),
  };
}

// -----------------------
// Row builders
// -----------------------
function baseRow(item, accountId, unitId, jobKey) {
  const date = getDate(item);
  const adId = item.ad_id || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${date}`;

  return {
    unique_key: unique_key,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date: date,

    campaign_id: item.campaign_id || null,
    campaign_name: item.campaign_name || null,
    adset_id: item.adset_id || null,
    adset_name: item.adset_name || null,
    ad_id: adId || null,
    ad_name: item.ad_name || null,

    spend: metricsFromItem(item).spend,
    impressions: metricsFromItem(item).impressions,
    reach: metricsFromItem(item).reach,
    frequency: metricsFromItem(item).frequency,
    clicks: metricsFromItem(item).clicks,
    link_clicks: metricsFromItem(item).link_clicks,
    ctr_link: metricsFromItem(item).ctr_link,
    cpc_link: metricsFromItem(item).cpc_link,
    cpm: metricsFromItem(item).cpm,
    messaging_conversations_started: metricsFromItem(item).messaging_conversations_started,
    messaging_conversations_replied: metricsFromItem(item).messaging_conversations_replied,
    leads: metricsFromItem(item).leads,
    purchases: metricsFromItem(item).purchases,
    purchase_value: metricsFromItem(item).purchase_value,

    raw: item,
  };
}

function platformRow(item, accountId, unitId, jobKey) {
  const date = getDate(item);
  const adId = item.ad_id || '';
  const publisherPlatform = item.publisher_platform || '';
  const platformPosition = item.platform_position || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${date}:${publisherPlatform}:${platformPosition}`;
  const m = metricsFromItem(item);

  return {
    unique_key: unique_key,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date: date,

    campaign_id: item.campaign_id || null,
    adset_id: item.adset_id || null,
    ad_id: adId || null,

    publisher_platform: publisherPlatform || null,
    platform_position: platformPosition || null,

    spend: m.spend,
    impressions: m.impressions,
    reach: m.reach,
    frequency: m.frequency,
    clicks: m.clicks,
    link_clicks: m.link_clicks,
    ctr_link: m.ctr_link,
    cpc_link: m.cpc_link,
    cpm: m.cpm,
  };
}

function deviceRow(item, accountId, unitId, jobKey) {
  const date = getDate(item);
  const adId = item.ad_id || '';
  const impressionDevice = item.impression_device || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${date}:${impressionDevice}`;
  const m = metricsFromItem(item);

  return {
    unique_key: unique_key,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date: date,

    campaign_id: item.campaign_id || null,
    adset_id: item.adset_id || null,
    ad_id: adId || null,

    impression_device: impressionDevice || null,

    spend: m.spend,
    impressions: m.impressions,
    reach: m.reach,
    frequency: m.frequency,
    clicks: m.clicks,
    link_clicks: m.link_clicks,
    ctr_link: m.ctr_link,
    cpc_link: m.cpc_link,
    cpm: m.cpm,
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
    unique_key: unique_key,
    job_key: jobKey,
    account_id: accountId,
    unit_id: unitId,
    date: date,

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
  };
}

// -----------------------
// Meta fetch
// -----------------------
async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || META_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    let data = {};
    try {
      data = await response.json();
    } catch (_e) {
      data = {};
    }
    return { res: response, data: data };
  } finally {
    clearTimeout(timer);
  }
}

function isTransientMetaError(res, data) {
  const httpStatus = res ? res.status : 0;
  const code = data && data.error ? data.error.code : null;

  if (httpStatus === 429) return true;
  if (httpStatus >= 500 && httpStatus <= 599) return true;
  if (code === 1 || code === 2 || code === 4 || code === 17) return true;

  return false;
}

async function fetchAllPagesInsights(actId, metaToken, params) {
  const results = [];
  let cursor = null;

  while (true) {
    const search = new URLSearchParams();

    for (const key of Object.keys(params)) {
      search.set(key, String(params[key]));
    }

    search.set('access_token', metaToken);
    search.set('limit', String(PAGE_LIMIT));

    if (cursor) {
      search.set('after', cursor);
    }

    const url = `${META_BASE}/act_${actId}/insights?${search.toString()}`;

    let ok = false;
    let responseData = null;

    for (let attempt = 0; attempt <= META_MAX_RETRIES; attempt++) {
      const fetched = await fetchJsonWithTimeout(url, META_TIMEOUT_MS);
      const res = fetched.res;
      const data = fetched.data;

      if (res.ok && !(data && data.error)) {
        responseData = data;
        ok = true;
        break;
      }

      const message = data && data.error && data.error.message ? data.error.message : `Meta API HTTP ${res.status}`;
      const code = data && data.error ? data.error.code : '';
      const subcode = data && data.error ? data.error.error_subcode : '';

      const fullMessage =
        message +
        (code ? ` | code=${code}` : '') +
        (subcode ? ` | sub=${subcode}` : '');

      if (!isTransientMetaError(res, data) || attempt === META_MAX_RETRIES) {
        throw new Error(fullMessage);
      }

      const backoff = jitter(8000 * Math.pow(2, attempt));
      console.warn(`Meta transient error. Retry ${attempt + 1}/${META_MAX_RETRIES + 1} em ${(backoff / 1000).toFixed(1)}s -> ${fullMessage}`);
      await sleep(backoff);
    }

    if (!ok || !responseData) {
      throw new Error('Falha ao buscar dados da Meta.');
    }

    const pageData = Array.isArray(responseData.data) ? responseData.data : [];
    for (const item of pageData) {
      results.push(item);
    }

    const nextCursor =
      responseData &&
      responseData.paging &&
      responseData.paging.cursors &&
      responseData.paging.cursors.after
        ? responseData.paging.cursors.after
        : null;

    const hasNext = !!(responseData && responseData.paging && responseData.paging.next && nextCursor);

    if (!hasNext) {
      break;
    }

    cursor = nextCursor;
    await sleep(DELAY_BETWEEN_PAGES);
  }

  return results;
}

async function fetchInsightsByDateChunks(actId, metaToken, baseParams, dateRanges) {
  const all = [];

  for (let i = 0; i < dateRanges.length; i++) {
    const range = dateRanges[i];

    const params = {
      ...baseParams,
      time_range: JSON.stringify({
        since: range.since,
        until: range.until,
      }),
    };

    const items = await fetchAllPagesInsights(actId, metaToken, params);

    for (const item of items) {
      all.push(item);
    }

    if (i < dateRanges.length - 1) {
      await sleep(DELAY_BETWEEN_PAGES);
    }
  }

  return all;
}

// -----------------------
// Persist helpers
// -----------------------
function splitIntoChunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function dedupByUniqueKey(rows) {
  const map = new Map();

  for (const row of rows || []) {
    if (row && row.unique_key) {
      map.set(row.unique_key, row);
    }
  }

  return Array.from(map.values());
}

async function runWithConcurrency(items, worker, concurrency) {
  let index = 0;
  const conc = Math.max(1, concurrency);

  async function runner() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
    }
  }

  const tasks = [];
  for (let i = 0; i < conc; i++) {
    tasks.push(runner());
  }

  await Promise.all(tasks);
}

function buildPeriodFilter(ctx) {
  return {
    account_id: ctx.account_id,
    unit_id: ctx.unit_id,
    date: {
      $gte: ctx.date_from,
      $lte: ctx.date_to,
    },
  };
}

async function deleteByPeriod(entity, ctx) {
  const filter = buildPeriodFilter(ctx);

  while (true) {
    const list = await entity.filter(filter, null, DELETE_BATCH);

    if (!list || !list.length) {
      break;
    }

    await runWithConcurrency(
      list,
      async function (row) {
        await entity.delete(row.id);
      },
      DELETE_CONCURRENCY
    );

    await sleep(50);
  }
}

async function safeFilterByInChunked(entity, keys) {
  try {
    const existingAll = [];
    const chunks = splitIntoChunks(keys, CHUNK_SIZE);

    for (const chunk of chunks) {
      const res = await entity.filter({ unique_key: { $in: chunk } }, null, chunk.length);
      if (Array.isArray(res) && res.length) {
        for (const row of res) {
          existingAll.push(row);
        }
      }
      await sleep(10);
    }

    return existingAll;
  } catch (e) {
    console.error('Falha no filter com $in:', e && e.message ? e.message : e);
    return null;
  }
}

async function bulkCreateChunked(entity, rows, bulkChunkSize) {
  let written = 0;

  for (let i = 0; i < rows.length; i += bulkChunkSize) {
    const chunk = rows.slice(i, i + bulkChunkSize);
    await entity.bulkCreate(chunk);
    written += chunk.length;

    if (i + bulkChunkSize < rows.length) {
      await sleep(30);
    }
  }

  return written;
}

async function createOnlyFallback(entity, rows) {
  let written = 0;

  for (const row of rows) {
    try {
      await entity.create(row);
      written += 1;
    } catch (e) {
      const msg = String((e && e.message) || '').toLowerCase();
      if (
        msg.indexOf('unique') !== -1 ||
        msg.indexOf('duplicate') !== -1 ||
        msg.indexOf('already') !== -1
      ) {
        continue;
      }
      throw e;
    }
  }

  return written;
}

async function safeBulkCreate(entity, rows, bulkChunkSize) {
  try {
    return await bulkCreateChunked(entity, rows, bulkChunkSize);
  } catch (e) {
    console.error('bulkCreate falhou, usando fallback create:', e && e.message ? e.message : e);
    return await createOnlyFallback(entity, rows);
  }
}

async function saveMode(entity, rows, ctx, options) {
  const deduped = dedupByUniqueKey(rows);

  if (!deduped.length) return 0;

  if (ctx.force) {
    await deleteByPeriod(entity, ctx);
    return await safeBulkCreate(entity, deduped, options.bulkChunkSize);
  }

  const keys = deduped.map((row) => row.unique_key);
  const existing = await safeFilterByInChunked(entity, keys);

  if (existing === null) {
    return await safeBulkCreate(entity, deduped, options.bulkChunkSize);
  }

  const existingSet = new Set(existing.map((item) => item.unique_key));
  const toCreate = deduped.filter((row) => !existingSet.has(row.unique_key));

  if (!toCreate.length) return 0;

  return await safeBulkCreate(entity, toCreate, options.bulkChunkSize);
}

// -----------------------
// Job helpers
// -----------------------
async function markJobFailed(base44, jobKey, errorMsg) {
  try {
    const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key: jobKey }, null, 1);
    if (jobs && jobs.length) {
      await base44.asServiceRole.entities.MetaIngestRun.update(jobs[0].id, {
        status: 'failed',
        error_message: String(errorMsg || '').substring(0, 500),
      });
    }
  } catch (e) {
    console.error('markJobFailed error:', e && e.message ? e.message : e);
  }
}

// -----------------------
// Main
// -----------------------
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let bodyData = {};
  try {
    bodyData = await req.json();
  } catch (_e) {
    bodyData = {};
  }

  const job_key = bodyData.job_key;
  const unit_id = bodyData.unit_id;
  const mode = bodyData.mode;
  const force = bodyData.force;

  if (!job_key) {
    return Response.json({ error: 'job_key obrigatório' }, { status: 400 });
  }

  try {
    const validModes = ['base', 'platform', 'device', 'demographic'];
    const effectiveMode = validModes.includes(mode) ? mode : null;

    const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key: job_key }, null, 1);
    if (!jobs || !jobs.length) {
      return Response.json({ error: 'job_key não encontrado' }, { status: 404 });
    }

    const job = jobs[0];
    const effectiveUnitId = unit_id || job.unit_id || '';

    const allTokens = await base44.asServiceRole.entities.MetaToken.list();
    const tokenRecord = (allTokens || []).find(function (t) {
      return t &&
        t.status === 'active' &&
        Array.isArray(t.unit_ids) &&
        t.unit_ids.includes(effectiveUnitId);
    });

    if (!tokenRecord) {
      return Response.json({ error: `Nenhum token ativo encontrado para a unidade ${effectiveUnitId}` }, { status: 404 });
    }

    const meta_token = tokenRecord.token;

    if (job.status === 'running') {
      return Response.json({ status: 'already_running', job_key: job_key });
    }

    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
      status: 'running',
      progress: 0,
      rows_written: 0,
      error_message: null,
    });

    const account_id = job.account_id;
    const date_from = job.date_from;
    const date_to = job.date_to;
    const actId = normalizeActId(account_id);

    const ctx = {
      account_id: account_id,
      unit_id: effectiveUnitId,
      date_from: date_from,
      date_to: date_to,
      force: !!force,
    };

    const baseParams = {
      time_range: JSON.stringify({ since: date_from, until: date_to }),
      fields:
        'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,' +
        'spend,impressions,reach,frequency,clicks,cpm,actions,action_values,date_start,date_stop',
      level: 'ad',
      time_increment: '1',
    };

    const breakdownParams = {
      fields:
        'campaign_id,adset_id,ad_id,spend,impressions,reach,frequency,clicks,cpm,actions,date_start,date_stop',
      level: 'ad',
      time_increment: '1',
    };

    let totalRows = 0;

    // BASE
    if (!effectiveMode || effectiveMode === 'base') {
      const items = await fetchAllPagesInsights(actId, meta_token, baseParams);
      const rows = items.map(function (item) {
        return baseRow(item, account_id, effectiveUnitId, job_key);
      });

      totalRows += await saveMode(
        base44.asServiceRole.entities.MetaInsightBase,
        rows,
        ctx,
        { bulkChunkSize: BULK_CHUNK_BASE }
      );

      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
        progress: 1,
        rows_written: totalRows,
      }).catch(function () {});

      if (effectiveMode === 'base') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
          status: 'done',
          rows_written: totalRows,
        });

        return Response.json({
          success: true,
          job_key: job_key,
          mode: 'base',
          rows_written: totalRows,
        });
      }

      await sleep(DELAY_BETWEEN_MODES);
    }

    // PLATFORM
    if (!effectiveMode || effectiveMode === 'platform') {
      const ranges = splitDateRange(date_from, date_to, 7);

      const items = await fetchInsightsByDateChunks(
        actId,
        meta_token,
        {
          ...breakdownParams,
          breakdowns: 'publisher_platform,platform_position',
        },
        ranges
      );

      const rows = items.map(function (item) {
        return platformRow(item, account_id, effectiveUnitId, job_key);
      });

      totalRows += await saveMode(
        base44.asServiceRole.entities.MetaInsightByPlatformPosition,
        rows,
        ctx,
        { bulkChunkSize: BULK_CHUNK_BREAKDOWN }
      );

      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
        progress: 2,
        rows_written: totalRows,
      }).catch(function () {});

      if (effectiveMode === 'platform') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
          status: 'done',
          rows_written: totalRows,
        });

        return Response.json({
          success: true,
          job_key: job_key,
          mode: 'platform',
          rows_written: totalRows,
        });
      }

      await sleep(DELAY_BETWEEN_MODES);
    }

    // DEVICE
    if (!effectiveMode || effectiveMode === 'device') {
      const ranges = splitDateRange(date_from, date_to, 7);

      const items = await fetchInsightsByDateChunks(
        actId,
        meta_token,
        {
          ...breakdownParams,
          breakdowns: 'impression_device',
        },
        ranges
      );

      const rows = items.map(function (item) {
        return deviceRow(item, account_id, effectiveUnitId, job_key);
      });

      totalRows += await saveMode(
        base44.asServiceRole.entities.MetaInsightByDevice,
        rows,
        ctx,
        { bulkChunkSize: BULK_CHUNK_BREAKDOWN }
      );

      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
        progress: 3,
        rows_written: totalRows,
      }).catch(function () {});

      if (effectiveMode === 'device') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
          status: 'done',
          rows_written: totalRows,
        });

        return Response.json({
          success: true,
          job_key: job_key,
          mode: 'device',
          rows_written: totalRows,
        });
      }

      await sleep(DELAY_BETWEEN_MODES);
    }

    // DEMOGRAPHIC
    if (!effectiveMode || effectiveMode === 'demographic') {
      const ranges = splitDateRange(date_from, date_to, 3);

      const items = await fetchInsightsByDateChunks(
        actId,
        meta_token,
        {
          ...breakdownParams,
          breakdowns: 'age,gender',
        },
        ranges
      );

      const rows = items.map(function (item) {
        return demographicRow(item, account_id, effectiveUnitId, job_key);
      });

      totalRows += await saveMode(
        base44.asServiceRole.entities.MetaInsightByDemographic,
        rows,
        ctx,
        { bulkChunkSize: BULK_CHUNK_BREAKDOWN }
      );

      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
        progress: 4,
        rows_written: totalRows,
      }).catch(function () {});

      if (effectiveMode === 'demographic') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
          status: 'done',
          rows_written: totalRows,
        });

        return Response.json({
          success: true,
          job_key: job_key,
          mode: 'demographic',
          rows_written: totalRows,
        });
      }
    }

    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
      status: 'done',
      progress: 4,
      rows_written: totalRows,
    });

    return Response.json({
      success: true,
      job_key: job_key,
      rows_written: totalRows,
    });
  } catch (error) {
    console.error('runMetaIngest error:', error && error.message ? error.message : error);
    await markJobFailed(base44, job_key, error && error.message ? error.message : String(error));

    return Response.json(
      { error: error && error.message ? error.message : String(error) },
      { status: 500 }
    );
  }
});