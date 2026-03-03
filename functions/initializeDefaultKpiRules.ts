import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { unit_id, provider = 'META' } = await req.json();

    // Verificar se já existem regras para essa unidade/provider
    const existing = await base44.entities.KpiRule.filter({ unit_id, provider });
    
    if (existing.length > 0) {
      return Response.json({ 
        message: 'Regras já existem',
        count: existing.length 
      });
    }

    // Regras de diagnóstico pré-configuradas
    const defaultRules = [
      {
        unit_id, provider,
        rule_name: 'Fadiga de Criativo',
        conditions: {
          ctr_link: 'red',
          frequency: ['yellow', 'red']
        },
        severity: 'high',
        message_title: 'Provável fadiga de criativo',
        message_body: 'CTR baixo combinado com frequência alta indica que o público já viu muito o anúncio e parou de interagir.',
        recommended_actions: [
          'Trocar criativo (nova imagem/vídeo)',
          'Variar ângulo da mensagem (dor vs benefício)',
          'Testar novo público semelhante',
          'Ampliar raio geográfico ou segmentação',
          'Pausar anúncio temporariamente'
        ],
        enabled: true
      },
      {
        unit_id, provider,
        rule_name: 'Leilão Caro',
        conditions: {
          cpc_link: 'red',
          ctr_link: ['green', 'yellow']
        },
        severity: 'medium',
        message_title: 'CPC alto com CTR aceitável',
        message_body: 'O anúncio tem boa taxa de clique mas o custo por clique está alto, indicando leilão competitivo ou segmentação muito restrita.',
        recommended_actions: [
          'Revisar segmentação (público pode estar muito pequeno)',
          'Testar Advantage+ ou públicos broad',
          'Ajustar posicionamentos (remover os mais caros)',
          'Revisar estratégia de lances',
          'Expandir públicos semelhantes'
        ],
        enabled: true
      },
      {
        unit_id, provider,
        rule_name: 'Problema Pós-Clique',
        conditions: {
          ctr_link: ['green', 'yellow'],
          wa_conversations_started_7d: ['yellow', 'red']
        },
        severity: 'high',
        message_title: 'Anúncio atrai mas não converte',
        message_body: 'O anúncio gera cliques mas não resulta em conversas no WhatsApp.',
        recommended_actions: [
          'Verificar se o link do WhatsApp está correto',
          'Testar mensagem pré-preenchida mais atrativa',
          'Revisar promessa do anúncio vs realidade do atendimento',
          'Melhorar call-to-action',
          'Adicionar prova social e urgência',
          'Verificar tempo de carregamento'
        ],
        enabled: true
      },
      {
        unit_id, provider,
        rule_name: 'Problema de Atendimento',
        conditions: {
          wa_conversations_started_7d: ['green', 'yellow'],
          wa_messaging_first_reply: 'red'
        },
        severity: 'high',
        message_title: 'Conversas sem resposta',
        message_body: 'O tráfego está gerando conversas mas o atendimento não está respondendo adequadamente.',
        recommended_actions: [
          'Ajustar SLA de atendimento',
          'Implementar automação de boas-vindas',
          'Revisar horário e fila de atendimento',
          'Treinar equipe de SDR',
          'Padronizar respostas iniciais',
          'Monitorar tempo de primeira resposta'
        ],
        enabled: true
      },
      {
        unit_id, provider,
        rule_name: 'CPM Muito Alto',
        conditions: {
          cpm: 'red'
        },
        severity: 'medium',
        message_title: 'CPM acima do ideal',
        message_body: 'Custo por mil impressões muito alto indica baixa competitividade no leilão ou criativo fraco.',
        recommended_actions: [
          'Trocar criativo por formatos mais nativos',
          'Usar Reels ou Stories em vez de feed',
          'Melhorar thumbnail e hook inicial',
          'Variar copy e abordagem',
          'Testar novos públicos',
          'Revisar posicionamentos'
        ],
        enabled: true
      },
      {
        unit_id, provider,
        rule_name: 'Custo por Conversa Alto',
        conditions: {
          cost_per_conversation: 'red'
        },
        severity: 'high',
        message_title: 'Custo por conversa acima do limite',
        message_body: 'O custo para gerar cada conversa no WhatsApp está acima do ideal para o segmento.',
        recommended_actions: [
          'Identificar se problema é CTR baixo, CPC alto ou baixa conversão',
          'Pausar variações de anúncios com pior desempenho',
          'Redistribuir orçamento para os melhores anúncios',
          'Revisar público-alvo',
          'Testar novas abordagens criativas',
          'Otimizar jornada pós-clique'
        ],
        enabled: true
      }
    ];

    // Criar todas as regras
    await base44.entities.KpiRule.bulkCreate(defaultRules);

    return Response.json({ 
      success: true,
      message: 'Regras de diagnóstico criadas com sucesso',
      count: defaultRules.length 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});