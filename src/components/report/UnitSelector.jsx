import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export default function UnitSelector({ units, value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px]">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-500" />
          <SelectValue placeholder="Selecionar unidade" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {units.map((unit) => (
          <SelectItem key={unit.id} value={unit.id}>
            <div className="flex items-center gap-2">
              {unit.logo_url ? (
                <img src={unit.logo_url} alt="" className="w-5 h-5 rounded" />
              ) : (
                <div 
                  className="w-5 h-5 rounded flex items-center justify-center text-xs font-medium text-white"
                  style={{ backgroundColor: unit.color || '#3B82F6' }}
                >
                  {unit.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              {unit.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}