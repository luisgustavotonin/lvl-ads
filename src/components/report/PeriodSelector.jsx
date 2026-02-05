import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PERIOD_OPTIONS = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'last_7_days', label: 'Últimos 7 dias' },
  { id: 'last_30_days', label: 'Últimos 30 dias' },
  { id: 'mtd', label: 'Mês atual' },
  { id: 'last_month', label: 'Mês anterior' },
  { id: 'custom', label: 'Personalizado' },
];

const getPeriodDates = (periodId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (periodId) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday':
      const yesterday = subDays(today, 1);
      return { start: yesterday, end: yesterday };
    case 'last_7_days':
      return { start: subDays(today, 6), end: today };
    case 'last_30_days':
      return { start: subDays(today, 29), end: today };
    case 'mtd':
      return { start: startOfMonth(today), end: today };
    case 'last_month':
      const lastMonth = subMonths(today, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    default:
      return { start: subDays(today, 29), end: today };
  }
};

export default function PeriodSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [customRange, setCustomRange] = useState({ from: null, to: null });

  const handlePeriodSelect = (periodId) => {
    if (periodId === 'custom') {
      return;
    }
    const dates = getPeriodDates(periodId);
    onChange({ periodId, ...dates });
    setOpen(false);
  };

  const handleCustomSelect = (range) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      onChange({ periodId: 'custom', start: range.from, end: range.to });
    }
  };

  const selectedOption = PERIOD_OPTIONS.find(o => o.id === value.periodId);
  const displayLabel = value.periodId === 'custom' && value.start && value.end
    ? `${format(value.start, 'dd/MM/yyyy')} - ${format(value.end, 'dd/MM/yyyy')}`
    : selectedOption?.label || 'Selecionar período';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-[200px] justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-500" />
            <span>{displayLabel}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Preset options */}
          <div className="border-r border-gray-100 p-2 w-44">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => handlePeriodSelect(option.id)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                  value.periodId === option.id
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          
          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={customRange}
              onSelect={handleCustomSelect}
              numberOfMonths={2}
              locale={ptBR}
            />
            {customRange?.from && customRange?.to && (
              <div className="flex justify-end pt-3 border-t border-gray-100 mt-3">
                <Button size="sm" onClick={() => setOpen(false)}>
                  Aplicar
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}