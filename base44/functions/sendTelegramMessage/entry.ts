import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { unit_id, bot_token, chat_id, message } = await req.json();
    
    if (!unit_id || !bot_token || !chat_id || !message) {
      return Response.json({ 
        error: 'Campos obrigatórios: unit_id, bot_token, chat_id, message' 
      }, { status: 400 });
    }

    // Enviar para API do Telegram
    const telegramUrl = `https://api.telegram.org/bot${bot_token}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();

    if (!result.ok) {
      console.error('Telegram error:', result);
      return Response.json({ 
        error: result.description || 'Erro ao enviar para Telegram'
      }, { status: 400 });
    }

    return Response.json({ 
      success: true,
      message: 'Mensagem enviada com sucesso'
    });

  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ 
      error: error.message || 'Erro ao processar requisição'
    }, { status: 500 });
  }
});