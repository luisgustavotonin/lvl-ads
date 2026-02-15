import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Exclusão em cascata de Jobs e dados relacionados
 * 
 * Exclui:
 * 1. MetaJobsResults (job principal)
 * 2. MetaAdDaily (dados detalhados vinculados pelo run_id ou job_id)
 * 3. MetricsDaily (métricas agregadas da unidade - opcional recalcular)
 * 4. ExecutionLog (logs relacionados)
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Autenticar usuário
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { job_ids, unit_id } = await req.json();

        if (!job_ids || !Array.isArray(job_ids) || job_ids.length === 0) {
            return Response.json({ 
                error: 'job_ids (array) obrigatório' 
            }, { status: 400 });
        }

        if (!unit_id) {
            return Response.json({ 
                error: 'unit_id obrigatório' 
            }, { status: 400 });
        }

        console.log(`🗑️ Iniciando exclusão em cascata de ${job_ids.length} jobs da unidade ${unit_id}`);

        let deletedResults = 0;
        let deletedAdDaily = 0;
        let deletedLogs = 0;
        const errors = [];

        // 1️⃣ Buscar todos os jobs a excluir e validar unit_id
        const jobResults = await base44.asServiceRole.entities.MetaJobsResults.filter({
            id: { $in: job_ids },
            unit_id: unit_id
        });

        if (jobResults.length !== job_ids.length) {
            return Response.json({
                error: 'Alguns jobs não pertencem a esta unidade ou não existem',
                found: jobResults.length,
                requested: job_ids.length
            }, { status: 403 });
        }

        // Extrair job_ids reais e run_ids dos resultados
        const jobIdsToDelete = jobResults.map(j => j.job_id);
        const resultIdsToDelete = jobResults.map(j => j.id);

        console.log(`✅ Validado: ${jobResults.length} jobs pertencem à unidade ${unit_id}`);

        // 2️⃣ Excluir MetaAdDaily vinculados (por job_id ou run_id se existir)
        try {
            // Buscar todos os registros MetaAdDaily relacionados
            const adDailyRecords = await base44.asServiceRole.entities.MetaAdDaily.filter({
                unit_id: unit_id
                // Não podemos filtrar por job_id diretamente pois MetaAdDaily não tem esse campo
                // Precisamos usar run_id se disponível
            });

            // Filtrar por run_id se os jobs tiverem esse campo
            const runIds = jobResults.map(j => j.run_id).filter(Boolean);
            let recordsToDelete = [];

            if (runIds.length > 0) {
                recordsToDelete = adDailyRecords.filter(record => 
                    runIds.includes(record.run_id)
                );
            }

            // Excluir em lotes
            if (recordsToDelete.length > 0) {
                console.log(`🗑️ Excluindo ${recordsToDelete.length} registros de MetaAdDaily...`);
                
                const batchSize = 100;
                for (let i = 0; i < recordsToDelete.length; i += batchSize) {
                    const batch = recordsToDelete.slice(i, i + batchSize);
                    const results = await Promise.allSettled(
                        batch.map(r => base44.asServiceRole.entities.MetaAdDaily.delete(r.id))
                    );
                    const succeeded = results.filter(r => r.status === 'fulfilled').length;
                    deletedAdDaily += succeeded;
                }
                console.log(`✅ ${deletedAdDaily} registros de MetaAdDaily excluídos`);
            }
        } catch (error) {
            console.error('⚠️ Erro ao excluir MetaAdDaily:', error.message);
            errors.push(`MetaAdDaily: ${error.message}`);
        }

        // 3️⃣ Excluir ExecutionLog relacionados (se houver integration_id ou outros vínculos)
        try {
            // Buscar logs da unidade
            const logsToDelete = await base44.asServiceRole.entities.ExecutionLog.filter({
                unit_id: unit_id,
                log_type: 'integration_execution'
            });

            if (logsToDelete.length > 0) {
                console.log(`🗑️ Excluindo ${logsToDelete.length} logs de execução...`);
                
                const batchSize = 100;
                for (let i = 0; i < logsToDelete.length; i += batchSize) {
                    const batch = logsToDelete.slice(i, i + batchSize);
                    const results = await Promise.allSettled(
                        batch.map(log => base44.asServiceRole.entities.ExecutionLog.delete(log.id))
                    );
                    const succeeded = results.filter(r => r.status === 'fulfilled').length;
                    deletedLogs += succeeded;
                }
                console.log(`✅ ${deletedLogs} logs excluídos`);
            }
        } catch (error) {
            console.error('⚠️ Erro ao excluir logs:', error.message);
            errors.push(`ExecutionLog: ${error.message}`);
        }

        // 4️⃣ Excluir MetaJobsResults (jobs principais)
        try {
            console.log(`🗑️ Excluindo ${resultIdsToDelete.length} jobs principais...`);
            
            const batchSize = 100;
            for (let i = 0; i < resultIdsToDelete.length; i += batchSize) {
                const batch = resultIdsToDelete.slice(i, i + batchSize);
                const results = await Promise.allSettled(
                    batch.map(id => base44.asServiceRole.entities.MetaJobsResults.delete(id))
                );
                const succeeded = results.filter(r => r.status === 'fulfilled').length;
                deletedResults += succeeded;
            }
            console.log(`✅ ${deletedResults} jobs principais excluídos`);
        } catch (error) {
            console.error('❌ Erro ao excluir MetaJobsResults:', error.message);
            errors.push(`MetaJobsResults: ${error.message}`);
        }

        // 5️⃣ Opcional: Reagregar métricas da unidade
        try {
            console.log('🔄 Recalculando métricas agregadas...');
            await base44.asServiceRole.functions.invoke('aggregateMetaAdDaily', { unit_id });
            console.log('✅ Métricas recalculadas');
        } catch (error) {
            console.warn('⚠️ Erro ao recalcular métricas (não fatal):', error.message);
        }

        const summary = {
            success: errors.length === 0,
            deleted: {
                jobs: deletedResults,
                ad_daily: deletedAdDaily,
                logs: deletedLogs
            },
            requested: job_ids.length,
            errors: errors.length > 0 ? errors : null
        };

        console.log('✅ Exclusão em cascata concluída:', summary);

        return Response.json(summary);

    } catch (error) {
        console.error('❌ Erro na exclusão em cascata:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});