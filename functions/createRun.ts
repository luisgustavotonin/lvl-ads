import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Criar novo RUN (batch de execução)
 * Garante isolamento completo entre execuções
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { 
            unit_id, 
            platform,
            date_start, 
            date_end,
            date_filter_type = 'ad_date',
            trigger_type = 'manual',
            metadata = {}
        } = await req.json();

        if (!unit_id || !platform || !date_start || !date_end) {
            return Response.json({ 
                error: 'Campos obrigatórios: unit_id, platform, date_start, date_end' 
            }, { status: 400 });
        }

        // Gerar UUID para o RUN
        const run_id = crypto.randomUUID();
        const now = new Date().toISOString();

        // Criar registro do RUN
        const run = await base44.entities.Run.create({
            run_id,
            unit_id,
            platform,
            date_start,
            date_end,
            date_filter_type,
            trigger_type,
            status: 'queued',
            started_at_utc: now,
            metadata
        });

        console.log(`✅ RUN criado: ${run_id}`);

        // Log de execução
        await base44.entities.ExecutionLog.create({
            unit_id,
            log_type: 'integration_execution',
            execution_type: trigger_type,
            execution_status: 'completed',
            execution_time: now,
            platform,
            message: `RUN ${run_id} criado`
        });

        return Response.json({
            success: true,
            run_id,
            run
        });

    } catch (error) {
        console.error('❌ Erro ao criar RUN:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});