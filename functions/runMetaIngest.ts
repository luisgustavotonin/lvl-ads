import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

const META_API_VERSION = "v24.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// -----------------------
// Tuning (Meta)
// -----------------------
const PAGE_LIMIT = 500;
const DELAY_BETWEEN_PAGES = 700;
const META_TIMEOUT_MS = 60000;
const META_MAX_RETRIES = 6;

// -----------------------
// Tuning (Jobs / Modos)
// -----------------------
const DELAY_BETWEEN_MODES = 2000;       // ✅ 2s entre modos quando roda "all"
const DELAY_AFTER_JOB_DONE_MS = 2000;   // ✅ 2s entre um job e outro (segura resposta)

// -----------------------
// Persistência (Base44)
// -----------------------
const CHUNK_SIZE = 200;
const BULK_CHUNK_BASE = 150;
const BULK_CHUNK_BREAKDOWN = 60;

const DELETE_BATCH = 150;
const DELETE_CONCURRENCY = 2;

// Rate limit Base44 (principal anti 500/502)
const BASE44_OP_CONCURRENCY = 1; // mais seguro
const BASE44_MIN_GAP_MS = 180;
const BASE44_MAX_RETRIES = 6;

// utils
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => ms + Math.floor(Math.random() * 250);

// -----------------------
// Helpers básicos
// -----------------------
function normalizeActId(id) {
  if (!id) return "";
  return String(id).replace(/^act_/, "");
}
function parseNum(v) {
  return v != null ? (parseFloat(v) || 0) : 0;
}
function actionsToMap(arr) {
  const m = {};
  if (!Array.isArray(arr)) return m;
  for (const a of arr) {
    if (a && a.action_type) m[a.action_type] = parseNum(a.value);
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
function getDate(item) {
  return item.date_start || item.date_stop || "";
}
function metricsFromItem(item) {
  const actionsMap = actionsToMap(item.actions || []);
  const actionValuesMap = actionsToMap(item.action_values || []);

  const spend = parseNum(item.spend);
  const impressions = parseNum(item.impressions);

  const link_clicks = fromMap(actionsMap, "link_click");
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

    messaging_conversations_started: fromMap(
      actionsMap,
      "onsite_conversion.messaging_conversation_started_7d"
    ),
    messaging_conversations_replied: fromMap(
      actionsMap,
      "onsite_conversion.total_messaging_connection"
    ),
    leads: fromMap(actionsMap, "onsite_conversion.messaging_first_reply"),

    purchases: sumActionsContaining(actionsMap, "purchase"),
    purchase_value: sumActionsContaining(actionValuesMap, "purchase"),
  };
}

// -----------------------
// Rows
// -----------------------
function baseRow(item, accountId, unitId, jobKey) {
  const date = getDate(item);
  const adId = item.ad_id || "";
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
    ad_id: adId || null,
    ad_name: item.ad_name || null,

    ...metricsFromItem(item),

    raw: item, // raw só aqui
  };
}

function platformRow(item, accountId, unitId, jobKey) {
  const date = getDate(item);
  const adId = item.ad_id || "";
  const pp = item.publisher_platform || "";
  const pos = item.platform_position || "";
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
  };
}

function deviceRow(item, accountId, unitId, jobKey) {
  const date = getDate(item);
  const adId = item.ad_id || "";
  const dev = item.impression_device || "";
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
  };
}

function demographicRow(item, accountId, unitId, jobKey) {
  const date = getDate(item);
  const adId = item.ad_id || "";
  const age = item.age || "";
  const gender = item.gender || "";
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
// Meta fetch (timeout + retry/backoff)
// -----------------------
async function fetchJsonWithTimeout(url, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms || META_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } finally {
    clearTimeout(t);
  }
}

function isTransientMetaError(res, data) {
  const http = res && res.status ? res.status : 0;
  const code = data && data.error ? data.error.code : undefined;
  if (http === 429 || (http >= 500 && http <= 599)) return true;
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
    if (cursor) p.set("after", cursor);

    const url = `${META_BASE}/act_${actId}/insights?${p.toString()}`;

    let lastErr = null;
    for (let attempt = 0; attempt <= META_MAX_RETRIES; attempt++) {
      const { res, data } = await fetchJsonWithTimeout(url, META_TIMEOUT_MS);

      if (res && res.ok && !(data && data.error)) {
        results.push(...((data && data.data) || []));

        if (data && data.paging && data.paging.cursors && data.paging.cursors.after && data.paging.next) {
          cursor = data.paging.cursors.after;
          await sleep(jitter(DELAY_BETWEEN_PAGES));
          break;
        }
        return results;
      }

      const msg = (data && data.error && data.error.message) || `Meta API HTTP ${(res && res.status) || "?"}`;
      const code = data && data.error ? data.error.code : undefined;
      const sub = data && data.error ? data.error.error_subcode : undefined;
      lastErr = new Error(`${msg}${code ? ` | code=${code}` : ""}${sub ? ` | sub=${sub}` : ""}`);

      if (!isTransientMetaError(res, data) || attempt === META_MAX_RETRIES) throw lastErr;

      const backoff = jitter(900 * Math.pow(2, attempt));
      console.warn(
        `Meta transient error (attempt ${attempt + 1}/${META_MAX_RETRIES + 1}) -> retry in ${backoff}ms: ${lastErr.message}`
      );
      await sleep(backoff);
    }
  }
}

// -----------------------
// Base44 rate limiter + retry/backoff
// -----------------------
function createLimiter(concurrency) {
  let active = 0;
  const queue = [];

  async function run(fn) {
    if (active >= concurrency) {
      await new Promise((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  }

  return { run };
}

const limiter = createLimiter(BASE44_OP_CONCURRENCY);
let base44LastTs = 0;

function isRateLimitLike(e) {
  const msg = String((e && e.message) || e || "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("too many") ||
    msg.includes("429") ||
    msg.includes("throttle") ||
    msg.includes("timeout") ||
    msg.includes("temporarily") ||
    msg.includes("server error") ||
    msg.includes("502") ||
    msg.includes("500") ||
    msg.includes("503")
  );
}

async function base44Call(fn, label) {
  return limiter.run(async () => {
    const now = Date.now();
    const gap = now - base44LastTs;
    if (gap < BASE44_MIN_GAP_MS) await sleep(BASE44_MIN_GAP_MS - gap);

    let lastErr = null;
    for (let attempt = 0; attempt <= BASE44_MAX_RETRIES; attempt++) {
      try {
        const out = await fn();
        base44LastTs = Date.now();
        return out;
      } catch (e) {
        lastErr = e;
        base44LastTs = Date.now();

        if (!isRateLimitLike(e) || attempt === BASE44_MAX_RETRIES) {
          console.error(`Base44 ${label} failed:`, (e && e.message) || e);
          throw e;
        }

        const backoff = jitter(900 * Math.pow(2, attempt));
        console.warn(
          `Base44 ${label} retry ${attempt + 1}/${BASE44_MAX_RETRIES + 1} in ${backoff}ms:`,
          (e && e.message) || e
        );
        await sleep(backoff);
      }
    }
    throw lastErr;
  });
}

// -----------------------
// Persist helpers
// -----------------------
function splitIntoChunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function dedupByUniqueKey(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (r && r.unique_key) map.set(r.unique_key, r);
  }
  return Array.from(map.values());
}

async function runWithConcurrency(items, worker, concurrency) {
  let idx = 0;
  const conc = Math.max(1, concurrency);

  async function runner() {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: conc }, () => runner()));
}

function buildPeriodFilter(ctx) {
  return {
    account_id: ctx.account_id,
    unit_id: ctx.unit_id,
    date: { $gte: ctx.date_from, $lte: ctx.date_to },
  };
}

async function deleteByPeriod(entity, ctx) {
  const filter = buildPeriodFilter(ctx);

  while (true) {
    const list = await base44Call(() => entity.filter(filter, null, DELETE_BATCH), "delete.filter");
    if (!list || !list.length) break;

    await runWithConcurrency(
      list,
      async (r) => {
        await base44Call(() => entity.delete(r.id), "delete.delete");
      },
      DELETE_CONCURRENCY
    );

    await sleep(200);
  }
}

/**
 * ✅ CORRIGIDO: não retorna null se teve erro numa tentativa anterior e depois funcionou
 */
async function safeFilterByInChunked(entity, keys, maxRetries) {
  const existingAll = [];
  const chunks = splitIntoChunks(keys, CHUNK_SIZE);
  const retries = typeof maxRetries === "number" ? maxRetries : 3;

  for (const ck of chunks) {
    let success = false;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await base44Call(
          () => entity.filter({ unique_key: { $in: ck } }, null, ck.length),
          "filter.$in"
        );
        if (Array.isArray(res) && res.length) existingAll.push(...res);
        await sleep(40);
        success = true;
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        if (attempt < retries) {
          const backoff = jitter(500 * Math.pow(2, attempt));
          console.warn(`filter $in retry (attempt ${attempt + 1}/${retries + 1}) in ${backoff}ms:`, (e && e.message) || e);
          await sleep(backoff);
        }
      }
    }

    if (!success) {
      console.error("⚠️ filter $in falhou após retries:", (lastError && lastError.message) || lastError);
      return null;
    }
  }

  return existingAll;
}

async function bulkCreateChunked(entity, rows, bulkChunkSize) {
  let written = 0;
  for (let i = 0; i < rows.length; i += bulkChunkSize) {
    const chunk = rows.slice(i, i + bulkChunkSize);
    await base44Call(() => entity.bulkCreate(chunk), "bulkCreate");
    written += chunk.length;
    if (i + bulkChunkSize < rows.length) await sleep(250);
  }
  return written;
}

async function createOnlyFallback(entity, rows) {
  let written = 0;
  for (const row of rows) {
    try {
      await base44Call(() => entity.create(row), "create.fallback");
      written++;
      await sleep(25);
    } catch (e) {
      const msg = String((e && e.message) || "").toLowerCase();
      if (msg.includes("unique") || msg.includes("duplicate") || msg.includes("already")) continue;
      throw e;
    }
  }
  return written;
}

async function safeBulkCreate(entity, rows, bulkChunkSize, maxRetries) {
  const retries = typeof maxRetries === "number" ? maxRetries : 2;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await bulkCreateChunked(entity, rows, bulkChunkSize);
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        const backoff = jitter(900 * Math.pow(2, attempt));
        console.warn(`bulkCreate retry (attempt ${attempt + 1}/${retries + 1}) in ${backoff}ms:`, (e && e.message) || e);
        await sleep(backoff);
      }
    }
  }

  console.error("⚠️ bulkCreate falhou após retries, usando createOnlyFallback:", (lastError && lastError.message) || lastError);
  return await createOnlyFallback(entity, rows);
}

async function saveMode(entity, rows, ctx, opts) {
  const bulkChunkSize = opts && opts.bulkChunkSize ? opts.bulkChunkSize : 100;

  const deduped = dedupByUniqueKey(rows);
  if (!deduped.length) return 0;

  if (ctx.force) {
    await deleteByPeriod(entity, ctx);
    await sleep(300);
    return await safeBulkCreate(entity, deduped, bulkChunkSize, 2);
  }

  const keys = deduped.map((r) => r.unique_key);
  const existing = await safeFilterByInChunked(entity, keys, 3);

  if (existing === null) {
    return await safeBulkCreate(entity, deduped, bulkChunkSize, 2);
  }

  const existingSet = new Set(existing.map((e) => e.unique_key));
  const toCreate = deduped.filter((r) => !existingSet.has(r.unique_key));
  if (!toCreate.length) return 0;

  return await safeBulkCreate(entity, toCreate, bulkChunkSize, 2);
}

async function markJobFailed(base44, jobKey, errorMsg) {
  try {
    const jobs = await base44Call(
      () => base44.asServiceRole.entities.MetaIngestRun.filter({ job_key: jobKey }, null, 1),
      "job.filter"
    );
    if (jobs && jobs.length) {
      await base44Call(
        () =>
          base44.asServiceRole.entities.MetaIngestRun.update(jobs[0].id, {
            status: "failed",
            error_message: String(errorMsg).substring(0, 500),
          }),
        "job.update.failed"
      );
    }
  } catch (e) {
    console.error("markJobFailed error:", (e && e.message) || e);
  }
}

// -----------------------
// Main (segue mesmo se um modo falhar)
// -----------------------
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let bodyData = {};
  try {
    bodyData = await req.json();
  } catch {
    bodyData = {};
  }

  const job_key = bodyData.job_key;
  const meta_token = bodyData.meta_token;
  const unit_id = bodyData.unit_id;
  const mode = bodyData.mode;
  const force = bodyData.force;

  if (!job_key || !meta_token) {
    return Response.json({ error: "job_key e meta_token obrigatórios" }, { status: 400 });
  }

  const validModes = ["base", "platform", "device", "demographic"];
  const effectiveMode = validModes.includes(mode) ? mode : null;

  let jobId = "";
  let totalRows = 0;

  const results = {};
  const errors = {};

  async function updateJobSafe(patch, label) {
    try {
      await base44Call(() => base44.asServiceRole.entities.MetaIngestRun.update(jobId, patch), label);
    } catch {
      // não derruba
    }
  }

  async function runModeSafe(modeName, progressValue, fn) {
    if (effectiveMode && effectiveMode !== modeName) return;

    try {
      const written = await fn();
      totalRows += written;
      results[modeName] = { ok: true, rows_written: written };

      await updateJobSafe(
        { progress: progressValue, rows_written: totalRows },
        `job.update.progress.${modeName}`
      );
    } catch (e) {
      const msg = String((e && e.message) || e).slice(0, 500);
      results[modeName] = { ok: false, rows_written: 0, error: msg };
      errors[modeName] = msg;

      await updateJobSafe(
        { error_message: `Falha em ${modeName}: ${msg}`.slice(0, 500) },
        `job.update.error.${modeName}`
      );
      // ✅ continua
    }

    if (!effectiveMode) await sleep(DELAY_BETWEEN_MODES);
  }

  try {
    const jobs = await base44Call(
      () => base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1),
      "job.filter"
    );
    if (!jobs || !jobs.length) return Response.json({ error: "job_key não encontrado" }, { status: 404 });

    const job = jobs[0];
    jobId = job.id;

    if (job.status === "running") return Response.json({ status: "already_running", job_key });

    await base44Call(
      () =>
        base44.asServiceRole.entities.MetaIngestRun.update(jobId, {
          status: "running",
          progress: 0,
          rows_written: 0,
          error_message: null,
        }),
      "job.update.running"
    );

    const account_id = job.account_id;
    const date_from = job.date_from;
    const date_to = job.date_to;

    const actId = normalizeActId(account_id);
    const effectiveUnitId = unit_id || job.unit_id || "";

    const ctx = {
      account_id,
      unit_id: effectiveUnitId,
      date_from,
      date_to,
      force: !!force,
    };

    const baseParams = {
      time_range: JSON.stringify({ since: date_from, until: date_to }),
      fields:
        "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name," +
        "spend,impressions,reach,frequency,clicks,cpm," +
        "actions,action_values,date_start,date_stop",
      level: "ad",
      time_increment: "1",
    };

    await runModeSafe("base", 1, async () => {
      const items = await fetchAllPagesInsights(actId, meta_token, baseParams);
      const rows = items.map((i) => baseRow(i, account_id, effectiveUnitId, job_key));
      return await saveMode(base44.asServiceRole.entities.MetaInsightBase, rows, ctx, {
        bulkChunkSize: BULK_CHUNK_BASE,
      });
    });

    await runModeSafe("platform", 2, async () => {
      const items = await fetchAllPagesInsights(actId, meta_token, {
        ...baseParams,
        breakdowns: "publisher_platform,platform_position",
      });
      const rows = items.map((i) => platformRow(i, account_id, effectiveUnitId, job_key));
      return await saveMode(base44.asServiceRole.entities.MetaInsightByPlatformPosition, rows, ctx, {
        bulkChunkSize: BULK_CHUNK_BREAKDOWN,
      });
    });

    await runModeSafe("device", 3, async () => {
      const items = await fetchAllPagesInsights(actId, meta_token, {
        ...baseParams,
        breakdowns: "impression_device",
      });
      const rows = items.map((i) => deviceRow(i, account_id, effectiveUnitId, job_key));
      return await saveMode(base44.asServiceRole.entities.MetaInsightByDevice, rows, ctx, {
        bulkChunkSize: BULK_CHUNK_BREAKDOWN,
      });
    });

    await runModeSafe("demographic", 4, async () => {
      const items = await fetchAllPagesInsights(actId, meta_token, {
        ...baseParams,
        breakdowns: "age,gender",
      });
      const rows = items.map((i) => demographicRow(i, account_id, effectiveUnitId, job_key));
      return await saveMode(base44.asServiceRole.entities.MetaInsightByDemographic, rows, ctx, {
        bulkChunkSize: BULK_CHUNK_BREAKDOWN,
      });
    });

    const hasErrors = Object.keys(errors).length > 0;

    await base44Call(
      () =>
        base44.asServiceRole.entities.MetaIngestRun.update(jobId, {
          status: "done", // mantém compatível
          progress: 4,
          rows_written: totalRows,
          error_message: hasErrors
            ? `Falhas: ${Object.entries(errors)
                .map(([k, v]) => `${k}=${v}`)
                .join(" | ")}`.slice(0, 500)
            : null,
        }),
      "job.update.done"
    );

    await sleep(DELAY_AFTER_JOB_DONE_MS);

    return Response.json({
      success: true,
      job_key,
      rows_written: totalRows,
      status: hasErrors ? "done_with_errors" : "done",
      results,
    });
  } catch (error) {
    console.error("runMetaIngest fatal error:", (error && error.message) || error);
    await markJobFailed(base44, job_key, (error && error.message) || String(error));
    await sleep(DELAY_AFTER_JOB_DONE_MS);
    return Response.json({ error: String((error && error.message) || error) }, { status: 500 });
  }
});