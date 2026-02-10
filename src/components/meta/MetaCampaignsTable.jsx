import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function MetaCampaignsTable({ metaAdDaily }) {
  const campaigns = useMemo(() => {
    const byCampaign = {};
    
    metaAdDaily.forEach(ad => {
      const key = ad.campaign_id;
      if (!byCampaign[key]) {
        byCampaign[key] = {
          campaign_id: ad.campaign_id,
          campaign_name: ad.campaign_name,
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          link_clicks: 0,
          conversations: 0,
        };
      }
      
      byCampaign[key].spend += ad.spend || 0;
      byCampaign[key].impressions += ad.impressions || 0;
      byCampaign[key].reach += ad.reach || 0;
      byCampaign[key].clicks += ad.clicks || 0;
      byCampaign[key].link_clicks += ad.link_clicks || 0;
      byCampaign[key].conversations += ad.wa_conversations_started_7d || 0;
    });
    
    return Object.values(byCampaign).map(c => ({
      ...c,
      ctr_link: c.impressions > 0 ? (c.link_clicks / c.impressions) * 100 : 0,
      cpc_link: c.link_clicks > 0 ? c.spend / c.link_clicks : 0,
      cost_per_conversation: c.conversations > 0 ? c.spend / c.conversations : 0,
    })).sort((a, b) => b.spend - a.spend);
  }, [metaAdDaily]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));
  const formatPercent = (val) => `${val.toFixed(2)}%`;

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Campanhas em Destaque</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campanha</th>
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
              {campaigns.slice(0, 20).map((c, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{c.campaign_name}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(c.spend)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatNumber(c.impressions)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatNumber(c.reach)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatNumber(c.link_clicks)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatPercent(c.ctr_link)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(c.cpc_link)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatNumber(c.conversations)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(c.cost_per_conversation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}