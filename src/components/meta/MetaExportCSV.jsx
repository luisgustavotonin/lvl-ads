import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export default function MetaExportCSV({ metricsDaily, metaAdDaily, unitName, period }) {
  const exportMetricsDaily = () => {
    const headers = [
      'Data',
      'Unit ID',
      'Account ID',
      'Investimento',
      'Impressões',
      'Alcance',
      'Cliques',
      'Cliques no Link',
      'Frequência',
      'CTR Link (%)',
      'CPC Link',
      'CPM',
      'Conversas',
      'Custo/Conversa',
    ];
    
    const rows = metricsDaily.map(m => [
      m.date,
      m.unit_id,
      m.account_id,
      m.spend_sum,
      m.impressions_sum,
      m.reach_sum,
      m.clicks_sum,
      m.link_clicks_sum,
      m.frequency_calc,
      m.ctr_link_calc * 100,
      m.cpc_link_calc,
      m.cpm_calc,
      m.wa_conversations_started_7d_sum,
      m.cost_per_conversation_calc,
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `meta-metrics-daily-${unitName}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportCampaigns = () => {
    const byCampaign = {};
    metaAdDaily.forEach(ad => {
      if (!byCampaign[ad.campaign_id]) {
        byCampaign[ad.campaign_id] = {
          campaign_name: ad.campaign_name,
          spend: 0,
          impressions: 0,
          reach: 0,
          link_clicks: 0,
          conversations: 0,
        };
      }
      byCampaign[ad.campaign_id].spend += ad.spend || 0;
      byCampaign[ad.campaign_id].impressions += ad.impressions || 0;
      byCampaign[ad.campaign_id].reach += ad.reach || 0;
      byCampaign[ad.campaign_id].link_clicks += ad.link_clicks || 0;
      byCampaign[ad.campaign_id].conversations += ad.wa_conversations_started_7d || 0;
    });
    
    const campaigns = Object.values(byCampaign).map(c => ({
      ...c,
      ctr_link: c.impressions > 0 ? (c.link_clicks / c.impressions) * 100 : 0,
      cpc_link: c.link_clicks > 0 ? c.spend / c.link_clicks : 0,
      cost_per_conversation: c.conversations > 0 ? c.spend / c.conversations : 0,
    }));
    
    const headers = [
      'Campanha',
      'Investimento',
      'Impressões',
      'Alcance',
      'Cliques no Link',
      'CTR Link (%)',
      'CPC Link',
      'Conversas',
      'Custo/Conversa',
    ];
    
    const rows = campaigns.map(c => [
      c.campaign_name,
      c.spend,
      c.impressions,
      c.reach,
      c.link_clicks,
      c.ctr_link,
      c.cpc_link,
      c.conversations,
      c.cost_per_conversation,
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `meta-campanhas-${unitName}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={exportMetricsDaily}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Download className="w-4 h-4" />
        CSV Métricas Diárias
      </Button>
      <Button
        onClick={exportCampaigns}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Download className="w-4 h-4" />
        CSV Campanhas
      </Button>
    </div>
  );
}