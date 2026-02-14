import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const payload = await req.json();

        // Validar campos obrigatórios
        const required = ['job_id', 'unit_id', 'account_id', 'access_token', 'job_type', 'date_mode'];
        for (const field of required) {
            if (!payload[field]) {
                return Response.json({ 
                    success: false, 
                    error: `Campo obrigatório ausente: ${field}` 
                }, { status: 400 });
            }
        }

        // Criar queue_key baseado em unit_id e job_type
        const queueKey = `${payload.unit_id}_${payload.job_type}_${payload.breakdown || 'default'}`;

        // Preparar dados para inserção
        const jobData = {
            job_id: payload.job_id,
            status: 'queued',
            queue_key: queueKey,
            unit_id: payload.unit_id,
            account_id: payload.account_id,
            access_token: payload.access_token,
            job_type: payload.job_type,
            breakdown: payload.breakdown || null,
            timezone: payload.timezone || 'America/Sao_Paulo',
            date_mode: payload.date_mode,
            since: payload.since || null,
            until: payload.until || null,
            attempt: 0,
            payload_json: payload
        };

        // Inserir na fila
        const job = await base44.asServiceRole.entities.MetaJobsQueue.create(jobData);

        console.log(`✅ Job enfileirado: ${job.job_id} (${job.job_type})`);

        return Response.json({
            success: true,
            message: 'Job enfileirado com sucesso',
            job_id: job.job_id,
            queue_key: job.queue_key,
            status: job.status
        });

    } catch (error) {
        console.error('❌ Erro ao enfileirar job:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});