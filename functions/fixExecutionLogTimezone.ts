import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Script de migração para corrigir timestamps do ExecutionLog
 * 
 * PROBLEMA: Registros antigos foram salvos como se fossem UTC, mas representavam horário local (America/Sao_Paulo)
 * SOLUÇÃO: Somar +3 horas em todos os execution_time anteriores à correção
 * 
 * ATENÇÃO: Executar apenas uma vez!
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Autenticar usuário admin
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ 
                error: 'Forbidden: Admin access required' 
            }, { status: 403 });
        }

        const { cutoff_date, dry_run = true } = await req.json();

        // Data de corte: registros anteriores a esta data serão corrigidos
        // Exemplo: "2026-02-15T00:00:00Z" (antes da correção do código)
        if (!cutoff_date) {
            return Response.json({
                error: 'cutoff_date obrigatório (ex: 2026-02-15T00:00:00Z)',
                dry_run_info: 'Use dry_run=true para preview sem alterar dados'
            }, { status: 400 });
        }

        console.log(`🔍 Buscando logs anteriores a ${cutoff_date}...`);

        // Buscar todos os logs antes da data de corte
        const allLogs = await base44.asServiceRole.entities.ExecutionLog.list();
        const logsToFix = allLogs.filter(log => {
            const logDate = new Date(log.execution_time);
            const cutoffDate = new Date(cutoff_date);
            return logDate < cutoffDate;
        });

        console.log(`📊 Encontrados ${logsToFix.length} registros para corrigir`);

        if (logsToFix.length === 0) {
            return Response.json({
                success: true,
                message: 'Nenhum registro para corrigir',
                total_analyzed: allLogs.length
            });
        }

        const corrections = [];
        let corrected = 0;
        let errors = 0;

        for (const log of logsToFix) {
            try {
                const oldDate = new Date(log.execution_time);
                
                // Somar +3 horas (180 minutos) para corrigir UTC -> America/Sao_Paulo
                const newDate = new Date(oldDate.getTime() + (3 * 60 * 60 * 1000));
                
                corrections.push({
                    id: log.id,
                    old_time: oldDate.toISOString(),
                    new_time: newDate.toISOString(),
                    old_display: oldDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
                    new_display: newDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                });

                if (!dry_run) {
                    await base44.asServiceRole.entities.ExecutionLog.update(log.id, {
                        execution_time: newDate.toISOString()
                    });
                    console.log(`✅ Corrigido: ${log.id} | ${oldDate.toISOString()} → ${newDate.toISOString()}`);
                }
                
                corrected++;
            } catch (error) {
                console.error(`❌ Erro ao corrigir log ${log.id}:`, error.message);
                errors++;
            }
        }

        return Response.json({
            success: true,
            dry_run: dry_run,
            message: dry_run 
                ? 'Preview: nenhuma alteração foi feita (use dry_run=false para aplicar)' 
                : `${corrected} registros corrigidos com sucesso`,
            total_analyzed: allLogs.length,
            total_to_fix: logsToFix.length,
            corrected: corrected,
            errors: errors,
            sample_corrections: corrections.slice(0, 10), // Primeiros 10 como amostra
            instructions: dry_run 
                ? 'Revise os resultados e execute novamente com dry_run=false para aplicar' 
                : 'Migração concluída! Verifique o histórico de execuções.'
        });

    } catch (error) {
        console.error('❌ Erro na migração:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});