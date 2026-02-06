import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLATFORM_DEFAULTS = {
  META: { name: 'Meta Ads', color: '#0668E1' },
  GOOGLE_ADS: { name: 'Google Ads', color: '#4285F4' },
  TIKTOK_ADS: { name: 'TikTok Ads', color: '#000000' },
  YOUTUBE: { name: 'YouTube', color: '#FF0000' }
};

export default function BrandLogo({ platform, editable = false, className = '' }) {
  const { data: logos = [] } = useQuery({
    queryKey: ['brandLogos'],
    queryFn: () => base44.entities.BrandLogo.list(),
  });

  const logo = logos.find(l => l.network === platform);
  const defaultInfo = PLATFORM_DEFAULTS[platform] || {};

  const handleUploadClick = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        if (logo) {
          await base44.entities.BrandLogo.update(logo.id, { logo_url: file_url });
        } else {
          await base44.entities.BrandLogo.create({ 
            network: platform, 
            logo_url: file_url 
          });
        }
      } catch (error) {
        console.error('Erro ao fazer upload:', error);
      }
    };
    input.click();
  };

  if (logo?.logo_url) {
    return (
      <div className={`relative group ${className}`}>
        <img 
          src={logo.logo_url} 
          alt={defaultInfo.name} 
          className="h-10 object-contain"
        />
        {editable && (
          <Button 
            size="sm" 
            variant="ghost" 
            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100"
            onClick={handleUploadClick}
          >
            <Upload className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
        style={{ backgroundColor: defaultInfo.color }}
      >
        {defaultInfo.name?.charAt(0)}
      </div>
      <span className="font-semibold text-gray-900">{defaultInfo.name}</span>
      {editable && (
        <Button size="sm" variant="outline" onClick={handleUploadClick}>
          <Upload className="w-3 h-3 mr-1" />
          Adicionar logo
        </Button>
      )}
    </div>
  );
}