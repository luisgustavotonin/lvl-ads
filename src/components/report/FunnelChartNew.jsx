import React from 'react';

export default function FunnelChartNew({ data }) {
  const stages = [
    { label: 'Impressões', value: data.impressions || 0, color: '#DBEAFE' },
    { label: 'Cliques no Link', value: data.linkClicks || 0, color: '#93C5FD' },
    { label: 'Conversas Iniciadas', value: data.conversations || 0, color: '#60A5FA' },
    { label: 'Contatos por Mensagem', value: data.totalContacts || 0, color: '#3B82F6' },
  ];

  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));

  return (
    <div className="flex items-center justify-center gap-4 py-8">
      {stages.map((stage, idx) => {
        const width = 200 - (idx * 40);
        
        return (
          <div
            key={idx}
            className="relative flex flex-col items-center justify-center text-center transition-all hover:scale-105"
            style={{
              width: `${width}px`,
              height: '120px',
              clipPath: idx === stages.length - 1 
                ? 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)'
                : 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',
              backgroundColor: stage.color,
              marginLeft: idx > 0 ? '-20px' : '0'
            }}
          >
            <div className="font-bold text-2xl text-gray-900">{formatNumber(stage.value)}</div>
            <div className="text-xs text-gray-700 mt-1 px-2">{stage.label}</div>
          </div>
        );
      })}
    </div>
  );
}