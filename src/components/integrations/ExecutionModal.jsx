import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function ExecutionModal({ open, onClose, integration, onExecute }) {
  const [dateMode, setDateMode] = useState('TODAY');
  const [customSince, setCustomSince] = useState('');
  const [customUntil, setCustomUntil] = useState('');
  const [module, setModule] = useState('');

  const handleExecute = () => {
    const params = {
      integration_id: integration.id,
      date_mode: dateMode,
      module: module || integration.integration_purpose || undefined
    };

    if (dateMode === 'CUSTOM') {
      if (!customSince || !customUntil) {
        alert('Por favor, preencha as datas de início e fim para o período customizado');
        return;
      }
      params.since = customSince;
      params.until = customUntil;
    }

    onExecute(params);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Executar Integração</DialogTitle>
          <DialogDescription>
            Configure o período de dados a serem buscados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Módulo / Tipo de Job (opcional)</Label>
            <Input
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder={integration.integration_purpose || 'Ex: META_DAILY, META_CAMPAIGNS'}
            />
            <p className="text-xs text-gray-500">
              Deixe vazio para usar o propósito padrão da integração
            </p>
          </div>

          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={dateMode} onValueChange={setDateMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAY">Hoje</SelectItem>
                <SelectItem value="YESTERDAY">Ontem</SelectItem>
                <SelectItem value="LAST_7D">Últimos 7 dias</SelectItem>
                <SelectItem value="LAST_14D">Últimos 14 dias</SelectItem>
                <SelectItem value="LAST_28D">Últimos 28 dias</SelectItem>
                <SelectItem value="LAST_30D">Últimos 30 dias</SelectItem>
                <SelectItem value="CUSTOM">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateMode === 'CUSTOM' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={customSince}
                  onChange={(e) => setCustomSince(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={customUntil}
                  onChange={(e) => setCustomUntil(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleExecute} className="bg-blue-600 hover:bg-blue-700">
            Executar Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}