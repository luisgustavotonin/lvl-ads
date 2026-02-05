import React from 'react';
import { X, GripVertical, Eye, EyeOff, BarChart3, PieChart, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const AVAILABLE_METRICS = [
  { id: 'spend', label: 'Investimento', type: 'currency' },
  { id: 'impressions', label: 'Impressões', type: 'number' },
  { id: 'reach', label: 'Alcance', type: 'number' },
  { id: 'clicks', label: 'Cliques', type: 'number' },
  { id: 'link_clicks', label: 'Cliques no Link', type: 'number' },
  { id: 'ctr', label: 'CTR', type: 'percent' },
  { id: 'cpc', label: 'CPC', type: 'currency' },
  { id: 'cpm', label: 'CPM', type: 'currency' },
  { id: 'conversions', label: 'Conversões', type: 'number' },
  { id: 'conversion_value', label: 'Valor de Conversões', type: 'currency' },
  { id: 'messages', label: 'Mensagens', type: 'number' },
  { id: 'leads', label: 'Leads', type: 'number' },
  { id: 'purchases', label: 'Compras', type: 'number' },
];

const AVAILABLE_CHARTS = [
  { id: 'spend_daily', label: 'Investimento por Dia', type: 'area' },
  { id: 'spend_platform', label: 'Investimento por Plataforma', type: 'bar' },
  { id: 'funnel', label: 'Funil de Conversão', type: 'funnel' },
  { id: 'impressions_daily', label: 'Impressões por Dia', type: 'line' },
];

const SECTIONS = [
  { id: 'summary', label: 'Resumo Geral' },
  { id: 'meta', label: 'Meta Ads' },
  { id: 'google', label: 'Google Ads' },
  { id: 'tiktok', label: 'TikTok Ads' },
  { id: 'youtube', label: 'YouTube' },
];

export default function ReportCustomizer({ open, onClose, config, onConfigChange }) {
  if (!open) return null;

  const toggleCard = (cardId) => {
    const newCards = config.cards.map(c => 
      c.id === cardId ? { ...c, visible: !c.visible } : c
    );
    onConfigChange({ ...config, cards: newCards });
  };

  const toggleChart = (chartId) => {
    const newCharts = config.charts.map(c => 
      c.id === chartId ? { ...c, visible: !c.visible } : c
    );
    onConfigChange({ ...config, charts: newCharts });
  };

  const toggleSection = (sectionId) => {
    const sections = config.sections || SECTIONS.map(s => s.id);
    const newSections = sections.includes(sectionId)
      ? sections.filter(s => s !== sectionId)
      : [...sections, sectionId];
    onConfigChange({ ...config, sections: newSections });
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Personalizar Relatório</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="cards" className="w-full">
            <TabsList className="w-full justify-start px-4 pt-4 bg-transparent">
              <TabsTrigger value="cards" className="gap-2">
                <LayoutGrid className="w-4 h-4" />
                Cards
              </TabsTrigger>
              <TabsTrigger value="charts" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Gráficos
              </TabsTrigger>
              <TabsTrigger value="sections" className="gap-2">
                <PieChart className="w-4 h-4" />
                Seções
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cards" className="p-4 space-y-2">
              <p className="text-sm text-gray-500 mb-4">
                Selecione quais métricas exibir no resumo
              </p>
              {AVAILABLE_METRICS.map((metric) => {
                const cardConfig = config.cards?.find(c => c.id === metric.id);
                const isVisible = cardConfig?.visible !== false;
                
                return (
                  <div 
                    key={metric.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isVisible ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                      <span className={cn(
                        "text-sm",
                        isVisible ? "text-gray-900 font-medium" : "text-gray-500"
                      )}>
                        {metric.label}
                      </span>
                    </div>
                    <Switch 
                      checked={isVisible}
                      onCheckedChange={() => toggleCard(metric.id)}
                    />
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="charts" className="p-4 space-y-2">
              <p className="text-sm text-gray-500 mb-4">
                Selecione quais gráficos exibir
              </p>
              {AVAILABLE_CHARTS.map((chart) => {
                const chartConfig = config.charts?.find(c => c.id === chart.id);
                const isVisible = chartConfig?.visible !== false;
                
                return (
                  <div 
                    key={chart.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isVisible ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                      <span className={cn(
                        "text-sm",
                        isVisible ? "text-gray-900 font-medium" : "text-gray-500"
                      )}>
                        {chart.label}
                      </span>
                    </div>
                    <Switch 
                      checked={isVisible}
                      onCheckedChange={() => toggleChart(chart.id)}
                    />
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="sections" className="p-4 space-y-2">
              <p className="text-sm text-gray-500 mb-4">
                Selecione quais seções exibir
              </p>
              {SECTIONS.map((section) => {
                const isVisible = config.sections?.includes(section.id) ?? true;
                
                return (
                  <div 
                    key={section.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isVisible ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                      <span className={cn(
                        "text-sm",
                        isVisible ? "text-gray-900 font-medium" : "text-gray-500"
                      )}>
                        {section.label}
                      </span>
                    </div>
                    <Switch 
                      checked={isVisible}
                      onCheckedChange={() => toggleSection(section.id)}
                    />
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <Button className="w-full" onClick={onClose}>
            Aplicar Alterações
          </Button>
        </div>
      </div>
    </>
  );
}