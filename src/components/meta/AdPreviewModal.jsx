import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ImageIcon } from 'lucide-react';

export default function AdPreviewModal({ ad, open, onClose }) {
  if (!ad) return null;

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));
  const formatPercent = (val) => `${val.toFixed(2)}%`;

  const getStatusColor = (status) => {
    if (status === 'ACTIVE') return 'bg-green-100 text-green-700';
    if (status === 'PAUSED') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{ad.ad_name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Thumbnail e Status */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              {ad.creative_thumbnail_url ? (
                <img 
                  src={ad.creative_thumbnail_url} 
                  alt={ad.ad_name}
                  className="w-48 h-48 object-cover rounded-lg border border-gray-200"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '';
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                  <ImageIcon className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
            
            <div className="flex-1 space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Status</span>
                <div className="mt-1">
                  <Badge className={`text-sm ${getStatusColor(ad.ad_effective_status)}`}>
                    {ad.ad_effective_status}
                  </Badge>
                </div>
              </div>
              
              {ad.creative_id && (
                <div>
                  <span className="text-sm font-medium text-gray-500">ID do Criativo</span>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{ad.creative_id}</p>
                </div>
              )}
              
              <div>
                <span className="text-sm font-medium text-gray-500">ID do Anúncio</span>
                <p className="mt-1 text-sm text-gray-900 font-mono">{ad.ad_id}</p>
              </div>
            </div>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <span className="text-xs font-medium text-gray-500">Investimento</span>
              <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(ad.spend)}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-gray-500">Impressões</span>
              <p className="mt-1 text-lg font-semibold text-gray-900">{formatNumber(ad.impressions)}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-gray-500">Alcance</span>
              <p className="mt-1 text-lg font-semibold text-gray-900">{formatNumber(ad.reach)}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-gray-500">Cliques no Link</span>
              <p className="mt-1 text-lg font-semibold text-gray-900">{formatNumber(ad.link_clicks)}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-gray-500">CTR Link</span>
              <p className="mt-1 text-lg font-semibold text-gray-900">{formatPercent(ad.ctr_link)}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-gray-500">CPC Link</span>
              <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(ad.cpc_link)}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-gray-500">Conversas WA</span>
              <p className="mt-1 text-lg font-semibold text-gray-900">{formatNumber(ad.conversations)}</p>
            </div>
            
            <div>
              <span className="text-xs font-medium text-gray-500">Custo/Conversa</span>
              <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(ad.cost_per_conversation)}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}