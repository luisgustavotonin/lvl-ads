import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Watchdog: Detecta Runs com status "sent" ou "receiving" há mais de 15 minutos
 * e os marca como "timeout"
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Verificar se veio do scheduler (sem user) ou de admin
        const isScheduled = req.headers.get('x-base44-scheduled') === 'true';
        if (!isScheduled) {
            const user = await base44.auth.me();
            if (!user || user.role !== 'admin') {
                return Response.json({ error: 'Acesso negado' }, { status: 403 });
            }
        }

        const now = new Date();
        const timeoutThresholdMs = 15 * 60 * 1000; // 15 minutos

        // Buscar runs com status "sent" ou "receiving"
        const pendingRuns = await base44.asServiceRole.entities.Run.filter({
            status: { $in: ['sent', 'receiving'] }
        }, '-created_date', 200);

        let timedOut = 0;

        for (const run of pendingRuns) {
            const createdAt = new Date(run.started_at_utc || run.created_date);
            const ageMs = now.getTime() - createdAt.getTime();

            if (ageMs > timeoutThresholdMs) {
                await base44.asServiceRole.entities.Run.update(run.id, {
                    status: 'timeout',
                    error_message: `N8N não retornou dados após ${Math.round(ageMs / 60000)} minutos`
                });

                // Atualizar ExecutionLog correspondente
                try {
                    const execLogs = await base44.asServiceRole.entities.ExecutionLog.filter({
                        unit_id: run.unit_id,
                        message: { $regex: run.run_id?.substring(0, 8) }
                    });
                    for (const log of execLogs) {
                        if (log.message.includes('[SENT]')) {
                            await base44.asServiceRole.entities.ExecutionLog.update(log.id, {
                                message: log.message.replace('[SENT]', '[TIMEOUT]'),
                                error_details: `N8N não retornou dados após ${Math.round(ageMs / 60000)} minutos`
                            });
                        }
                    }
                } catch (_) {}

                timedOut++;
                console.log(`⏰ Run ${run.run_id?.substring(0, 8)} marcado como timeout (${Math.round(ageMs / 60000)} min)`);
            }
        }

        return Response.json({
            ok: true,
            checked: pendingRuns.length,
            timed_out: timedOut,
            checked_at: now.toISOString()
        });

    } catch (error) {
        console.error('❌ Erro no watchdog:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
});