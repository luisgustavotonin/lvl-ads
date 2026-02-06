import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

const formatNumber = (value) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
};

const MetricCard = ({ title, value, previousValue, chartData, color, type = 'number' }) => {
  const variation = previousValue > 0 ? ((value - previousValue) / previousValue * 100) : 0;
  const isPositive = variation > 0;
  
  const displayValue = type === 'currency' ? formatCurrency(value) : formatNumber(value);

  return (
    <div className="relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-hidden">
      {/* Background Chart */}
      <div className="absolute inset-0 opacity-10">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          {variation !== 0 && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(variation).toFixed(1)}%
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <div className="text-4xl font-bold text-gray-900">{displayValue}</div>
          <div className="text-xs text-gray-500">
            vs {type === 'currency' ? formatCurrency(previousValue) : formatNumber(previousValue)} período anterior
          </div>
        </div>

        {/* Mini sparkline no rodapé */}
        <div className="mt-4 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={color} 
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default function FunnelChartWithLines({ metrics, previousMetrics }) {
  // Preparar dados dos gráficos
  const chartData = {
    spend: metrics.map(m => ({ value: m.spend })),
    impressions: metrics.map(m => ({ value: m.impressions })),
    reach: metrics.map(m => ({ value: m.reach })),
    clicks: metrics.map(m => ({ value: m.clicks })),
    link_clicks: metrics.map(m => ({ value: m.link_clicks })),
    whatsapp: metrics.map(m => ({ value: m.whatsapp_conversations_started }))
  };

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <MetricCard
        title="Valor investido"
        value={currentTotals.spend}
        previousValue={previousTotals.spend}
        chartData={chartData.spend}
        color="#3b82f6"
        type="currency"
      />
      <MetricCard
        title="Impressões"
        value={currentTotals.impressions}
        previousValue={previousTotals.impressions}
        chartData={chartData.impressions}
        color="#8b5cf6"
      />
      <MetricCard
        title="Alcance"
        value={currentTotals.reach}
        previousValue={previousTotals.reach}
        chartData={chartData.reach}
        color="#ec4899"
      />
      <MetricCard
        title="Cliques"
        value={currentTotals.clicks}
        previousValue={previousTotals.clicks}
        chartData={chartData.clicks}
        color="#f59e0b"
      />
      <MetricCard
        title="Cliques no link"
        value={currentTotals.link_clicks}
        previousValue={previousTotals.link_clicks}
        chartData={chartData.link_clicks}
        color="#10b981"
      />
      <MetricCard
        title="Conversas WhatsApp"
        value={currentTotals.whatsapp}
        previousValue={previousTotals.whatsapp}
        chartData={chartData.whatsapp}
        color="#06b6d4"
      />
    </div>
  );
}