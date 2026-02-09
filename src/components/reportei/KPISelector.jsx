import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Settings2 } from 'lucide-react';

const AVAILABLE_KPIS = [
  { id: 'spend', label: 'Investimento', category: 'Geral' },
  { id: 'impressions', label: 'Impressões', category: 'Geral' },
  { id: 'reach', label: 'Alcance', category: 'Geral' },
  { id: 'frequency', label: 'Frequência', category: 'Geral' },
  { id: 'clicks', label: 'Cliques', category: 'Tráfego' },
  { id: 'link_clicks', label: 'Cliques no link', category: 'Tráfego' },
  { id: 'ctr_link', label: 'CTR Link', category: 'Tráfego' },
  { id: 'cpc_link', label: 'CPC Link', category: 'Tráfego' },
  { id: 'cpm', label: 'CPM', category: 'Tráfego' },
  { id: 'wa_conversations', label: 'Conversas iniciadas', category: 'WhatsApp' },
  { id: 'cost_per_conversation', label: 'Custo por conversa', category: 'WhatsApp' },
  { id: 'wa_total_connection', label: 'Total messaging connection', category: 'WhatsApp' },
  { id: 'wa_first_reply', label: 'Messaging first reply', category: 'WhatsApp' },
  { id: 'cost_per_first_reply', label: 'Custo por first reply', category: 'WhatsApp' },
  { id: 'page_engagement', label: 'Page engagement', category: 'Engajamento' },
  { id: 'post_engagement', label: 'Post engagement', category: 'Engajamento' },
  { id: 'video_view', label: 'Video view', category: 'Engajamento' },
  { id: 'post_interaction', label: 'Post interaction gross', category: 'Engajamento' },
  { id: 'post_reaction', label: 'Post reaction', category: 'Engajamento' },
  { id: 'post_net_like', label: 'Post net like', category: 'Engajamento' },
];

export default function KPISelector({ selectedKPIs, onChange }) {
  const [open, setOpen] = React.useState(false);

  const categories = [...new Set(AVAILABLE_KPIS.map(k => k.category))];

  const toggleKPI = (kpiId) => {
    if (selectedKPIs.includes(kpiId)) {
      onChange(selectedKPIs.filter(id => id !== kpiId));
    } else {
      onChange([...selectedKPIs, kpiId]);
    }
  };

  const selectAll = () => {
    onChange(AVAILABLE_KPIS.map(k => k.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings2 className="w-4 h-4" />
          Selecionar KPIs ({selectedKPIs.length})
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px]">
        <SheetHeader>
          <SheetTitle>Selecionar KPIs</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll} className="flex-1">
              Selecionar Todos
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll} className="flex-1">
              Limpar Seleção
            </Button>
          </div>

          {categories.map((category) => (
            <div key={category} className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700">{category}</Label>
              <div className="space-y-2">
                {AVAILABLE_KPIS.filter(k => k.category === category).map((kpi) => (
                  <label key={kpi.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedKPIs.includes(kpi.id)}
                      onChange={() => toggleKPI(kpi.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">{kpi.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}