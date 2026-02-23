import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BULK_SIZE = 200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function saveBulk(entity, rows) {
    if (!rows?.length) return 0;
    // Dedup in-memory por unique_key
    const map = new Map();
    for (const r of rows) {
        if (r?.unique_key) map.set(r.unique_key, r);
    }
    const deduped = Array.from(map.values());

    let written = 0;
    for (let i = 0; i < deduped.length; i += BULK_SIZE) {
        const chunk = deduped.slice(i, i + BULK_SIZE);
        try {
            await entity.bulkCreate(chunk);
            written += chunk.length;
        } catch (e) {
            // fallback: criar um a um se bulkCreate falhar
            console.warn(`⚠️ bulkCreate falhou, tentando individual: ${e.message}`);
            for (const row of chunk) {
                try {
                    await entity.create(row);
                    written++;
                } catch (e2) {
                    const msg = String(e2?.message || '').toLowerCase();
                    if (!msg.includes('unique') && !msg.includes('duplicate') && !msg.includes('already')) {
                        console.error('create falhou:', e2.message);
                    }
                }
            }
        }
        if (i + BULK_SIZE < deduped.length) await sleep(50);
    }
    return written;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { job_id, unit_id } = await req.json();

        if (!unit_id) {
            return Response.json({ error: 'unit_id é obrigatório' }, { status: 400 });
        }

        console.log(`🔄 Processando ADS_LIGHT - Unit: ${unit_id}`);

        const unit = await base44.asServiceRole.entities.Unit.get(unit_id);
        if (!unit?.account_id) throw new Error('Unidade não encontrada ou sem account_id');

        const integrations = await base44.asServiceRole.entities.Integration.filter({ unit_id, platform_id: 'META' });
        if (!integrations.length) throw new Error('Integração Meta não encontrada');

        const accessToken = integrations[0].settings?.access_token;
        if (!accessToken) throw new Error('Access token não encontrado');

        const baseUrl = `https://graph.facebook.com/v22.0/${unit.account_id}/ads`;
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,name,effective_status,campaign_id,campaign{id,name},adset_id,adset{id,name},creative{id}',
            limit: '500'
        });

        let url = `${baseUrl}?${params.toString()}`;
        const allAds = [];

        // ── Fase 1: baixar TUDO da API Meta sem nenhuma escrita no BD ──
        while (url) {
            console.log(`📥 Buscando anúncios... (coletados ${allAds.length})`);
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Meta API Error: ${response.status} - ${errorData}`);
            }
            const data = await response.json();
            if (data.error) throw new Error(`Meta API: ${data.error.message}`);

            for (const ad of (data.data || [])) {
                allAds.push({
                    unique_key: `${unit_id}::${ad.id}`,
                    unit_id,
                    account_id: unit.account_id,
                    ad_id: ad.id,
                    ad_name: ad.name || ad.id,
                    ad_status: ad.effective_status || '',
                    campaign_id: ad.campaign?.id || '',
                    campaign_name: ad.campaign?.name || '',
                    adset_id: ad.adset?.id || '',
                    adset_name: ad.adset?.name || '',
                    creative_id: ad.creative?.id || '',
                    last_updated: new Date().toISOString()
                });
            }

            url = data.paging?.next || null;
            if (url) await sleep(100);
        }

        console.log(`📦 Coletados ${allAds.length} anúncios, salvando em bulk...`);

        // ── Fase 2: salvar em bulk no BD ──
        const written = await saveBulk(base44.asServiceRole.entities.MetaAdsDim, allAds);

        console.log(`✅ ADS_LIGHT processado: ${written}/${allAds.length} registros salvos`);
        return Response.json({ ok: true, job_id, records_processed: written });

    } catch (error) {
        console.error('❌ Erro ao processar ADS_LIGHT:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
});