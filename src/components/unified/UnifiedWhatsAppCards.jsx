import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, UserPlus, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);
};

const formatNumber = (value) => {
  return new Intl.NumberFormat('pt-BR').format(value || 0);
};

function MetricCard({ icon: Icon, title, value, cost, previousValue, previousCost, color }) {
  const variation = previousValue > 0 ? ((value - previousValue) / previousValue * 100) : 0;
  const isPositive = variation > 0;

  return (
    <Card className="border-gray-100">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {variation !== 0 && (
            <Badge className={`gap-1 ${isPositive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(variation).toFixed(1)}%
            </Badge>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{formatNumber(value)}</span>
            <span className="text-sm text-gray-500">conversões</span>
          </div>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-gray-900">{formatCurrency(cost)}</span>
              <span className="text-xs text-gray-500">por conversão</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {formatNumber(previousValue)} no período anterior
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UnifiedWhatsAppCards({ currentMetrics, previousMetrics }) {
  if (!currentMetrics) return null;

  const { totals, whatsappCosts } = currentMetrics;
  const prevTotals = previousMetrics?.totals || {};
  const prevCosts = previousMetrics?.whatsappCosts || {};

  // Não renderizar se não houver dados
  if (totals.whatsapp_conversations_started === 0 && totals.whatsapp_new_contacts === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Métricas de WhatsApp</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          icon={MessageCircle}
          title="Conversas por mensagem iniciadas"
          value={totals.whatsapp_conversations_started}
          cost={whatsappCosts.cost_per_conversation}
          previousValue={prevTotals.whatsapp_conversations_started}
          previousCost={prevCosts.cost_per_conversation}
          color="bg-gradient-to-br from-green-500 to-green-600"
        />
        
        <MetricCard
          icon={UserPlus}
          title="Novos contatos de mensagem"
          value={totals.whatsapp_new_contacts}
          cost={whatsappCosts.cost_per_new_contact}
          previousValue={prevTotals.whatsapp_new_contacts}
          previousCost={prevCosts.cost_per_new_contact}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
        />
      </div>
    </div>
  );
}