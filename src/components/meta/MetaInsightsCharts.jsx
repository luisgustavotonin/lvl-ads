import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SpendVsImpressionsChart({ data, isLoading }) {
  if (isLoading) return <Skeleton className="h-80" />;
  if (!data?.length) return <p className="text-gray-400 text-center py-8">Sem dados</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Gastos vs Impressões</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="spend" fill="#ef4444" name="Gasto (R$)" />
            <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#3b82f6" name="Impressões" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ClicksPerDayChart({ data, isLoading }) {
  if (isLoading) return <Skeleton className="h-80" />;
  if (!data?.length) return <p className="text-gray-400 text-center py-8">Sem dados</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Cliques por Dia</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} name="Cliques" />
            <Line type="monotone" dataKey="link_clicks" stroke="#8b5cf6" strokeWidth={2} name="Link Clicks" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function CPMTrendChart({ data, isLoading }) {
  if (isLoading) return <Skeleton className="h-80" />;
  if (!data?.length) return <p className="text-gray-400 text-center py-8">Sem dados</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">CPM & CTR ao Longo do Tempo</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="cpm" fill="#f59e0b" name="CPM (R$)" />
            <Line yAxisId="right" type="monotone" dataKey="ctr_link" stroke="#06b6d4" name="CTR (%)" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}