import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, TrendingUp, DollarSign, Eye, MousePointerClick } from 'lucide-react';

export default function MetaIngestReport({ unit, dateRange, metrics }) {
  return (
    <div className="space-y-4">
      {/* Header com dados da unidade */}
      <Card className="border-l-4 border-l-blue-600 bg-gradient-to-r from-blue-50 to-blue-100">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Unidade */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Unidade</p>
                <p className="text-lg font-semibold text-gray-900">{unit?.name || '—'}</p>
                {unit?.account_id && <p className="text-xs text-gray-500">{unit.account_id}</p>}
              </div>
            </div>

            {/* Período */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Período</p>
                <p className="text-lg font-semibold text-gray-900">
                  {dateRange?.from && dateRange?.to
                    ? `${new Date(dateRange.from).toLocaleDateString('pt-BR')} — ${new Date(dateRange.to).toLocaleDateString('pt-BR')}`
                    : '—'}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Status</p>
                <Badge className="mt-1 bg-green-100 text-green-800">Ativo</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Gasto Total</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    R$ {metrics.total_spend?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="p-2 bg-red-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Impressões</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {(metrics.total_impressions / 1000)?.toFixed(1) || '0'}K
                  </p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Cliques</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {(metrics.total_clicks / 1000)?.toFixed(1) || '0'}K
                  </p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <MousePointerClick className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">CPM Médio</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    R$ {metrics.avg_cpm?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}