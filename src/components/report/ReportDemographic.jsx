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

const AGE_ORDER = ['13-17','18-24','25-34','35-44','45-54','55-64','65+'];
const GENDER_LABELS = { male: 'Masculino', female: 'Feminino', unknown: 'Desconhecido' };

function getHeatColor(value, min, max) {
  if (!value || max === min) return 'bg-gray-50 text-gray-500';
  const ratio = (value - min) / (max - min);
  if (ratio < 0.33) return 'bg-green-100 text-green-800';
  if (ratio < 0.66) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function DemoTable({ title, data, dimKey, dimLabel, dimFormatter }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {[dimLabel,'Investimento','Impressões','Cliques Link','CTR Link','CPC Link'].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d[dimKey]} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium">{dimFormatter ? dimFormatter(d[dimKey]) : d[dimKey]}</td>
                  <td className="py-2 px-3">{fmtR(d.spend)}</td>
                  <td className="py-2 px-3">{fmtN(d.impressions)}</td>
                  <td className="py-2 px-3">{fmtN(d.link_clicks)}</td>
                  <td className="py-2 px-3">{fmtP(d.ctr_link)}</td>
                  <td className="py-2 px-3">{fmtR(d.cpc_link)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportDemographic({ unit, period }) {
  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ['demographicBreakdown', unit?.account_id, period?.start, period?.end],
    queryFn: async () => {
      if (!unit?.account_id) return [];
      const s = format(period.start, 'yyyy-MM-dd');
      const e = format(period.end, 'yyyy-MM-dd');
      return base44.entities.MetaInsightByDemographic.filter(
        { account_id: unit.account_id, date: { $gte: s, $lte: e } }, '-date', 5000
      );
    },
    enabled: !!unit?.account_id
  });

  const { byAge, byGender, crossTab } = useMemo(() => {
    const ageGroups = {}, genderGroups = {}, crossGroups = {};

    rawData.forEach(item => {
      const age = item.age || 'unknown';
      const gender = item.gender || 'unknown';
      const cross = `${age}||${gender}`;

      [
        [ageGroups, age],
        [genderGroups, gender],
        [crossGroups, cross],
      ].forEach(([groups, key]) => {
        if (!groups[key]) groups[key] = { key, spend: 0, impressions: 0, reach: 0, link_clicks: 0 };
        groups[key].spend += item.spend || 0;
        groups[key].impressions += item.impressions || 0;
        groups[key].reach += item.reach || 0;
        groups[key].link_clicks += item.link_clicks || 0;
      });
    });

    const calc = (g) => ({
      ...g,
      ctr_link: g.impressions > 0 ? (g.link_clicks / g.impressions) * 100 : 0,
      cpc_link: g.link_clicks > 0 ? g.spend / g.link_clicks : 0,
      cpm: g.impressions > 0 ? (g.spend / g.impressions) * 1000 : 0,
    });

    const byAge = Object.values(ageGroups).map(calc).sort((a, b) => {
      const ai = AGE_ORDER.indexOf(a.key), bi = AGE_ORDER.indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }).map(g => ({ ...g, age: g.key }));

    const byGender = Object.values(genderGroups).map(calc).sort((a, b) => b.spend - a.spend)
      .map(g => ({ ...g, gender: g.key }));

    const crossTab = Object.entries(crossGroups).map(([key, g]) => {
      const [age, gender] = key.split('||');
      return { ...calc(g), age, gender };
    });

    return { byAge, byGender, crossTab };
  }, [rawData]);

  // Heatmap: age rows × gender cols
  const ages = [...new Set(crossTab.map(d => d.age))].sort((a, b) => {
    const ai = AGE_ORDER.indexOf(a), bi = AGE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const genders = [...new Set(crossTab.map(d => d.gender))];
  const crossMap = {};
  crossTab.forEach(d => { crossMap[`${d.age}||${d.gender}`] = d; });

  const allSpends = crossTab.map(d => d.spend).filter(v => v > 0);
  const spendMin = Math.min(...allSpends);
  const spendMax = Math.max(...allSpends);

  // Top/Bottom segments
  const sortedCross = [...crossTab].filter(d => d.spend > 0).sort((a, b) => a.cpc_link - b.cpc_link);
  const top10 = sortedCross.slice(0, 10);
  const bottom10 = [...sortedCross].reverse().slice(0, 10);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (!rawData.length) return (
    <Card className="flex items-center justify-center h-64">
      <p className="text-gray-400">Sem dados demográficos para o período selecionado.</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Investimento por Faixa Etária</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byAge} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="age" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmtR(v)} />
                <Bar dataKey="spend" fill="#3B82F6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Investimento por Gênero</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byGender} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="gender" tickFormatter={k => GENDER_LABELS[k] || k} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmtR(v)} labelFormatter={l => GENDER_LABELS[l] || l} />
                <Bar dataKey="spend" fill="#8B5CF6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables by age and gender */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DemoTable title="Por Faixa Etária" data={byAge} dimKey="age" dimLabel="Idade" />
        <DemoTable title="Por Gênero" data={byGender} dimKey="gender" dimLabel="Gênero" dimFormatter={k => GENDER_LABELS[k] || k} />
      </div>

      {/* Heatmap age × gender */}
      {ages.length > 0 && genders.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Heatmap: Investimento por Idade × Gênero</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-gray-500 font-medium">Idade</th>
                    {genders.map(g => <th key={g} className="p-2 font-semibold text-gray-600 min-w-[100px]">{GENDER_LABELS[g] || g}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ages.map(age => (
                    <tr key={age}>
                      <td className="p-2 font-semibold text-gray-700">{age}</td>
                      {genders.map(gender => {
                        const cell = crossMap[`${age}||${gender}`];
                        return (
                          <td key={gender} className="p-1">
                            {cell ? (
                              <div className={`rounded-lg p-2 text-center ${getHeatColor(cell.spend, spendMin, spendMax)}`}>
                                <div className="font-bold text-sm">{fmtR(cell.spend)}</div>
                                <div className="text-xs opacity-75">{fmtN(cell.link_clicks)} cliques</div>
                              </div>
                            ) : (
                              <div className="rounded-lg p-2 text-center bg-gray-50 text-gray-400 text-xs">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">🟢 Menor investimento · 🔴 Maior investimento</p>
          </CardContent>
        </Card>
      )}

      {/* Top / Bottom segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base text-green-700">Top 10 Segmentos (menor CPC Link)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {top10.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm text-gray-700">{d.age} · {GENDER_LABELS[d.gender] || d.gender}</span>
                  <div className="flex gap-3 text-sm">
                    <span className="text-gray-500">{fmtR(d.spend)}</span>
                    <span className="font-semibold text-green-700">{fmtR(d.cpc_link)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base text-red-700">Top 10 Segmentos (maior CPC Link)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bottom10.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm text-gray-700">{d.age} · {GENDER_LABELS[d.gender] || d.gender}</span>
                  <div className="flex gap-3 text-sm">
                    <span className="text-gray-500">{fmtR(d.spend)}</span>
                    <span className="font-semibold text-red-700">{fmtR(d.cpc_link)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}