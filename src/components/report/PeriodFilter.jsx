import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Função para obter data atual em São Paulo (sem hora, apenas YYYY-MM-DD)
const getBrasiliaToday = () => {
  const now = new Date();
  const brasiliaDateStr = now.toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // Formato retornado: "MM/DD/YYYY" - converter para Date
  const [month, day, year] = brasiliaDateStr.split('/');
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const PRESETS = [
  { id: 'today', label: 'Hoje', getDates: () => {
    const today = getBrasiliaToday();
    return { start: today, end: today };
  }},
  { id: 'yesterday', label: 'Ontem', getDates: () => {
    const today = getBrasiliaToday();
    const yesterday = subDays(today, 1);
    return { start: yesterday, end: yesterday };
  }},
  { id: 'last_7_days', label: 'Últimos 7 dias', getDates: () => {
    const today = getBrasiliaToday();
    return { start: subDays(today, 6), end: today };
  }},
  { id: 'last_14_days', label: 'Últimos 14 dias', getDates: () => {
    const today = getBrasiliaToday();
    return { start: subDays(today, 13), end: today };
  }},
  { id: 'last_28_days', label: 'Últimos 28 dias', getDates: () => {
    const today = getBrasiliaToday();
    return { start: subDays(today, 27), end: today };
  }},
  { id: 'last_30_days', label: 'Últimos 30 dias', getDates: () => {
    const today = getBrasiliaToday();
    return { start: subDays(today, 29), end: today };
  }},
  { id: 'custom', label: 'Período livre', getDates: null },
];

export default function PeriodFilter({ value, onChange }) {
  const [activePreset, setActivePreset] = React.useState('last_30_days');
  const [customOpen, setCustomOpen] = React.useState(false);

  const handlePresetClick = (preset) => {
    setActivePreset(preset.id);
    if (preset.getDates) {
      const dates = preset.getDates();
      onChange({ start: dates.start, end: dates.end });
    } else {
      setCustomOpen(true);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((preset) => (
        preset.id === 'custom' ? (
          <Popover key={preset.id} open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={activePreset === preset.id ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
              >
                <Calendar className="w-4 h-4" />
                {activePreset === preset.id && value.start && value.end ? 
                  `${format(value.start, 'dd/MM')} - ${format(value.end, 'dd/MM')}` : 
                  preset.label
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarComponent
                mode="range"
                selected={{ from: value.start, to: value.end }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    onChange({ start: range.from, end: range.to });
                    setActivePreset('custom');
                    setCustomOpen(false);
                  }
                }}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            key={preset.id}
            variant={activePreset === preset.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(preset)}
          >
            {preset.label}
          </Button>
        )
      ))}
    </div>
  );
}