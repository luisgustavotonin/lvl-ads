import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Copy } from 'lucide-react';

const METRICS = [
  { value: 'ctr_link', label: 'CTR (Link)' },
  { value: 'cpm', label: 'CPM' },
  { value: 'cost_per_conversation', label: 'Custo/Conversa' },
  { value: 'frequency', label: 'Frequência' },
  { value: 'spend', label: 'Gasto' },
  { value: 'impressions', label: 'Impressões' },
  { value: 'reach', label: 'Alcance' },
  { value: 'wa_conversations_started_7d', label: 'Conversas (7d)' },
];

export default function RuleBuilder({ rule, onSave, onCancel }) {
  const [formData, setFormData] = useState(rule || {
    rule_name: '',
    conditions: [{ id: '1', operator: 'AND', metric: '', comparison: 'greater_than', value: 0 }],
    condition_logic: 'all',
    severity: 'medium',
    message_title: '',
    message_body: '',
    recommended_actions: [''],
    root_cause_hints: [''],
    notes: ''
  });

  const addCondition = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setFormData({
      ...formData,
      conditions: [...formData.conditions, { 
        id: newId, 
        operator: formData.conditions.length === 0 ? 'AND' : formData.conditions[formData.conditions.length - 1].operator,
        metric: '', 
        comparison: 'greater_than', 
        value: 0 
      }]
    });
  };

  const removeCondition = (id) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter(c => c.id !== id)
    });
  };

  const updateCondition = (id, field, value) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      )
    });
  };

  const updateAction = (idx, value) => {
    const newActions = [...formData.recommended_actions];
    newActions[idx] = value;
    setFormData({ ...formData, recommended_actions: newActions });
  };

  const updateHint = (idx, value) => {
    const newHints = [...formData.root_cause_hints];
    newHints[idx] = value;
    setFormData({ ...formData, root_cause_hints: newHints });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar/Editar Regra de Diagnóstico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Básico */}
        <div className="space-y-3">
          <div>
            <Label>Nome da Regra</Label>
            <Input
              value={formData.rule_name}
              onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
              placeholder="ex: CTR baixo com alto frequência"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Severidade</Label>
              <Select value={formData.severity} onValueChange={(val) => setFormData({ ...formData, severity: val })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Lógica de Condições</Label>
              <Select value={formData.condition_logic} onValueChange={(val) => setFormData({ ...formData, condition_logic: val })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODAS as condições (AND)</SelectItem>
                  <SelectItem value="any">QUALQUER condição (OR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Condições */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Condições</Label>
            <Button onClick={addCondition} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Adicionar Condição
            </Button>
          </div>

          {formData.conditions.map((condition, idx) => (
            <div key={condition.id} className="border rounded-lg p-3 space-y-3 bg-gray-50">
              {idx > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    {condition.operator}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Métrica</Label>
                  <Select value={condition.metric} onValueChange={(val) => updateCondition(condition.id, 'metric', val)}>
                    <SelectTrigger className="h-8 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METRICS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Comparação</Label>
                  <Select value={condition.comparison} onValueChange={(val) => updateCondition(condition.id, 'comparison', val)}>
                    <SelectTrigger className="h-8 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="greater_than">Maior que</SelectItem>
                      <SelectItem value="less_than">Menor que</SelectItem>
                      <SelectItem value="equal">Igual a</SelectItem>
                      <SelectItem value="between">Entre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={condition.value}
                    onChange={(e) => updateCondition(condition.id, 'value', parseFloat(e.target.value))}
                    className="h-8 mt-1"
                  />
                </div>

                {condition.comparison === 'between' && (
                  <div>
                    <Label className="text-xs">Valor Máximo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={condition.value_max || ''}
                      onChange={(e) => updateCondition(condition.id, 'value_max', parseFloat(e.target.value))}
                      className="h-8 mt-1"
                    />
                  </div>
                )}

                {idx > 0 && (
                  <div className="flex items-end">
                    <Button
                      onClick={() => removeCondition(condition.id)}
                      variant="ghost"
                      size="sm"
                      className="w-full text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" /> Remover
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Mensagem */}
        <div className="space-y-3 border-t pt-4">
          <div>
            <Label>Título da Mensagem</Label>
            <Input
              value={formData.message_title}
              onChange={(e) => setFormData({ ...formData, message_title: e.target.value })}
              placeholder="ex: Performance do anúncio em declínio"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Corpo da Mensagem</Label>
            <Textarea
              value={formData.message_body}
              onChange={(e) => setFormData({ ...formData, message_body: e.target.value })}
              placeholder="Descreva o problema detectado"
              className="mt-1 h-20"
            />
          </div>
        </div>

        {/* Ações Recomendadas */}
        <div className="space-y-3 border-t pt-4">
          <Label className="text-base font-semibold">Ações Recomendadas</Label>
          {formData.recommended_actions.map((action, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={action}
                onChange={(e) => updateAction(idx, e.target.value)}
                placeholder={`Ação ${idx + 1}`}
              />
              {idx === formData.recommended_actions.length - 1 && (
                <Button
                  onClick={() => setFormData({ ...formData, recommended_actions: [...formData.recommended_actions, ''] })}
                  variant="outline"
                  size="icon"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Possíveis Causas Raiz */}
        <div className="space-y-3 border-t pt-4">
          <Label className="text-base font-semibold">Possíveis Causas Raiz</Label>
          <p className="text-xs text-gray-600">Baseadas em correlações históricas de dados</p>
          {formData.root_cause_hints.map((hint, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={hint}
                onChange={(e) => updateHint(idx, e.target.value)}
                placeholder={`Causa raiz ${idx + 1}`}
              />
              {idx === formData.root_cause_hints.length - 1 && (
                <Button
                  onClick={() => setFormData({ ...formData, root_cause_hints: [...formData.root_cause_hints, ''] })}
                  variant="outline"
                  size="icon"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Notas */}
        <div className="space-y-3 border-t pt-4">
          <Label>Notas e Justificativa</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Registre o contexto, motivo ou justificativa para criar esta regra..."
            className="h-24"
          />
        </div>

        {/* Botões */}
        <div className="flex gap-2 justify-end border-t pt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(formData)}>
            Salvar Regra
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}