import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

const formatValue = (value, type) => {
  if (value === null || value === undefined) return '-';
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL',
        minimumFractionDigits: 2
      }).format(value);
    case 'number':
      return new Intl.NumberFormat('pt-BR').format(value);
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'decimal':
      return value.toFixed(2);
    default:
      return value;
  }
};

export default function MetricCard({ 
  title, 
  value, 
  previousValue,
  type = 'number',
  icon: Icon,
  color = 'blue',
  size = 'default'
}) {
  const change = previousValue ? ((value - previousValue) / previousValue) * 100 : null;
  const isPositive = change > 0;
  
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    pink: 'bg-pink-50 text-pink-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };

  return (
    <div className={cn(
      "bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow",
      size === 'large' ? 'p-6' : 'p-4'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className={cn(
            "font-bold text-gray-900",
            size === 'large' ? 'text-3xl' : 'text-2xl'
          )}>
            {formatValue(value, type)}
          </p>
          
          {change !== null && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-sm font-medium",
              isPositive ? "text-green-600" : "text-red-500"
            )}>
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{isPositive ? '+' : ''}{change.toFixed(1)}%</span>
              <span className="text-gray-400 font-normal">vs anterior</span>
            </div>
          )}
        </div>
        
        {Icon && (
          <div className={cn("p-2.5 rounded-lg", colorClasses[color])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}