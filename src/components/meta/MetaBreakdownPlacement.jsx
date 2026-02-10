import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

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
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="spend" fill="#3B82F6" radius={[0, 8, 8, 0]}>
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Investimento por Placement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={placementData}
                  dataKey="spend"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {placementData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => formatCurrency(value)} 
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}