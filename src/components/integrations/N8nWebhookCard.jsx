import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Settings, Trash2, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function N8nWebhookCard({ integration, onEdit, onDelete }) {
  const webhookUrl = `${window.location.origin}/api/functions/receiveN8nData`;
  const secretToken = integration.settings?.n8n_secret_token || 'NÃO CONFIGURADO';
  
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copiado!`);
  };

  const getStatusBadge = () => {
    if (!integration.settings?.n8n_secret_token) {
      return <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendente Configuração</Badge>;
    }
    return <Badge className="bg-green-50 text-green-700 border-green-200">Configurado</Badge>;
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Webhook className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {integration.integration_purpose || integration.account_name || 'Integração N8n'}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                ID: {integration.id}
              </p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Webhook URL */}
        <div className="p-3 bg-white rounded-lg border border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-1.5">URL do Webhook:</p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-gray-50 px-2 py-1.5 rounded border break-all">
              {webhookUrl}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(webhookUrl, 'URL')}
              className="shrink-0"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Integration ID */}
        <div className="p-3 bg-white rounded-lg border border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-1.5">Integration ID (enviar no JSON):</p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-gray-50 px-2 py-1.5 rounded border">
              {integration.id}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(integration.id, 'Integration ID')}
              className="shrink-0"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Secret Token */}
        <div className="p-3 bg-white rounded-lg border border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-1.5">Secret Token:</p>
          <div className="flex gap-2">
            <code className={cn(
              "flex-1 text-xs px-2 py-1.5 rounded border",
              secretToken === 'NÃO CONFIGURADO' ? 'bg-red-50 text-red-600' : 'bg-gray-50'
            )}>
              {secretToken === 'NÃO CONFIGURADO' ? secretToken : '••••••••••••'}
            </code>
            {secretToken !== 'NÃO CONFIGURADO' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(secretToken, 'Token')}
                className="shrink-0"
              >
                <Copy className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* JSON Example */}
        <details className="p-3 bg-white rounded-lg border border-gray-200">
          <summary className="text-xs font-medium text-gray-700 cursor-pointer">
            📋 Ver exemplo de JSON para enviar
          </summary>
          <pre className="text-xs mt-2 p-2 bg-gray-50 rounded border overflow-x-auto">
{`{
  "integration_id": "${integration.id}",
  "secret_token": "${secretToken === 'NÃO CONFIGURADO' ? 'SEU_TOKEN_AQUI' : secretToken}",
  "data": [
    {
      "date": "2024-01-15",
      "metrics": {
        "spend": 1500.50,
        "impressions": 50000,
        "clicks": 1200,
        "link_clicks": 980,
        "conversions": 45,
        "leads": 30,
        "purchases": 15
      },
      "campaign_data": [
        {
          "id": "campaign_123",
          "name": "Campanha Verão",
          "status": "active",
          "spend": 500,
          "impressions": 20000,
          "clicks": 400
        }
      ],
      "adset_data": [...],
      "ad_data": [
        {
          "id": "ad_456",
          "name": "Anúncio Produto X",
          "status": "active",
          "spend": 100,
          "thumbnail_url": "https://exemplo.com/imagem.jpg"
        }
      ]
    }
  ]
}`}
          </pre>
        </details>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1"
          >
            <Settings className="w-4 h-4 mr-1" />
            Configurar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}