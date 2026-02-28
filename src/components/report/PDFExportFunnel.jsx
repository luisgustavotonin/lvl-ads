import React from 'react';

const CURRENCY_KEYS = ['spend', 'costPerConversation', 'costPerTotalContact', 'costPerFirstReply', 'cpcLink', 'cpm'];

function formatValue(key, value) {
  if (CURRENCY_KEYS.includes(key)) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }
  if (key === 'ctrLink') return `${Number(value || 0).toFixed(2)}%`;
  if (key === 'frequency') return Number(value || 0).toFixed(2);
  return new Intl.NumberFormat('pt-BR').format(Math.round(value || 0));
}

export default function PDFExportFunnel({ current = {}, stages = [] }) {
  if (!stages || stages.length === 0) return null;

  const values = stages.map((s) => current[s.key] || 0);
  const maxVal = Math.max(...values, 1);

  const W = 600;
  const STAGE_H = 52;
  const GAP = 4;
  const totalH = stages.length * (STAGE_H + GAP);
  const MIN_W = 120;

  const COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#EF4444'];

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width={W} height={totalH} viewBox={`0 0 ${W} ${totalH}`} style={{ maxWidth: '100%' }}>
        {stages.map((stage, i) => {
          const val = values[i];
          const barW = Math.max(MIN_W, (val / maxVal) * W);
          const x = (W - barW) / 2;
          const y = i * (STAGE_H + GAP);
          const color = COLORS[i % COLORS.length];

          // Trapezoid points: wider on top if first, narrower than previous otherwise
          const prevW = i === 0 ? barW : Math.max(MIN_W, (values[i - 1] / maxVal) * W);
          const prevX = (W - prevW) / 2;

          const points = [
            `${prevX},${y}`,
            `${prevX + prevW},${y}`,
            `${x + barW},${y + STAGE_H}`,
            `${x},${y + STAGE_H}`,
          ].join(' ');

          return (
            <g key={stage.key}>
              <polygon points={points} fill={color} opacity={0.85} />
              <text
                x={W / 2}
                y={y + STAGE_H / 2 - 6}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={12}
                fontWeight="600"
              >
                {stage.label}
              </text>
              <text
                x={W / 2}
                y={y + STAGE_H / 2 + 10}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={13}
                fontWeight="700"
              >
                {formatValue(stage.key, val)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}