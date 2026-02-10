import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings } from 'lucide-react';

export default function MetaKPISelector({ selected, onChange, allKPIs }) {
  const [open, setOpen] = useState(false);

  const categories = [...new Set(allKPIs.map(k => k.category))];

  const handleToggle = (kpiId) => {
    if (selected.includes(kpiId)) {
      onChange(selected.filter(id => id !== kpiId));
    } else {
      onChange([...selected, kpiId]);
    }
  };

  const handleSelectAll = () => {
    onChange(allKPIs.map(k => k.id));
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Escolher KPIs ({selected.length})
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Escolher KPIs visíveis</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSelectAll}>Selecionar Todos</Button>
            <Button size="sm" variant="outline" onClick={handleClear}>Limpar Seleção</Button>
          </div>
          
          {categories.map(category => (
            <div key={category} className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-700">{category}</h3>
              <div className="space-y-2 pl-4">
                {allKPIs.filter(k => k.category === category).map(kpi => (
                  <div key={kpi.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={kpi.id}
                      checked={selected.includes(kpi.id)}
                      onCheckedChange={() => handleToggle(kpi.id)}
                    />
                    <label
                      htmlFor={kpi.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {kpi.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}