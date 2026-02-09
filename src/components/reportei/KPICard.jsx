import React from 'react';
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const formatValue = (value, type) => {
  if (value === null || value === undefined) return '-';
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
      }).format(value);
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'number':
      return new Intl.NumberFormat('pt-BR').format(Math.round(value));
    case 'decimal':
      return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    default:
      return value;
  }
};

export default function KPICard({ 
  label, 
  value, 
  type = 'number',
  previousValue = null,
  formula = null,
  theme = 'blue'
}) {
  const variation = previousValue && previousValue !== 0 
    ? ((value - previousValue) / previousValue) * 100 
    : null;

  const themeColors = {
    blue: 'border-blue-100 bg-blue-50/30',
    green: 'border-green-100 bg-green-50/30',
    purple: 'border-purple-100 bg-purple-50/30',
    orange: 'border-orange-100 bg-orange-50/30',
  };

  return (
    <div className={`rounded-lg border-2 ${themeColors[theme] || themeColors.blue} p-4 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        {formula && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{formula}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <div className="text-2xl font-bold text-gray-900 mb-2">
        {formatValue(value, type)}
      </div>

      {variation !== null && (
        <div className="flex items-center gap-1">
          {variation > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-600" />
          ) : variation < 0 ? (
            <TrendingDown className="w-4 h-4 text-red-600" />
          ) : null}
          <span className={`text-sm font-medium ${
            variation > 0 ? 'text-green-600' : variation < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
          </span>
          <span className="text-xs text-gray-500 ml-1">vs período anterior</span>
        </div>
      )}
    </div>
  );
}