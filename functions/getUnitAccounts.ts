import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // ✅ Auth via secret interno (não expira)
    const secret = req.headers.get('x-internal-secret');
    if (!secret || secret !== Deno.env.get('INTERNAL_SECRET')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);

    // Buscar todas as unidades
    const units = await base44.asServiceRole.entities.Unit.list();

    const accounts = units
      .filter(u => u.status === 'active')
      .map(unit => ({
        unit_id: unit.id,
        account_id: unit.account_id || '',
        access_token: unit.secret_token || '',
        is_active: unit.status === 'active'
      }));

    return Response.json({
      accounts,
      total: accounts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return Response.json({ error: error?.message || String(error), accounts: [] }, { status: 500 });
  }
});