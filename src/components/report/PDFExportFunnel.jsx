import React from 'react';

const fmtNumber = (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v || 0));
const fmtCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function formatValue(key, value) {
  if (!value && value !== 0) return '—';
  if (key === 'spend' || key.includes('cost') || key.includes('cpc') || key.includes('cpm')) {
    return fmtCurrency(value);
  }
  if (key.includes('ctr') || key.includes('rate')) return `${Number(value || 0).toFixed(2)}%`;
  if (key === 'frequency') return Number(value || 0).toFixed(2);
  return fmtNumber(value);
}

const STAGE_COLORS = [
  '#1e40af', '#1d4ed8', '#0284c7', '#0891b2',
  '#0d9488', '#059669', '#7c3aed', '#9333ea',
];

export default function PDFExportFunnel({ current = {}, previous = {}, stages = [] }) {
  if (!stages.length) return null;

  const values = stages.map((s) => current[s.key] || 0);
  const maxVal = Math.max(...values, 1);

  const W = 680;
  const SH = 58;   // stage height
  const GAP = 3;
  const MAX_W = W * 0.88;
  const MIN_W = W * 0.2;
  const totalH = stages.length * (SH + GAP) + 6;

  return (
    <div style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '4px 20px' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${totalH}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {stages.map((stage, i) => {
          const val = values[i];
          const prevVal = previous[stage.key] || 0;
          const ratio = maxVal > 0 ? val / maxVal : 0;

          const nextVal = i < stages.length - 1 ? values[i + 1] : val * 0.72;
          const nextRatio = maxVal > 0 ? nextVal / maxVal : 0;

          const topW = MIN_W + (MAX_W - MIN_W) * ratio;
          const botW = MIN_W + (MAX_W - MIN_W) * nextRatio;
          const topX = (W - topW) / 2;
          const botX = (W - botW) / 2;
          const y = i * (SH + GAP);

          const variation =
            prevVal > 0 ? ((val - prevVal) / prevVal) * 100 : null;
          const varText =
            variation !== null
              ? `${variation >= 0 ? '▲' : '▼'} ${Math.abs(variation).toFixed(1)}%`
              : '';
          const varColor = variation !== null
            ? variation >= 0 ? '#4ade80' : '#fca5a5'
            : '#fff';

          const color = STAGE_COLORS[i % STAGE_COLORS.length];

          return (
            <g key={stage.key}>
              {/* Trapezoid shape */}
              <polygon
                points={`${topX},${y} ${topX + topW},${y} ${botX + botW},${y + SH} ${botX},${y + SH}`}
                fill={color}
              />

              {/* Label */}
              <text
                x={W / 2}
                y={y + SH / 2 - 8}
                textAnchor="middle"
                fill="white"
                fontSize="11"
                fontWeight="700"
                fontFamily="system-ui, -apple-system, Arial, sans-serif"
              >
                {stage.label}
              </text>

              {/* Value */}
              <text
                x={W / 2}
                y={y + SH / 2 + 9}
                textAnchor="middle"
                fill="white"
                fontSize="13"
                fontWeight="600"
                fontFamily="system-ui, -apple-system, Arial, sans-serif"
              >
                {formatValue(stage.key, val)}
              </text>

              {/* Variation (outside right) */}
              {varText && (
                <text
                  x={topX + topW + 10}
                  y={y + SH / 2 + 5}
                  textAnchor="start"
                  fill={varColor}
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="system-ui, -apple-system, Arial, sans-serif"
                >
                  {varText}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}