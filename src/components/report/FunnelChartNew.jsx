import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Pencil } from 'lucide-react';

const COLOR_OPTIONS = [
  '#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#06B6D4',
  '#EF4444','#6366F1','#EAB308','#84CC16','#059669','#1D4ED8',
  '#14B8A6','#D946EF','#D97706','#F97316','#7C3AED','#6B7280',
];

const STORAGE_KEY_FUNNEL_COLORS = 'funnel_chart_colors';
const loadFunnelColors = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_FUNNEL_COLORS)) || {}; } catch { return {}; }
};

export default function FunnelChartNew({ current, previous, stages: configStages }) {
  const [customColors, setCustomColors] = useState(loadFunnelColors);
  const [editingIdx, setEditingIdx] = useState(null);
  const DEFAULT_COLORS = ['#93C5FD','#60A5FA','#3B82F6','#2563EB','#1D4ED8','#1E40AF','#1e3a8a'];

  const handleColorChange = (idx, color) => {
    const next = { ...customColors, [idx]: color };
    setCustomColors(next);
    localStorage.setItem(STORAGE_KEY_FUNNEL_COLORS, JSON.stringify(next));
    setEditingIdx(null);
  };

  const CURRENCY_KEYS = ['spend', 'cpcLink', 'cpm', 'costPerConversation', 'costPerTotalContact', 'costPerFirstReply'];

  const stages = configStages.map((stage, idx) => ({
    key: stage.key,
    label: stage.label,
    value: current[stage.key] || 0,
    prevValue: previous?.[stage.key] || 0,
    color: customColors[idx] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    isCurrency: CURRENCY_KEYS.includes(stage.key),
  }));

  const formatNumber = (v, isCurrency = false) => {
    if (isCurrency) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    return new Intl.NumberFormat('pt-BR').format(Math.round(v));
  };

  const getVariation = (current, previous) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="flex flex-col items-center gap-1 py-8">
      {stages.map((stage, idx) => {
        const variation = getVariation(stage.value, stage.prevValue);
        const isPositive = variation > 0;
        const isNegative = variation < 0;
        const bgColor = stage.color;

        return (
          <div key={stage.key} className="w-full flex flex-col items-center">
            <div 
              className="w-full rounded-lg py-6 px-8 text-center shadow-sm relative"
              style={{ 
                maxWidth: `${100 - (idx * 12)}%`,
                backgroundColor: bgColor,
                transition: 'all 0.3s ease'
              }}
            >
              {/* Botão de editar cor - sempre visível */}
              <button
                onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                className="absolute top-2 right-2 p-1 rounded hover:bg-white/20 transition-colors"
                title="Editar cor"
              >
                <Pencil className="w-3 h-3 text-white/70" />
              </button>

              {/* Color picker */}
              {editingIdx === idx && (
                <div className="absolute top-8 right-2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-48" onClick={e => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Escolher cor</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => handleColorChange(idx, c)}
                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ backgroundColor: c, borderColor: bgColor === c ? '#000' : 'transparent' }}
                      />
                    ))}
                  </div>
                  <button onClick={() => setEditingIdx(null)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 w-full text-right">fechar</button>
                </div>
              )}

              <div className="text-white font-medium mb-1">{stage.label}</div>
              <div className="text-white text-2xl font-bold mb-2">
                {formatNumber(stage.value, stage.isCurrency)}
              </div>
              {variation !== null && (
                <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                  isPositive ? 'text-green-200' : isNegative ? 'text-red-200' : 'text-white'
                }`}>
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : isNegative ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : null}
                  <span>{isPositive ? '+' : ''}{variation.toFixed(1)}%</span>
                </div>
              )}
            </div>
            {idx < stages.length - 1 && (
              <div className="h-2 w-0.5 bg-gray-300" />
            )}
          </div>
        );
      })}
    </div>
  );
}