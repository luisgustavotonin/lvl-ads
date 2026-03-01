import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtN = (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v || 0));
const fmtP = (v) => `${(v || 0).toFixed(2)}%`;

const PLATFORM_LABELS = {
  facebook: 'Facebook', instagram: 'Instagram',
  audience_network: 'Audience Network', messenger: 'Messenger'
};
const PLATFORM_COLORS = { facebook: '#1877F2', instagram: '#E1306C', audience_network: '#F59E0B', messenger: '#00B2FF' };

export default function ReportPlatforms({ unit, period }) {
  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ['platformBreakdown', unit?.account_id, period?.start, period?.end],
    queryFn: async () => {
      if (!unit?.account_id) return [];
      const s = format(period.start, 'yyyy-MM-dd');
      const e = format(period.end, 'yyyy-MM-dd');
      return base44.entities.MetaInsightByPlatformPosition.filter(
        { account_id: unit.account_id, date: { $gte: s, $lte: e } }, '-date', 5000
      );
    },
    enabled: !!unit?.account_id
  });

  const byPlatform = useMemo(() => {
    const groups = {};
    rawData.forEach(item => {
      const key = item.publisher_platform || 'unknown';
      if (!groups[key]) groups[key] = { platform: key, spend: 0, impressions: 0, reach: 0, link_clicks: 0, clicks: 0 };
      groups[key].spend += item.spend || 0;
      groups[key].impressions += item.impressions || 0;
      groups[key].reach += item.reach || 0;
      groups[key].link_clicks += item.link_clicks || 0;
      groups[key].clicks += item.clicks || 0;
    });
    return Object.values(groups).map(g => ({
      ...g,
      label: PLATFORM_LABELS[g.platform] || g.platform,
      color: PLATFORM_COLORS[g.platform] || '#6B7280',
      ctr_link: g.impressions > 0 ? (g.link_clicks / g.impressions) * 100 : 0,
      cpc_link: g.link_clicks > 0 ? g.spend / g.link_clicks : 0,
      cpm: g.impressions > 0 ? (g.spend / g.impressions) * 1000 : 0,
    })).sort((a, b) => b.spend - a.spend);
  }, [rawData]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (!rawData.length) return (
    <Card className="flex items-center justify-center h-64">
      <p className="text-gray-400">Sem dados de plataforma para o período selecionado.</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {byPlatform.map(p => (
          <Card key={p.platform}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{p.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{fmtR(p.spend)}</p>
              <p className="text-xs text-gray-500 mt-1">{fmtN(p.impressions)} impressões · CTR {fmtP(p.ctr_link)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[
          { title: 'Investimento por Plataforma', key: 'spend', fmt: fmtR, tickFmt: v => `R$${(v/1000).toFixed(0)}k` },
          { title: 'CTR Link por Plataforma', key: 'ctr_link', fmt: fmtP, tickFmt: v => `${v.toFixed(1)}%` },
          { title: 'CPC Link por Plataforma', key: 'cpc_link', fmt: fmtR, tickFmt: v => `R$${v.toFixed(2)}` },
          { title: 'Cliques no Link por Plataforma', key: 'link_clicks', fmt: fmtN, tickFmt: v => fmtN(v) },
        ].map(chart => (
          <Card key={chart.key}>
            <CardHeader><CardTitle className="text-base">{chart.title}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byPlatform} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={chart.tickFmt} />
                  <Tooltip formatter={v => chart.fmt(v)} labelFormatter={l => l} />
                  <Bar dataKey={chart.key} fill="#3B82F6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Comparativo por Plataforma</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['Plataforma','Investimento','Impressões','Alcance','Cliques Link','CTR Link','CPC Link','CPM'].map(h => (
                    <th key={h} className="text-left py-3 px-3 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byPlatform.map(p => (
                  <tr key={p.platform} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </td>
                    <td className="py-3 px-3">{fmtR(p.spend)}</td>
                    <td className="py-3 px-3">{fmtN(p.impressions)}</td>
                    <td className="py-3 px-3">{fmtN(p.reach)}</td>
                    <td className="py-3 px-3">{fmtN(p.link_clicks)}</td>
                    <td className="py-3 px-3">{fmtP(p.ctr_link)}</td>
                    <td className="py-3 px-3">{fmtR(p.cpc_link)}</td>
                    <td className="py-3 px-3">{fmtR(p.cpm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}