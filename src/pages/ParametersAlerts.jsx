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
import { AlertCircle, CheckCircle2, RefreshCw, Settings, Bell, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

export default function ParametersAlerts() {
  const [selectedUnit, setSelectedUnit] = useState('');
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

  const initThresholdsMutation = useMutation({
    mutationFn: () => base44.functions.invoke('initializeDefaultKpiThresholds', { unit_id: selectedUnit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thresholds'] });
      toast.success('Parâmetros padrão criados com sucesso');
    }
  });

  const initRulesMutation = useMutation({
    mutationFn: () => base44.functions.invoke('initializeDefaultKpiRules', { unit_id: selectedUnit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Regras de diagnóstico criadas com sucesso');
    }
  });

  const replicateThresholdsMutation = useMutation({
    mutationFn: async ({ targetUnitId }) => {
      // Buscar thresholds da unidade atual
      const sourceThresholds = await base44.entities.KpiThreshold.filter({ unit_id: selectedUnit });
      
      // Deletar thresholds existentes na unidade alvo
      const existingTarget = await base44.entities.KpiThreshold.filter({ unit_id: targetUnitId });
      for (const t of existingTarget) {
        await base44.entities.KpiThreshold.delete(t.id);
      }
      
      // Criar novos thresholds na unidade alvo
      const newThresholds = sourceThresholds.map(t => {
        const { id, created_date, updated_date, created_by, ...rest } = t;
        return { ...rest, unit_id: targetUnitId };
      });
      
      await base44.entities.KpiThreshold.bulkCreate(newThresholds);
      
      // Replicar regras também
      const sourceRules = await base44.entities.KpiRule.filter({ unit_id: selectedUnit });
      const existingRules = await base44.entities.KpiRule.filter({ unit_id: targetUnitId });
      for (const r of existingRules) {
        await base44.entities.KpiRule.delete(r.id);
      }
      
      const newRules = sourceRules.map(r => {
        const { id, created_date, updated_date, created_by, ...rest } = r;
        return { ...rest, unit_id: targetUnitId };
      });
      
      await base44.entities.KpiRule.bulkCreate(newRules);
    },
    onSuccess: () => {
      toast.success('Parâmetros replicados com sucesso');
    }
  });

  const updateThresholdMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.KpiThreshold.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thresholds'] });
      toast.success('Parâmetro atualizado');
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
        <CardContent className="flex gap-4">
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
          
          {selectedUnit && thresholds.length > 0 && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Replicar para outra unidade</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Replicar Parâmetros</SheetTitle>
                  <SheetDescription>Copiar configurações desta unidade para outra</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <Label>Unidade de destino</Label>
                  <Select onValueChange={(targetId) => {
                    if (window.confirm(`Replicar parâmetros para a unidade selecionada? Os parâmetros atuais dela serão substituídos.`)) {
                      replicateThresholdsMutation.mutate({ targetUnitId: targetId });
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.filter(u => u.id !== selectedUnit).map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </CardContent>
      </Card>

      {selectedUnit && (
        <Tabs defaultValue="thresholds" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="thresholds">Parâmetros de KPIs</TabsTrigger>
            <TabsTrigger value="rules">Regras de Diagnóstico</TabsTrigger>
            <TabsTrigger value="alerts">Alertas WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="thresholds" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Parâmetros de KPIs</CardTitle>
                    <CardDescription>Defina faixas verde/amarelo/vermelho para cada métrica</CardDescription>
                  </div>
                  {thresholds.length === 0 && (
                    <Button onClick={() => initThresholdsMutation.mutate()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Criar Padrões Recomendados
                    </Button>
                  )}
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
                                  value={threshold.green_min}
                                  onChange={(e) => updateThresholdMutation.mutate({ 
                                    id: threshold.id, 
                                    data: { green_min: parseFloat(e.target.value) } 
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
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Regras de Diagnóstico</CardTitle>
                    <CardDescription>Sugestões automáticas baseadas em combinações de métricas</CardDescription>
                  </div>
                  {rules.length === 0 && (
                    <Button onClick={() => initRulesMutation.mutate()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Criar Regras Padrão
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {rules.map(rule => (
                  <div key={rule.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{rule.rule_name}</h4>
                          <Badge variant={
                            rule.severity === 'high' ? 'destructive' : 
                            rule.severity === 'medium' ? 'default' : 
                            'secondary'
                          }>
                            {rule.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{rule.message_body}</p>
                        <div className="bg-blue-50 border border-blue-200 rounded p-3">
                          <p className="text-xs font-medium text-blue-900 mb-2">Ações Recomendadas:</p>
                          <ul className="text-xs text-blue-800 space-y-1">
                            {rule.recommended_actions?.map((action, idx) => (
                              <li key={idx}>• {action}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <Switch checked={rule.enabled} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
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

                    <div>
                      <Label>Frequência de Alertas</Label>
                      <Select
                        value={alertConfig?.alert_frequency || 'daily_9h'}
                        onValueChange={(alert_frequency) => updateAlertConfigMutation.mutate({ alert_frequency })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Imediato</SelectItem>
                          <SelectItem value="daily_9h">Diário às 9h</SelectItem>
                          <SelectItem value="daily_18h">Diário às 18h</SelectItem>
                        </SelectContent>
                      </Select>
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
        </Tabs>
      )}
    </div>
  );
}