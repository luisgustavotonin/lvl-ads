import React from 'react';

export default function FunnelChart({ data }) {
  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));

  const steps = [
    { label: 'Investimento', value: data.spend, format: formatCurrency, color: '#3B82F6' },
    { label: 'Impressões', value: data.impressions, format: formatNumber, color: '#60A5FA' },
    { label: 'Alcance', value: data.reach, format: formatNumber, color: '#93C5FD' },
    { label: 'Cliques', value: data.clicks, format: formatNumber, color: '#BFDBFE' },
    { label: 'Cliques no link', value: data.linkClicks, format: formatNumber, color: '#DBEAFE' },
    { label: 'Conversas', value: data.conversations, format: formatNumber, color: '#EFF6FF' },
  ];

  return (
    <div className="flex flex-col items-center gap-1 py-6">
      {steps.map((step, idx) => {
        const widthPercent = 100 - (idx * 12);
        const convRate = idx > 0 ? ((step.value / steps[idx - 1].value) * 100) : 100;
        
        return (
          <div key={idx} className="w-full flex flex-col items-center">
            <div 
              className="relative flex items-center justify-center py-6 px-6 rounded-lg shadow-md transition-all hover:scale-105"
              style={{ 
                width: `${widthPercent}%`,
                backgroundColor: step.color,
                minWidth: '200px'
              }}
            >
              <div className="text-center">
                <div className="text-sm font-medium text-gray-700 mb-1">{step.label}</div>
                <div className="text-xl font-bold text-gray-900">{step.format(step.value)}</div>
                {idx > 0 && (
                  <div className="text-xs text-gray-600 mt-1">{convRate.toFixed(1)}% conversão</div>
                )}
              </div>
            </div>
            
            {/* Connector Triangle */}
            {idx < steps.length - 1 && (
              <svg width="0" height="16" className="relative" style={{ top: '-1px' }}>
                <defs>
                  <linearGradient id={`gradient-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: step.color, stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: steps[idx + 1].color, stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}