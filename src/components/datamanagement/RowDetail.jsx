import React from 'react';

const BUILTIN_KEYS = ['id', 'created_date', 'updated_date', 'created_by_id'];

function formatScalar(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v);
}

// Mostra TODOS os campos de um registro (inclusive actions_map, action_values_map e raw)
// para auditoria dos dados baixados da API.
export default function RowDetail({ row }) {
  const entries = Object.entries(row || {}).filter(([key]) => !BUILTIN_KEYS.includes(key));
  const scalars = entries.filter(([, v]) => v === null || typeof v !== 'object');
  const objects = entries.filter(([, v]) => v !== null && typeof v === 'object');

  return (
    <div className="bg-gray-50 p-4 text-xs space-y-4">
      <div>
        <p className="font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Todos os campos ({entries.length})
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {scalars.map(([key, value]) => (
            <div key={key} className="bg-white rounded border p-2">
              <p className="text-gray-400 font-mono text-[10px] truncate">{key}</p>
              <p className="text-gray-800 font-medium break-all">{formatScalar(value)}</p>
            </div>
          ))}
        </div>
      </div>
      {objects.map(([key, value]) => (
        <div key={key}>
          <p className="font-mono font-semibold text-gray-500 mb-1">{key}</p>
          <pre className="bg-white border rounded p-2 overflow-auto max-h-64 text-[11px] leading-relaxed whitespace-pre-wrap break-all">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}