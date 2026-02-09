import React from 'react';

const FUNNEL_STEPS = [
  { id: 'spend', label: 'Investimento', field: 'spend', type: 'currency' },
  { id: 'impressions', label: 'Impressões', field: 'impressions', type: 'number' },
  { id: 'reach', label: 'Alcance', field: 'reach', type: 'number' },
  { id: 'clicks', label: 'Cliques', field: 'clicks', type: 'number' },
  { id: 'link_clicks', label: 'Cliques no link', field: 'link_clicks', type: 'number' },
  { id: 'conversations', label: 'Conversas iniciadas', field: 'wa_conversations', type: 'number' },
];

const formatValue = (value, type) => {
  if (!value) return '0';
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'number':
      return new Intl.NumberFormat('pt-BR').format(Math.round(value));
    default:
      return value;
  }
};

export default function FunnelChart({ data }) {
  const maxValue = Math.max(...FUNNEL_STEPS.map(step => data[step.field] || 0));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Funil de Conversão</h3>
      
      <div className="space-y-3">
        {FUNNEL_STEPS.map((step, index) => {
          const value = data[step.field] || 0;
          const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const prevValue = index > 0 ? data[FUNNEL_STEPS[index - 1].field] || 0 : null;
          const conversionRate = prevValue && prevValue > 0 ? (value / prevValue) * 100 : null;
          
          // Cor degradê azul
          const blueShades = [
            'bg-blue-200',
            'bg-blue-300',
            'bg-blue-400',
            'bg-blue-500',
            'bg-blue-600',
            'bg-blue-700',
          ];
          
          return (
            <div key={step.id} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{step.label}</span>
                <span className="text-sm font-bold text-gray-900">{formatValue(value, step.type)}</span>
              </div>
              
              <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className={`h-full ${blueShades[index]} transition-all duration-500 flex items-center justify-end px-4`}
                  style={{ width: `${width}%` }}
                >
                  {conversionRate !== null && (
                    <span className="text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {conversionRate.toFixed(1)}% do passo anterior
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}