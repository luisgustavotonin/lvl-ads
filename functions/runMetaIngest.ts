import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const META_API_VERSION = 'v24.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const PAGE_LIMIT = 100;
const BATCH_SAVE = 100;
const DELAY_MS = 250;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function normalizeActId(accountId) {
  if (!accountId) return '';
  return String(accountId).replace(/^act_/, '');
}

function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function buildUniqueKey(accountId, date, level, item, breakdowns) {
  const parts = [accountId, date, level];

  if (item.ad_id) parts.push(item.ad_id);
  else if (item.adset_id) parts.push(item.adset_id);
  else if (item.campaign_id) parts.push(item.campaign_id);

  (breakdowns || []).forEach(b => {
    if (item[b]) parts.push(item[b]);
  });

  return parts.join(':');
}

function parseNum(v) {
  return v !== undefined && v !== null ? (parseFloat(v) || 0) : 0;
}

function actionsToMap(actionsArr) {
  const map = {};
  if (!Array.isArray(actionsArr)) return map;
  for (const a of actionsArr) {
    if (!a || !a.action_type) continue;
    map[a.action_type] = parseNum(a.value);
  }
  return map;
}

function costPerActionToMap(arr) {
  const map = {};
  if (!Array.isArray(arr)) return map;
  for (const a of arr) {
    if (!a || !a.action_type) continue;
    map[a.action_type] = parseNum(a.value);
  }
  return map;
}

function getFromMap(map, key) {
  return map && Object.prototype.hasOwnProperty.call(map, key) ? parseNum(map[key]) : 0;
}

function transformInsight(item, accountId, level, breakdowns, jobKey) {
  const date = item.date_start || item.date_stop || '';
  const unique_key = buildUniqueKey(accountId, date, level, item, breakdowns);

  const actionsMap = actionsToMap(item.actions);
  const costMap = costPerActionToMap(item.cost_per_action_type);

  const link_clicks = getFromMap(actionsMap, 'link_click');

  const impressions = parseNum(item.impressions);
  const spend = parseNum(item.spend);

  const ctr_link = impressions > 0 ? (link_clicks / impressions) * 100 : 0;
  const cpc_link = link_clicks > 0 ? (spend / link_clicks) : 0;

  return {
    unique_key,
    job_key: jobKey,
    account_id: accountId,
    date,
    level,

    campaign_id: item.campaign_id || null,
    campaign_name: item.campaign_name || null,
    adset_id: item.adset_id || null,
    adset_name: item.adset_name || null,
    ad_id: item.ad_id || null,
    ad_name: item.ad_name || null,

    spend,
    impressions,
    clicks: parseNum(item.clicks),
    reach: parseNum(item.reach),
    frequency: parseNum(item.frequency),
    ctr: parseNum(item.ctr),
    cpc: parseNum(item.cpc),
    cpm: parseNum(item.cpm),

    publisher_platform: item.publisher_platform || null,
    platform_position: item.platform_position || null,
    impression_device: item.impression_device || null,
    age: item.age || null,
    gender: item.gender || null,

    link_clicks,
    ctr_link,
    cpc_link,

    raw_json: {
      ...item,
      _actions_map: actionsMap,
      _cost_per_action_map: costMap
    }
  };
}

async function upsertBatch(base44, rows) {
  if (rows.length === 0) return 0;

  let written = 0;

  for (const row of rows) {
    try {
      await base44.asServiceRole.entities.MetaIngestInsight.create(row);
      written++;
    } catch (e) {
      // Se falhar por unique_key, tenta atualizar
      try {
        const found = await base44
          .asServiceRole
          .entities
          .MetaIngestInsight
          .filter({ unique_key: row.unique_key }, null, 1);

        if (found.length > 0) {
          await base44
            .asServiceRole
            .entities
            .MetaIngestInsight
            .update(found[0].id, row);

          written++;
        }
      } catch {
        // ignora erro secundário
      }
    }
  }

  return written;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { job_key, meta_token } = body;

    if (!job_key || !meta_token) {
      return Response.json({ error: 'job_key e meta_token obrigatórios' }, { status: 400 });
    }

    const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1);
    if (jobs.length === 0) {
      return Response.json({ error: 'job_key não encontrado' }, { status: 404 });
    }
    const job = jobs[0];

    if (job.status === 'running') {
      return Response.json({ status: 'already_running', job_key });
    }

    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
      status: 'running', progress: 0, rows_written: 0, error_message: null
    });

    const { account_id, date_from, date_to, level, breakdowns = [] } = job;

    // ✅ normaliza o act id (evita act_act_)
    const actId = normalizeActId(account_id);

    const fields = [
      'campaign_id', 'campaign_name',
      'adset_id', 'adset_name',
      'ad_id', 'ad_name',
      'spend', 'impressions', 'clicks', 'reach', 'frequency', 'ctr', 'cpc', 'cpm',
      'date_start', 'date_stop',
      'actions',
      'cost_per_action_type'
    ];

    let cursor = null;
    let pageNum = 0;
    let totalRows = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        access_token: meta_token,
        time_range: JSON.stringify({ since: date_from, until: date_to }),
        level,
        fields: fields.join(','),
        limit: String(PAGE_LIMIT),
        time_increment: '1'
      });

      if (breakdowns.length > 0) params.set('breakdowns', breakdowns.join(','));
      if (cursor) params.set('after', cursor);

      // ✅ usa actId normalizado
      const url = `${META_BASE}/act_${actId}/insights?${params.toString()}`;

      const metaRes = await fetch(url);
      const metaData = await metaRes.json();

      if (!metaRes.ok || metaData.error) {
        const errMsg = metaData.error?.message || `HTTP ${metaRes.status}`;
        await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
          status: 'failed', error_message: errMsg
        });
        return Response.json({ success: false, error: errMsg });
      }

      const items = metaData.data || [];
      const pageHash = simpleHash(JSON.stringify(items.map(i => i.ad_id || i.adset_id || i.campaign_id)));

      await base44.asServiceRole.entities.MetaIngestPage.create({
        job_key,
        page_num: pageNum,
        cursor_after: cursor || 'start',
        page_hash: pageHash,
        rows_in_page: items.length,
        fetched_at: new Date().toISOString()
      }).catch(() => {});

      const rows = items.map(item => transformInsight(item, account_id, level, breakdowns, job_key));

      for (let i = 0; i < rows.length; i += BATCH_SAVE) {
        const batch = rows.slice(i, i + BATCH_SAVE);
        const written = await upsertBatch(base44, batch);
        totalRows += written;
        await sleep(DELAY_MS);
      }

      pageNum++;

      await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
        progress: pageNum,
        rows_written: totalRows
      }).catch(() => {});

      const paging = metaData.paging;
      if (paging?.cursors?.after && paging?.next) {
        cursor = paging.cursors.after;
      } else {
        hasMore = false;
      }

      if (hasMore) await sleep(500);
    }

    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
      status: 'done',
      progress: pageNum,
      rows_written: totalRows
    });

    return Response.json({ success: true, job_key, pages: pageNum, rows_written: totalRows });

  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      const { job_key } = await req.clone().json().catch(() => ({}));
      if (job_key) {
        const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1);
        if (jobs.length > 0) {
          await base44.asServiceRole.entities.MetaIngestRun.update(jobs[0].id, {
            status: 'failed', error_message: error.message
          });
        }
      }
    } catch { /* ignore */ }

    return Response.json({ error: error.message }, { status: 500 });
  }
});