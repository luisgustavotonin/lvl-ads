import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock } from 'lucide-react';

const DATE_MODES = [
  { value: 'TODAY', label: 'Hoje' },
  { value: 'YESTERDAY', label: 'Ontem' },
  { value: 'LAST_7D', label: 'Últimos 7 dias' },
  { value: 'LAST_14D', label: 'Últimos 14 dias' },
  { value: 'LAST_28D', label: 'Últimos 28 dias' },
  { value: 'LAST_30D', label: 'Últimos 30 dias' }
];

const FREQUENCIES = [
  { value: 'hourly', label: 'A cada hora' },
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' }
];

const EXECUTION_TIMES = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];

import { Input } from '@/components/ui/input';

export default function ScheduleModal({ open, onClose, integration, onSave }) {
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [dateMode, setDateMode] = useState('YESTERDAY');
  const [frequency, setFrequency] = useState('daily');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [customHour, setCustomHour] = useState('09');
  const [customMinute, setCustomMinute] = useState('00');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (integration && open) {
      setScheduleEnabled(integration.schedule_enabled || false);
      setDateMode(integration.schedule_date_mode || 'YESTERDAY');
      setFrequency(integration.schedule_frequency || 'daily');
      setScheduleTime(integration.schedule_time || '09:00');
    }
  }, [integration, open]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const timeToSave = useCustomTime ? `${customHour.padStart(2, '0')}:${customMinute.padStart(2, '0')}` : scheduleTime;
      await onSave({
        schedule_enabled: scheduleEnabled,
        schedule_date_mode: dateMode,
        schedule_frequency: frequency,
        schedule_time: timeToSave
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Configurar Agendamento
          </DialogTitle>
          <DialogDescription>
            Configure a importação automática de dados para {integration?.account_name || integration?.integration_purpose || 'esta integração'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Habilitar/Desabilitar */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="schedule_enabled" className="font-medium">Agendamento Ativo</Label>
              <p className="text-xs text-gray-500 mt-1">Ativar execução automática</p>
            </div>
            <Switch
              id="schedule_enabled"
              checked={scheduleEnabled}
              onCheckedChange={setScheduleEnabled}
            />
          </div>

          {scheduleEnabled && (
            <>
              {/* Período de Importação */}
              <div className="space-y-2">
                <Label htmlFor="date_mode">Período de Importação</Label>
                <Select value={dateMode} onValueChange={setDateMode}>
                  <SelectTrigger id="date_mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_MODES.map(mode => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Define qual período será importado a cada execução
                </p>
              </div>

              {/* Frequência */}
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequência</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(freq => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Horário (apenas para daily e weekly) */}
              {(frequency === 'daily' || frequency === 'weekly') && (
                <div className="space-y-2">
                  <Label htmlFor="schedule_time">Horário de Execução</Label>
                  <div className="flex gap-2 items-end">
                    {!useCustomTime ? (
                      <>
                        <div className="flex-1">
                          <Select value={scheduleTime} onValueChange={setScheduleTime}>
                            <SelectTrigger id="schedule_time">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {EXECUTION_TIMES.map(time => (
                                <SelectItem key={time} value={time}>
                                  <Clock className="w-3 h-3 inline mr-2" />
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setUseCustomTime(true)}
                          className="h-9"
                        >
                          Manual
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="w-20">
                          <Input
                            type="number"
                            min="0"
                            max="23"
                            placeholder="HH"
                            value={customHour}
                            onChange={(e) => setCustomHour(e.target.value)}
                            className="h-9 text-center"
                          />
                        </div>
                        <span className="text-gray-500 font-bold">:</span>
                        <div className="w-20">
                          <Input
                            type="number"
                            min="0"
                            max="59"
                            placeholder="MM"
                            value={customMinute}
                            onChange={(e) => setCustomMinute(e.target.value)}
                            className="h-9 text-center"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setUseCustomTime(false)}
                          className="h-9"
                        >
                          Lista
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-800">
                  ℹ️ O agendamento executará automaticamente nos horários configurados, importando dados do período selecionado.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}