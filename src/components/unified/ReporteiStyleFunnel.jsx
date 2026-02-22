import React, { useState } from 'react';
import { Pencil } from 'lucide-react';

const COLOR_OPTIONS = [
  { label: 'Azul',       value: '#3B82F6' },
  { label: 'Roxo',       value: '#8B5CF6' },
  { label: 'Rosa',       value: '#EC4899' },
  { label: 'Laranja',    value: '#F59E0B' },
  { label: 'Verde',      value: '#10B981' },
  { label: 'Ciano',      value: '#06B6D4' },
  { label: 'Vermelho',   value: '#EF4444' },
  { label: 'Índigo',     value: '#6366F1' },
  { label: 'Amarelo',    value: '#EAB308' },
  { label: 'Lima',       value: '#84CC16' },
  { label: 'Esmeralda',  value: '#059669' },
  { label: 'Azul Escuro',value: '#1D4ED8' },
  { label: 'Teal',       value: '#14B8A6' },
  { label: 'Fúcsia',     value: '#D946EF' },
  { label: 'Âmbar',      value: '#D97706' },
  { label: 'Coral',      value: '#F97316' },
  { label: 'Marrom',     value: '#92400E' },
  { label: 'Violeta',    value: '#7C3AED' },
  { label: 'Cinza',      value: '#6B7280' },
  { label: 'Preto',      value: '#111827' },
];

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
  onColorChange
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const variation = previousValue > 0 ? ((value - previousValue) / previousValue * 100) : 0;
  const isPositive = variation > 0;
  
  const displayValue = type === 'currency' ? formatCurrency(value) : formatNumber(value);
  const displayPrevious = type === 'currency' ? formatCurrency(previousValue) : formatNumber(previousValue);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 min-h-[200px] flex flex-col relative">
      {/* Botão editar cor - sempre visível */}
      <button
        onClick={() => setShowPicker(v => !v)}
        className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100"
        title="Editar cor"
      >
        <Pencil className="w-3 h-3 text-gray-400" />
      </button>

      {/* Color picker dropdown */}
      {showPicker && (
        <div className="absolute top-8 right-2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-48">
          <p className="text-xs font-semibold text-gray-600 mb-2">Escolher cor</p>
          <div className="grid grid-cols-5 gap-1.5">
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                title={opt.label}
                onClick={() => { onColorChange(opt.value); setShowPicker(false); }}
                className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: opt.value, borderColor: color === opt.value ? '#000' : 'transparent' }}
              />
            ))}
          </div>
          <button onClick={() => setShowPicker(false)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 w-full text-right">fechar</button>
        </div>
      )}

      {/* Título */}
      <h3 className="text-xs font-medium text-gray-600 mb-3 pr-6">{title}</h3>
      
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

const STORAGE_KEY = 'funnel_colors';

const loadColors = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_COLORS; } catch { return [...DEFAULT_COLORS]; }
};

export default function ReporteiStyleFunnel({ 
  currentMetrics, 
  previousMetrics = {}
}) {
  const [colors, setColors] = useState(loadColors);

  if (!currentMetrics || !currentMetrics.totals) return null;

  const { totals, funnelPercentages } = currentMetrics;
  const prevTotals = previousMetrics.totals || {};

  const handleColorChange = (index, newColor) => {
    setColors(prev => {
      const next = [...prev];
      next[index] = newColor;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const cards = [
    { title: 'Valor investido',                    value: totals.spend,                             prevValue: prevTotals.spend,                             type: 'currency', pct: undefined },
    { title: 'Impressões Totais',                   value: totals.impressions,                        prevValue: prevTotals.impressions,                        pct: funnelPercentages?.impressions },
    { title: 'Alcance Total',                       value: totals.reach,                              prevValue: prevTotals.reach,                              pct: funnelPercentages?.reach },
    { title: 'Total de Cliques',                    value: totals.clicks,                             prevValue: prevTotals.clicks,                             pct: funnelPercentages?.clicks },
    { title: 'Total de cliques no link',            value: totals.link_clicks,                        prevValue: prevTotals.link_clicks,                        pct: funnelPercentages?.link_clicks },
    { title: 'Conversas iniciadas por mensagem',    value: totals.whatsapp_conversations_started,     prevValue: prevTotals.whatsapp_conversations_started,     pct: funnelPercentages?.whatsapp },
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
            color={colors[i] || DEFAULT_COLORS[i]}
            onColorChange={(c) => handleColorChange(i, c)}
          />
        ))}
      </div>
    </div>
  );
}