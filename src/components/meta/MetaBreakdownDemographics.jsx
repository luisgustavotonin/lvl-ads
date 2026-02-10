import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function MetaBreakdownDemographics({ metaAdDaily }) {
  const { ageData, genderData } = useMemo(() => {
    const ages = {};
    const genders = {};
    
    metaAdDaily.forEach(ad => {
      if (!ad.demographics_json) return;
      
      const demographics = Array.isArray(ad.demographics_json) ? ad.demographics_json : [ad.demographics_json];
      
      demographics.forEach(demo => {
        // Age
        if (demo.age) {
          if (!ages[demo.age]) {
            ages[demo.age] = { age: demo.age, spend: 0, impressions: 0, conversations: 0 };
          }
          ages[demo.age].spend += ad.spend || 0;
          ages[demo.age].impressions += ad.impressions || 0;
          ages[demo.age].conversations += ad.wa_conversations_started_7d || 0;
        }
        
        // Gender
        if (demo.gender) {
          if (!genders[demo.gender]) {
            genders[demo.gender] = { gender: demo.gender, spend: 0, impressions: 0, conversations: 0 };
          }
          genders[demo.gender].spend += ad.spend || 0;
          genders[demo.gender].impressions += ad.impressions || 0;
          genders[demo.gender].conversations += ad.wa_conversations_started_7d || 0;
        }
      });
    });
    
    return {
      ageData: Object.values(ages).sort((a, b) => a.age.localeCompare(b.age)),
      genderData: Object.values(genders),
    };
  }, [metaAdDaily]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Investimento por Faixa Etária</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="spend" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {ageData.map((a, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{a.age}</span>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{formatCurrency(a.spend)}</div>
                  <div className="text-xs text-gray-500">{formatNumber(a.impressions)} impressões • {formatNumber(a.conversations)} conversas</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Investimento por Gênero</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genderData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="gender" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="spend" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {genderData.map((g, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 capitalize">{g.gender}</span>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{formatCurrency(g.spend)}</div>
                  <div className="text-xs text-gray-500">{formatNumber(g.impressions)} impressões • {formatNumber(g.conversations)} conversas</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}