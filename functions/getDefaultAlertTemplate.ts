import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const defaultTemplate = `🔔 ALERTA DE PERFORMANCE

📍 Unidade: [Nome da Unidade]
📅 Data: [Data do Dia]
⏰ Período: Hoje (00:00 até agora)

━━━━━━━━━━━━━━━━━━━━━━━━━

📊 RESUMO DO DIA

💰 Investimento: R$ [Gasto Total]
💬 Conversas: [Total Conversas]
📈 Custo/Conversa: R$ [Custo por Conversa]

━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ ALERTAS DETECTADOS

[Alertas ou "Nenhum alerta detectado"]

━━━━━━━━━━━━━━━━━━━━━━━━━

📈 TOP 3 ANÚNCIOS DO DIA

🥇 [Nome Campanha] - PÁGINA OFICIAL
   └─ [Nome Conjunto]
   └─ [Nome Anúncio]

💰 Investimento: R$ [Valor]
💬 Conversas: [Número]
📊 Custo/Conversa: R$ [Valor]

🥈 [Nome Campanha] - PÁGINA OFICIAL
   └─ [Nome Conjunto]
   └─ [Nome Anúncio]

💰 Investimento: R$ [Valor]
💬 Conversas: [Número]
📊 Custo/Conversa: R$ [Valor]

🥉 [Nome Campanha] - PÁGINA OFICIAL
   └─ [Nome Conjunto]
   └─ [Nome Anúncio]

💰 Investimento: R$ [Valor]
💬 Conversas: [Número]
📊 Custo/Conversa: R$ [Valor]

━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return Response.json({ template: defaultTemplate });

  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ 
      error: error.message || 'Erro ao processar'
    }, { status: 500 });
  }
});