import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem parar agendamentos' }, { status: 403 });
    }

    const body = await req.json();
    const { schedule_id } = body;

    if (!schedule_id) {
      return Response.json({ error: 'schedule_id é obrigatório' }, { status: 400 });
    }

    await base44.asServiceRole.entities.IngestSchedule.update(schedule_id, {
      last_status: 'idle',
      last_log: 'Parado manualmente pelo usuário'
    });

    return Response.json({ ok: true, message: 'Agendamento parado' });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});