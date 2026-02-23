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

const DEVICE_LABELS = {
  desktop: 'Desktop', iphone: 'iPhone', ipad: 'iPad',
  android_smartphone: 'Android Phone', android_tablet: 'Android Tablet',
  other: 'Outros'
};

export default function ReportDevice({ unit, period }) {
  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ['deviceBreakdown', unit?.account_id, period?.start, period?.end],
    queryFn: async () => {
      if (!unit?.account_id) return [];
      const s = format(period.start, 'yyyy-MM-dd');
      const e = format(period.end, 'yyyy-MM-dd');
      return base44.entities.MetaInsightByDevice.filter(
        { account_id: unit.account_id, date: { $gte: s, $lte: e } }, '-date', 5000
      );
    },
    enabled: !!unit?.account_id
  });

  const byDevice = useMemo(() => {
    const groups = {};
    rawData.forEach(item => {
      const raw_key = item.impression_device || 'unknown';
      // Group rare devices into "others" if outside top known devices
      const key = raw_key;
      if (!groups[key]) groups[key] = { device: key, spend: 0, impressions: 0, reach: 0, link_clicks: 0, clicks: 0 };
      groups[key].spend += item.spend || 0;
      groups[key].impressions += item.impressions || 0;
      groups[key].reach += item.reach || 0;
      groups[key].link_clicks += item.link_clicks || 0;
      groups[key].clicks += item.clicks || 0;
    });

    const all = Object.values(groups).map(g => ({
      ...g,
      label: DEVICE_LABELS[g.device] || g.device,
      ctr_link: g.impressions > 0 ? (g.link_clicks / g.impressions) * 100 : 0,
      cpc_link: g.link_clicks > 0 ? g.spend / g.link_clicks : 0,
      cpm: g.impressions > 0 ? (g.spend / g.impressions) * 1000 : 0,
    })).sort((a, b) => b.spend - a.spend);

    // Top 8 + others
    if (all.length <= 8) return all;
    const top = all.slice(0, 8);
    const rest = all.slice(8).reduce((acc, g) => ({
      ...acc, spend: acc.spend + g.spend, impressions: acc.impressions + g.impressions,
      reach: acc.reach + g.reach, link_clicks: acc.link_clicks + g.link_clicks
    }), { device: 'others', label: 'Outros', spend: 0, impressions: 0, reach: 0, link_clicks: 0, clicks: 0 });
    rest.ctr_link = rest.impressions > 0 ? (rest.link_clicks / rest.impressions) * 100 : 0;
    rest.cpc_link = rest.link_clicks > 0 ? rest.spend / rest.link_clicks : 0;
    rest.cpm = rest.impressions > 0 ? (rest.spend / rest.impressions) * 1000 : 0;
    return [...top, rest];
  }, [rawData]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (!rawData.length) return (
    <Card className="flex items-center justify-center h-64">
      <p className="text-gray-400">Sem dados de device para o período selecionado.</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Investimento por Device</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byDevice} layout="vertical" margin={{ top: 0, right: 24, left: 100, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={90} />
                <Tooltip formatter={v => fmtR(v)} />
                <Bar dataKey="spend" fill="#3B82F6" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">CTR Link por Device</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byDevice} layout="vertical" margin={{ top: 0, right: 24, left: 100, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `${v.toFixed(1)}%`} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={90} />
                <Tooltip formatter={v => fmtP(v)} />
                <Bar dataKey="ctr_link" fill="#10B981" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">CPC Link por Device</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byDevice} layout="vertical" margin={{ top: 0, right: 24, left: 100, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `R$${v.toFixed(2)}`} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={90} />
                <Tooltip formatter={v => fmtR(v)} />
                <Bar dataKey="cpc_link" fill="#8B5CF6" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Detalhamento por Device</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['Device','Investimento','Impressões','Alcance','Cliques Link','CTR Link','CPC Link','CPM'].map(h => (
                    <th key={h} className="text-left py-3 px-3 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byDevice.map(d => (
                  <tr key={d.device} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium">{d.label}</td>
                    <td className="py-3 px-3">{fmtR(d.spend)}</td>
                    <td className="py-3 px-3">{fmtN(d.impressions)}</td>
                    <td className="py-3 px-3">{fmtN(d.reach)}</td>
                    <td className="py-3 px-3">{fmtN(d.link_clicks)}</td>
                    <td className="py-3 px-3">{fmtP(d.ctr_link)}</td>
                    <td className="py-3 px-3">{fmtR(d.cpc_link)}</td>
                    <td className="py-3 px-3">{fmtR(d.cpm)}</td>
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