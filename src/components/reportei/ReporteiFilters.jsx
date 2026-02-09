import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar, ChevronDown, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PERIOD_PRESETS = [
  { id: 'today', label: 'Hoje', days: 0 },
  { id: 'yesterday', label: 'Ontem', days: 1 },
  { id: 'last_7_days', label: 'Últimos 7 dias', days: 7 },
  { id: 'last_30_days', label: 'Últimos 30 dias', days: 30 },
  { id: 'last_90_days', label: 'Últimos 90 dias', days: 90 },
  { id: 'custom', label: 'Personalizado', days: null },
];

export default function ReporteiFilters({ 
  units, 
  selectedUnit, 
  onUnitChange,
  period,
  onPeriodChange,
  compareEnabled,
  onCompareToggle,
  showAdvanced,
  onToggleAdvanced
}) {
  const [periodPreset, setPeriodPreset] = useState('last_30_days');

  const handlePresetChange = (presetId) => {
    setPeriodPreset(presetId);
    if (presetId !== 'custom') {
      const preset = PERIOD_PRESETS.find(p => p.id === presetId);
      const end = new Date();
      const start = subDays(end, preset.days);
      onPeriodChange({ start, end });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* Main Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Unit */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Unidade</Label>
          <Select value={selectedUnit} onValueChange={onUnitChange}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Selecione uma unidade" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  <div className="flex items-center gap-2">
                    {unit.logo_url && (
                      <img src={unit.logo_url} alt={unit.name} className="w-5 h-5 rounded" />
                    )}
                    <span>{unit.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Period Preset */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Período</Label>
          <Select value={periodPreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom Date Range */}
        {periodPreset === 'custom' && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Datas</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  {period.start && period.end ? (
                    `${format(period.start, 'dd/MM/yyyy')} - ${format(period.end, 'dd/MM/yyyy')}`
                  ) : (
                    'Selecionar período'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="range"
                  selected={{ from: period.start, to: period.end }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      onPeriodChange({ start: range.from, end: range.to });
                    }
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Compare Toggle */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={compareEnabled}
            onChange={(e) => onCompareToggle(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <Label className="text-sm font-medium text-gray-700">
            Comparar com período anterior
          </Label>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleAdvanced}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtros Avançados
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="pt-4 border-t border-gray-100 space-y-4">
          <p className="text-sm text-gray-500">Filtros avançados disponíveis em breve...</p>
        </div>
      )}
    </div>
  );
}