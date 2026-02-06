import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

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

const FunnelCard = ({ 
  title, 
  value, 
  previousValue = 0, 
  percentage, 
  type = 'number',
  index
}) => {
  const variation = previousValue > 0 ? ((value - previousValue) / previousValue * 100) : 0;
  const isPositive = variation > 0;
  
  const displayValue = type === 'currency' ? formatCurrency(value) : formatNumber(value);
  const displayPrevious = type === 'currency' ? formatCurrency(previousValue) : formatNumber(previousValue);

  // Cores diferentes para cada card
  const colors = [
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#F59E0B', // orange
    '#10B981', // green
    '#06B6D4'  // cyan
  ];
  
  const color = colors[index % colors.length];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 min-h-[200px] flex flex-col relative">
      {/* Título */}
      <h3 className="text-xs font-medium text-gray-600 mb-3">{title}</h3>
      
      {/* Valor principal */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl font-bold text-gray-900">{displayValue}</span>
        {variation !== 0 && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive ? '▲' : '▼'} {Math.abs(variation).toFixed(2)}%
          </span>
        )}
      </div>
      
      {/* Período anterior */}
      <div className="text-[10px] text-gray-500 mb-4">
        {displayPrevious} no período anterior
      </div>

      {/* Mini linha do funil dentro do card */}
      <div className="mt-auto">
        <svg width="100%" height="40" className="overflow-visible">
          <defs>
            <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.2 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.8 }} />
            </linearGradient>
          </defs>
          <path
            d="M 0,20 Q 25,10 50,20 T 100,20"
            fill="none"
            stroke={`url(#gradient-${index})`}
            strokeWidth="2"
            opacity="0.6"
          />
        </svg>
        
        {/* Percentual no rodapé */}
        {percentage !== undefined && percentage !== 100 && (
          <div className="text-center mt-1">
            <span className="text-lg font-bold" style={{ color }}>{percentage.toFixed(2)}%</span>
            <span className="text-[9px] text-gray-500 ml-1">de {title.toLowerCase().substring(0, 20)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function ReporteiStyleFunnel({ 
  currentMetrics, 
  previousMetrics = {}
}) {
  if (!currentMetrics || !currentMetrics.totals) return null;

  const { totals, funnelPercentages } = currentMetrics;
  const prevTotals = previousMetrics.totals || {};

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">Funil</h3>
      
      {/* Grid de cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <FunnelCard
          title="Valor investido"
          value={totals.spend}
          previousValue={prevTotals.spend}
          type="currency"
          index={0}
        />
        <FunnelCard
          title="Impressões Totais"
          value={totals.impressions}
          previousValue={prevTotals.impressions}
          percentage={funnelPercentages.impressions}
          index={1}
        />
        <FunnelCard
          title="Alcance Total"
          value={totals.reach}
          previousValue={prevTotals.reach}
          percentage={funnelPercentages.reach}
          index={2}
        />
        <FunnelCard
          title="Total de Cliques"
          value={totals.clicks}
          previousValue={prevTotals.clicks}
          percentage={funnelPercentages.clicks}
          index={3}
        />
        <FunnelCard
          title="Total de cliques no link"
          value={totals.link_clicks}
          previousValue={prevTotals.link_clicks}
          percentage={funnelPercentages.link_clicks}
          index={4}
        />
        <FunnelCard
          title="Conversas iniciadas por mensagem"
          value={totals.whatsapp_conversations_started}
          previousValue={prevTotals.whatsapp_conversations_started}
          percentage={funnelPercentages.whatsapp}
          index={5}
        />
      </div>
    </div>
  );
}