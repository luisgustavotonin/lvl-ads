import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function MetaBreakdownDevices({ metaAdDaily }) {
  const devicesData = useMemo(() => {
    const devices = {};
    
    metaAdDaily.forEach(ad => {
      if (!ad.devices_json) return;
      
      const devicesArr = Array.isArray(ad.devices_json) ? ad.devices_json : [ad.devices_json];
      
      devicesArr.forEach(device => {
        const key = device.impression_device || device.device_platform || 'unknown';
        
        if (!devices[key]) {
          devices[key] = { name: key, spend: 0, impressions: 0, clicks: 0, conversations: 0 };
        }
        
        devices[key].spend += ad.spend || 0;
        devices[key].impressions += ad.impressions || 0;
        devices[key].clicks += ad.clicks || 0;
        devices[key].conversations += ad.wa_conversations_started_7d || 0;
      });
    });
    
    return Object.values(devices).sort((a, b) => b.spend - a.spend);
  }, [metaAdDaily]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Investimento por Dispositivo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={devicesData}
                dataKey="spend"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {devicesData.map((entry, index) => (
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
        <div className="mt-4 space-y-2">
          {devicesData.map((d, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 capitalize">{d.name}</span>
              <div className="text-right">
                <div className="font-semibold text-gray-900">{formatCurrency(d.spend)}</div>
                <div className="text-xs text-gray-500">
                  {formatNumber(d.impressions)} impressões • {formatNumber(d.clicks)} cliques • {formatNumber(d.conversations)} conversas
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}