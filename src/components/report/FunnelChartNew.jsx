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

export default function FunnelChartNew({ current, previous, stages: configStages = [] }) {
  const stages = useMemo(() => {
    return (configStages || []).map((stage, idx) => {
      const color = stage.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      const isCurrency = CURRENCY_KEYS.includes(stage.key);
      return {
        key: stage.key,
        label: stage.label,
        value: current?.[stage.key] || 0,
        prevValue: previous?.[stage.key] || 0,
        color,
        isCurrency,
      };
    });
  }, [configStages, current, previous]);

  if (!stages.length) return null;

  const total = stages.length;
  // Larguras: de 100% (topo) até ~55% (base), lineares
  const topPct = 100;
  const bottomPct = 55;
  const step = total > 1 ? (topPct - bottomPct) / (total - 1) : 0;

  return (
    <div className="w-full flex justify-center py-4">
      <div className="w-full max-w-[580px]">
        {stages.map((stage, idx) => {
          const varPct = variationPct(stage.value, stage.prevValue);
          const isPositive = varPct !== null && varPct > 0;
          const isNegative = varPct !== null && varPct < 0;

          // Largura do topo e da base de cada fatia (trapézio)
          const wTop = topPct - idx * step;        // largura superior desta fatia
          const wBot = topPct - (idx + 1) * step;  // largura inferior desta fatia

          // clip-path em percentuais: recuo nas laterais para criar o trapézio
          const leftTop  = ((100 - wTop) / 2);
          const rightTop = 100 - leftTop;
          const leftBot  = ((100 - wBot) / 2);
          const rightBot = 100 - leftBot;

          const clipPath = `polygon(${leftTop}% 0%, ${rightTop}% 0%, ${rightBot}% 100%, ${leftBot}% 100%)`;

          // Texto claro/escuro dependendo da cor de fundo
          const isLight = ['#93C5FD','#60A5FA'].includes(stage.color);
          const textColor = isLight ? 'text-gray-800' : 'text-white';
          const subTextColor = isLight ? 'text-gray-600' : 'text-white/80';

          return (
            <div
              key={stage.key}
              className="relative text-center"
              style={{
                height: 72,
                backgroundColor: stage.color,
                clipPath,
                marginTop: idx === 0 ? 0 : -1, // sem gap entre fatias
              }}
            >
              {/* Conteúdo centralizado verticalmente */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-[12px] font-semibold leading-tight ${textColor}`}>
                  {stage.label}
                </div>
                <div className={`text-[17px] font-bold leading-tight mt-0.5 ${textColor}`}>
                  {fmtCompact(stage.value, stage.isCurrency)}
                </div>
                {varPct !== null && Math.abs(varPct) >= 0.1 && (
                  <div className={`flex items-center gap-1 text-[11px] font-medium mt-0.5 ${
                    isPositive ? (isLight ? 'text-green-700' : 'text-green-200')
                               : isNegative ? (isLight ? 'text-red-600' : 'text-red-200')
                               : subTextColor
                  }`}>
                    {isPositive
                      ? <TrendingUp className="w-3 h-3" />
                      : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
                    <span>{isPositive ? '+' : ''}{varPct.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}