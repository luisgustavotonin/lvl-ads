import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';

const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtN = (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v || 0));
const fmtP = (v) => `${(v || 0).toFixed(2)}%`;

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', color: '#E1306C', bg: 'bg-pink-50', border: 'border-pink-200', textColor: 'text-pink-700' },
  { key: 'facebook', label: 'Facebook', color: '#1877F2', bg: 'bg-blue-50', border: 'border-blue-200', textColor: 'text-blue-700' },
  { key: 'messenger', label: 'Messenger', color: '#00B2FF', bg: 'bg-sky-50', border: 'border-sky-200', textColor: 'text-sky-700' },
  { key: 'audience_network', label: 'Audience Network', color: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-200', textColor: 'text-amber-700' },
];

function aggregateByPlatform(records) {
  const groups = {};
  for (const r of records || []) {
    const key = r.publisher_platform;
    if (!key) continue;
    if (!groups[key]) groups[key] = { spend: 0, impressions: 0, reach: 0, clicks: 0, link_clicks: 0 };
    groups[key].spend += r.spend || 0;
    groups[key].impressions += r.impressions || 0;
    groups[key].reach += r.reach || 0;
    groups[key].clicks += r.clicks || 0;
    groups[key].link_clicks += r.link_clicks || 0;
  }
  return groups;
}

function pctChange(curr, prev) {
  if (!prev || prev === 0) return curr > 0 ? null : null;
  return ((curr - prev) / prev) * 100;
}

function ChangeChip({ pct }) {
  if (pct === null || pct === undefined) return null;
  const positive = pct >= 0;
  return (
    <span className={`text-xs font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

export default function PlatformSummaryCards({ currentPlatformData = [], previousPlatformData = [] }) {
  const current = useMemo(() => aggregateByPlatform(currentPlatformData), [currentPlatformData]);
  const previous = useMemo(() => aggregateByPlatform(previousPlatformData), [previousPlatformData]);

  const activePlatforms = PLATFORMS.filter(p => current[p.key] && current[p.key].spend > 0);

  if (!activePlatforms.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-gray-700">Métricas por Plataforma</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {activePlatforms.map(platform => {
          const curr = current[platform.key] || {};
          const prev = previous[platform.key] || {};
          const ctr = curr.impressions > 0 ? (curr.link_clicks / curr.impressions) * 100 : 0;

          const metrics = [
            { label: 'Valor Investido', value: fmtR(curr.spend), pct: pctChange(curr.spend, prev.spend) },
            { label: 'Alcance', value: fmtN(curr.reach), pct: pctChange(curr.reach, prev.reach) },
            { label: 'Impressões', value: fmtN(curr.impressions), pct: pctChange(curr.impressions, prev.impressions) },
            { label: 'Cliques', value: fmtN(curr.clicks), pct: pctChange(curr.clicks, prev.clicks) },
          ];

          return (
            <Card key={platform.key} className={`border ${platform.border} ${platform.bg}`}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: platform.color }} />
                  <span className={`text-sm font-bold ${platform.textColor}`}>{platform.label}</span>
                </div>
                <div className="space-y-2">
                  {metrics.map(m => (
                    <div key={m.label} className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{m.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900">{m.value}</span>
                        <ChangeChip pct={m.pct} />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-gray-200 pt-1.5 mt-1.5">
                    <span className="text-xs text-gray-500">CTR Link</span>
                    <span className="text-sm font-semibold text-gray-900">{fmtP(ctr)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}