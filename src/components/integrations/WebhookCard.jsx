import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Settings, Users, Calendar, Trash2, BarChart3, Image, Zap } from 'lucide-react';

const TYPE_CONFIG = {
  insights: { label: 'Insights', className: 'bg-blue-50 text-blue-700 border-blue-100', Icon: BarChart3 },
  creatives: { label: 'Criativos', className: 'bg-purple-50 text-purple-700 border-purple-100', Icon: Image },
  custom: { label: 'Custom', className: 'bg-gray-50 text-gray-700 border-gray-100', Icon: Zap },
};

export default function WebhookCard({ webhook, units, onExecute, onManageUnits, onEdit, onSchedule, onDelete }) {
  const type = webhook.webhook_type || 'insights';
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.custom;
  const TypeIcon = config.Icon;

  const associatedUnits = units.filter(u => (webhook.unit_ids || []).includes(u.id));
  const buttonLabel = webhook.button_label || `Executar ${config.label}`;
  const hasUnits = associatedUnits.length > 0;

  return (
    <Card className="border-gray-200 hover:border-gray-300 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-gray-900">{webhook.name}</span>
              <Badge className={`text-xs border shrink-0 ${config.className}`}>
                <TypeIcon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
              {webhook.schedule_enabled && (
                <Badge variant="outline" className="text-xs shrink-0">
                  <Calendar className="w-3 h-3 mr-1" />
                  Agendado
                </Badge>
              )}
            </div>

            {webhook.webhook_url && (
              <p className="text-xs text-gray-400 font-mono truncate max-w-md mb-2">
                {webhook.webhook_url}
              </p>
            )}

            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {hasUnits ? (
                associatedUnits.map(unit => (
                  <Badge key={unit.id} variant="outline" className="text-xs">
                    {unit.name}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-gray-400 italic">Nenhuma unidade — clique em Unidades para adicionar</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <Button
              size="sm"
              onClick={() => onExecute(webhook)}
              disabled={!hasUnits}
              className="bg-blue-600 hover:bg-blue-700 gap-1.5"
              title={!hasUnits ? 'Adicione unidades primeiro' : ''}
            >
              <Play className="w-3.5 h-3.5" />
              {buttonLabel}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onManageUnits(webhook)} title="Gerenciar unidades">
              <Users className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onSchedule(webhook)} title="Agendamento">
              <Calendar className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(webhook)} title="Configurar webhook">
              <Settings className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(webhook)} title="Excluir">
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}