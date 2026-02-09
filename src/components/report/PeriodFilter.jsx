import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PRESETS = [
  { id: 'today', label: 'Hoje', getDates: () => ({ start: new Date(), end: new Date() }) },
  { id: 'yesterday', label: 'Ontem', getDates: () => ({ start: subDays(new Date(), 1), end: subDays(new Date(), 1) }) },
  { id: 'last_7_days', label: 'Últimos 7 dias', getDates: () => ({ start: subDays(new Date(), 6), end: new Date() }) },
  { id: 'last_14_days', label: 'Últimos 14 dias', getDates: () => ({ start: subDays(new Date(), 13), end: new Date() }) },
  { id: 'last_28_days', label: 'Últimos 28 dias', getDates: () => ({ start: subDays(new Date(), 27), end: new Date() }) },
  { id: 'last_30_days', label: 'Últimos 30 dias', getDates: () => ({ start: subDays(new Date(), 29), end: new Date() }) },
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