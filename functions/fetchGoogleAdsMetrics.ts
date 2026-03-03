import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { integration_id, start_date, end_date } = await req.json();

    if (!integration_id) {
      return Response.json({ error: 'integration_id is required' }, { status: 400 });
    }

    // Buscar integração
    const integrations = await base44.asServiceRole.entities.Integration.filter({ id: integration_id });
    const integration = integrations[0];

    if (!integration || integration.platform_id !== 'GOOGLE_ADS') {
      return Response.json({ error: 'Google Ads integration not found' }, { status: 404 });
    }

    const { account_reference, settings, unit_id } = integration;
    const accessToken = settings?.access_token;
    const developerToken = settings?.developer_token;

    if (!accessToken || !developerToken) {
      return Response.json({ 
        error: 'Google Ads credentials not fully configured (need access_token and developer_token)',
        message: 'Configure OAuth credentials and developer token in integration settings'
      }, { status: 400 });
    }

    // Nota: Google Ads API requer configuração mais complexa com OAuth e developer token
    // Este é um exemplo simplificado que mostra a estrutura básica
    
    return Response.json({
      success: false,
      message: 'Google Ads integration requires OAuth 2.0 setup with developer token',
      note: 'Esta integração requer configuração OAuth completa. As credenciais foram salvas e podem ser usadas quando o fluxo OAuth for implementado.',
      required_credentials: {
        client_id: settings?.client_id ? 'Configured' : 'Missing',
        client_secret: settings?.client_secret ? 'Configured' : 'Missing',
        refresh_token: settings?.refresh_token ? 'Configured' : 'Missing',
        developer_token: settings?.developer_token ? 'Configured' : 'Missing'
      }
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});