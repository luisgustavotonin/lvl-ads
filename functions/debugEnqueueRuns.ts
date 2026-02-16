import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        console.log('🟣 ========== DEBUG ENQUEUE RUNS ==========');
        console.log('🟣 Run ID:', payload.run_id);
        console.log('🟣 Expected Jobs:', payload.expected_jobs);
        console.log('🟣 Received Jobs:', payload.jobs?.length || 0);
        console.log('🟣 Payload:', JSON.stringify(payload, null, 2));
        console.log('🟣 =========================================');

        const { run_id, payload_hash, expected_jobs, unit_id, account_id, jobs = [] } = payload;

        if (!run_id || !payload_hash || !expected_jobs) {
            return Response.json({ 
                error: 'Missing required fields: run_id, payload_hash, expected_jobs' 
            }, { status: 400 });
        }

        // Verificar se run_id já existe (idempotência)
        const existingRuns = await base44.asServiceRole.entities.MetaEnqueueRuns.filter({ run_id });
        
        let enqueueRun;
        if (existingRuns.length > 0) {
            enqueueRun = existingRuns[0];
            console.log('⚠️ Run já existe, atualizando received_jobs_count');
            
            // Atualizar apenas o count
            await base44.asServiceRole.entities.MetaEnqueueRuns.update(enqueueRun.id, {
                received_jobs_count: jobs.length
            });
        } else {
            // Criar novo run
            enqueueRun = await base44.asServiceRole.entities.MetaEnqueueRuns.create({
                run_id,
                source: 'n8n_dispatcher',
                received_at: new Date().toISOString(),
                unit_id: unit_id || null,
                account_id: account_id || null,
                payload_hash,
                expected_jobs,
                received_jobs_count: jobs.length,
                raw_payload_json: payload
            });
        }

        // Inserir items (verificar duplicados)
        const itemsToCreate = [];
        const duplicates = [];

        for (const job of jobs) {
            const jobKey = job.job_key || `${job.unit_id}|${job.account_id}|${job.since}|${job.until}|${job.job_type}|${job.breakdown || ''}`;
            
            // Verificar se job_key já existe
            const existingItems = await base44.asServiceRole.entities.MetaEnqueueRunItems.filter({ job_key: jobKey });
            const isDuplicate = existingItems.length > 0;
            
            if (isDuplicate) {
                duplicates.push(jobKey);
            }

            itemsToCreate.push({
                run_id,
                job_key: jobKey,
                job_type: job.job_type,
                breakdown: job.breakdown || null,
                since: job.since,
                until: job.until,
                unit_id: job.unit_id,
                account_id: job.account_id,
                job_id_sent: job.job_id_sent,
                is_duplicate: isDuplicate
            });
        }

        // Criar todos os items
        if (itemsToCreate.length > 0) {
            await base44.asServiceRole.entities.MetaEnqueueRunItems.bulkCreate(itemsToCreate);
        }

        console.log('✅ Debug enqueue registrado:', {
            run_id,
            expected: expected_jobs,
            received: jobs.length,
            duplicates: duplicates.length
        });

        return Response.json({
            ok: true,
            run_id,
            received_jobs_count: jobs.length,
            expected_jobs,
            divergence: jobs.length !== expected_jobs,
            duplicates: duplicates.length,
            duplicate_keys: duplicates
        });

    } catch (error) {
        console.error('❌ Erro em debugEnqueueRuns:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});