import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';

export default function EditPlatformDialog({ open, platform, onClose, onSave, isSaving }) {
  const [form, setForm] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    if (platform) {
      setForm({ name: platform.name, color: platform.color, icon_url: platform.icon_url });
      setLogoFile(null);
    }
  }, [platform]);

  const handleSave = async () => {
    let icon_url = form.icon_url;
    if (logoFile) {
      setUploading(true);
      const res = await base44.integrations.Core.UploadFile({ file: logoFile });
      icon_url = res.file_url;
      setUploading(false);
    }
    onSave({ name: form.name, color: form.color, icon_url });
  };

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar Plataforma</DialogTitle>
          <DialogDescription>Personalize o logo, nome e cor da plataforma.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Logo</Label>
            <Input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} />
            {(logoFile || form.icon_url) && (
              <div className="p-3 bg-gray-50 rounded flex justify-center">
                <img
                  src={logoFile ? URL.createObjectURL(logoFile) : form.icon_url}
                  alt="preview"
                  className="w-12 h-12 object-contain"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Cor (hex)</Label>
            <div className="flex gap-2">
              <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="#1877F2" />
              <div className="w-10 h-9 rounded border shrink-0" style={{ backgroundColor: form.color }} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={uploading || isSaving}>
            {uploading ? 'Enviando...' : isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}