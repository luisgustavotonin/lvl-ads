import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DEFAULT_FORM = {
  name: '',
  button_label: '',
  webhook_type: 'insights',
  webhook_url: '',
  settings: { secret_token: '' },
};

export default function WebhookFormDialog({ open, onClose, onSave, webhook, platformName, isSaving }) {
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    if (open) {
      if (webhook) {
        setForm({
          name: webhook.name || '',
          button_label: webhook.button_label || '',
          webhook_type: webhook.webhook_type || 'insights',
          webhook_url: webhook.webhook_url || webhook.n8n_webhook_insights_url || webhook.n8n_webhook_creatives_url || '',
          settings: {
            secret_token: webhook.settings?.secret_token || webhook.settings?.n8n_secret_token || '',
          },
        });
      } else {
        setForm(DEFAULT_FORM);
      }
    }
  }, [webhook, open]);

  const handleSave = () => {
    if (!form.name.trim() || !form.webhook_url.trim()) {
      alert('Nome e URL do webhook são obrigatórios');
      return;
    }
    onSave(form);
  };

  const placeholderLabel = form.webhook_type === 'insights'
    ? 'Executar Insights'
    : form.webhook_type === 'creatives'
    ? 'Executar Criativos'
    : 'Executar';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {webhook ? 'Editar Webhook' : `Novo Webhook — ${platformName}`}
          </DialogTitle>
          <DialogDescription>
            Configure as informações do webhook. As unidades são adicionadas depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Meta Insights - Produção"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Webhook</Label>
            <Select value={form.webhook_type} onValueChange={v => setForm({ ...form, webhook_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="insights">Insights (dados de performance)</SelectItem>
                <SelectItem value="creatives">Criativos (imagens/vídeos)</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Label do Botão de Execução</Label>
            <Input
              value={form.button_label}
              onChange={e => setForm({ ...form, button_label: e.target.value })}
              placeholder={placeholderLabel}
            />
            <p className="text-xs text-gray-400">Deixe em branco para usar o padrão</p>
          </div>

          <div className="space-y-2">
            <Label>URL do Webhook N8n *</Label>
            <Input
              value={form.webhook_url}
              onChange={e => setForm({ ...form, webhook_url: e.target.value })}
              placeholder="https://seu-n8n.com/webhook/..."
            />
          </div>

          <div className="space-y-2">
            <Label>Token de Segurança</Label>
            <Input
              type="password"
              value={form.settings.secret_token}
              onChange={e => setForm({ ...form, settings: { ...form.settings, secret_token: e.target.value } })}
              placeholder="Token enviado no header Authorization"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}