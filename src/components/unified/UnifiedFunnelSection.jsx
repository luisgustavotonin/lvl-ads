import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const formatNumber = (value) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return Math.round(value).toLocaleString('pt-BR');
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);
};

function FunnelCard({ 
  title, 
  value, 
  previousValue, 
  percentage, 
  type = 'number',
  isFirst 
}) {
  const variation = previousValue > 0 ? ((value - previousValue) / previousValue * 100) : 0;
  const isPositive = variation > 0;
  
  const displayValue = type === 'currency' ? formatCurrency(value) : formatNumber(value);
  const displayPrevious = type === 'currency' ? formatCurrency(previousValue) : formatNumber(previousValue);

  return (
    <div className="relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm min-h-[240px] flex flex-col">
      {/* Cabeçalho */}
      <div className="space-y-2 flex-1">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        
        {/* Valor principal */}
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-gray-900">{displayValue}</span>
          {variation !== 0 && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(variation).toFixed(2)}%
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-500">
          {displayPrevious} no período anterior
        </div>
      </div>

      {/* Percentual do funil */}
      {!isFirst && percentage !== undefined && (
        <div className="pt-3 mt-3 border-t border-gray-100">
          <div className="text-2xl font-bold text-blue-600">{percentage.toFixed(2)}%</div>
          <div className="text-xs text-gray-500 mt-1">de {title.toLowerCase()}</div>
        </div>
      )}
    </div>
  );
}

export default function UnifiedFunnelSection({ 
  currentMetrics, 
  previousMetrics,
  warning 
}) {
  if (!currentMetrics) return null;

  const { totals, funnelPercentages } = currentMetrics;
  const prevTotals = previousMetrics?.totals || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Funil</h3>
        {warning && (
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{warning}</AlertDescription>
          </Alert>
        )}
      </div>
      
      <div className="relative">
        {/* Linha de fundo estilo Reportei */}
        <svg 
          className="absolute top-1/2 left-0 w-full h-32 -translate-y-1/2 pointer-events-none z-0"
          style={{ height: '180px', top: '55%' }}
          preserveAspectRatio="none"
        >
          <path
            d="M 8% 50% Q 15% 35%, 23% 50% Q 31% 60%, 40% 50% Q 48% 42%, 57% 50% Q 65% 54%, 74% 50% Q 82% 48%, 92% 50%"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="2"
            opacity="0.6"
          />
        </svg>

        {/* Cards do funil */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <FunnelCard
            title="Valor investido"
            value={totals.spend}
            previousValue={prevTotals.spend}
            type="currency"
            isFirst
          />
          <FunnelCard
            title="Impressões Totais"
            value={totals.impressions}
            previousValue={prevTotals.impressions}
            percentage={funnelPercentages.impressions}
          />
          <FunnelCard
            title="Alcance Total"
            value={totals.reach}
            previousValue={prevTotals.reach}
            percentage={funnelPercentages.reach}
          />
          <FunnelCard
            title="Total de Cliques"
            value={totals.clicks}
            previousValue={prevTotals.clicks}
            percentage={funnelPercentages.clicks}
          />
          <FunnelCard
            title="Total de cliques no link"
            value={totals.link_clicks}
            previousValue={prevTotals.link_clicks}
            percentage={funnelPercentages.link_clicks}
          />
          <FunnelCard
            title="Conversas iniciadas por mensagem"
            value={totals.whatsapp_conversations_started}
            previousValue={prevTotals.whatsapp_conversations_started}
            percentage={funnelPercentages.whatsapp}
          />
        </div>
      </div>
    </div>
  );
}