import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper para aguardar tempo
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Calcular backoff exponencial
function calcularBackoff(tentativas) {
  const baseDelay = 60000; // 1 minuto
  const delay = baseDelay * Math.pow(2, tentativas); // Exponencial
  const maxDelay = 3600000; // Máximo 1 hora
  return Math.min(delay, maxDelay);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { batch_size = 20, delay_ms = 1000 } = await req.json();
    
    // Buscar itens pendentes prontos para processar
    const agora = new Date().toISOString();
    const items = await base44.asServiceRole.entities.FilaDeEntrada.filter(
      {
        status: 'pendente',
        proxima_tentativa_em: { $lte: agora }
      },
      'proxima_tentativa_em',
      batch_size
    );
    
    let processados = 0;
    let erros = 0;
    let sucessos = 0;
    
    for (const item of items) {
      try {
        // Marcar como processando
        await base44.asServiceRole.entities.FilaDeEntrada.update(item.id, {
          status: 'processando'
        });
        
        console.log(`⏳ Processando item ${item.event_id}...`);
        
        // Chamar a função real de processamento (receiveN8nData)
        const result = await base44.asServiceRole.functions.invoke('receiveN8nData', item.payload);
        
        // Marcar como feito
        await base44.asServiceRole.entities.FilaDeEntrada.update(item.id, {
          status: 'feito',
          tentativas: item.tentativas + 1
        });
        
        console.log(`✅ Item ${item.event_id} processado com sucesso`);
        sucessos++;
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${item.event_id}:`, error.message);
        
        const isRateLimit = error.message?.includes('rate limit') || 
                           error.message?.includes('429') ||
                           error.message?.includes('Rate limit');
        
        const novasTentativas = item.tentativas + 1;
        const maxTentativas = 5;
        
        if (isRateLimit || novasTentativas < maxTentativas) {
          // Reagendar com backoff
          const backoffMs = calcularBackoff(novasTentativas);
          const proximaTentativa = new Date(Date.now() + backoffMs).toISOString();
          
          await base44.asServiceRole.entities.FilaDeEntrada.update(item.id, {
            status: 'pendente',
            tentativas: novasTentativas,
            proxima_tentativa_em: proximaTentativa,
            erro_detalhes: `${error.message} (tentativa ${novasTentativas})`
          });
          
          console.log(`⏰ Item ${item.event_id} reagendado para ${new Date(proximaTentativa).toLocaleString('pt-BR')}`);
        } else {
          // Marcar como erro permanente
          await base44.asServiceRole.entities.FilaDeEntrada.update(item.id, {
            status: 'erro',
            tentativas: novasTentativas,
            erro_detalhes: `Máximo de tentativas atingido: ${error.message}`
          });
        }
        
        erros++;
      }
      
      processados++;
      
      // Rate limiting: aguardar entre processamentos
      if (processados < items.length) {
        await sleep(delay_ms);
      }
    }
    
    return Response.json({
      success: true,
      processados: processados,
      sucessos: sucessos,
      erros: erros,
      restantes: items.length - processados
    });
    
  } catch (error) {
    console.error('❌ Erro no processamento da fila:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});