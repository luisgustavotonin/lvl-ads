import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, subDays } from 'date-fns';
import { Bookmark, Check } from 'lucide-react';

const getBrasiliaToday = () => {
  const str = new Date().toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const [month, day, year] = str.split('/');
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const ALL_PRESETS = [
  { id: 'today',        label: 'Hoje',          getDates: () => { const t = getBrasiliaToday(); return { start: t, end: t }; } },
  { id: 'yesterday',    label: 'Ontem',         getDates: () => { const t = getBrasiliaToday(); const y = subDays(t, 1); return { start: y, end: y }; } },
  { id: 'last_7',       label: '7 dias',        getDates: () => { const t = getBrasiliaToday(); return { start: subDays(t, 6), end: t }; } },
  { id: 'last_14',      label: '14 dias',       getDates: () => { const t = getBrasiliaToday(); return { start: subDays(t, 13), end: t }; } },
  { id: 'last_28',      label: '28 dias',       getDates: () => { const t = getBrasiliaToday(); return { start: subDays(t, 27), end: t }; } },
  { id: 'last_30',      label: '30 dias',       getDates: () => { const t = getBrasiliaToday(); return { start: subDays(t, 29), end: t }; } },
  { id: 'mtd',          label: 'Mês atual',     getDates: () => { const t = getBrasiliaToday(); const s = new Date(t.getFullYear(), t.getMonth(), 1); return { start: s, end: t }; } },
  { id: 'last_month',   label: 'Mês anterior',  getDates: () => { const t = getBrasiliaToday(); const s = new Date(t.getFullYear(), t.getMonth() - 1, 1); const e = new Date(t.getFullYear(), t.getMonth(), 0); return { start: s, end: e }; } },
];

const toInput = (date) => {
  if (!date) return '';
  try { return format(date, 'yyyy-MM-dd'); } catch { return ''; }
};

const fromInput = (str) => {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

// allowedPresets: array of preset ids. If null/empty = show all
// onSaveDefault: optional callback(presetId) called when admin clicks save
export default function PeriodFilter({ value, onChange, comparisonPeriod, onComparisonChange, allowedPresets, onSaveDefault }) {
  const [activePreset, setActivePreset] = React.useState('last_30');
  const [isCustomOpen, setIsCustomOpen] = React.useState(false);
  const [showComparison, setShowComparison] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const visiblePresets = React.useMemo(() => {
    if (!allowedPresets || allowedPresets.length === 0) return ALL_PRESETS;
    return ALL_PRESETS.filter(p => allowedPresets.includes(p.id));
  }, [allowedPresets]);

  const showCustom = !allowedPresets || allowedPresets.length === 0 || allowedPresets.includes('custom');

  const handlePreset = (preset) => {
    setActivePreset(preset.id);
    setSaved(false);
    onChange(preset.getDates());
  };

  const handleSaveDefault = async () => {
    if (!onSaveDefault || activePreset === 'custom') return;
    await onSaveDefault(activePreset);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleMainDate = (field, str) => {
    const date = fromInput(str);
    if (!date) return;
    setActivePreset('custom');
    onChange({ start: field === 'start' ? date : value.start, end: field === 'end' ? date : value.end });
  };

  const handleCompDate = (field, str) => {
    const date = fromInput(str);
    if (!date) return;
    const prev = comparisonPeriod || { start: null, end: null };
    onComparisonChange?.({ start: field === 'start' ? date : prev.start, end: field === 'end' ? date : prev.end });
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Preset buttons */}
       <div className="flex flex-wrap items-center gap-2">
         {visiblePresets.map((p) => (
           <Button
             key={p.id}
             variant={activePreset === p.id ? 'default' : 'outline'}
             size="sm"
             onClick={() => { handlePreset(p); setIsCustomOpen(false); }}
           >
             {p.label}
           </Button>
         ))}
         {showCustom && (
           <Button
             variant={isCustomOpen || activePreset === 'custom' ? 'default' : 'outline'}
             size="sm"
             onClick={() => setIsCustomOpen(!isCustomOpen)}
           >
             Personalizado
           </Button>
         )}
         {(isCustomOpen || showComparison) && (
           <Button
             variant={showComparison ? 'default' : 'outline'}
             size="sm"
             onClick={() => setShowComparison(v => !v)}
             className={`${showComparison ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
           >
             Comparar
           </Button>
         )}
       </div>

      {/* Date rows */}
      {isCustomOpen && (
      <div className="flex flex-col gap-2 border-t pt-3">
        {/* Período analisado */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 w-36 shrink-0">Período</span>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
            <Label className="text-xs text-gray-500">De:</Label>
            <Input
              type="date"
              className="h-7 text-xs w-36 border-0 p-0 shadow-none focus-visible:ring-0"
              value={toInput(value.start)}
              onChange={(e) => handleMainDate('start', e.target.value)}
            />
          </div>
          <span className="text-gray-400 text-sm">→</span>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
            <Label className="text-xs text-gray-500">Até:</Label>
            <Input
              type="date"
              className="h-7 text-xs w-36 border-0 p-0 shadow-none focus-visible:ring-0"
              value={toInput(value.end)}
              onChange={(e) => handleMainDate('end', e.target.value)}
            />
          </div>
        </div>

        {/* Período comparativo */}
        {showComparison && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-purple-600 w-36 shrink-0">Período comparativo</span>
            <div className="flex items-center gap-2 bg-white border border-purple-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Label className="text-xs text-gray-500">De:</Label>
              <Input
                type="date"
                className="h-7 text-xs w-36 border-0 p-0 shadow-none focus-visible:ring-0"
                value={toInput(comparisonPeriod?.start)}
                onChange={(e) => handleCompDate('start', e.target.value)}
              />
            </div>
            <span className="text-gray-400 text-sm">→</span>
            <div className="flex items-center gap-2 bg-white border border-purple-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Label className="text-xs text-gray-500">Até:</Label>
              <Input
                type="date"
                className="h-7 text-xs w-36 border-0 p-0 shadow-none focus-visible:ring-0"
                value={toInput(comparisonPeriod?.end)}
                onChange={(e) => handleCompDate('end', e.target.value)}
              />
            </div>
          </div>
        )}
        </div>
        )}
        </div>
        );
        }