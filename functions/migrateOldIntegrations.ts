import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const results = {
      created_global_integrations: [],
      created_unit_links: [],
      updated_units: [],
      errors: []
    };

    // Buscar todas as integrações antigas (que têm unit_id)
    const oldIntegrations = await base44.asServiceRole.entities.Integration.filter({ 
      is_global: false 
    });

    // Buscar todas as integrações globais existentes
    const globalIntegrations = await base44.asServiceRole.entities.Integration.filter({ 
      is_global: true 
    });

    // Buscar todas as unidades
    const units = await base44.asServiceRole.entities.Unit.list();

    // Processar cada integração antiga
    for (const oldInt of oldIntegrations) {
      try {
        // Verificar se já existe uma integração global para esta plataforma
        let globalInt = globalIntegrations.find(g => g.platform_id === oldInt.platform_id);
        
        // Se não existe, criar
        if (!globalInt) {
          globalInt = await base44.asServiceRole.entities.Integration.create({
            is_global: true,
            platform_id: oldInt.platform_id,
            auth_type: oldInt.auth_type || 'n8n_webhook',
            settings: {
              n8n_webhook_url: oldInt.settings?.n8n_webhook_url || '',
              n8n_secret_token: oldInt.settings?.n8n_secret_token || '',
            }
          });
          results.created_global_integrations.push({
            platform_id: oldInt.platform_id,
            integration_id: globalInt.id
          });
        }

        // Criar link entre a integração global e a unidade
        const link = await base44.asServiceRole.entities.IntegrationUnitLink.create({
          integration_id: globalInt.id,
          unit_id: oldInt.unit_id,
          account_id: oldInt.account_reference,
          is_active: true
        });
        
        results.created_unit_links.push({
          unit_id: oldInt.unit_id,
          integration_id: globalInt.id,
          link_id: link.id
        });

        // Atualizar a unidade com account_id e access_token baseado na plataforma
        const unit = units.find(u => u.id === oldInt.unit_id);
        if (unit) {
          const updateData = {};
          
          if (oldInt.platform_id === 'META') {
            updateData.meta_account_id = oldInt.account_reference;
            updateData.meta_access_token = oldInt.settings?.access_token || '';
          } else if (oldInt.platform_id === 'GOOGLE_ADS') {
            updateData.google_account_id = oldInt.account_reference;
            updateData.google_access_token = oldInt.settings?.access_token || '';
          } else if (oldInt.platform_id === 'TIKTOK_ADS') {
            updateData.tiktok_account_id = oldInt.account_reference;
            updateData.tiktok_access_token = oldInt.settings?.access_token || '';
          }

          if (Object.keys(updateData).length > 0) {
            await base44.asServiceRole.entities.Unit.update(oldInt.unit_id, updateData);
            results.updated_units.push({
              unit_id: oldInt.unit_id,
              platform: oldInt.platform_id,
              updated_fields: Object.keys(updateData)
            });
          }
        }

      } catch (error) {
        results.errors.push({
          integration_id: oldInt.id,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      results
    });

  } catch (error) {
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});