import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const COLOR_OPTIONS = [
  '#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#06B6D4',
  '#EF4444','#6366F1','#EAB308','#84CC16','#059669','#1D4ED8',
  '#14B8A6','#D946EF','#D97706','#F97316','#7C3AED','#6B7280',
];

export default function FunnelChartNew({ current, previous, stages: configStages, unitId }) {
  const [customColors, setCustomColors] = useState({});
  const [customOpacity, setCustomOpacity] = useState({});
  const [editingIdx, setEditingIdx] = useState(null);
  const [loading, setLoading] = useState(true);
  const DEFAULT_COLORS = ['#93C5FD','#60A5FA','#3B82F6','#2563EB','#1D4ED8','#1E40AF','#1e3a8a'];

  // Carregar cores do banco de dados
  useEffect(() => {
    if (!unitId) {
      setLoading(false);
      return;
    }

    const loadColors = async () => {
      try {
        const configs = await base44.entities.FunnelChartConfig.filter({ unit_id: unitId }, null, 100);
        const colors = {};
        const opacity = {};
        configs.forEach(cfg => {
          colors[cfg.stage_index] = cfg.color;
          opacity[cfg.stage_index] = cfg.opacity || 100;
        });
        setCustomColors(colors);
        setCustomOpacity(opacity);
      } catch (err) {
        console.error('Erro ao carregar cores do funnel:', err);
      } finally {
        setLoading(false);
      }
    };

    loadColors();
  }, [unitId]);

  const handleColorChange = async (idx, color) => {
    const next = { ...customColors, [idx]: color };
    setCustomColors(next);

    // Salvar no banco
    if (unitId) {
      try {
        const existing = await base44.entities.FunnelChartConfig.filter({
          unit_id: unitId,
          stage_index: idx
        }, null, 1);

        if (existing.length > 0) {
          await base44.entities.FunnelChartConfig.update(existing[0].id, { color });
        } else {
          await base44.entities.FunnelChartConfig.create({
            unit_id: unitId,
            stage_index: idx,
            color,
            opacity: customOpacity[idx] || 100
          });
        }
      } catch (err) {
        console.error('Erro ao salvar cor:', err);
      }
    }
    setEditingIdx(null);
  };

  const handleOpacityChange = async (idx, opacity) => {
    const next = { ...customOpacity, [idx]: opacity };
    setCustomOpacity(next);

    // Salvar no banco
    if (unitId) {
      try {
        const existing = await base44.entities.FunnelChartConfig.filter({
          unit_id: unitId,
          stage_index: idx
        }, null, 1);

        if (existing.length > 0) {
          await base44.entities.FunnelChartConfig.update(existing[0].id, { opacity });
        } else {
          await base44.entities.FunnelChartConfig.create({
            unit_id: unitId,
            stage_index: idx,
            color: customColors[idx] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
            opacity
          });
        }
      } catch (err) {
        console.error('Erro ao salvar opacidade:', err);
      }
    }
  };

  const CURRENCY_KEYS = ['spend', 'cpcLink', 'cpm', 'costPerConversation', 'costPerTotalContact', 'costPerFirstReply'];

  const stages = configStages.map((stage, idx) => {
    const baseColor = customColors[idx] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
    const opacity = customOpacity[idx] ?? 100;
    
    // Converter hex para rgba com opacidade
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha / 100})`;
    };

    return {
      key: stage.key,
      label: stage.label,
      value: current[stage.key] || 0,
      prevValue: previous?.[stage.key] || 0,
      color: baseColor,
      colorWithOpacity: hexToRgba(baseColor, opacity),
      opacity,
      isCurrency: CURRENCY_KEYS.includes(stage.key),
    };
  });

  const formatNumber = (v, isCurrency = false) => {
    if (isCurrency) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    return new Intl.NumberFormat('pt-BR').format(Math.round(v));
  };

  const getVariation = (current, previous) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  if (loading) {
    return <div className="py-8 text-center text-gray-400">Carregando...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-1 py-8">
      {stages.map((stage, idx) => {
        const variation = getVariation(stage.value, stage.prevValue);
        const isPositive = variation > 0;
        const isNegative = variation < 0;

        return (
          <div key={stage.key} className="w-full flex flex-col items-center">
            <div 
              className="w-full rounded-lg py-6 px-8 text-center shadow-sm relative"
              style={{ 
                maxWidth: `${100 - (idx * 12)}%`,
                backgroundColor: stage.colorWithOpacity,
                transition: 'all 0.3s ease'
              }}
            >
              {/* Botão de editar cor - sempre visível */}
              <button
                onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                className="absolute top-2 right-2 p-1 rounded hover:bg-white/20 transition-colors"
                title="Editar cor e transparência"
              >
                <Pencil className="w-3 h-3 text-white/70" />
              </button>

              {/* Color picker + Opacity slider */}
              {editingIdx === idx && (
                <div className="absolute top-8 right-2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-56" onClick={e => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-gray-600 mb-3">Escolher cor</p>
                  <div className="grid grid-cols-6 gap-1.5 mb-4">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => handleColorChange(idx, c)}
                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ backgroundColor: c, borderColor: stage.color === c ? '#000' : 'transparent' }}
                      />
                    ))}
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-600">Transparência</label>
                      <span className="text-xs text-gray-500">{stage.opacity}%</span>
                    </div>
                    <Slider 
                      value={[stage.opacity]} 
                      onValueChange={(v) => handleOpacityChange(idx, v[0])}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  <button onClick={() => setEditingIdx(null)} className="mt-3 text-xs text-gray-400 hover:text-gray-600 w-full text-right">fechar</button>
                </div>
              )}

              <div className="text-white font-medium mb-1">{stage.label}</div>
              <div className="text-white text-2xl font-bold mb-2">
                {formatNumber(stage.value, stage.isCurrency)}
              </div>
              {variation !== null && (
                <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                  isPositive ? 'text-green-200' : isNegative ? 'text-red-200' : 'text-white'
                }`}>
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : isNegative ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : null}
                  <span>{isPositive ? '+' : ''}{variation.toFixed(1)}%</span>
                </div>
              )}
            </div>
            {idx < stages.length - 1 && (
              <div className="h-2 w-0.5 bg-gray-300" />
            )}
          </div>
        );
      })}
    </div>
  );
}