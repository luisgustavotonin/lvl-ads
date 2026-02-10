import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowDown } from 'lucide-react';

const BLUE_GRADIENT = [
  '#DBEAFE', // blue-100
  '#BFDBFE', // blue-200
  '#93C5FD', // blue-300
  '#60A5FA', // blue-400
  '#3B82F6', // blue-500
  '#2563EB', // blue-600
];

export default function MetaFunnel({ data }) {
  const steps = [
    { label: 'Investimento', value: data.spend || 0, format: 'currency' },
    { label: 'Impressões', value: data.impressions || 0, format: 'number' },
    { label: 'Alcance', value: data.reach || 0, format: 'number' },
    { label: 'Cliques', value: data.clicks || 0, format: 'number' },
    { label: 'Cliques no link', value: data.link_clicks || 0, format: 'number' },
    { label: 'Conversas iniciadas', value: data.conversations || 0, format: 'number' },
  ];

  const formatValue = (value, format) => {
    if (format === 'currency') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  const getConversionRate = (current, previous) => {
    if (previous === 0) return 0;
    return ((current / previous) * 100).toFixed(1);
  };

  const maxValue = steps[0].value;

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Funil de Conversão</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const widthPercent = maxValue > 0 ? Math.max((step.value / maxValue) * 100, 10) : 0;
            const conversionRate = idx > 0 ? getConversionRate(step.value, steps[idx - 1].value) : null;
            
            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-700">{step.label}</span>
                  <span className="text-sm font-bold text-gray-900">{formatValue(step.value, step.format)}</span>
                </div>
                <div className="relative">
                  <div className="w-full h-14 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full flex items-center justify-center text-white text-sm font-semibold transition-all duration-300"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: BLUE_GRADIENT[idx] || BLUE_GRADIENT[5],
                      }}
                    >
                      {widthPercent > 15 ? `${widthPercent.toFixed(0)}%` : ''}
                    </div>
                  </div>
                  {conversionRate !== null && (
                    <div className="absolute -bottom-5 left-0 flex items-center gap-1 text-xs text-gray-500">
                      <ArrowDown className="w-3 h-3" />
                      <span>{conversionRate}% do passo anterior</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}