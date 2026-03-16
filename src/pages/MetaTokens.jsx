import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Key, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import toast from 'react-hot-toast';

const invoke = (action, params = {}) =>
  base44.functions.invoke('manageMetaTokens', { action, ...params });

export default function MetaTokens() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showToken, setShowToken] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const [form, setForm] = useState({ name: '', token: '', unit_ids: [], notes: '' });
  const [saving, setSaving] = useState(false);

  const { data: tokens = [], isLoading: loadingTokens } = useQuery({
    queryKey: ['metaTokens'],
    queryFn: async () => {
      const res = await invoke('list');
      return res.data.tokens || [];
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.Unit.list(),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', token: '', unit_ids: [], notes: '' });
    setShowToken(false);
    setUnitSearch('');
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name || '', token: '', unit_ids: t.unit_ids || [], notes: t.notes || '' });
    setShowToken(false);
    setUnitSearch('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Informe um nome'); return; }
    if (!editing && !form.token.trim()) { toast.error('Informe o token'); return; }
    setSaving(true);
    const payload = { ...form, token: form.token.trim(), name: form.name.trim() };
    try {
      if (editing) {
        await invoke('update', { id: editing.id, ...payload });
        toast.success('Token atualizado!');
      } else {
        await invoke('create', payload);
        toast.success('Token criado!');
      }
      queryClient.invalidateQueries({ queryKey: ['metaTokens'] });
      setDialogOpen(false);
    } catch (e) {
      toast.error(e.message || 'Erro ao salvar');
    }
    setSaving(false);
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Excluir token "${t.name}"?`)) return;
    await invoke('delete', { id: t.id });
    queryClient.invalidateQueries({ queryKey: ['metaTokens'] });
    toast.success('Token excluído');
  };

  const toggleUnit = (uid) => {
    setForm(f => ({
      ...f,
      unit_ids: f.unit_ids.includes(uid)
        ? f.unit_ids.filter(id => id !== uid)
        : [...f.unit_ids, uid],
    }));
  };

  const getUnitNames = (unit_ids = []) =>
    units.filter(u => unit_ids.includes(u.id)).map(u => u.name);

  const filteredUnits = [...units]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .filter(u => u.name.toLowerCase().includes(unitSearch.toLowerCase()));

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tokens Meta</h1>
          <p className="text-gray-500 mt-1 text-sm">Tokens de acesso armazenados com segurança — nunca expostos no frontend</p>
        </div>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Token
        </Button>
      </div>

      {loadingTokens && (
        <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
      )}

      {!loadingTokens && tokens.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Key className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhum token cadastrado</p>
            <p className="text-sm text-gray-400 mt-1">Clique em "Novo Token" para adicionar</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {tokens.map(t => {
          const unitNames = getUnitNames(t.unit_ids);
          return (
            <Card key={t.id} className="border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Key className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="font-semibold text-gray-800">{t.name}</span>
                      <Badge variant={t.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {t.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 font-mono">
                      Token: ••••••••••••••••••••••••
                    </p>
                    {unitNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {unitNames.map(name => (
                          <Badge key={name} variant="outline" className="text-xs text-blue-700 border-blue-200 bg-blue-50">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-500 mt-2">⚠️ Nenhuma unidade associada</p>
                    )}
                    {t.notes && <p className="text-xs text-gray-400 mt-2 italic">{t.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(t)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(t)} className="text-gray-300 hover:text-red-500 transition-colors" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Token' : 'Novo Token'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nome / Apelido *</Label>
              <Input
                placeholder="Ex: Conta João Silva"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{editing ? 'Novo Token (deixe vazio para manter o atual)' : 'Token de Acesso *'}</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder={editing ? 'Cole um novo token para substituir...' : 'Cole o token da Meta Ads API'}
                  value={form.token}
                  onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400">
                O token é enviado diretamente ao backend e nunca é retornado para o navegador.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Unidades associadas</Label>
              <Input
                placeholder="Buscar unidade..."
                value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
                className="text-sm"
              />
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {filteredUnits.map(u => {
                  const selected = form.unit_ids.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleUnit(u.id)}
                      />
                      <span className={`text-sm font-medium flex-1 ${selected ? 'text-blue-800' : 'text-gray-800'}`}>{u.name}</span>
                      {u.account_id && <span className="text-xs text-gray-400">{u.account_id}</span>}
                    </label>
                  );
                })}
              </div>
              {form.unit_ids.length > 0 && (
                <p className="text-xs text-blue-600">{form.unit_ids.length} unidade(s) selecionada(s)</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Ex: Token expira em 90 dias, renovar em maio/2025"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}