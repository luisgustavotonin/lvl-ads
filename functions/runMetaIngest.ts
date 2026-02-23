import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const META_API_VERSION = 'v24.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// -----------------------
// Tuning
// -----------------------
const PAGE_LIMIT = 500;
const DELAY_BETWEEN_PAGES = 120; // recomendo voltar p/ 120~200ms p/ estabilidade

// Save tuning
const IN_FILTER_CHUNK = 200;     // igual ao antigo (bem seguro)
const BULK_CHUNK = 250;          // 200~400 costuma ser bom
const UPDATE_CONCURRENCY = 6;    // updates são mais caros; mantenha baixo
const DELETE_CONCURRENCY = 10;   // delete controlado p/ não derrubar runtime
const DELETE_BATCH = 200;

// Fallback create-only
const CREATE_CONCURRENCY = 6;    // se instável, 4~6

// Meta retry
const META_TIMEOUT_MS = 60000;
const META_MAX_RETRIES = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function jitter(ms) {
  const j = Math.floor(Math.random() * 200);
  return ms + j;
}

function splitIntoChunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// -----------------------
// Helpers
// -----------------------
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

// -----------------------
// Rows
// -----------------------
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

// -----------------------
// Fetch (Meta) w/ retry
// -----------------------
async function fetchJsonWithTimeout(url, ms = META_TIMEOUT_MS) {
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

function isTransientMetaError(res, data) {
  const http = res?.status || 0;
  const code = data?.error?.code;
  // HTTP transitórios
  if (http === 429 || (http >= 500 && http <= 599)) return true;
  // Meta throttling/transient típicos
  if (code === 4 || code === 17 || code === 1 || code === 2) return true;
  return false;
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

    let lastErr = null;
    for (let attempt = 0; attempt <= META_MAX_RETRIES; attempt++) {
      const { res, data } = await fetchJsonWithTimeout(url, META_TIMEOUT_MS);

      if (res.ok && !data?.error) {
        results.push(...(data.data || []));

        if (data.paging?.cursors?.after && data.paging?.next) {
          cursor = data.paging.cursors.after;
          if (DELAY_BETWEEN_PAGES) await sleep(DELAY_BETWEEN_PAGES);
          break; // vai para próxima página
        }

        return results; // acabou
      }

      const msg = data?.error?.message || `Meta API HTTP ${res.status}`;
      const code = data?.error?.code;
      const sub = data?.error?.error_subcode;
      lastErr = new Error(`${msg}${code ? ` | code=${code}` : ''}${sub ? ` | sub=${sub}` : ''}`);

      if (!isTransientMetaError(res, data) || attempt === META_MAX_RETRIES) {
        throw lastErr;
      }

      // backoff exponencial com jitter
      const backoff = jitter(500 * Math.pow(2, attempt));
      console.warn(`Meta transient error (attempt ${attempt + 1}/${META_MAX_RETRIES + 1}) -> retry in ${backoff}ms:`, lastErr.message);
      await sleep(backoff);
    }
  }
}

// -----------------------
// Save (Base44) — UP SERT REAL
// -----------------------
function dedupByUniqueKey(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (r?.unique_key) map.set(r.unique_key, r);
  }
  return Array.from(map.values());
}

async function runWithConcurrency(items, worker, concurrency) {
  let idx = 0;
  let ok = 0;

  async function runner() {
    while (idx < items.length) {
      const i = idx++;
      try {
        const res = await worker(items[i], i);
        if (res) ok++;
      } catch (e) {
        throw e;
      }
    }
  }

  const runners = Array.from({ length: Math.max(1, concurrency) }, () => runner());
  await Promise.all(runners);
  return ok;
}

async function bulkDeleteByJobKey(entity, job_key) {
  while (true) {
    const list = await entity.filter({ job_key }, null, DELETE_BATCH);
    if (!list?.length) break;

    await runWithConcurrency(
      list,
      async (r) => {
        await entity.delete(r.id);
        return true;
      },
      DELETE_CONCURRENCY
    );

    // pequeno respiro evita “rajada”
    await sleep(50);
  }
}

async function tryBulkCreate(entity, rows) {
  let written = 0;
  for (let i = 0; i < rows.length; i += BULK_CHUNK) {
    const chunk = rows.slice(i, i + BULK_CHUNK);
    await entity.bulkCreate(chunk);
    written += chunk.length;
    if (i + BULK_CHUNK < rows.length) await sleep(30);
  }
  return written;
}

async function fallbackCreateOnly(entity, rows) {
  // create em paralelo com ignore de duplicado
  let written = 0;

  for (let i = 0; i < rows.length; i += CREATE_CONCURRENCY) {
    const chunk = rows.slice(i, i + CREATE_CONCURRENCY);

    const results = await Promise.allSettled(
      chunk.map(async (row) => {
        try {
          await entity.create(row);
          return true;
        } catch (e) {
          const msg = String(e?.message || '').toLowerCase();
          if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already')) return false;
          throw e;
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value === true) written++;
      if (r.status === 'rejected') console.error('⚠️ create falhou:', r.reason?.message || r.reason);
    }

    if (i + CREATE_CONCURRENCY < rows.length) await sleep(20);
  }

  return written;
}

async function safeBulkCreate(entity, rows) {
  try {
    return await tryBulkCreate(entity, rows);
  } catch (e) {
    console.error('⚠️ bulkCreate falhou, usando fallback create-only:', e?.message || e);
    return await fallbackCreateOnly(entity, rows);
  }
}

async function safeFilterByInChunked(entity, keys) {
  // Retorna array completo dos existentes (ou null se $in falhar)
  try {
    const existingAll = [];
    const chunks = splitIntoChunks(keys, IN_FILTER_CHUNK);

    for (const ck of chunks) {
      const res = await entity.filter({ unique_key: { $in: ck } }, null, ck.length);
      if (Array.isArray(res) && res.length) existingAll.push(...res);
      // respiro pequeno
      await sleep(10);
    }

    return existingAll;
  } catch (e) {
    console.error('⚠️ filter $in falhou (não dá pra checar existentes):', e?.message || e);
    return null;
  }
}

async function safeUpdateMany(entity, updates) {
  // updates: [{ id, data }]
  // (Base44 não tem bulkUpdate aqui, então controlamos concorrência)
  const written = await runWithConcurrency(
    updates,
    async ({ id, data }) => {
      await entity.update(id, data);
      return true;
    },
    UPDATE_CONCURRENCY
  );
  return written;
}

/**
 * Salvamento: sempre DELETE por job_key + bulkCreate (mais rápido e consistente)
 */
async function saveUpsert(entity, rows, { job_key }) {
  const deduped = dedupByUniqueKey(rows);
  if (!deduped.length) return 0;

  await bulkDeleteByJobKey(entity, job_key);
  return await safeBulkCreate(entity, deduped);
}

// -----------------------
// Job status
// -----------------------
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

// -----------------------
// Main
// -----------------------
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let bodyData = {};
  try {
    bodyData = await req.json();
  } catch {
    bodyData = {};
  }

  const { job_key, meta_token, unit_id, mode, force } = bodyData;

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

      totalRows += await saveUpsert(base44.asServiceRole.entities.MetaInsightBase, rows, { job_key });

      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
        progress: 1,
        rows_written: totalRows,
      }).catch(() => {});

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
      totalRows += await saveUpsert(base44.asServiceRole.entities.MetaInsightByPlatformPosition, rows, { job_key });

      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
        progress: 2,
        rows_written: totalRows,
      }).catch(() => {});

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
      totalRows += await saveUpsert(base44.asServiceRole.entities.MetaInsightByDevice, rows, { job_key });

      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
        progress: 3,
        rows_written: totalRows,
      }).catch(() => {});

      if (effectiveMode === 'device') {
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { status: 'done', rows_written: totalRows });
        return Response.json({ success: true, job_key, mode: 'device', rows_written: totalRows });
      }
    }

    // DEMOGRAPHIC
    if (!effectiveMode || effectiveMode === 'demographic') {
      const items = await fetchAllPagesInsights(actId, meta_token, {
        ...baseParams,
        breakdowns: 'age,gender',
      });

      const rows = items.map((i) => demographicRow(i, account_id, effectiveUnitId, job_key));
      totalRows += await saveUpsert(base44.asServiceRole.entities.MetaInsightByDemographic, rows, {
        force: effectiveForce,
        job_key,
      });

      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
        progress: 4,
        rows_written: totalRows,
      }).catch(() => {});

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