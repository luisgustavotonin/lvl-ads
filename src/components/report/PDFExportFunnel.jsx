import React from 'react';

const formatCompact = (val) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(val || 0));

const formatCurrency = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val || 0);

const CURRENCY_KEYS = ['spend', 'costPerConversation', 'costPerTotalContact', 'costPerFirstReply', 'cpcLink', 'cpm'];

function formatValue(key, val) {
  if (CURRENCY_KEYS.includes(key)) return formatCurrency(val);
  return formatCompact(val);
}

function pctChange(curr, prev) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export default function PDFExportFunnel({ current = {}, previous = {}, stages = [] }) {
  if (!stages.length) return null;

  const COLORS = ['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A'];

  const maxVal = Math.max(...stages.map((s) => Number(current[s.key] || 0)), 1);

  return (
    <div style={{ width: '100%', fontFamily: 'system-ui, Arial, sans-serif' }}>
      {stages.map((stage, i) => {
        const val = current[stage.key] || 0;
        const prevVal = previous[stage.key] || 0;
        const pct = (val / maxVal) * 100;
        const change = pctChange(val, prevVal);
        const color = COLORS[i % COLORS.length];
        const width = Math.max(pct, 20);

        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            {/* Bar */}
            <div
              style={{
                flex: 1,
                background: '#F3F4F6',
                borderRadius: 6,
                height: 36,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${width}%`,
                  background: color,
                  height: '100%',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 12,
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {stage.label}
                </span>
              </div>
            </div>

            {/* Value */}
            <div style={{ width: 110, textAlign: 'right', paddingLeft: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{formatValue(stage.key, val)}</div>
              {change !== null && (
                <div style={{ fontSize: 11, color: change >= 0 ? '#10B981' : '#EF4444' }}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}