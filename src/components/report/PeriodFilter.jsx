import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, subDays } from 'date-fns';

const getBrasiliaToday = () => {
  const now = new Date();
  const str = now.toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const [month, day, year] = str.split('/');
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const PRESETS = [
  { id: 'today',        label: 'Hoje',           getDates: () => { const t = getBrasiliaToday(); return { start: t, end: t }; } },
  { id: 'yesterday',    label: 'Ontem',          getDates: () => { const t = getBrasiliaToday(); const y = subDays(t, 1); return { start: y, end: y }; } },
  { id: 'last_7_days',  label: 'Últimos 7 dias', getDates: () => { const t = getBrasiliaToday(); return { start: subDays(t, 6), end: t }; } },
  { id: 'last_14_days', label: 'Últimos 14 dias',getDates: () => { const t = getBrasiliaToday(); return { start: subDays(t, 13), end: t }; } },
  { id: 'last_28_days', label: 'Últimos 28 dias',getDates: () => { const t = getBrasiliaToday(); return { start: subDays(t, 27), end: t }; } },
  { id: 'last_30_days', label: 'Últimos 30 dias',getDates: () => { const t = getBrasiliaToday(); return { start: subDays(t, 29), end: t }; } },
];

const toInputValue = (date) => {
  if (!date) return '';
  try { return format(date, 'yyyy-MM-dd'); } catch { return ''; }
};

const parseInputDate = (str) => {
  if (!str) return null;
  const [year, month, day] = str.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const formatDisplay = (date) => {
  if (!date) return '';
  try { return format(date, 'dd/MM/yyyy'); } catch { return ''; }
};

export default function PeriodFilter({ value, onChange }) {
  const [activePreset, setActivePreset] = React.useState('last_30_days');
  const [showCustom, setShowCustom] = React.useState(false);

  const handlePresetClick = (preset) => {
    setActivePreset(preset.id);
    const dates = preset.getDates();
    onChange({ start: dates.start, end: dates.end });
    setShowCustom(false);
  };

  const handleCustomDateChange = (field, strValue) => {
    const date = parseInputDate(strValue);
    if (!date) return;
    const newStart = field === 'start' ? date : (value.start || date);
    const newEnd = field === 'end' ? date : (value.end || date);
    onChange({ start: newStart, end: newEnd });
    setActivePreset('custom');
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Preset buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant={activePreset === preset.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Date range row */}
      <div className="flex flex-wrap items-start gap-4">
        {/* Período analisado */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Período analisado</span>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
            <button
              onClick={() => setShowCustom(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <Calendar className="w-4 h-4 text-gray-500" />
              {value.start && value.end
                ? `${format(value.start, 'dd/MM')} - ${format(value.end, 'dd/MM')}`
                : 'Selecionar datas'}
            </button>
          </div>
          {showCustom && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm mt-1">
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
      </div>
    </div>
  );
}