import React from 'react';
import { Play, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(value || 0);
};

const formatNumber = (value) => {
  return new Intl.NumberFormat('pt-BR').format(value || 0);
};

export default function CreativeGallery({ data, title = "Criativos" }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-gray-500 text-center py-8">Nenhum criativo disponível</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {data.map((creative, index) => (
          <div 
            key={creative.ad_id || index}
            className="group relative bg-gray-50 rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all"
          >
            {/* Thumbnail */}
            <div className="aspect-square relative overflow-hidden bg-gray-100">
              {creative.thumbnail_url ? (
                <img 
                  src={creative.thumbnail_url} 
                  alt={creative.ad_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-gray-300" />
                </div>
              )}
              
              {creative.creative_type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-5 h-5 text-gray-800 ml-1" />
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              <p className="text-sm font-medium text-gray-900 truncate mb-2">
                {creative.ad_name}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">Invest.</p>
                  <p className="font-medium text-gray-900">{formatCurrency(creative.spend)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Cliques</p>
                  <p className="font-medium text-gray-900">{formatNumber(creative.clicks)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Impr.</p>
                  <p className="font-medium text-gray-900">{formatNumber(creative.impressions)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Result.</p>
                  <p className="font-medium text-gray-900">{formatNumber(creative.results)}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}