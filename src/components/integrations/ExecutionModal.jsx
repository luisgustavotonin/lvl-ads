import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar, Play } from 'lucide-react';
import { format } from 'date-fns';

const DATE_MODES = [
  { value: 'TODAY', label: 'Hoje' },
  { value: 'YESTERDAY', label: 'Ontem' },
  { value: 'LAST_7D', label: 'Últimos 7 dias' },
  { value: 'LAST_14D', label: 'Últimos 14 dias' },
  { value: 'LAST_28D', label: 'Últimos 28 dias' },
  { value: 'LAST_30D', label: 'Últimos 30 dias' },
  { value: 'CUSTOM', label: 'Período personalizado' }
];

export default function ExecutionModal({ open, onClose, integration, onExecute }) {
  const [dateMode, setDateMode] = useState('YESTERDAY');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleExecute = async () => {
    setIsLoading(true);
    try {
      await onExecute({
        integration_id: integration.id,
        date_mode: dateMode,
        since: dateMode === 'CUSTOM' ? since : null,
        until: dateMode === 'CUSTOM' ? until : null
      });
      onClose();
    } catch (error) {
      console.error('Erro ao executar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = dateMode !== 'CUSTOM' || (since && until);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-blue-600" />
            Executar Integração
          </DialogTitle>
          <DialogDescription>
            Configure o período de dados para buscar de {integration?.account_name || 'integração'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date_mode">Período</Label>
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
          </div>

          {dateMode === 'CUSTOM' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="since">Data Inicial</Label>
                <Input
                  id="since"
                  type="date"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                  max={until || format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="until">Data Final</Label>
                <Input
                  id="until"
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  min={since}
                  max={format(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })), 'yyyy-MM-dd')}
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              <Calendar className="w-3 h-3 inline mr-1" />
              Esta execução será enviada ao N8n para processamento. O tempo de processamento pode variar conforme o volume de dados.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleExecute} 
            disabled={!isValid || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Executando...' : 'Executar Agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}