import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function MetaBreakdownPlacement({ metaAdDaily }) {
  const { platformData, placementData } = useMemo(() => {
    const platforms = {};
    const placements = {};
    
    metaAdDaily.forEach(ad => {
      if (!ad.placement_json) return;
      
      // Tentar extrair plataforma e placement
      const placementStr = JSON.stringify(ad.placement_json).toLowerCase();
      
      // Detectar plataforma
      let platform = 'other';
      if (placementStr.includes('facebook')) platform = 'facebook';
      else if (placementStr.includes('instagram')) platform = 'instagram';
      else if (placementStr.includes('audience_network')) platform = 'audience_network';
      else if (placementStr.includes('messenger')) platform = 'messenger';
      
      if (!platforms[platform]) {
        platforms[platform] = { name: platform, spend: 0, impressions: 0, clicks: 0, conversations: 0 };
      }
      platforms[platform].spend += ad.spend || 0;
      platforms[platform].impressions += ad.impressions || 0;
      platforms[platform].clicks += ad.clicks || 0;
      platforms[platform].conversations += ad.wa_conversations_started_7d || 0;
      
      // Detectar placement específico
      let placement = 'other';
      if (placementStr.includes('feed')) placement = 'feed';
      else if (placementStr.includes('reels')) placement = 'reels';
      else if (placementStr.includes('stories')) placement = 'stories';
      else if (placementStr.includes('search')) placement = 'search';
      else if (placementStr.includes('right_column')) placement = 'right_column';
      
      if (!placements[placement]) {
        placements[placement] = { name: placement, spend: 0, impressions: 0, clicks: 0, conversations: 0 };
      }
      placements[placement].spend += ad.spend || 0;
      placements[placement].impressions += ad.impressions || 0;
      placements[placement].clicks += ad.clicks || 0;
      placements[placement].conversations += ad.wa_conversations_started_7d || 0;
    });
    
    return {
      platformData: Object.values(platforms).sort((a, b) => b.spend - a.spend),
      placementData: Object.values(placements).sort((a, b) => b.spend - a.spend),
    };
  }, [metaAdDaily]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Investimento por Plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={platformData}
                  dataKey="spend"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.name}: ${formatCurrency(entry.spend)}`}
                >
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {platformData.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 capitalize">{p.name}</span>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{formatCurrency(p.spend)}</div>
                  <div className="text-xs text-gray-500">{formatNumber(p.impressions)} impressões • {formatNumber(p.conversations)} conversas</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Investimento por Placement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={placementData}
                  dataKey="spend"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.name}: ${formatCurrency(entry.spend)}`}
                >
                  {placementData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {placementData.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 capitalize">{p.name}</span>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{formatCurrency(p.spend)}</div>
                  <div className="text-xs text-gray-500">{formatNumber(p.impressions)} impressões • {formatNumber(p.conversations)} conversas</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}