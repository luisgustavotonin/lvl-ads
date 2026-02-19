import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EXCLUDED_KEYS = ['id', 'created_date', 'updated_date', 'created_by'];

const NUM_KEYS = new Set([
  'spend','impressions','reach','frequency','clicks','link_clicks',
  'ctr_link','cpc_link','cpm','wa_conversations_started_7d',
  'wa_total_messaging_connection','wa_messaging_first_reply',
  'cost_per_conversation','cost_per_total_contact','cost_per_first_reply',
]);

const CURRENCY_KEYS = new Set(['spend','cpc_link','cpm','cost_per_conversation','cost_per_total_contact','cost_per_first_reply','facebook_spend','instagram_spend','audience_network_spend','messenger_spend','android_spend','iphone_spend','ipad_spend','desktop_spend','male_spend','female_spend']);
const PERCENT_KEYS  = new Set(['ctr_link']);

export default function SubTabTable({ data, subTab, pageSize = 25, currentPage, setCurrentPage, formatValue, formatDateString, formatCurrency }) {
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const cols = useMemo(() => {
    if (!data.length) return [];
    return Object.keys(data[0]).filter(k => !EXCLUDED_KEYS.includes(k) && !k.startsWith('_'));
  }, [data]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av || '').localeCompare(String(bv || '')) : String(bv || '').localeCompare(String(av || ''));
    });
  }, [data, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const fmtCell = (key, val) => {
    if (val == null || val === '') return '-';
    if (key === 'date') return formatDateString(val);
    if (CURRENCY_KEYS.has(key)) return formatCurrency(val);
    if (PERCENT_KEYS.has(key)) return `${(val * 100).toFixed(2)}%`;
    if (typeof val === 'number') return val % 1 === 0 ? new Intl.NumberFormat('pt-BR').format(val) : val.toFixed(2);
    return String(val);
  };

  const isNumericCol = (key) => {
    return CURRENCY_KEYS.has(key) || PERCENT_KEYS.has(key) || NUM_KEYS.has(key) || (data.length && typeof data[0][key] === 'number');
  };

  if (!data.length) return null;

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        Exibindo {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, sorted.length)} de {sorted.length} registros
      </div>

      <div className="overflow-x-auto border rounded-lg max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b sticky top-0 z-10">
            <tr>
              {cols.map(col => (
                <th
                  key={col}
                  className="px-2 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort(col)}
                >
                  {col} <SortIcon field={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginated.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {cols.map(col => (
                  <td key={col} className={`px-2 py-2 ${isNumericCol(col) ? 'text-right' : 'text-left'}`}>
                    {fmtCell(col, row[col])}
                  </td>
                ))}
              </tr>
            ))}
            {/* Totais */}
            <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200 sticky bottom-0">
              {cols.map((col, i) => {
                if (i === 0) return <td key={col} className="px-2 py-2 text-gray-700">TOTAL</td>;
                if (!isNumericCol(col)) return <td key={col} className="px-2 py-2 text-center text-gray-400">-</td>;
                const sum = paginated.reduce((acc, row) => acc + (parseFloat(row[col]) || 0), 0);
                return <td key={col} className="px-2 py-2 text-right">{fmtCell(col, sum)}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">Página {currentPage} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}