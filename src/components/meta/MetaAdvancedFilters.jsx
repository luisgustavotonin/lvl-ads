import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Filter } from 'lucide-react';

export default function MetaAdvancedFilters({ filters, onFiltersChange, campaigns = [] }) {
  const [expanded, setExpanded] = useState(false);

  const handleChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm font-semibold">Filtros Avançados</CardTitle>
            {Object.values(filters).filter(v => v && v !== 'all').length > 0 && (
              <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5">
                {Object.values(filters).filter(v => v && v !== 'all').length} ativos
              </span>
            )}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Data Início */}
          <div className="space-y-1">
            <Label className="text-xs">Data Início</Label>
            <Input
              type="date"
              value={filters.date_from || ''}
              onChange={(e) => handleChange('date_from', e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Data Fim */}
          <div className="space-y-1">
            <Label className="text-xs">Data Fim</Label>
            <Input
              type="date"
              value={filters.date_to || ''}
              onChange={(e) => handleChange('date_to', e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Campanha */}
          <div className="space-y-1">
            <Label className="text-xs">Campanha</Label>
            <Select value={filters.campaign_id || 'all'} onValueChange={(v) => handleChange('campaign_id', v === 'all' ? '' : v)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Todas as campanhas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {campaigns.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Anúncio */}
          <div className="space-y-1">
            <Label className="text-xs">Tipo de Anúncio</Label>
            <Select value={filters.ad_type || 'all'} onValueChange={(v) => handleChange('ad_type', v === 'all' ? '' : v)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="carousel">Carrossel</SelectItem>
                <SelectItem value="collection">Coleção</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Gasto Mínimo */}
          <div className="space-y-1">
            <Label className="text-xs">Gasto Mínimo (R$)</Label>
            <Input
              type="number"
              placeholder="0"
              value={filters.min_spend || ''}
              onChange={(e) => handleChange('min_spend', e.target.value ? parseFloat(e.target.value) : '')}
              className="text-sm"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => onFiltersChange({ date_from: '', date_to: '', campaign_id: '', ad_type: '', min_spend: '' })}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}