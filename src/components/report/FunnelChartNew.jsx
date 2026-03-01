import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const DEFAULT_COLORS = ['#93C5FD','#60A5FA','#3B82F6','#2563EB','#1D4ED8','#1E40AF','#1e3a8a'];

const CURRENCY_KEYS = [
  'spend', 'cpcLink', 'cpm', 'costPerConversation',
  'costPerTotalContact', 'costPerFirstReply'
];

function fmtCompact(v, isCurrency) {
  const n = Number(v || 0);
  if (isCurrency) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  }
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function variationPct(curr, prev) {
  if (prev == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function compactLabel(label) {
  if (!label) return '';
  return String(label)
    .replace(/no\s+link/gi, 'Link')
    .replace(/conversas\s+iniciadas/gi, 'Conversas')
    .replace(/impressões/gi, 'Impr.')
    .replace(/investimento/gi, 'Inv.');
}

export default function FunnelChartNew({ current, previous, stages: configStages = [], unitId }) {
  const stages = useMemo(() => {
    return (configStages || []).map((stage, idx) => {
      const color = stage.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      const isCurrency = CURRENCY_KEYS.includes(stage.key);

      return {
        key: stage.key,
        label: stage.label,
        shortLabel: compactLabel(stage.label),
        value: current?.[stage.key] || 0,
        prevValue: previous?.[stage.key] || 0,
        color,
        isCurrency,
      };
    });
  }, [configStages, current, previous]);

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[560px] px-2">
        <div className="flex flex-col items-center gap-2 py-4">
          {stages.map((stage, idx) => {
            const varPct = variationPct(stage.value, stage.prevValue);
            const isPositive = varPct !== null && varPct > 0;
            const isNegative = varPct !== null && varPct < 0;
            const widthPct = Math.max(52, 92 - idx * 8);

            return (
              <div key={stage.key} className="w-full flex flex-col items-center">
                <div
                  className="relative text-center shadow-sm"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: stage.color,
                    clipPath: 'polygon(6% 0%, 94% 0%, 88% 100%, 12% 100%)',
                    borderRadius: 12,
                    padding: '8px 12px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div className="text-white/90 text-[11px] font-medium leading-tight">
                    {stage.shortLabel || stage.label}
                  </div>

                  <div className="text-white text-[16px] font-semibold leading-tight mt-0.5">
                    {fmtCompact(stage.value, stage.isCurrency)}
                  </div>

                  {varPct !== null && Math.abs(varPct) >= 0.1 && (
                    <div className={`mt-1 flex items-center justify-center gap-1 text-[11px] font-medium ${
                      isPositive ? 'text-green-200' : isNegative ? 'text-red-200' : 'text-white/90'
                    }`}>
                      {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : isNegative ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                      <span>{isPositive ? '+' : ''}{varPct.toFixed(1)}%</span>
                    </div>
                  )}
                </div>

                {idx < stages.length - 1 && (
                  <div className="h-1 w-0.5 bg-gray-200" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}