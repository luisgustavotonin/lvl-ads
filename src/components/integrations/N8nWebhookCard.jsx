import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Settings, Trash2, Webhook, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function N8nWebhookCard({ integration, onEdit, onDelete }) {
  const [isTesting, setIsTesting] = useState(false);
  
  // URL correta para chamar a função backend externamente (via N8n)
  // Formato: https://app--your-app-name.base44.app/api/apps/your-app-id/functions/functionName
  const webhookUrl = `https://app--unified-ads-platform.base44.app/api/apps/6984a13af76359c5c3583c42/functions/receiveN8nData`;
  
  const secretToken = integration.settings?.n8n_secret_token || 'NÃO CONFIGURADO';
  
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copiado!`);
  };

  const handleTestWebhook = async () => {
    const n8nUrl = integration.settings?.n8n_webhook_url;
    
    if (!n8nUrl) {
      alert('⚠️ Configure a URL do webhook N8n antes de testar!');
      return;
    }

    setIsTesting(true);
    try {
      const testPayload = {
        integration_id: integration.id,
        secret_token: secretToken,
        data: [
          {
            date: new Date().toISOString().split('T')[0],
            metrics: {
              spend: 100.50,
              impressions: 5000,
              clicks: 250,
              link_clicks: 200,
              conversions: 10,
              leads: 8,
              purchases: 2
            },
            campaign_data: [
              {
                id: "test_campaign_001",
                name: "Campanha de Teste",
                status: "active",
                spend: 100.50,
                impressions: 5000,
                clicks: 250,
                results: 10
              }
            ]
          }
        ]
      };

      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ Teste enviado para N8n com sucesso!`);
      } else {
        alert(`❌ Erro ao chamar N8n:\n\nStatus ${response.status}`);
      }
    } catch (error) {
      alert(`❌ Erro ao enviar teste:\n\n${error.message}`);
    } finally {
      setIsTesting(false);
    }
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
        {/* N8n Webhook URL */}
        <div className="p-3 bg-white rounded-lg border border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-1.5">URL do Webhook N8n:</p>
          <div className="flex gap-2">
            <code className={cn(
              "flex-1 text-xs px-2 py-1.5 rounded border break-all",
              !integration.settings?.n8n_webhook_url ? 'bg-red-50 text-red-600' : 'bg-gray-50'
            )}>
              {integration.settings?.n8n_webhook_url || 'NÃO CONFIGURADO'}
            </code>
            {integration.settings?.n8n_webhook_url && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(integration.settings.n8n_webhook_url, 'URL N8n')}
                className="shrink-0"
              >
                <Copy className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Base44 Receiver URL */}
        <div className="p-3 bg-white rounded-lg border border-green-200 bg-green-50">
          <p className="text-xs font-medium text-green-900 mb-1.5">✅ URL para N8n enviar dados (POST):</p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-white px-2 py-1.5 rounded border break-all font-mono">
              {webhookUrl}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(webhookUrl, 'URL do Webhook')}
              className="shrink-0"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-xs text-green-700 mt-1.5">
            ⚠️ Use esta URL no N8n para enviar dados para o Base44
          </p>
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
            onClick={handleTestWebhook}
            disabled={isTesting || !integration.settings?.n8n_webhook_url}
            className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1" />
                Testar Webhook
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
          >
            <Settings className="w-4 h-4" />
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