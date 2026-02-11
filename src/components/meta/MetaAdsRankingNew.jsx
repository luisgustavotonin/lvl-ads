import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Image } from 'lucide-react';

export default function MetaAdsRankingNew({ metaAdDaily = [] }) {
  const [topN, setTopN] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');

  const processedAds = useMemo(() => {
    const byAd = {};
    
    metaAdDaily.forEach(ad => {
      const key = ad.ad_id;
      if (!byAd[key]) {
        byAd[key] = {
          ad_id: ad.ad_id,
          ad_name: ad.ad_name,
          ad_effective_status: ad.ad_effective_status,
          creative_thumbnail_url: ad.creative_thumbnail_url,
          spend: 0,
          impressions: 0,
          link_clicks: 0,
          wa_conversations_started_7d: 0,
        };
      }
      
      byAd[key].spend += ad.spend || 0;
      byAd[key].impressions += ad.impressions || 0;
      byAd[key].link_clicks += ad.link_clicks || 0;
      byAd[key].wa_conversations_started_7d += ad.wa_conversations_started_7d || 0;
      
      // Manter último status e thumbnail
      if (ad.ad_effective_status) byAd[key].ad_effective_status = ad.ad_effective_status;
      if (ad.creative_thumbnail_url) byAd[key].creative_thumbnail_url = ad.creative_thumbnail_url;
    });

    let filtered = Object.values(byAd);
    
    // Filtro de status
    if (statusFilter === 'active') {
      filtered = filtered.filter(a => a.ad_effective_status === 'ACTIVE');
    } else if (statusFilter === 'paused') {
      filtered = filtered.filter(a => a.ad_effective_status === 'PAUSED');
    }
    
    return filtered
      .sort((a, b) => b.spend - a.spend)
      .slice(0, topN)
      .map((a, idx) => ({
        ...a,
        rank: idx + 1,
        ctr_link: a.impressions > 0 ? (a.link_clicks / a.impressions) * 100 : 0,
        cpc_link: a.link_clicks > 0 ? a.spend / a.link_clicks : 0,
        cost_per_conversation: a.wa_conversations_started_7d > 0 ? a.spend / a.wa_conversations_started_7d : 0,
      }));
  }, [metaAdDaily, topN, statusFilter]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));

  const getStatusBadge = (status) => {
    const variants = {
      'ACTIVE': { color: 'bg-green-100 text-green-800', label: 'Ativo' },
      'PAUSED': { color: 'bg-gray-100 text-gray-800', label: 'Pausado' },
      'DISAPPROVED': { color: 'bg-red-100 text-red-800', label: 'Reprovado' },
      'ERROR': { color: 'bg-red-100 text-red-800', label: 'Erro' },
    };
    const config = variants[status] || { color: 'bg-gray-100 text-gray-800', label: status || '—' };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Ranking de Anúncios</CardTitle>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="paused">Pausados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(topN)} onValueChange={(v) => setTopN(parseInt(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Top 5</SelectItem>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="15">Top 15</SelectItem>
                <SelectItem value="30">Top 30</SelectItem>
                <SelectItem value="50">Top 50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {processedAds.map(ad => (
            <div key={ad.ad_id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50">
              <div className="text-xl font-bold text-gray-400 w-8">
                {ad.rank}
              </div>
              
              <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                {ad.creative_thumbnail_url ? (
                  <img
                    src={ad.creative_thumbnail_url}
                    alt="Thumbnail"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div style={{ display: ad.creative_thumbnail_url ? 'none' : 'flex' }} className="w-full h-full items-center justify-center">
                  <Image className="w-6 h-6 text-gray-400" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900 truncate">{ad.ad_name}</p>
                  {getStatusBadge(ad.ad_effective_status)}
                </div>
                <p className="text-xs text-gray-500 truncate">{ad.ad_id}</p>
              </div>
              
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="text-gray-500 text-xs">Investimento</div>
                  <div className="font-semibold">{formatCurrency(ad.spend)}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Conversas</div>
                  <div className="font-semibold">{formatNumber(ad.wa_conversations_started_7d)}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Custo/Conversa</div>
                  <div className="font-semibold">{formatCurrency(ad.cost_per_conversation)}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">CTR</div>
                  <div className="font-semibold">{ad.ctr_link.toFixed(2)}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}