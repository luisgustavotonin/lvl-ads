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

        return (
          <div key={stage.key} className="w-full flex flex-col items-center">
            <div 
              className={`w-full bg-gradient-to-r ${stage.color} rounded-lg py-6 px-8 text-center shadow-sm`}
              style={{ 
                maxWidth: `${100 - (idx * 15)}%`,
                transition: 'all 0.3s ease'
              }}
            >
              <div className="text-white font-medium mb-1">{stage.label}</div>
              <div className="text-white text-2xl font-bold mb-2">
                {formatNumber(stage.value)}
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
              <div className="h-2 w-0.5 bg-gradient-to-b from-blue-300 to-blue-400" />
            )}
          </div>
        );
      })}
    </div>
  );
}