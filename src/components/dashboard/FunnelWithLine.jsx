import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const formatNumber = (value) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return Math.round(value).toString();
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);
};

const formatPercentage = (value) => {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

function FunnelCard({ title, value, previousValue, percentage, previousPercentage, isFirst, isLast, type = 'number' }) {
  const variation = previousValue > 0 ? ((value - previousValue) / previousValue * 100) : 0;
  const isPositive = variation > 0;
  
  const displayValue = type === 'currency' ? formatCurrency(value) : formatNumber(value);
  const displayPrevious = type === 'currency' ? formatCurrency(previousValue) : formatNumber(previousValue);

  return (
    <div className="relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-gray-900">{displayValue}</span>
          {variation !== 0 && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {formatPercentage(Math.abs(variation))}
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-500">
          {displayPrevious} no período anterior
        </div>

        {/* Percentual do funil (em relação ao anterior) */}
        {percentage !== undefined && (
          <div className="pt-3 mt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-blue-600">{percentage.toFixed(2)}%</span>
              <span className="text-xs text-gray-500">de {title.toLowerCase()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FunnelWithLine({ metrics, previousMetrics }) {
  // Calcular totais
  const currentTotals = metrics.reduce((acc, m) => ({
    spend: acc.spend + (m.spend || 0),
    impressions: acc.impressions + (m.impressions || 0),
    reach: acc.reach + (m.reach || 0),
    clicks: acc.clicks + (m.clicks || 0),
    link_clicks: acc.link_clicks + (m.link_clicks || 0),
    whatsapp: acc.whatsapp + (m.whatsapp_conversations_started || 0)
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, link_clicks: 0, whatsapp: 0 });

  const previousTotals = previousMetrics.reduce((acc, m) => ({
    spend: acc.spend + (m.spend || 0),
    impressions: acc.impressions + (m.impressions || 0),
    reach: acc.reach + (m.reach || 0),
    clicks: acc.clicks + (m.clicks || 0),
    link_clicks: acc.link_clicks + (m.link_clicks || 0),
    whatsapp: acc.whatsapp + (m.whatsapp_conversations_started || 0)
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, link_clicks: 0, whatsapp: 0 });

  // Calcular percentuais do funil
  const funnelPercentages = {
    impressions: 100,
    reach: currentTotals.impressions > 0 ? (currentTotals.reach / currentTotals.impressions * 100) : 0,
    clicks: currentTotals.reach > 0 ? (currentTotals.clicks / currentTotals.reach * 100) : 0,
    link_clicks: currentTotals.clicks > 0 ? (currentTotals.link_clicks / currentTotals.clicks * 100) : 0,
    whatsapp: currentTotals.link_clicks > 0 ? (currentTotals.whatsapp / currentTotals.link_clicks * 100) : 0
  };

  const previousFunnelPercentages = {
    impressions: 100,
    reach: previousTotals.impressions > 0 ? (previousTotals.reach / previousTotals.impressions * 100) : 0,
    clicks: previousTotals.reach > 0 ? (previousTotals.clicks / previousTotals.reach * 100) : 0,
    link_clicks: previousTotals.clicks > 0 ? (previousTotals.link_clicks / previousTotals.clicks * 100) : 0,
    whatsapp: previousTotals.link_clicks > 0 ? (previousTotals.whatsapp / previousTotals.link_clicks * 100) : 0
  };

  return (
    <div className="space-y-8">
      <h3 className="text-xl font-bold text-gray-900">Funil</h3>
      
      <div className="relative">
        {/* Linha de conexão do funil - SVG desenhando curvas entre os cards */}
        <svg 
          className="absolute top-1/2 left-0 w-full h-24 -translate-y-1/2 pointer-events-none z-0"
          style={{ height: '200px', top: '60%' }}
        >
          {/* Linha contínua conectando os cards */}
          <path
            d="M 10% 50% Q 14% 30%, 18% 50% T 35% 50% T 52% 50% T 69% 50% T 86% 50%"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="2"
            opacity="0.5"
          />
        </svg>

        {/* Cards do funil */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <FunnelCard
            title="Valor investido"
            value={currentTotals.spend}
            previousValue={previousTotals.spend}
            type="currency"
            isFirst
          />
          <FunnelCard
            title="Impressões Totais"
            value={currentTotals.impressions}
            previousValue={previousTotals.impressions}
            percentage={funnelPercentages.impressions}
            previousPercentage={previousFunnelPercentages.impressions}
          />
          <FunnelCard
            title="Alcance Total"
            value={currentTotals.reach}
            previousValue={previousTotals.reach}
            percentage={funnelPercentages.reach}
            previousPercentage={previousFunnelPercentages.reach}
          />
          <FunnelCard
            title="Total de Cliques"
            value={currentTotals.clicks}
            previousValue={previousTotals.clicks}
            percentage={funnelPercentages.clicks}
            previousPercentage={previousFunnelPercentages.clicks}
          />
          <FunnelCard
            title="Total de cliques no link"
            value={currentTotals.link_clicks}
            previousValue={previousTotals.link_clicks}
            percentage={funnelPercentages.link_clicks}
            previousPercentage={previousFunnelPercentages.link_clicks}
          />
          <FunnelCard
            title="Conversas iniciadas por mensagem"
            value={currentTotals.whatsapp}
            previousValue={previousTotals.whatsapp}
            percentage={funnelPercentages.whatsapp}
            previousPercentage={previousFunnelPercentages.whatsapp}
            isLast
          />
        </div>
      </div>
    </div>
  );
}