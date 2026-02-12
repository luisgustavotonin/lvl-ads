import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const defaultTemplate = `📡 CENTRAL DE PERFORMANCE – META ADS
Unidade: {{unidade}}
Data: {{data_atual}}
Período analisado: Hoje (00:00 até agora)

━━━━━━━━━━━━━━━━━━

📊 CONSOLIDADO DO DIA

Investimento acumulado: R$ {{investimento_total}}
Conversas iniciadas: {{total_conversas}}
Custo médio por conversa: R$ {{custo_medio_conversa}}

━━━━━━━━━━━━━━━━━━

🎯 STATUS OPERACIONAL

{{status_automatico}}

━━━━━━━━━━━━━━━━━━

📈 ANÚNCIOS COM MAIOR GERAÇÃO DE CONVERSAS

{{lista_anuncios_com_conversas}}

━━━━━━━━━━━━━━━━━━

🔎 Observação Estratégica

{{analise_automatica}}`;

    return Response.json({ template: defaultTemplate });

  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ 
      error: error.message || 'Erro ao processar'
    }, { status: 500 });
  }
});