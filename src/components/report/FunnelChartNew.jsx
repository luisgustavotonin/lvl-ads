import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const COLOR_PALETTE = [
  '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF',
  '#10B981', '#059669', '#047857',
  '#8B5CF6', '#7C3AED', '#6D28D9',
  '#F59E0B', '#D97706', '#B45309',
  '#EF4444', '#DC2626', '#B91C1C',
  '#EC4899', '#DB2777', '#BE185D',
  '#06B6D4', '#0891B2', '#0E7490',
  '#F97316',
];

export default function FunnelChartNew({ current, previous, stages: configStages, onColorChange }) {
  const defaultColors = [
    '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A', '#172554', '#0F172A',
  ];

  const [colors, setColors] = useState(() => {
    return configStages.map((s, idx) => s.color || defaultColors[idx % defaultColors.length]);
  });

  React.useEffect(() => {
    setColors(configStages.map((s, idx) => s.color || defaultColors[idx % defaultColors.length]));
  }, [configStages]);

  const stages = configStages.map((stage, idx) => ({
    key: stage.key,
    label: stage.label,
    value: current[stage.key] || 0,
    prevValue: previous?.[stage.key] || 0,
    color: colors[idx] || defaultColors[idx % defaultColors.length],
  }));

  const maxValue = Math.max(...stages.map(s => s.value), 1);

  const formatNumber = (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v));

  const getVariation = (cur, prev) => {
    if (!prev || prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  };

  const handleColorChange = (idx, color) => {
    const newColors = [...colors];
    newColors[idx] = color;
    setColors(newColors);
    if (onColorChange) onColorChange(idx, color);
  };

  return (
    <div className="w-full py-4 space-y-2">
      {stages.map((stage, idx) => {
        const variation = getVariation(stage.value, stage.prevValue);
        const isPositive = variation > 0;
        const isNegative = variation < 0;
        const pct = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
        // Min width 20% so even 0-value bars are visible
        const barWidth = Math.max(pct, 20);

        return (
          <div key={stage.key} className="flex items-center gap-3 group">
            {/* Label col */}
            <div className="w-32 sm:w-44 text-right text-xs sm:text-sm font-medium text-gray-700 flex-shrink-0 leading-tight">
              {stage.label}
            </div>

            {/* Bar col */}
            <div className="flex-1 relative h-12 sm:h-14 bg-gray-100 rounded-lg overflow-visible">
              <div
                className="absolute left-0 top-0 h-full rounded-lg flex items-center px-3 sm:px-4 transition-all duration-500"
                style={{ width: `${barWidth}%`, backgroundColor: stage.color, minWidth: 80 }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white font-bold text-sm sm:text-base whitespace-nowrap">
                    {formatNumber(stage.value)}
                  </span>
                  {variation !== null && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${
                      isPositive ? 'bg-green-100 text-green-700' : isNegative ? 'bg-red-100 text-red-700' : 'bg-white/30 text-white'
                    }`}>
                      {isPositive ? '+' : ''}{variation.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Color picker button */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1 shadow-sm border border-gray-200 z-10"
                    title="Editar cor"
                  >
                    <Palette className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-3" align="end">
                  <p className="text-xs font-medium text-gray-700 mb-2">Escolher cor</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                          colors[idx] === c ? 'border-gray-900 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => handleColorChange(idx, c)}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Previous period */}
            {stage.prevValue > 0 && (
              <div className="w-24 sm:w-32 text-xs text-gray-400 flex-shrink-0">
                {formatNumber(stage.prevValue)} anterior
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}