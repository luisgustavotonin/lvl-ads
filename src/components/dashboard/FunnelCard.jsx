import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
};

const formatNumber = (value) => {
  return new Intl.NumberFormat('pt-BR').format(value || 0);
};

const formatPercentage = (value) => {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

export default function FunnelCard({ 
  title, 
  value, 
  previousValue, 
  type = 'number',
  subtext,
  percentage
}) {
  const variation = previousValue > 0 ? ((value - previousValue) / previousValue * 100) : 0;
  const isPositive = variation > 0;

  const formattedValue = type === 'currency' ? formatCurrency(value) : formatNumber(value);
  const formattedPrevious = type === 'currency' ? formatCurrency(previousValue) : formatNumber(previousValue);

  return (
    <div className="relative bg-white rounded-xl border border-gray-100 p-6 flex-1 min-w-0">
      <div className="space-y-3">
        {/* Title */}
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        
        {/* Main value */}
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold text-gray-900">{formattedValue}</span>
          {variation !== 0 && (
            <Badge className={`gap-1 ${isPositive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {formatPercentage(Math.abs(variation))}
            </Badge>
          )}
        </div>

        {/* Previous period */}
        <div className="text-sm text-gray-500">
          <span className="font-medium text-gray-700">{formattedPrevious}</span> no período anterior
        </div>

        {/* Subtext percentage (optional) */}
        {subtext && percentage !== undefined && (
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            <span className="font-semibold text-gray-700">{percentage.toFixed(1)}%</span> {subtext}
          </div>
        )}
      </div>
    </div>
  );
}