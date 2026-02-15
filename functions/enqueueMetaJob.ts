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

        // Validar date_mode e datas
        const validDateModes = ['TODAY', 'TODAY_AND_YESTERDAY', 'YESTERDAY', 'LAST_7D', 'LAST_14D', 'LAST_28D', 'LAST_30D', 'CUSTOM'];
        if (!validDateModes.includes(payload.date_mode)) {
            return Response.json({ 
                success: false, 
                error: `date_mode inválido. Use: ${validDateModes.join(', ')}` 
            }, { status: 400 });
        }

        // Se for CUSTOM, validar since/until
        if (payload.date_mode === 'CUSTOM') {
            if (!payload.since || !payload.until) {
                return Response.json({ 
                    success: false, 
                    error: 'Para date_mode CUSTOM, since e until são obrigatórios' 
                }, { status: 400 });
            }
        }

        const queueKey = `${payload.unit_id}_${payload.job_type}_${payload.breakdown || 'default'}`;

        // CRÍTICO: Salvar payload EXATAMENTE como recebido
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

        const job = await base44.asServiceRole.entities.MetaJobsQueue.create(jobData);

        console.log(`✅ Job enfileirado: ${job.job_id} | date_mode=${job.date_mode} | since=${job.since} | until=${job.until}`);

        return Response.json({
            success: true,
            message: 'Job enfileirado com sucesso',
            job_id: job.job_id,
            queue_key: job.queue_key,
            status: job.status,
            date_mode: job.date_mode,
            since: job.since,
            until: job.until
        });

    } catch (error) {
        console.error('❌ Erro ao enfileirar job:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});