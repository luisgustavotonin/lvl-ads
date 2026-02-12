import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const payload = Array.isArray(body) ? body[0] : body;
    
    const { event_id, source = 'n8n', ...data } = payload;
    
    if (!event_id) {
      return Response.json({ 
        ok: false, 
        error: 'event_id é obrigatório' 
      }, { status: 400 });
    }
    
    // Verificar duplicata
    const existing = await base44.asServiceRole.entities.FilaDeEntrada.filter({
      event_id: event_id,
      source: source
    });
    
    if (existing.length > 0) {
      console.log(`⚠️ Evento duplicado ignorado: ${event_id}`);
      return Response.json({
        ok: true,
        duplicate: true,
        message: 'Evento já existe na fila'
      });
    }
    
    // Adicionar à fila
    const item = await base44.asServiceRole.entities.FilaDeEntrada.create({
      source: source,
      event_id: event_id,
      payload: data,
      status: 'pendente',
      tentativas: 0,
      proxima_tentativa_em: new Date().toISOString()
    });
    
    console.log(`✅ Evento adicionado à fila: ${event_id}`);
    
    return Response.json({
      ok: true,
      queue_id: item.id,
      event_id: event_id
    });
    
  } catch (error) {
    console.error('❌ Erro no intake:', error);
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});