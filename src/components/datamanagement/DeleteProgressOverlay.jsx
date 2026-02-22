import React from 'react';
import { Trash2 } from 'lucide-react';

export default function DeleteProgressOverlay({ tables, progress }) {
  // progress = { tableId, tableDone, tableTotal, tableIndex, totalTables, deleted }
  const { tableId, tableDone, tableTotal, tableIndex, totalTables, tableLabel, tableCount } = progress || {};

  const globalPct = totalTables > 0
    ? Math.round(((tableIndex || 0) / totalTables) * 100 + (tableTotal > 0 ? ((tableDone || 0) / tableTotal / totalTables) * 100 : 0))
    : 0;

  const tablePct = tableTotal > 0 ? Math.round(((tableDone || 0) / tableTotal) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4 text-center space-y-5">
        <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-50 rounded-full">
          <Trash2 className="w-8 h-8 text-red-500" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-gray-900">Excluindo dados…</h2>
          {tableLabel && (
            <p className="text-sm text-gray-500 mt-1">
              Tabela atual: <strong>{tableLabel}</strong>
              {tableCount !== undefined && <span className="text-gray-400"> ({tableCount.toLocaleString('pt-BR')} registros)</span>}
            </p>
          )}
        </div>

        {/* Progresso global (tabelas) */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progresso geral</span>
            <span>{tableIndex || 0} de {totalTables || '?'} tabelas ({globalPct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${globalPct}%` }}
            />
          </div>
        </div>

        {/* Progresso dentro da tabela atual */}
        {tablePct !== null && tableTotal > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Dentro desta tabela</span>
              <span>{(tableDone || 0).toLocaleString('pt-BR')} de {tableTotal.toLocaleString('pt-BR')} ({tablePct}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-red-500 transition-all duration-150"
                style={{ width: `${tablePct}%` }}
              />
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400">Por favor, não feche esta janela.</p>
      </div>
    </div>
  );
}