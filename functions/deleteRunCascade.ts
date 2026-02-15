import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * EXCLUSÃO EM CASCATA DEFINITIVA
 * Remove RUN e TODOS os dados vinculados
 * SEM EXCEÇÃO
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { run_ids, unit_id } = await req.json();

        if (!run_ids || !Array.isArray(run_ids) || run_ids.length === 0) {
            return Response.json({ 
                error: 'run_ids (array) obrigatório' 
            }, { status: 400 });
        }

        if (!unit_id) {
            return Response.json({ 
                error: 'unit_id obrigatório para validação' 
            }, { status: 400 });
        }

        console.log(`🗑️ Iniciando exclusão DEFINITIVA de ${run_ids.length} RUNs`);

        const deleted = {
            runs: 0,
            jobs: 0,
            ad_daily: 0,
            metrics_daily: 0,
            logs: 0
        };
        const errors = [];

        // 1️⃣ VALIDAR QUE TODOS OS RUNS PERTENCEM À UNIDADE
        const runs = await base44.asServiceRole.entities.Run.filter({
            run_id: { $in: run_ids },
            unit_id: unit_id
        });

        if (runs.length !== run_ids.length) {
            return Response.json({
                error: 'Alguns RUNs não pertencem a esta unidade',
                found: runs.length,
                requested: run_ids.length
            }, { status: 403 });
        }

        console.log(`✅ Validado: ${runs.length} RUNs da unidade ${unit_id}`);

        // 2️⃣ EXCLUIR MetaAdDaily (dados detalhados)
        try {
            const adDaily = await base44.asServiceRole.entities.MetaAdDaily.filter({
                run_id: { $in: run_ids },
                unit_id: unit_id
            }, null, 50000);

            console.log(`📊 ${adDaily.length} registros MetaAdDaily para excluir`);

            if (adDaily.length > 0) {
                const batchSize = 100;
                for (let i = 0; i < adDaily.length; i += batchSize) {
                    const batch = adDaily.slice(i, i + batchSize);
                    const results = await Promise.allSettled(
                        batch.map(r => base44.asServiceRole.entities.MetaAdDaily.delete(r.id))
                    );
                    deleted.ad_daily += results.filter(r => r.status === 'fulfilled').length;
                }
                console.log(`✅ ${deleted.ad_daily} MetaAdDaily excluídos`);
            }
        } catch (error) {
            console.error('⚠️ Erro ao excluir MetaAdDaily:', error.message);
            errors.push(`MetaAdDaily: ${error.message}`);
        }

        // 3️⃣ EXCLUIR JOBS
        try {
            const jobs = await base44.asServiceRole.entities.Job.filter({
                run_id: { $in: run_ids },
                unit_id: unit_id
            });

            console.log(`📊 ${jobs.length} Jobs para excluir`);

            if (jobs.length > 0) {
                const batchSize = 100;
                for (let i = 0; i < jobs.length; i += batchSize) {
                    const batch = jobs.slice(i, i + batchSize);
                    const results = await Promise.allSettled(
                        batch.map(j => base44.asServiceRole.entities.Job.delete(j.id))
                    );
                    deleted.jobs += results.filter(r => r.status === 'fulfilled').length;
                }
                console.log(`✅ ${deleted.jobs} Jobs excluídos`);
            }
        } catch (error) {
            console.error('⚠️ Erro ao excluir Jobs:', error.message);
            errors.push(`Jobs: ${error.message}`);
        }

        // 4️⃣ EXCLUIR RUNS
        try {
            for (const run of runs) {
                await base44.asServiceRole.entities.Run.delete(run.id);
                deleted.runs++;
            }
            console.log(`✅ ${deleted.runs} RUNs excluídos`);
        } catch (error) {
            console.error('⚠️ Erro ao excluir RUNs:', error.message);
            errors.push(`Runs: ${error.message}`);
        }

        // 5️⃣ LIMPAR MetricsDaily (métricas agregadas órfãs)
        try {
            const metrics = await base44.asServiceRole.entities.MetricsDaily.filter({
                unit_id: unit_id
            });

            if (metrics.length > 0) {
                console.log(`🗑️ Limpando ${metrics.length} MetricsDaily órfãos`);
                const batchSize = 100;
                for (let i = 0; i < metrics.length; i += batchSize) {
                    const batch = metrics.slice(i, i + batchSize);
                    const results = await Promise.allSettled(
                        batch.map(m => base44.asServiceRole.entities.MetricsDaily.delete(m.id))
                    );
                    deleted.metrics_daily += results.filter(r => r.status === 'fulfilled').length;
                }
                console.log(`✅ ${deleted.metrics_daily} MetricsDaily limpos`);
            }
        } catch (error) {
            console.warn('⚠️ Erro ao limpar MetricsDaily:', error.message);
        }

        // 6️⃣ RECALCULAR MÉTRICAS DA UNIDADE (se ainda houver dados)
        try {
            console.log('🔄 Verificando se há dados restantes...');
            const remainingData = await base44.asServiceRole.entities.MetaAdDaily.filter({
                unit_id: unit_id
            }, null, 1);

            if (remainingData.length > 0) {
                console.log('🔄 Recalculando métricas...');
                await base44.asServiceRole.functions.invoke('aggregateMetaAdDaily', { unit_id });
                console.log('✅ Métricas recalculadas');
            } else {
                console.log('✅ Nenhum dado restante, banco limpo para esta unidade');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao recalcular métricas:', error.message);
        }

        const summary = {
            success: errors.length === 0,
            deleted,
            requested_runs: run_ids.length,
            errors: errors.length > 0 ? errors : null
        };

        console.log('✅ EXCLUSÃO DEFINITIVA CONCLUÍDA:', summary);

        return Response.json(summary);

    } catch (error) {
        console.error('❌ Erro na exclusão:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});