import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const payload = await req.json();
    
    // Validação básica do payload
    const { integration_id, secret_token, unit_id, account_id, provider, data } = payload;

    if (!integration_id || !unit_id || !data) {
      return Response.json({ 
        error: 'Payload inválido: integration_id, unit_id e data são obrigatórios' 
      }, { status: 400 });
    }

    // Buscar integração para validar secret_token
    const integration = await base44.asServiceRole.entities.Integration.get(integration_id);
    
    if (!integration) {
      return Response.json({ error: 'Integração não encontrada' }, { status: 404 });
    }

    if (integration.unit_id !== unit_id) {
      return Response.json({ error: 'unit_id não corresponde à integração' }, { status: 403 });
    }

    // Validar secret_token (se configurado na integração)
    if (integration.settings?.secret_token && integration.settings.secret_token !== secret_token) {
      return Response.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Processar dados
    const records = Array.isArray(data) ? data : [data];
    const processed = [];

    for (const record of records) {
      // Adicionar campos automáticos
      const fullRecord = {
        ...record,
        unit_id,
        account_id: account_id || integration.account_reference,
        run_id: payload.run_id || `webhook_${Date.now()}`
      };

      // Criar registro no MetaAdDaily
      const created = await base44.asServiceRole.entities.MetaAdDaily.create(fullRecord);
      processed.push(created.id);
    }

    // Log do webhook
    await base44.asServiceRole.entities.WebhookLog.create({
      integration_id,
      source: 'n8n',
      status: 'success',
      payload_received: payload,
      records_processed: {
        total: processed.length,
        entity: 'MetaAdDaily'
      }
    });

    return Response.json({
      success: true,
      message: 'Dados processados com sucesso',
      records_created: processed.length,
      record_ids: processed
    });

  } catch (error) {
    // Log de erro
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.WebhookLog.create({
        source: 'n8n',
        status: 'error',
        error_message: error.message,
        payload_received: await req.json().catch(() => ({}))
      });
    } catch {}

    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});