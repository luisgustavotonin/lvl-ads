import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays, parseISO } from 'date-fns';

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

  // Converter Date para string YYYY-MM-DD para o input type=date
  const toInputValue = (date) => {
    if (!date) return '';
    try {
      return format(date, 'yyyy-MM-dd');
    } catch { return ''; }
  };

  const handlePresetClick = (preset) => {
    setActivePreset(preset.id);
    if (preset.getDates) {
      const dates = preset.getDates();
      onChange({ start: dates.start, end: dates.end });
      setCustomOpen(false);
    } else {
      setCustomOpen(prev => !prev);
    }
  };

  const handleCustomDateChange = (field, strValue) => {
    if (!strValue) return;
    const [year, month, day] = strValue.split('-').map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);
    const newStart = field === 'start' ? date : (value.start || date);
    const newEnd = field === 'end' ? date : (value.end || date);
    onChange({ start: newStart, end: newEnd });
    setActivePreset('custom');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        preset.id === 'custom' ? (
          <div key={preset.id} className="flex flex-wrap items-center gap-2">
            <Button
              variant={activePreset === preset.id ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => handlePresetClick(preset)}
            >
              <Calendar className="w-4 h-4" />
              {activePreset === preset.id && value.start && value.end
                ? `${format(value.start, 'dd/MM')} - ${format(value.end, 'dd/MM')}`
                : preset.label}
            </Button>
            {customOpen && (
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-gray-500 whitespace-nowrap">De:</Label>
                  <Input
                    type="date"
                    className="h-7 text-xs w-36"
                    value={toInputValue(value.start)}
                    onChange={(e) => handleCustomDateChange('start', e.target.value)}
                  />
                </div>
                <span className="text-gray-400 text-xs">→</span>
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-gray-500 whitespace-nowrap">Até:</Label>
                  <Input
                    type="date"
                    className="h-7 text-xs w-36"
                    value={toInputValue(value.end)}
                    onChange={(e) => handleCustomDateChange('end', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
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