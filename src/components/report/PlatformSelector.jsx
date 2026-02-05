import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronDown, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLATFORM_INFO = {
  META: { name: 'Meta Ads', color: '#1877F2', icon: '📘' },
  GOOGLE_ADS: { name: 'Google Ads', color: '#34A853', icon: '🔍' },
  TIKTOK_ADS: { name: 'TikTok Ads', color: '#000000', icon: '🎵' },
  YOUTUBE: { name: 'YouTube', color: '#FF0000', icon: '▶️' },
};

export default function PlatformSelector({ platforms, selected, onChange }) {
  const handleToggle = (platformId) => {
    if (selected.includes(platformId)) {
      onChange(selected.filter(id => id !== platformId));
    } else {
      onChange([...selected, platformId]);
    }
  };

  const selectedCount = selected.length;
  const totalCount = platforms.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-[180px] justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-500" />
            <span>
              {selectedCount === 0 
                ? 'Selecionar' 
                : selectedCount === totalCount 
                  ? 'Todas plataformas' 
                  : `${selectedCount} plataforma${selectedCount > 1 ? 's' : ''}`}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {platforms.map((platform) => {
            const info = PLATFORM_INFO[platform.platform_id] || { name: platform.name, icon: '📊' };
            const isSelected = selected.includes(platform.platform_id);
            
            return (
              <button
                key={platform.platform_id}
                onClick={() => handleToggle(platform.platform_id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                )}
              >
                <Checkbox 
                  checked={isSelected}
                  className="pointer-events-none"
                />
                <span className="text-lg">{info.icon}</span>
                <span className={cn(
                  "text-sm",
                  isSelected ? "font-medium text-gray-900" : "text-gray-600"
                )}>
                  {info.name}
                </span>
              </button>
            );
          })}
        </div>
        
        <div className="flex gap-2 pt-3 mt-3 border-t border-gray-100">
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1"
            onClick={() => onChange(platforms.map(p => p.platform_id))}
          >
            Todas
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1"
            onClick={() => onChange([])}
          >
            Nenhuma
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}