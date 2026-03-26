import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_key } = await req.json();
    if (!job_key) return Response.json({ error: 'job_key obrigatório' }, { status: 400 });

    const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1);
    if (!jobs.length) return Response.json({ error: 'Job não encontrado' }, { status: 404 });

    const job = jobs[0];

    if (job.status === 'done' || job.status === 'failed') {
      return Response.json({ error: `Job já está com status "${job.status}", não pode ser cancelado.` }, { status: 400 });
    }

    await base44.asServiceRole.entities.MetaIngestRun.update(job.id, {
      status: 'failed',
      error_message: 'Cancelado manualmente pelo usuário.',
    });

    return Response.json({ success: true, job_key });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});