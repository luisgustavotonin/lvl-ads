import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertCircle, CheckCircle2, RefreshCw, Settings, Bell, TrendingUp, TrendingDown, Loader2, Edit, Eye, Plus } from 'lucide-react';
import { toast } from 'sonner';
import RuleBuilder from '@/components/report/RuleBuilder';
import { Textarea } from '@/components/ui/textarea';

export default function ParametersAlerts() {
  const [selectedUnit, setSelectedUnit] = useState('');
  const [showTestResult, setShowTestResult] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [viewingNotes, setViewingNotes] = useState(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const { data: thresholds = [] } = useQuery({
    queryKey: ['thresholds', selectedUnit],
    queryFn: () => base44.entities.KpiThreshold.filter(selectedUnit ? { unit_id: selectedUnit } : {}),
    enabled: !!selectedUnit
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['rules', selectedUnit],
    queryFn: () => base44.entities.KpiRule.filter(selectedUnit ? { unit_id: selectedUnit } : {}),
    enabled: !!selectedUnit
  });

  const { data: alertConfig } = useQuery({
    queryKey: ['alertConfig', selectedUnit],
    queryFn: async () => {
      const configs = await base44.entities.AlertConfig.filter({ unit_id: selectedUnit });
      return configs[0] || null;
    },
    enabled: !!selectedUnit
  });

  const { data: telegramAlertConfig } = useQuery({
    queryKey: ['telegramAlertConfig', selectedUnit],
    queryFn: async () => {
      const configs = await base44.entities.TelegramAlertConfig.filter({ unit_id: selectedUnit });
      return configs[0] || null;
    },
    enabled: !!selectedUnit
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['executionLogs', selectedUnit],
    queryFn: async () => {
      const response = await base44.entities.ExecutionLog.filter({ unit_id: selectedUnit }, '-execution_time', 20);
      return response || [];
    },
    enabled: !!selectedUnit,
    refetchInterval: 5000
  });

  const initThresholdsMutation = useMutation({
    mutationFn: () => base44.functions.invoke('initializeDefaultKpiThresholds', { unit_id: selectedUnit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thresholds'] });
      toast.success('Parâmetros padrão criados com sucesso');
    }
  });

  const syncKpisMutation = useMutation({
    mutationFn: () => base44.functions.invoke('syncKpiThresholdsFromReports', { unit_id: selectedUnit }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['thresholds'] });
      toast.success(`${result.data.created} novos KPIs sincronizados`);
    }
  });

  const initRulesMutation = useMutation({
    mutationFn: () => base44.functions.invoke('initializeDefaultKpiRules', { unit_id: selectedUnit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Regras de diagnóstico criadas com sucesso');
    }
  });

  const saveRuleMutation = useMutation({
    mutationFn: (ruleData) => {
      if (editingRule?.id) {
        return base44.entities.KpiRule.update(editingRule.id, {
          ...ruleData,
          unit_id: selectedUnit
        });
      } else {
        return base44.entities.KpiRule.create({
          ...ruleData,
          unit_id: selectedUnit,
          provider: 'META'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      setShowRuleBuilder(false);
      setEditingRule(null);
      toast.success(editingRule ? 'Regra atualizada' : 'Regra criada');
    }
  });

  const [pendingThresholds, setPendingThresholds] = useState({});
  const [pendingRules, setPendingRules] = useState({});

  const updateThresholdMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.KpiThreshold.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thresholds'] });
      setPendingThresholds({});
      toast.success('Parâmetros salvos');
    }
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.KpiRule.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      setPendingRules({});
      toast.success('Regras salvas');
    }
  });

  const replicateToUnitMutation = useMutation({
    mutationFn: async (targetUnitId) => {
      const thresholdsToReplicate = thresholds.map(t => ({
        unit_id: targetUnitId,
        provider: t.provider,
        kpi_key: t.kpi_key,
        kpi_name: t.kpi_name,
        group: t.group,
        direction: t.direction,
        green_min: t.green_min,
        green_max: t.green_max,
        yellow_min: t.yellow_min,
        yellow_max: t.yellow_max,
        red_min: t.red_min,
        red_max: t.red_max,
        evaluation_window: t.evaluation_window,
        min_spend_to_evaluate_7d: t.min_spend_to_evaluate_7d,
        min_spend_to_evaluate_30d: t.min_spend_to_evaluate_30d,
        min_impressions_to_evaluate_7d: t.min_impressions_to_evaluate_7d,
        min_impressions_to_evaluate_30d: t.min_impressions_to_evaluate_30d,
        enabled: t.enabled
      }));

      const rulesToReplicate = rules.map(r => ({
        unit_id: targetUnitId,
        provider: r.provider,
        rule_name: r.rule_name,
        conditions: r.conditions,
        severity: r.severity,
        message_title: r.message_title,
        message_body: r.message_body,
        recommended_actions: r.recommended_actions,
        enabled: r.enabled
      }));

      await base44.entities.KpiThreshold.bulkCreate(thresholdsToReplicate);
      await base44.entities.KpiRule.bulkCreate(rulesToReplicate);
    },
    onSuccess: () => {
      toast.success('Parametrização replicada com sucesso');
    }
  });

  const updateAlertConfigMutation = useMutation({
    mutationFn: (data) => {
      if (alertConfig?.id) {
        return base44.entities.AlertConfig.update(alertConfig.id, data);
      } else {
        return base44.entities.AlertConfig.create({ ...data, unit_id: selectedUnit });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertConfig'] });
      toast.success('Configuração de alertas atualizada');
    }
  });

  const updateTelegramAlertConfigMutation = useMutation({
    mutationFn: (data) => {
      if (telegramAlertConfig?.id) {
        return base44.entities.TelegramAlertConfig.update(telegramAlertConfig.id, data);
      } else {
        return base44.entities.TelegramAlertConfig.create({ ...data, unit_id: selectedUnit });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegramAlertConfig'] });
      toast.success('Configuração Telegram atualizada');
    }
  });

  const [telegramTemplate, setTelegramTemplate] = React.useState('');
  const [editingTemplate, setEditingTemplate] = React.useState(false);
  const [telegramCustomTime, setTelegramCustomTime] = React.useState('');
  const [alertCustomTime, setAlertCustomTime] = React.useState('');
  const [recentlySaved, setRecentlySaved] = React.useState({});
  const [executionLogs, setExecutionLogs] = React.useState([]);

  React.useEffect(() => {
    const loadTemplate = async () => {
      const response = await base44.functions.invoke('getDefaultAlertTemplate', {});
      setTelegramTemplate(response.data.template);
    };
    loadTemplate();
  }, []);

  const testTelegramMutation = useMutation({
    mutationFn: async () => {
      const configs = await base44.entities.TelegramAlertConfig.filter({ unit_id: selectedUnit });
      if (!configs || configs.length === 0) throw new Error('Configuração não encontrada');
      
      const config = configs[0];
      const alertResponse = await base44.functions.invoke('generateTelegramAlertLegacy', { 
        unit_id: selectedUnit,
        template: editingTemplate && telegramTemplate ? telegramTemplate : null
      });
      
      await base44.functions.invoke('sendTelegramMessage', {
        unit_id: selectedUnit,
        bot_token: config.bot_token,
        chat_id: config.chat_id,
        message: alertResponse.data.message
      });
      
      return { success: true };
    },
    onSuccess: () => {
      setTestResult({ success: true });
      setShowTestResult(true);
      toast.success('Alerta de teste enviado!');
    },
    onError: (error) => {
      setTestResult({ success: false, error: error.message });
      setShowTestResult(true);
    }
  });

  const groupedThresholds = thresholds.reduce((acc, t) => {
    if (!acc[t.group]) acc[t.group] = [];
    acc[t.group].push(t);
    return acc;
  }, {});

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Acesso Restrito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Esta página é acessível apenas para administradores.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Modal de Resultado do Teste Telegram */}
      <AlertDialog open={showTestResult} onOpenChange={setShowTestResult}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {testResult?.success ? (
                <><CheckCircle2 className="w-5 h-5 text-green-600" /> Sucesso!</>
              ) : (
                <><AlertCircle className="w-5 h-5 text-red-600" /> Erro</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {testResult?.success 
                ? 'Teste enviado para o Telegram! Verifique seu chat.'
                : `Problema: ${testResult?.error}`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={() => setShowTestResult(false)}>
            OK
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Notas da Regra */}
      <AlertDialog open={!!viewingNotes} onOpenChange={() => setViewingNotes(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{viewingNotes?.rule_name}</AlertDialogTitle>
            <AlertDialogDescription>Notas e Justificativa</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="p-4 bg-gray-50 rounded-lg border">
            <p className="text-sm whitespace-pre-wrap">{viewingNotes?.notes}</p>
          </div>
          <AlertDialogAction onClick={() => setViewingNotes(null)}>
            Fechar
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Parâmetros & Alertas</h1>
          <p className="text-gray-600 mt-1">Configure thresholds de KPIs, regras de diagnóstico e alertas por WhatsApp</p>
        </div>
        <Settings className="w-8 h-8 text-blue-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Unidade</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Escolha uma unidade" />
            </SelectTrigger>
            <SelectContent>
              {units.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedUnit && (
        <Tabs defaultValue="thresholds" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="thresholds">Parâmetros de KPIs</TabsTrigger>
            <TabsTrigger value="rules">Regras de Diagnóstico</TabsTrigger>
            <TabsTrigger value="alerts">Alertas WhatsApp</TabsTrigger>
            <TabsTrigger value="telegram">Alertas Telegram</TabsTrigger>
          </TabsList>

          <TabsContent value="thresholds" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Parâmetros de KPIs</CardTitle>
                    <CardDescription>Defina faixas verde/amarelo/vermelho para cada métrica</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {thresholds.length === 0 ? (
                      <Button onClick={() => initThresholdsMutation.mutate()}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Criar Padrões Recomendados
                      </Button>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={() => syncKpisMutation.mutate()}
                          disabled={syncKpisMutation.isPending}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sincronizar KPIs
                        </Button>
                        <Select onValueChange={(targetUnitId) => {
                          if (confirm('Replicar toda parametrização para esta unidade?')) {
                            replicateToUnitMutation.mutate(targetUnitId);
                          }
                        }}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Replicar para..." />
                          </SelectTrigger>
                          <SelectContent>
                            {units.filter(u => u.id !== selectedUnit).map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          onClick={() => {
                            Object.entries(pendingThresholds).forEach(([id, data]) => {
                              updateThresholdMutation.mutate({ id, data });
                            });
                          }}
                          disabled={Object.keys(pendingThresholds).length === 0}
                        >
                          Salvar Alterações
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.keys(groupedThresholds).map(group => (
                  <div key={group}>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      {group === 'Volume' && '📊'}
                      {group === 'Interesse' && '👁️'}
                      {group === 'Conversão' && '💬'}
                      {group === 'Custo' && '💰'}
                      {group === 'Qualidade' && '⭐'}
                      {group}
                    </h3>
                    <div className="space-y-3">
                      {groupedThresholds[group].map(threshold => (
                        <div key={threshold.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{threshold.kpi_name}</span>
                              <Badge variant={threshold.direction === 'higher_is_better' ? 'default' : 'secondary'}>
                                {threshold.direction === 'higher_is_better' ? (
                                  <><TrendingUp className="w-3 h-3 mr-1" /> Maior é melhor</>
                                ) : (
                                  <><TrendingDown className="w-3 h-3 mr-1" /> Menor é melhor</>
                                )}
                              </Badge>
                            </div>
                            <Switch
                              checked={threshold.enabled}
                              onCheckedChange={(enabled) => updateThresholdMutation.mutate({ id: threshold.id, data: { enabled } })}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label className="text-xs text-green-600 font-medium">Verde (Bom)</Label>
                              <div className="flex gap-2 mt-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={pendingThresholds[threshold.id]?.green_min ?? threshold.green_min}
                                  onChange={(e) => setPendingThresholds({
                                    ...pendingThresholds,
                                    [threshold.id]: {
                                      ...pendingThresholds[threshold.id],
                                      green_min: parseFloat(e.target.value)
                                    }
                                  })}
                                  className="h-8"
                                />
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={threshold.green_max}
                                  onChange={(e) => updateThresholdMutation.mutate({ 
                                    id: threshold.id, 
                                    data: { green_max: parseFloat(e.target.value) } 
                                  })}
                                  className="h-8"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-yellow-600 font-medium">Amarelo (Atenção)</Label>
                              <div className="flex gap-2 mt-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={threshold.yellow_min}
                                  onChange={(e) => updateThresholdMutation.mutate({ 
                                    id: threshold.id, 
                                    data: { yellow_min: parseFloat(e.target.value) } 
                                  })}
                                  className="h-8"
                                />
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={threshold.yellow_max}
                                  onChange={(e) => updateThresholdMutation.mutate({ 
                                    id: threshold.id, 
                                    data: { yellow_max: parseFloat(e.target.value) } 
                                  })}
                                  className="h-8"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-red-600 font-medium">Vermelho (Ruim)</Label>
                              <div className="flex gap-2 mt-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={threshold.red_min}
                                  onChange={(e) => updateThresholdMutation.mutate({ 
                                    id: threshold.id, 
                                    data: { red_min: parseFloat(e.target.value) } 
                                  })}
                                  className="h-8"
                                />
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={threshold.red_max}
                                  onChange={(e) => updateThresholdMutation.mutate({ 
                                    id: threshold.id, 
                                    data: { red_max: parseFloat(e.target.value) } 
                                  })}
                                  className="h-8"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            {showRuleBuilder ? (
              <RuleBuilder
                rule={editingRule}
                onSave={(data) => saveRuleMutation.mutate(data)}
                onCancel={() => {
                  setShowRuleBuilder(false);
                  setEditingRule(null);
                }}
              />
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Regras de Diagnóstico</CardTitle>
                      <CardDescription>Regras com múltiplas condições (AND/OR) e análise de causa raiz</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {rules.length > 0 && (
                        <Button 
                          onClick={() => {
                            setEditingRule(null);
                            setShowRuleBuilder(true);
                          }}
                          variant="outline"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Nova Regra
                        </Button>
                      )}
                      {rules.length === 0 ? (
                        <Button onClick={() => initRulesMutation.mutate()}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Criar Regras Padrão
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rules.map(rule => (
                    <div key={rule.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold">{rule.rule_name}</h4>
                          <Badge variant={
                            rule.severity === 'high' ? 'destructive' : 
                            rule.severity === 'medium' ? 'default' : 
                            'secondary'
                          }>
                            {rule.severity}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          {rule.notes && (
                            <Button
                              onClick={() => setViewingNotes(rule)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            onClick={() => {
                              setEditingRule(rule);
                              setShowRuleBuilder(true);
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(enabled) => 
                              updateRuleMutation.mutate({ id: rule.id, data: { enabled } })
                            }
                          />
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">{rule.message_body}</p>

                      {rule.conditions && rule.conditions.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-3">
                          <p className="text-xs font-medium text-gray-700 mb-2">Condições ({rule.condition_logic === 'all' ? 'AND' : 'OR'}):</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {rule.conditions.map((cond, idx) => (
                              <li key={idx}>
                                {idx > 0 && <span className="font-bold text-blue-600 mr-1">{cond.operator}</span>}
                                {cond.metric} {cond.comparison.replace('_', ' ')} {cond.value}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                        <p className="text-xs font-medium text-blue-900 mb-2">Ações Recomendadas:</p>
                        <ul className="text-xs text-blue-800 space-y-1">
                          {rule.recommended_actions?.map((action, idx) => (
                            <li key={idx}>• {action}</li>
                          ))}
                        </ul>
                      </div>

                      {rule.root_cause_hints && rule.root_cause_hints.length > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded p-3">
                          <p className="text-xs font-medium text-orange-900 mb-2">Possíveis Causas Raiz:</p>
                          <ul className="text-xs text-orange-800 space-y-1">
                            {rule.root_cause_hints.map((hint, idx) => (
                              <li key={idx}>• {hint}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Configuração de Alertas WhatsApp
                </CardTitle>
                <CardDescription>Receba alertas automáticos quando métricas saírem do padrão</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="font-medium">Ativar Alertas</Label>
                    <p className="text-sm text-gray-600">Receber notificações por WhatsApp</p>
                  </div>
                  <Switch
                    checked={alertConfig?.enabled || false}
                    onCheckedChange={(enabled) => updateAlertConfigMutation.mutate({ enabled })}
                  />
                </div>

                {alertConfig?.enabled && (
                  <>
                    <div>
                      <Label>Número do WhatsApp</Label>
                      <Input
                        placeholder="5511999999999"
                        value={alertConfig?.phone_number || ''}
                        onChange={(e) => updateAlertConfigMutation.mutate({ phone_number: e.target.value })}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Formato: 5511999999999 (código país + DDD + número)</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Frequência de Alertas</Label>
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <Select
                            value={alertConfig?.alert_frequency || 'daily'}
                            onValueChange={(alert_frequency) => updateAlertConfigMutation.mutate({ alert_frequency })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="immediate">Imediato</SelectItem>
                              <SelectItem value="daily">Diário</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {alertConfig?.alert_frequency === 'daily' && (
                          <>
                            <div className="w-20">
                              <Input
                                type="number"
                                min="0"
                                max="23"
                                placeholder="HH"
                                value={alertCustomTime.split(':')[0] || ''}
                                onChange={(e) => {
                                  const hour = e.target.value.padStart(2, '0');
                                  const minute = alertCustomTime.split(':')[1] || '00';
                                  setAlertCustomTime(`${hour}:${minute}`);
                                }}
                                className="h-9"
                              />
                            </div>
                            <span className="text-gray-500 font-bold">:</span>
                            <div className="w-20">
                              <Input
                                type="number"
                                min="0"
                                max="59"
                                placeholder="MM"
                                value={alertCustomTime.split(':')[1] || ''}
                                onChange={(e) => {
                                  const minute = e.target.value.padStart(2, '0');
                                  const hour = alertCustomTime.split(':')[0] || '09';
                                  setAlertCustomTime(`${hour}:${minute}`);
                                }}
                                className="h-9"
                              />
                            </div>
                            <Button
                              onClick={() => updateAlertConfigMutation.mutate({ alert_frequency: 'daily', custom_time: alertCustomTime })}
                              className="h-9"
                            >
                              Salvar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>Filtro de Severidade</Label>
                      <Select
                        value={alertConfig?.severity_filter || 'medium_high'}
                        onValueChange={(severity_filter) => updateAlertConfigMutation.mutate({ severity_filter })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high_only">Apenas Alta</SelectItem>
                          <SelectItem value="medium_high">Média + Alta</SelectItem>
                          <SelectItem value="all">Todos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <Label className="font-medium">Incluir Top Anúncios</Label>
                        <p className="text-sm text-gray-600">Mostrar os melhores anúncios no alerta</p>
                      </div>
                      <Switch
                        checked={alertConfig?.include_top_ads || false}
                        onCheckedChange={(include_top_ads) => updateAlertConfigMutation.mutate({ include_top_ads })}
                      />
                    </div>

                    {alertConfig?.include_top_ads && (
                      <div>
                        <Label>Quantidade de Top Anúncios</Label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={alertConfig?.top_ads_quantity || 3}
                          onChange={(e) => updateAlertConfigMutation.mutate({ top_ads_quantity: parseInt(e.target.value) })}
                          className="mt-1"
                        />
                      </div>
                    )}

                    <div>
                      <Label>Webhook URL (opcional)</Label>
                      <Input
                        placeholder="https://seu-n8n.com/webhook/whatsapp-alerts"
                        value={alertConfig?.webhook_url || ''}
                        onChange={(e) => updateAlertConfigMutation.mutate({ webhook_url: e.target.value })}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Se configurado, os alertas serão enviados para este endpoint</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="telegram" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Configuração de Alertas Telegram
                </CardTitle>
                <CardDescription>Receba alertas automáticos via Telegram quando métricas saírem do padrão</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="font-medium">Ativar Alertas Telegram</Label>
                    <p className="text-sm text-gray-600">Receber notificações por Telegram</p>
                  </div>
                  <Switch
                    checked={telegramAlertConfig?.enabled || false}
                    onCheckedChange={(enabled) => updateTelegramAlertConfigMutation.mutate({ enabled })}
                  />
                </div>

                {telegramAlertConfig?.enabled && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-sm text-blue-900 mb-2">Como configurar:</h4>
                      <ol className="text-xs text-blue-800 space-y-1 list-decimal ml-4">
                        <li>Abra o Telegram e procure por <strong>@BotFather</strong></li>
                        <li>Envie o comando <code>/newbot</code> e siga as instruções</li>
                        <li>Copie o <strong>token</strong> fornecido e cole abaixo</li>
                        <li>Para obter o Chat ID, envie uma mensagem para o bot e acesse: <code>https://api.telegram.org/bot{'<TOKEN>'}/getUpdates</code></li>
                        <li>Procure por "chat":{"{"}"id": no JSON retornado</li>
                      </ol>
                    </div>

                    <div>
                      <Label>Token do Bot</Label>
                      <Input
                        type="password"
                        placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                        value={telegramAlertConfig?.bot_token || ''}
                        onChange={(e) => updateTelegramAlertConfigMutation.mutate({ bot_token: e.target.value })}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Token fornecido pelo BotFather</p>
                    </div>

                    <div>
                      <Label>Chat ID</Label>
                      <Input
                        placeholder="123456789"
                        value={telegramAlertConfig?.chat_id || ''}
                        onChange={(e) => updateTelegramAlertConfigMutation.mutate({ chat_id: e.target.value })}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">ID do chat, grupo ou canal que receberá os alertas</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Frequência de Alertas</Label>
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <Select
                            value={telegramAlertConfig?.alert_frequency || 'daily'}
                            onValueChange={(alert_frequency) => updateTelegramAlertConfigMutation.mutate({ alert_frequency })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="immediate">Imediato</SelectItem>
                              <SelectItem value="daily">Diário</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {telegramAlertConfig?.alert_frequency === 'daily' && (
                          <>
                            <div className="w-20">
                              <Input
                                type="number"
                                min="0"
                                max="23"
                                placeholder="HH"
                                value={telegramCustomTime.split(':')[0] || ''}
                                onChange={(e) => {
                                  const hour = e.target.value.padStart(2, '0');
                                  const minute = telegramCustomTime.split(':')[1] || '00';
                                  setTelegramCustomTime(`${hour}:${minute}`);
                                }}
                                className="h-9"
                              />
                            </div>
                            <span className="text-gray-500 font-bold">:</span>
                            <div className="w-20">
                              <Input
                                type="number"
                                min="0"
                                max="59"
                                placeholder="MM"
                                value={telegramCustomTime.split(':')[1] || ''}
                                onChange={(e) => {
                                  const minute = e.target.value.padStart(2, '0');
                                  const hour = telegramCustomTime.split(':')[0] || '09';
                                  setTelegramCustomTime(`${hour}:${minute}`);
                                }}
                                className="h-9"
                              />
                            </div>
                            <Button
                              onClick={() => updateTelegramAlertConfigMutation.mutate({ alert_frequency: 'daily', custom_time: telegramCustomTime })}
                              className="h-9"
                            >
                              Salvar
                            </Button>
                            <Button 
                              onClick={() => testTelegramMutation.mutate()}
                              disabled={testTelegramMutation.isPending || !telegramAlertConfig?.bot_token || !telegramAlertConfig?.chat_id}
                              variant="outline"
                              className="h-9 gap-2"
                            >
                              {testTelegramMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                              {testTelegramMutation.isPending ? 'Enviando...' : 'Testar'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Template do Alerta</Label>
                        <Button 
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingTemplate(!editingTemplate)}
                        >
                          {editingTemplate ? 'Salvar' : 'Editar'}
                        </Button>
                      </div>
                      {editingTemplate ? (
                        <Textarea
                          value={telegramTemplate}
                          onChange={(e) => setTelegramTemplate(e.target.value)}
                          className="font-mono text-xs h-96"
                        />
                      ) : (
                        <div className="bg-gray-50 border rounded p-3 text-xs whitespace-pre-wrap text-gray-700 max-h-60 overflow-y-auto font-mono">
                          {telegramTemplate}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>Filtro de Severidade</Label>
                      <Select
                        value={telegramAlertConfig?.severity_filter || 'medium_high'}
                        onValueChange={(severity_filter) => updateTelegramAlertConfigMutation.mutate({ severity_filter })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high_only">Apenas Alta</SelectItem>
                          <SelectItem value="medium_high">Média + Alta</SelectItem>
                          <SelectItem value="all">Todos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <Label className="font-medium">Incluir Top Anúncios</Label>
                        <p className="text-sm text-gray-600">Mostrar os melhores anúncios no alerta</p>
                      </div>
                      <Switch
                        checked={telegramAlertConfig?.include_top_ads || false}
                        onCheckedChange={(include_top_ads) => updateTelegramAlertConfigMutation.mutate({ include_top_ads })}
                      />
                    </div>

                    {telegramAlertConfig?.include_top_ads && (
                      <div>
                        <Label>Quantidade de Top Anúncios</Label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={telegramAlertConfig?.top_ads_quantity || 3}
                          onChange={(e) => updateTelegramAlertConfigMutation.mutate({ top_ads_quantity: parseInt(e.target.value) })}
                          className="mt-1"
                        />
                      </div>
                    )}



                    <div>
                      <Label>Webhook URL (opcional)</Label>
                      <Input
                        placeholder="https://seu-n8n.com/webhook/telegram-alerts"
                        value={telegramAlertConfig?.webhook_url || ''}
                        onChange={(e) => updateTelegramAlertConfigMutation.mutate({ webhook_url: e.target.value })}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Se configurado, os alertas serão enviados para este endpoint ao invés de diretamente para o Telegram</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}