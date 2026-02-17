import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar todas as unidades
    const units = await base44.asServiceRole.entities.Unit.list();

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