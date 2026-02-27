import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const COLOR_OPTIONS = [
  '#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#06B6D4',
  '#EF4444','#6366F1','#EAB308','#84CC16','#059669','#1D4ED8',
  '#14B8A6','#D946EF','#D97706','#F97316','#7C3AED','#6B7280',
];

const DEFAULT_COLORS = ['#93C5FD','#60A5FA','#3B82F6','#2563EB','#1D4ED8','#1E40AF','#1e3a8a'];

const CURRENCY_KEYS = [
  'spend', 'cpcLink', 'cpm', 'costPerConversation',
  'costPerTotalContact', 'costPerFirstReply'
];

function hexToRgba(hex, alphaPct) {
  const safeHex = (hex || '#3B82F6').replace('#', '');
  const r = parseInt(safeHex.slice(0, 2), 16);
  const g = parseInt(safeHex.slice(2, 4), 16);
  const b = parseInt(safeHex.slice(4, 6), 16);
  const a = Math.max(0, Math.min(100, alphaPct ?? 100)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function fmt(v, isCurrency) {
  if (isCurrency) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  }
  return new Intl.NumberFormat('pt-BR').format(Math.round(v || 0));
}

function variationPct(curr, prev) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

/**
 * FunnelChartNew (corrigido)
 * - Funil menor (menos altura e padding)
 * - Estilo trapezoidal (parece funil)
 * - Fontes menores
 * - Evita sobreposição visual e problemas de fluxo
 */
export default function FunnelChartNew({ current, previous, stages: configStages = [], unitId }) {
  const [customColors, setCustomColors] = useState({});
  const [customOpacity, setCustomOpacity] = useState({});
  const [editingIdx, setEditingIdx] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carregar configs do banco
  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!unitId) {
        if (mounted) setLoading(false);
        return;
      }
      try {
        const configs = await base44.entities.FunnelChartConfig.filter({ unit_id: unitId }, null, 100);
        const colors = {};
        const opacity = {};
        configs.forEach(cfg => {
          colors[cfg.stage_index] = cfg.color;
          opacity[cfg.stage_index] = cfg.opacity ?? 100;
        });
        if (mounted) {
          setCustomColors(colors);
          setCustomOpacity(opacity);
        }
      } catch (err) {
        console.error('Erro ao carregar cores do funnel:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [unitId]);

  const upsertConfig = async (idx, patch) => {
    if (!unitId) return;
    try {
      const existing = await base44.entities.FunnelChartConfig.filter(
        { unit_id: unitId, stage_index: idx },
        null,
        1
      );

      if (existing.length > 0) {
        await base44.entities.FunnelChartConfig.update(existing[0].id, patch);
      } else {
        await base44.entities.FunnelChartConfig.create({
          unit_id: unitId,
          stage_index: idx,
          color: patch.color ?? customColors[idx] ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
          opacity: patch.opacity ?? customOpacity[idx] ?? 100,
        });
      }
    } catch (err) {
      console.error('Erro ao salvar config do funnel:', err);
    }
  };

  const handleColorChange = async (idx, color) => {
    setCustomColors(prev => ({ ...prev, [idx]: color }));
    await upsertConfig(idx, { color });
    setEditingIdx(null);
  };

  const handleOpacityChange = async (idx, opacity) => {
    setCustomOpacity(prev => ({ ...prev, [idx]: opacity }));
    await upsertConfig(idx, { opacity });
  };

  const stages = useMemo(() => {
    return (configStages || []).map((stage, idx) => {
      const baseColor = customColors[idx] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      const opacity = customOpacity[idx] ?? 100;
      const isCurrency = CURRENCY_KEYS.includes(stage.key);

      return {
        key: stage.key,
        label: stage.label,
        value: current?.[stage.key] || 0,
        prevValue: previous?.[stage.key] || 0,
        color: baseColor,
        opacity,
        colorWithOpacity: hexToRgba(baseColor, opacity),
        isCurrency,
      };
    });
  }, [configStages, current, previous, customColors, customOpacity]);

  if (loading) {
    return <div className="py-6 text-center text-gray-400">Carregando...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      {stages.map((stage, idx) => {
        const varPct = variationPct(stage.value, stage.prevValue);
        const isPositive = varPct !== null && varPct > 0;
        const isNegative = varPct !== null && varPct < 0;

        // Afunilamento: começa em 100% e vai reduzindo; limita mínimo para não sumir
        const widthPct = Math.max(46, 100 - idx * 10);

        return (
          <div key={stage.key} className="w-full flex flex-col items-center">
            <div
              className="relative text-center shadow-sm"
              style={{
                width: `${widthPct}%`,
                backgroundColor: stage.colorWithOpacity,
                clipPath: 'polygon(4% 0%, 96% 0%, 92% 100%, 8% 100%)',
                borderRadius: 12,
                padding: '10px 16px', // compacto
                transition: 'all 0.25s ease',
              }}
            >
              {/* Botão de editar */}
              <button
                onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                className="absolute top-2 right-2 p-1 rounded hover:bg-white/20 transition-colors"
                title="Editar cor e transparência"
                type="button"
              >
                <Pencil className="w-3 h-3 text-white/75" />
              </button>

              {/* Popover edição */}
              {editingIdx === idx && (
                <div
                  className="absolute top-9 right-2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-56"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-semibold text-gray-600 mb-3">Escolher cor</p>

                  <div className="grid grid-cols-6 gap-1.5 mb-4">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        onClick={() => handleColorChange(idx, c)}
                        type="button"
                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: c,
                          borderColor: stage.color === c ? '#111827' : 'transparent',
                        }}
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

                  <button
                    onClick={() => setEditingIdx(null)}
                    type="button"
                    className="mt-3 text-xs text-gray-400 hover:text-gray-600 w-full text-right"
                  >
                    fechar
                  </button>
                </div>
              )}

              {/* Textos (menores) */}
              <div className="text-white/90 text-xs font-medium mb-0.5">
                {stage.label}
              </div>

              <div className="text-white text-lg font-semibold leading-tight">
                {fmt(stage.value, stage.isCurrency)}
              </div>

              {varPct !== null && (
                <div
                  className={`mt-1 flex items-center justify-center gap-1 text-xs font-medium ${
                    isPositive ? 'text-green-200' : isNegative ? 'text-red-200' : 'text-white/90'
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : isNegative ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : null}
                  <span>{isPositive ? '+' : ''}{varPct.toFixed(1)}%</span>
                </div>
              )}
            </div>

            {/* Conector menor */}
            {idx < stages.length - 1 && (
              <div className="h-1 w-0.5 bg-gray-300" />
            )}
          </div>
        );
      })}
    </div>
  );
}