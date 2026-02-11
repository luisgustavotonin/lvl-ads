import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageIcon } from 'lucide-react';
import AdPreviewModal from './AdPreviewModal';

export default function MetaAdsTable({ metaAdDaily }) {
  const [selectedAd, setSelectedAd] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const ads = useMemo(() => {
    const byAd = {};
    
    metaAdDaily.forEach(ad => {
      const key = `${ad.ad_id}_${ad.date}`;
      if (!byAd[key]) {
        byAd[key] = {
          ad_id: ad.ad_id,
          ad_name: ad.ad_name,
          ad_effective_status: ad.ad_effective_status,
          creative_id: ad.creative_id,
          creative_thumbnail_url: ad.creative_thumbnail_url,
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          link_clicks: 0,
          conversations: 0,
        };
      }
      
      byAd[key].spend += ad.spend || 0;
      byAd[key].impressions += ad.impressions || 0;
      byAd[key].reach += ad.reach || 0;
      byAd[key].clicks += ad.clicks || 0;
      byAd[key].link_clicks += ad.link_clicks || 0;
      byAd[key].conversations += ad.wa_conversations_started_7d || 0;
    });
    
    return Object.values(byAd).map(a => ({
      ...a,
      ctr_link: a.impressions > 0 ? (a.link_clicks / a.impressions) * 100 : 0,
      cpc_link: a.link_clicks > 0 ? a.spend / a.link_clicks : 0,
      cost_per_conversation: a.conversations > 0 ? a.spend / a.conversations : 0,
    })).sort((a, b) => b.spend - a.spend);
  }, [metaAdDaily]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));
  const formatPercent = (val) => `${val.toFixed(2)}%`;

  const getStatusColor = (status) => {
    if (status === 'ACTIVE') return 'bg-green-100 text-green-700';
    if (status === 'PAUSED') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const handleAdClick = (ad) => {
    setSelectedAd(ad);
    setModalOpen(true);
  };

  return (
    <>
      <AdPreviewModal 
        ad={selectedAd} 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Anúncios em Destaque</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criativo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anúncio</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
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
              {ads.slice(0, 20).map((a, idx) => (
                <tr 
                  key={idx} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleAdClick(a)}
                >
                  <td className="px-4 py-3">
                    {a.creative_thumbnail_url ? (
                      <img 
                        src={a.creative_thumbnail_url} 
                        alt={a.ad_name}
                        className="w-12 h-12 object-cover rounded border border-gray-200"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '';
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = '<div class="w-12 h-12 bg-gray-100 rounded flex items-center justify-center"><svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center border border-gray-200">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{a.ad_name}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${getStatusColor(a.ad_effective_status)}`}>
                      {a.ad_effective_status}
                    </Badge>
                  </td>
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
    </>
  );
}