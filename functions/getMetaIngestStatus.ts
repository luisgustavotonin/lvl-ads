import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_key } = await req.json();
    if (!job_key) return Response.json({ error: 'job_key obrigatório' }, { status: 400 });

    const jobs = await base44.asServiceRole.entities.MetaIngestRun.filter({ job_key }, null, 1);
    if (jobs.length === 0) return Response.json({ error: 'job_key não encontrado' }, { status: 404 });

    const job = jobs[0];
    return Response.json({
      job_key: job.job_key,
      status: job.status,
      progress: job.progress,
      rows_written: job.rows_written,
      error_message: job.error_message || null,
      account_id: job.account_id,
      date_from: job.date_from,
      date_to: job.date_to,
      level: job.level,
      breakdowns: job.breakdowns || []
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});