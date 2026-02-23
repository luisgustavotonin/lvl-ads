import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ImageOff, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtN = (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v || 0));
const fmtP = (v) => `${(v || 0).toFixed(2)}%`;

export default function ReportCreatives({ unit, period }) {
  const [selectedCreative, setSelectedCreative] = useState(null);
  const [sortBy, setSortBy] = useState('spend');
  const [search, setSearch] = useState('');

  const { data: creativesData = [], isLoading: loadingCreatives } = useQuery({
    queryKey: ['creativesGallery', unit?.account_id],
    queryFn: async () => {
      if (!unit?.account_id) return [];
      return base44.entities.MetaAdsCreative.filter({ account_id: unit.account_id }, '-last_updated', 2000);
    },
    enabled: !!unit?.account_id
  });

  const { data: insightsData = [], isLoading: loadingInsights } = useQuery({
    queryKey: ['creativesInsights', unit?.account_id, period?.start, period?.end],
    queryFn: async () => {
      if (!unit?.account_id) return [];
      const s = format(period.start, 'yyyy-MM-dd');
      const e = format(period.end, 'yyyy-MM-dd');
      return base44.entities.MetaInsightBase.filter(
        { account_id: unit.account_id, date: { $gte: s, $lte: e } }, '-date', 10000
      );
    },
    enabled: !!unit?.account_id
  });

  // Aggregate insights by ad_id
  const aggregatedByAd = useMemo(() => {
    const groups = {};
    insightsData.forEach(item => {
      const key = item.ad_id;
      if (!key) return;
      if (!groups[key]) groups[key] = {
        ad_id: key, ad_name: item.ad_name || key,
        spend: 0, impressions: 0, link_clicks: 0, conversations: 0, reach: 0
      };
      groups[key].spend += item.spend || 0;
      groups[key].impressions += item.impressions || 0;
      groups[key].link_clicks += item.link_clicks || 0;
      groups[key].conversations += item.messaging_conversations_started || 0;
      groups[key].reach += item.reach || 0;
    });
    return Object.values(groups).map(g => ({
      ...g,
      ctr_link: g.impressions > 0 ? (g.link_clicks / g.impressions) * 100 : 0,
      cpc_link: g.link_clicks > 0 ? g.spend / g.link_clicks : 0,
      cpm: g.impressions > 0 ? (g.spend / g.impressions) * 1000 : 0,
      cost_per_conversation: g.conversations > 0 ? g.spend / g.conversations : 0,
    }));
  }, [insightsData]);

  // Merge with creatives
  const creativeCards = useMemo(() => {
    const creativeMap = {};
    creativesData.forEach(c => {
      if (c.ad_id) creativeMap[c.ad_id] = c;
    });
    return aggregatedByAd.map(ad => ({
      ...ad,
      thumbnail_url: creativeMap[ad.ad_id]?.thumbnail_url || creativeMap[ad.ad_id]?.image_url || null,
      creative_name: creativeMap[ad.ad_id]?.name || ad.ad_name,
      body: creativeMap[ad.ad_id]?.body || null,
      title: creativeMap[ad.ad_id]?.title || null,
      object_type: creativeMap[ad.ad_id]?.object_type || null,
    }));
  }, [aggregatedByAd, creativesData]);

  // Filter + sort
  const displayCards = useMemo(() => {
    let result = creativeCards;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => (c.creative_name || '').toLowerCase().includes(q) || (c.ad_name || '').toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [creativeCards, sortBy, search]);

  // Time series for selected creative
  const creativeDailyData = useMemo(() => {
    if (!selectedCreative) return [];
    const byDate = {};
    insightsData.filter(item => item.ad_id === selectedCreative.ad_id).forEach(item => {
      if (!byDate[item.date]) byDate[item.date] = { date: item.date, spend: 0, conversations: 0, link_clicks: 0 };
      byDate[item.date].spend += item.spend || 0;
      byDate[item.date].conversations += item.messaging_conversations_started || 0;
      byDate[item.date].link_clicks += item.link_clicks || 0;
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedCreative, insightsData]);

  const isLoading = loadingCreatives || loadingInsights;

  if (isLoading) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar criativo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="spend">Ordenar por Investimento</SelectItem>
            <SelectItem value="conversations">Ordenar por Conversas</SelectItem>
            <SelectItem value="link_clicks">Ordenar por Cliques</SelectItem>
            <SelectItem value="impressions">Ordenar por Impressões</SelectItem>
            <SelectItem value="ctr_link">Ordenar por CTR</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-500">{displayCards.length} criativos</span>
      </div>

      {displayCards.length === 0 ? (
        <Card className="flex items-center justify-center h-64">
          <p className="text-gray-400">Sem dados de criativos para o período selecionado.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {displayCards.map(card => (
            <div
              key={card.ad_id}
              onClick={() => setSelectedCreative(card)}
              className="bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition-all overflow-hidden group"
            >
              {/* Thumbnail */}
              <div className="relative bg-gray-100 aspect-square overflow-hidden">
                {card.thumbnail_url ? (
                  <img
                    src={card.thumbnail_url}
                    alt={card.creative_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div className={`${card.thumbnail_url ? 'hidden' : 'flex'} w-full h-full items-center justify-center text-gray-300`}>
                  <ImageOff className="w-10 h-10" />
                </div>
                {card.conversations > 0 && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow">
                    {fmtN(card.conversations)} conv.
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-xs font-semibold text-gray-800 line-clamp-2 mb-2">{card.creative_name || card.ad_name}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Investimento</span>
                    <span className="font-semibold text-gray-800">{fmtR(card.spend)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Cliques Link</span>
                    <span className="font-semibold text-gray-800">{fmtN(card.link_clicks)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">CTR</span>
                    <span className="font-semibold text-blue-600">{fmtP(card.ctr_link)}</span>
                  </div>
                  {card.cost_per_conversation > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Custo/Conv.</span>
                      <span className="font-semibold text-orange-600">{fmtR(card.cost_per_conversation)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedCreative} onOpenChange={open => !open && setSelectedCreative(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedCreative && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-base pr-6">{selectedCreative.creative_name || selectedCreative.ad_name}</SheetTitle>
              </SheetHeader>

              {/* Image */}
              {selectedCreative.thumbnail_url && (
                <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  <img src={selectedCreative.thumbnail_url} alt="" className="w-full max-h-72 object-contain" />
                </div>
              )}

              {/* Metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {[
                  { label: 'Investimento', value: fmtR(selectedCreative.spend) },
                  { label: 'Impressões', value: fmtN(selectedCreative.impressions) },
                  { label: 'Alcance', value: fmtN(selectedCreative.reach) },
                  { label: 'Cliques Link', value: fmtN(selectedCreative.link_clicks) },
                  { label: 'CTR Link', value: fmtP(selectedCreative.ctr_link) },
                  { label: 'CPC Link', value: fmtR(selectedCreative.cpc_link) },
                  { label: 'CPM', value: fmtR(selectedCreative.cpm) },
                  { label: 'Conversas', value: fmtN(selectedCreative.conversations) },
                  { label: 'Custo/Conv.', value: selectedCreative.cost_per_conversation > 0 ? fmtR(selectedCreative.cost_per_conversation) : 'N/D' },
                ].map(m => (
                  <div key={m.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                    <p className="text-sm font-bold text-gray-800">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Time series */}
              {creativeDailyData.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-gray-700">Evolução no Período</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={creativeDailyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => `R$${v.toFixed(0)}`} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v, name) => name === 'spend' ? fmtR(v) : fmtN(v)} labelFormatter={d => d} />
                        <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#3B82F6" strokeWidth={2} dot={false} name="Investimento" />
                        <Line yAxisId="right" type="monotone" dataKey="link_clicks" stroke="#10B981" strokeWidth={2} dot={false} name="Cliques" />
                        {selectedCreative.conversations > 0 && (
                          <Line yAxisId="right" type="monotone" dataKey="conversations" stroke="#F59E0B" strokeWidth={2} dot={false} name="Conversas" />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Investimento</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" /> Cliques Link</span>
                    {selectedCreative.conversations > 0 && <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 inline-block" /> Conversas</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}