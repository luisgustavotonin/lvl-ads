import React from 'react';
import { Loader2, Trash2 } from 'lucide-react';

export default function DeleteProgressOverlay({ message, progress, total, currentLabel }) {
  const pct = total > 0 ? Math.round((progress / total) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 text-center space-y-5">
        <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-50 rounded-full">
          <Trash2 className="w-8 h-8 text-red-500" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-gray-900">Excluindo dados…</h2>
          {currentLabel && (
            <p className="text-sm text-gray-500 mt-1">
              Processando: <strong>{currentLabel}</strong>
            </p>
          )}
          {message && (
            <p className="text-sm text-gray-400 mt-1">{message}</p>
          )}
        </div>

        {pct !== null ? (
          <div className="space-y-2">
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-red-500 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {progress} de {total} tabelas ({pct}%)
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
        )}

        <p className="text-xs text-gray-400">Por favor, não feche esta janela.</p>
      </div>
    </div>
  );
}