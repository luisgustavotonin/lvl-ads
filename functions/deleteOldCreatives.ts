import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { unit_id } = await req.json();

    if (!unit_id) {
      return Response.json({ error: 'unit_id obrigatório' }, { status: 400 });
    }

    // Buscar criativos com os campos antigos (name, title, body, configured_status)
    const creatives = await base44.asServiceRole.entities.MetaAdsCreative.filter({
      unit_id: unit_id
    }, null, 5000);

    const toDelete = creatives.filter(c => {
      // Deleta se tiver ANY dos campos antigos preenchidos
      return c.name || c.title || c.body || c.configured_status;
    });

    if (toDelete.length === 0) {
      return Response.json({ success: true, deleted: 0, message: 'Nenhum criativo antigo encontrado' });
    }

    // Deletar em chunks
    let deleted = 0;
    for (const creative of toDelete) {
      await base44.asServiceRole.entities.MetaAdsCreative.delete(creative.id);
      deleted++;
    }

    console.log(`[deleteOldCreatives] unit=${unit_id} deleted=${deleted}`);

    return Response.json({ success: true, deleted, message: `${deleted} criativos antigos deletados` });
  } catch (error) {
    console.error('deleteOldCreatives error:', error?.message || error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});