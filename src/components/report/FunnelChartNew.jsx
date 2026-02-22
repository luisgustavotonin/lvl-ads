import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function FunnelChartNew({ current, previous, stages: configStages }) {
  const colorGradients = [
    'from-blue-100 to-blue-200',
    'from-blue-200 to-blue-300',
    'from-blue-300 to-blue-400',
    'from-blue-400 to-blue-500',
    'from-blue-500 to-blue-600',
    'from-blue-600 to-blue-700',
    'from-blue-700 to-blue-800',
  ];

  const stages = configStages.map((stage, idx) => ({
    key: stage.key,
    label: stage.label,
    value: current[stage.key] || 0,
    prevValue: previous?.[stage.key] || 0,
    color: colorGradients[idx % colorGradients.length]
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