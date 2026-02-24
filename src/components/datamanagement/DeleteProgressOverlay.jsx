import React from 'react';
import { Trash2 } from 'lucide-react';

export default function DeleteProgressOverlay({ progress }) {
  // progress = { tableIndex, totalTables, tableLabel, tableDone }
  const { tableIndex = 0, totalTables = 1, tableLabel = '', tableDone = 0 } = progress || {};

  const globalPct = totalTables > 0
    ? Math.round((tableIndex / totalTables) * 100)
    : 0;

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
            </p>
          )}
          {tableDone > 0 && (
            <p className="text-sm text-blue-600 font-medium mt-1">
              {tableDone.toLocaleString('pt-BR')} registros excluídos nesta tabela
            </p>
          )}
        </div>

        {/* Progresso global (tabelas concluídas) */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progresso geral</span>
            <span>{tableIndex} de {totalTables} tabelas ({globalPct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${globalPct}%` }}
            />
          </div>
        </div>

        {/* Barra animada da tabela atual */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Tabela atual</span>
            <span>Em andamento…</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-red-400 animate-pulse" style={{ width: '100%' }} />
          </div>
        </div>

        <p className="text-xs text-gray-400">Por favor, não feche esta janela.</p>
      </div>
    </div>
  );
}