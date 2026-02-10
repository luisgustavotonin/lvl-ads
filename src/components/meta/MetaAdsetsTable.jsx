import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function MetaAdsetsTable({ metaAdDaily }) {
  const adsets = useMemo(() => {
    const byAdset = {};
    
    metaAdDaily.forEach(ad => {
      const key = ad.adset_id;
      if (!byAdset[key]) {
        byAdset[key] = {
          adset_id: ad.adset_id,
          adset_name: ad.adset_name,
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          link_clicks: 0,
          conversations: 0,
        };
      }
      
      byAdset[key].spend += ad.spend || 0;
      byAdset[key].impressions += ad.impressions || 0;
      byAdset[key].reach += ad.reach || 0;
      byAdset[key].clicks += ad.clicks || 0;
      byAdset[key].link_clicks += ad.link_clicks || 0;
      byAdset[key].conversations += ad.wa_conversations_started_7d || 0;
    });
    
    return Object.values(byAdset).map(a => ({
      ...a,
      ctr_link: a.impressions > 0 ? (a.link_clicks / a.impressions) * 100 : 0,
      cpc_link: a.link_clicks > 0 ? a.spend / a.link_clicks : 0,
      cost_per_conversation: a.conversations > 0 ? a.spend / a.conversations : 0,
    })).sort((a, b) => b.spend - a.spend);
  }, [metaAdDaily]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));
  const formatPercent = (val) => `${val.toFixed(2)}%`;

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Conjuntos de Anúncios em Destaque</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conjunto de Anúncio</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Investimento</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impressões</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Alcance</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cliques no link</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR Link</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPC Link</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conversas</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo/Conversa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {adsets.slice(0, 20).map((a, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{a.adset_name}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(a.spend)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatNumber(a.impressions)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatNumber(a.reach)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatNumber(a.link_clicks)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatPercent(a.ctr_link)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(a.cpc_link)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatNumber(a.conversations)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(a.cost_per_conversation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}