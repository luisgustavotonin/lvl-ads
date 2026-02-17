import { createClient } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // Service role direto - sem autenticação para permitir chamadas do n8n
    const base44 = createClient(
      Deno.env.get('BASE44_APP_ID'),
      Deno.env.get('BASE44_SERVICE_ROLE_KEY')
    );

    // Buscar todas as unidades
    const units = await base44.entities.Unit.list();

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