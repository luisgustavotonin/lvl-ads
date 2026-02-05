import React from 'react';
import { cn } from '@/lib/utils';

export default function FunnelChart({ data, title = "Funil de Conversão" }) {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => {
          const widthPercent = (item.value / maxValue) * 100;
          const conversionRate = index > 0 ? ((item.value / data[index - 1].value) * 100).toFixed(1) : null;
          
          return (
            <div key={item.label} className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">
                    {new Intl.NumberFormat('pt-BR').format(item.value)}
                  </span>
                  {conversionRate && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {conversionRate}%
                    </span>
                  )}
                </div>
              </div>
              <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-lg transition-all duration-500",
                    item.color || "bg-blue-500"
                  )}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}