import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  // Responder imediatamente a OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' } });
  }

  try {
    // Validar x-internal-secret para chamadas externas (N8N)
    const internalSecret = Deno.env.get('INTERNAL_SECRET');
    const headerSecret = req.headers.get('x-internal-secret');
    if (internalSecret && headerSecret !== internalSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);

    // Buscar todas as unidades via service role (sem autenticação de usuário necessária)
    const units = await base44.asServiceRole.entities.Unit.list('-created_date', 100);

    // Formatar no formato esperado pelo n8n
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
    return Response.json({ 
      error: error.message,
      accounts: []
    }, { status: 500 });
  }
});