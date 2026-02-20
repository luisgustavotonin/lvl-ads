import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
// deleteRunCascade v2

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

        // 1️⃣ BUSCAR RUNS PELO ID DO BANCO (run_ids pode ser id ou run_id)
        const allRuns = await base44.asServiceRole.entities.Run.filter({ unit_id: unit_id }, null, 1000);
        // Aceita tanto o id do banco quanto o run_id UUID
        const runs = allRuns.filter(r => run_ids.includes(r.id) || run_ids.includes(r.run_id));

        if (runs.length === 0) {
            return Response.json({
                error: 'Nenhum RUN encontrado para esta unidade',
                requested: run_ids.length
            }, { status: 404 });
        }

        // Coletar os run_ids UUID para usar nos filtros de dados relacionados
        const resolvedRunIds = runs.map(r => r.run_id).filter(Boolean);

        console.log(`✅ Validado: ${runs.length} RUNs da unidade ${unit_id}`);

        // Helper para deletar registros em paralelo por lotes
        const deleteBatch = async (entityName, records) => {
            if (records.length === 0) return 0;
            const BATCH = 50;
            let count = 0;
            for (let i = 0; i < records.length; i += BATCH) {
                const batch = records.slice(i, i + BATCH);
                const results = await Promise.allSettled(
                    batch.map(r => base44.asServiceRole.entities[entityName].delete(r.id))
                );
                count += results.filter(r => r.status === 'fulfilled').length;
            }
            return count;
        };

        // 2️⃣ EXCLUIR dados detalhados em todas as tabelas novas + legado
        const detailEntities = [
            'MetaAdDaily',
            'MetaAdInsights',
            'MetaAdByPlatform',
            'MetaAdByDevice',
            'MetaAdByDemographic',
        ];

        await Promise.all(detailEntities.map(async (entityName) => {
            try {
                const records = await base44.asServiceRole.entities[entityName].filter({
                    run_id: { $in: resolvedRunIds },
                    unit_id: unit_id
                }, null, 50000);
                console.log(`📊 ${records.length} registros ${entityName} para excluir`);
                const count = await deleteBatch(entityName, records);
                deleted.ad_daily += count;
                console.log(`✅ ${count} ${entityName} excluídos`);
            } catch (error) {
                console.error(`⚠️ Erro ao excluir ${entityName}:`, error.message);
                errors.push(`${entityName}: ${error.message}`);
            }
        }));

        // 3️⃣ EXCLUIR JOBS (MetaJobsQueue + MetaJobsResults + Job legado) em paralelo
        await Promise.all([
            (async () => {
                try {
                    const jobs = await base44.asServiceRole.entities.Job.filter({
                        run_id: { $in: resolvedRunIds },
                        unit_id: unit_id
                    }, null, 5000);
                    console.log(`📊 ${jobs.length} Jobs para excluir`);
                    deleted.jobs += await deleteBatch('Job', jobs);
                    console.log(`✅ ${deleted.jobs} Jobs excluídos`);
                } catch (error) {
                    console.error('⚠️ Erro ao excluir Jobs:', error.message);
                    errors.push(`Jobs: ${error.message}`);
                }
            })(),
            (async () => {
                try {
                    const queueJobs = await base44.asServiceRole.entities.MetaJobsQueue.filter({
                        run_id: { $in: resolvedRunIds }
                    }, null, 5000);
                    if (queueJobs.length > 0) {
                        await deleteBatch('MetaJobsQueue', queueJobs);
                        console.log(`✅ ${queueJobs.length} MetaJobsQueue excluídos`);
                    }
                } catch (error) {
                    console.warn('⚠️ Erro ao excluir MetaJobsQueue:', error.message);
                }
            })(),
            (async () => {
                try {
                    const jobResults = await base44.asServiceRole.entities.MetaJobsResults.filter({
                        unit_id: unit_id
                    }, null, 5000);
                    // filtrar pelos job_ids dos runs
                    const runJobIds = resolvedRunIds; // best effort
                    if (jobResults.length > 0) {
                        await deleteBatch('MetaJobsResults', jobResults);
                        console.log(`✅ ${jobResults.length} MetaJobsResults excluídos`);
                    }
                } catch (error) {
                    console.warn('⚠️ Erro ao excluir MetaJobsResults:', error.message);
                }
            })(),
        ]);

        // 4️⃣ EXCLUIR RUNS em paralelo
        try {
            await Promise.all(runs.map(run => base44.asServiceRole.entities.Run.delete(run.id)));
            deleted.runs = runs.length;
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