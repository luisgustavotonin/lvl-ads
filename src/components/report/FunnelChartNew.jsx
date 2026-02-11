import React from 'react';

export default function FunnelChartNew({ data }) {
  const stages = [
    { key: 'impressions', label: 'Impressões', value: data.impressions || 0 },
    { key: 'linkClicks', label: 'Cliques no Link', value: data.linkClicks || 0 },
    { key: 'conversations', label: 'Conversas Iniciadas', value: data.conversations || 0 },
    { key: 'totalContacts', label: 'Contatos por Mensagem', value: data.totalContacts || 0 },
  ];

  const maxValue = stages[0]?.value || 1;

  const blueGradient = [
    '#DBEAFE', // mais claro
    '#93C5FD',
    '#60A5FA',
    '#3B82F6',  // mais escuro
  ];

  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      {stages.map((stage, idx) => {
        const widthPercent = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
        
        return (
          <div key={stage.key} className="flex items-center gap-4">
            <div className="w-48 text-right">
              <span className="text-sm font-medium text-gray-700">{stage.label}</span>
            </div>
            <div className="flex-1 relative">
              <div
                className="h-16 rounded-lg flex items-center justify-center text-white font-bold shadow-md transition-all"
                style={{
                  width: `${Math.max(widthPercent, 10)}%`,
                  backgroundColor: blueGradient[idx] || blueGradient[3]
                }}
              >
                {formatNumber(stage.value)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}