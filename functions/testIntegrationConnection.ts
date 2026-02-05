import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({ error: 'integration_id is required' }, { status: 400 });
    }

    // Buscar a integração no banco de dados
    const integrations = await base44.entities.Integration.filter({ id: integration_id });
    const integration = integrations[0];

    if (!integration) {
      return Response.json({ error: 'Integration not found' }, { status: 404 });
    }

    const { platform_id, account_reference, settings, auth_type } = integration;

    let testResult = { success: false, message: '' };

    // Testar conexão baseado na plataforma
    if (platform_id === 'META') {
      const accessToken = settings?.access_token;
      
      if (!accessToken) {
        return Response.json({ 
          error: 'Access token not configured',
          connection_status: 'error'
        }, { status: 400 });
      }

      // Testar conexão com Meta Graph API
      const metaResponse = await fetch(
        `https://graph.facebook.com/v18.0/${account_reference}?fields=name,account_status&access_token=${accessToken}`
      );

      if (metaResponse.ok) {
        const data = await metaResponse.json();
        testResult = {
          success: true,
          message: `Conectado com sucesso: ${data.name}`,
          account_info: data
        };
      } else {
        const error = await metaResponse.json();
        testResult = {
          success: false,
          message: `Erro ao conectar: ${error.error?.message || 'Token inválido'}`
        };
      }
    } else if (platform_id === 'GOOGLE_ADS') {
      const accessToken = settings?.access_token || settings?.client_id;
      
      if (!accessToken) {
        return Response.json({ 
          error: 'Credentials not configured',
          connection_status: 'error'
        }, { status: 400 });
      }

      testResult = {
        success: true,
        message: 'Credenciais configuradas (teste completo requer OAuth setup)'
      };
    } else if (platform_id === 'TIKTOK_ADS') {
      const accessToken = settings?.access_token;
      
      if (!accessToken) {
        return Response.json({ 
          error: 'Access token not configured',
          connection_status: 'error'
        }, { status: 400 });
      }

      testResult = {
        success: true,
        message: 'Credenciais configuradas (teste completo requer validação TikTok)'
      };
    } else if (platform_id === 'YOUTUBE') {
      const apiKey = settings?.api_key || settings?.access_token;
      
      if (!apiKey) {
        return Response.json({ 
          error: 'API key not configured',
          connection_status: 'error'
        }, { status: 400 });
      }

      testResult = {
        success: true,
        message: 'Credenciais configuradas (teste completo requer OAuth setup)'
      };
    }

    // Atualizar status da integração
    const newStatus = testResult.success ? 'connected' : 'error';
    await base44.asServiceRole.entities.Integration.update(integration_id, {
      connection_status: newStatus,
      last_test: new Date().toISOString(),
      error_message: testResult.success ? null : testResult.message
    });

    return Response.json({
      success: testResult.success,
      message: testResult.message,
      connection_status: newStatus,
      account_info: testResult.account_info
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      connection_status: 'error'
    }, { status: 500 });
  }
});