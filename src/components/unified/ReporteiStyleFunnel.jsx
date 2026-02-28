import React from 'react';

const formatNumber = (value) => {
  if (!value || value === 0) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return Math.round(value).toLocaleString('pt-BR');
};

const formatCurrency = (value) => {
  if (!value || value === 0) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const DEFAULT_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4'
];

const FunnelCard = ({ 
  title, 
  value, 
  previousValue = 0, 
  percentage, 
  type = 'number',
  index,
  color,
}) => {
  const variation = previousValue > 0 ? ((value - previousValue) / previousValue * 100) : 0;
  const isPositive = variation > 0;
  
  const displayValue = type === 'currency' ? formatCurrency(value) : formatNumber(value);
  const displayPrevious = type === 'currency' ? formatCurrency(previousValue) : formatNumber(previousValue);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col" style={{ borderTop: `3px solid ${color}` }}>
      {/* Título */}
      <h3 className="text-xs font-medium text-gray-500 mb-3 leading-tight">{title}</h3>
      
      {/* Valor principal */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl font-bold text-gray-900">{displayValue}</span>
        {variation !== 0 && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive ? '▲' : '▼'} {Math.abs(variation).toFixed(1)}%
          </span>
        )}
      </div>
      
      {/* Período anterior */}
      <div className="text-[10px] text-gray-400 mb-3">
        {displayPrevious} período anterior
      </div>

      {/* Percentual do funil */}
      {percentage !== undefined && percentage !== 100 && (
        <div className="mt-auto">
          <span className="text-base font-bold" style={{ color }}>{percentage.toFixed(1)}%</span>
          <span className="text-[9px] text-gray-400 ml-1">conversão</span>
        </div>
      )}
    </div>
  );
};

export default function ReporteiStyleFunnel({ 
  currentMetrics, 
  previousMetrics = {},
  stageColors = {}
}) {
  if (!currentMetrics || !currentMetrics.totals) return null;

  const { totals, funnelPercentages } = currentMetrics;
  const prevTotals = previousMetrics.totals || {};

  const cards = [
    { key: 'spend',       title: 'Valor investido',                 value: totals.spend,                         prevValue: prevTotals.spend,                         type: 'currency', pct: undefined },
    { key: 'impressions', title: 'Impressões Totais',                value: totals.impressions,                    prevValue: prevTotals.impressions,                    pct: funnelPercentages?.impressions },
    { key: 'reach',       title: 'Alcance Total',                   value: totals.reach,                          prevValue: prevTotals.reach,                          pct: funnelPercentages?.reach },
    { key: 'clicks',      title: 'Total de Cliques',                value: totals.clicks,                         prevValue: prevTotals.clicks,                         pct: funnelPercentages?.clicks },
    { key: 'linkClicks',  title: 'Total de cliques no link',        value: totals.link_clicks,                    prevValue: prevTotals.link_clicks,                    pct: funnelPercentages?.link_clicks },
    { key: 'conversations', title: 'Conversas iniciadas',           value: totals.whatsapp_conversations_started, prevValue: prevTotals.whatsapp_conversations_started, pct: funnelPercentages?.whatsapp },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">Funil</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((card, i) => (
          <FunnelCard
            key={i}
            index={i}
            title={card.title}
            value={card.value}
            previousValue={card.prevValue}
            type={card.type}
            percentage={card.pct}
            color={stageColors[card.key] || DEFAULT_COLORS[i]}
          />
        ))}
      </div>
    </div>
  );
}