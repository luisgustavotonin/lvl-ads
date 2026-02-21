import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const META_API_VERSION = 'v24.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const PAGE_LIMIT = 500;
const BATCH_SIZE = 100;
const CONCURRENCY = 8;
const DELAY_BETWEEN_PAGES = 150;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── utils ───────────────────────────────────────────────────────────────────

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
  for (const a of arr) { if (a?.action_type) m[a.action_type] = parseNum(a.value); }
  return m;
}

function fromMap(m, key) {
  return (m && Object.prototype.hasOwnProperty.call(m, key)) ? parseNum(m[key]) : 0;
}

// ─── transformers ────────────────────────────────────────────────────────────

function metricsFromItem(item) {
  const actionsMap = actionsToMap(item.actions);
  const spend       = parseNum(item.spend);
  const impressions = parseNum(item.impressions);
  const link_clicks = fromMap(actionsMap, 'link_click');
  const ctr_link    = impressions > 0 ? (link_clicks / impressions) * 100 : 0;
  const cpc_link    = link_clicks  > 0 ? (spend / link_clicks) : 0;
  return {
    spend, impressions, link_clicks, ctr_link, cpc_link,
    reach:     parseNum(item.reach),
    frequency: parseNum(item.frequency),
    clicks:    parseNum(item.clicks),
    cpm:       parseNum(item.cpm),
    messaging_conversations_started:  fromMap(actionsMap, 'onsite_conversion.messaging_conversation_started_7d'),
    messaging_conversations_replied:  fromMap(actionsMap, 'onsite_conversion.messaging_first_reply'),
    leads:          fromMap(actionsMap, 'lead'),
    purchases:      fromMap(actionsMap, 'purchase'),
    purchase_value: fromMap(actionsToMap(item.action_values || []), 'purchase'),
  };
}

function baseRow(item, accountId, unitId, jobKey) {
  const date = item.date_start || item.date_stop || '';
  const adId = item.ad_id || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${date}`;
  return {
    unique_key, job_key: jobKey, account_id: accountId, unit_id: unitId, date,
    campaign_id: item.campaign_id || null, campaign_name: item.campaign_name || null,
    adset_id: item.adset_id || null, adset_name: item.adset_name || null,
    ad_id: adId, ad_name: item.ad_name || null,
    ...metricsFromItem(item),
    raw: item,
  };
}

function platformRow(item, accountId, unitId, jobKey) {
  const date = item.date_start || item.date_stop || '';
  const adId = item.ad_id || '';
  const pp   = item.publisher_platform || '';
  const pos  = item.platform_position || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${date}:${pp}:${pos}`;
  const m = metricsFromItem(item);
  return {
    unique_key, job_key: jobKey, account_id: accountId, unit_id: unitId, date,
    campaign_id: item.campaign_id || null, adset_id: item.adset_id || null, ad_id: adId,
    publisher_platform: pp, platform_position: pos,
    spend: m.spend, impressions: m.impressions, reach: m.reach, frequency: m.frequency,
    clicks: m.clicks, link_clicks: m.link_clicks, ctr_link: m.ctr_link, cpc_link: m.cpc_link, cpm: m.cpm,
    raw: item,
  };
}

function deviceRow(item, accountId, unitId, jobKey) {
  const date = item.date_start || item.date_stop || '';
  const adId = item.ad_id || '';
  const dev  = item.impression_device || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${date}:${dev}`;
  const m = metricsFromItem(item);
  return {
    unique_key, job_key: jobKey, account_id: accountId, unit_id: unitId, date,
    campaign_id: item.campaign_id || null, adset_id: item.adset_id || null, ad_id: adId,
    impression_device: dev,
    spend: m.spend, impressions: m.impressions, reach: m.reach, frequency: m.frequency,
    clicks: m.clicks, link_clicks: m.link_clicks, ctr_link: m.ctr_link, cpc_link: m.cpc_link, cpm: m.cpm,
    raw: item,
  };
}

function demographicRow(item, accountId, unitId, jobKey) {
  const date = item.date_start || item.date_stop || '';
  const adId = item.ad_id || '';
  const age    = item.age || '';
  const gender = item.gender || '';
  const unique_key = `${accountId}:${unitId}:${adId}:${date}:${age}:${gender}`;
  const m = metricsFromItem(item);
  return {
    unique_key, job_key: jobKey, account_id: accountId, unit_id: unitId, date,
    campaign_id: item.campaign_id || null, adset_id: item.adset_id || null, ad_id: adId,
    age, gender,
    spend: m.spend, impressions: m.impressions, reach: m.reach, frequency: m.frequency,
    clicks: m.clicks, link_clicks: m.link_clicks, ctr_link: m.ctr_link, cpc_link: m.cpc_link, cpm: m.cpm,
    raw: item,
  };
}

// ─── upsert batch ─────────────────────────────────────────────────────────────

async function upsertBatch(entity, rows) {
  if (!rows.length) return 0;
  let written = 0;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (row) => {
        try {
          // Try create first
          await entity.create(row);
          return true;
        } catch (e) {
          const msg = (e?.message || '').toLowerCase();
          if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already')) {
            // Find and update existing
            try {
              const existing = await entity.filter({ unique_key: row.unique_key }, null, 1);
              if (existing.length > 0) {
                await entity.update(existing[0].id, row);
                return true;
              }
            } catch { /* ignore */ }
            return false;
          }
          throw e;
        }
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) written++;
      if (r.status === 'rejected') console.error('upsert failed:', r.reason?.message);
    }
  }
  return written;
}

// ─── fetch all pages from Meta ────────────────────────────────────────────────

async function fetchAllPages(actId, metaToken, params) {
  const results = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const p = new URLSearchParams({ ...params, access_token: metaToken, limit: String(PAGE_LIMIT) });
    if (cursor) p.set('after', cursor);

    const res = await fetch(`${META_BASE}/act_${actId}/insights?${p.toString()}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `Meta API HTTP ${res.status}`);
    }

    results.push(...(data.data || []));

    if (data.paging?.cursors?.after && data.paging?.next) {
      cursor = data.paging.cursors.after;
    } else {
      hasMore = false;
    }

    if (hasMore) await sleep(DELAY_BETWEEN_PAGES);
  }

  return results;
}

// ─── main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { job_key, meta_token, unit_id } = await req.json();

    if (!job_key || !meta_token) {
      return Response.json({ error: 'job_key e meta_token obrigatórios' }, { status: 400 });
    }

    const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1);
    if (!jobs.length) return Response.json({ error: 'job_key não encontrado' }, { status: 404 });
    const job = jobs[0];

    if (job.status === 'running') return Response.json({ status: 'already_running', job_key });

    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
      status: 'running', progress: 0, rows_written: 0, error_message: null
    });

    const { account_id, date_from, date_to } = job;
    const actId = normalizeActId(account_id);
    const effectiveUnitId = unit_id || job.unit_id || '';

    const baseParams = {
      time_range: JSON.stringify({ since: date_from, until: date_to }),
      fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,action_values,date_start,date_stop',
      level: 'ad',
      time_increment: '1',
    };

    let totalRows = 0;

    // ── 1. BASE (sem breakdown) ──────────────────────────────────────────────
    console.log(`[runMetaIngest] ${job_key} — fetching base`);
    const baseItems = await fetchAllPages(actId, meta_token, baseParams);
    const baseRows  = baseItems.map(i => baseRow(i, account_id, effectiveUnitId, job_key));
    for (let i = 0; i < baseRows.length; i += BATCH_SIZE) {
      totalRows += await upsertBatch(base44.asServiceRole.entities.MetaInsightBase, baseRows.slice(i, i + BATCH_SIZE));
    }
    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 1, rows_written: totalRows }).catch(() => {});

    // ── 2. PLATFORM + POSITION ───────────────────────────────────────────────
    console.log(`[runMetaIngest] ${job_key} — fetching platform/position`);
    const ppItems = await fetchAllPages(actId, meta_token, { ...baseParams, breakdowns: 'publisher_platform,platform_position' });
    const ppRows  = ppItems.map(i => platformRow(i, account_id, effectiveUnitId, job_key));
    for (let i = 0; i < ppRows.length; i += BATCH_SIZE) {
      totalRows += await upsertBatch(base44.asServiceRole.entities.MetaInsightByPlatformPosition, ppRows.slice(i, i + BATCH_SIZE));
    }
    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 2, rows_written: totalRows }).catch(() => {});

    // ── 3. DEVICE ────────────────────────────────────────────────────────────
    console.log(`[runMetaIngest] ${job_key} — fetching device`);
    const devItems = await fetchAllPages(actId, meta_token, { ...baseParams, breakdowns: 'impression_device' });
    const devRows  = devItems.map(i => deviceRow(i, account_id, effectiveUnitId, job_key));
    for (let i = 0; i < devRows.length; i += BATCH_SIZE) {
      totalRows += await upsertBatch(base44.asServiceRole.entities.MetaInsightByDevice, devRows.slice(i, i + BATCH_SIZE));
    }
    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 3, rows_written: totalRows }).catch(() => {});

    // ── 4. DEMOGRAPHIC ───────────────────────────────────────────────────────
    console.log(`[runMetaIngest] ${job_key} — fetching demographics`);
    const demoItems = await fetchAllPages(actId, meta_token, { ...baseParams, breakdowns: 'age,gender' });
    const demoRows  = demoItems.map(i => demographicRow(i, account_id, effectiveUnitId, job_key));
    for (let i = 0; i < demoRows.length; i += BATCH_SIZE) {
      totalRows += await upsertBatch(base44.asServiceRole.entities.MetaInsightByDemographic, demoRows.slice(i, i + BATCH_SIZE));
    }
    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, { progress: 4, rows_written: totalRows }).catch(() => {});

    // ── DONE ─────────────────────────────────────────────────────────────────
    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
      status: 'done', progress: 4, rows_written: totalRows
    });

    return Response.json({ success: true, job_key, rows_written: totalRows });

  } catch (error) {
    console.error('runMetaIngest error:', error.message);
    try {
      const base44b = createClientFromRequest(req);
      const body = await req.clone().json().catch(() => ({}));
      if (body.job_key) {
        const jobs = await base44b.asServiceRole.entities.MetaIngestRun.filter({ job_key: body.job_key }, null, 1);
        if (jobs.length) {
          await base44b.asServiceRole.entities.MetaIngestRun.update(jobs[0].id, {
            status: 'failed', error_message: error.message
          });
        }
      }
    } catch { /* ignore */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
});