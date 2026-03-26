import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CONCURRENCY = 6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_RETRIES = 3;

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      return response;
    } catch (error) {
      if (attempt < retries) {
        const backoff = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
        console.warn(`Retry ${attempt + 1}/${retries} in ${backoff}ms:`, error?.message);
        await sleep(backoff);
      } else {
        throw error;
      }
    }
  }
}

async function saveBatch(entity, rows) {
    if (!rows?.length) return 0;
    const map = new Map();
    for (const r of rows) {
        const key = r.unique_key || `${r.unit_id}:${r.day}:${r.ad_id}:${r.module}:${r.breakdown_value}`;
        map.set(key, r);
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
                    if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already')) return false;
                    throw e;
                }
            })
        );
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value === true) written++;
            if (r.status === 'rejected') console.error('⚠️ create falhou:', r.reason?.message);
        }
    }
    return written;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { job_id, unit_id, module, date_start, date_end } = await req.json();

        if (!unit_id || !module || !date_start || !date_end) {
            return Response.json({ error: 'Parâmetros obrigatórios: unit_id, module, date_start, date_end' }, { status: 400 });
        }

        console.log(`🔄 Processando INSIGHTS - Unit: ${unit_id}, Module: ${module}`);

        const unit = await base44.asServiceRole.entities.Unit.get(unit_id);
        if (!unit?.account_id) throw new Error('Unidade não encontrada ou sem account_id');

        const integrations = await base44.asServiceRole.entities.Integration.filter({ unit_id, platform_id: 'META' });
        if (!integrations.length) throw new Error('Integração Meta não encontrada');

        const accessToken = integrations[0].settings?.access_token;
        if (!accessToken) throw new Error('Access token não encontrado');

        const breakdownMap = {
            core: null,
            platform: 'publisher_platform',
            age: 'age',
            gender: 'gender',
            device: 'impression_device'
        };
        const breakdown = breakdownMap[module];
        const breakdownKey = breakdown || 'none';

        const baseUrl = `https://graph.facebook.com/v22.0/${unit.account_id}/insights`;
        const fields = ['spend','impressions','reach','frequency','clicks','cpc','cpm','ctr','actions','action_values'].join(',');

        const params = new URLSearchParams({
            access_token: accessToken,
            level: 'ad',
            time_increment: '1',
            fields,
            limit: '500',
            time_range: JSON.stringify({ since: date_start, until: date_end })
        });
        if (breakdown) params.append('breakdowns', breakdown);

        let url = `${baseUrl}?${params.toString()}`;
        const allRows = [];

        while (url) {
             console.log(`📊 Buscando insights - ${module}... (coletadas ${allRows.length})`);
             const response = await fetchWithRetry(url);
             if (!response.ok) {
                 const errorData = await response.text();
                 throw new Error(`Meta API Error: ${response.status} - ${errorData}`);
             }
             const data = await response.json();
             for (const insight of (data.data || [])) {
                const adId = insight.ad_id;
                const dateValue = insight.date_start;
                let breakdownValue = 'all';
                if (breakdown) breakdownValue = insight[breakdown] || 'unknown';

                allRows.push({
                    unit_id,
                    day: dateValue,
                    ad_id: adId,
                    module,
                    breakdown_key: breakdownKey,
                    breakdown_value: breakdownValue,
                    spend: parseFloat(insight.spend || 0),
                    impressions: parseInt(insight.impressions || 0),
                    reach: parseInt(insight.reach || 0),
                    frequency: parseFloat(insight.frequency || 0),
                    clicks: parseInt(insight.clicks || 0),
                    cpc: parseFloat(insight.cpc || 0),
                    cpm: parseFloat(insight.cpm || 0),
                    ctr: parseFloat(insight.ctr || 0),
                    actions: insight.actions || {},
                    action_values: insight.action_values || {},
                    job_id: job_id,
                    unique_key: `${unit_id}:${dateValue}:${adId}:${module}:${breakdownValue}`
                });
            }
            url = data.paging?.next || null;
            if (url) await sleep(1000);
        }

        console.log(`📦 Coletados ${allRows.length} registros, salvando em batch...`);
        const written = await saveBatch(base44.asServiceRole.entities.MetaInsightsStaging, allRows);
        console.log(`✅ INSIGHTS processado - ${module}: ${written}/${allRows.length} registros salvos`);

        return Response.json({ ok: true, job_id, module, records_processed: written });

    } catch (error) {
        console.error('❌ Erro ao processar INSIGHTS:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
});