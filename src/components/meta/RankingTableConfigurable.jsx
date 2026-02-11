import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings2, ArrowUpDown, Image as ImageIcon } from 'lucide-react';

const ALL_COLUMNS = [
  { key: 'thumbnail', label: 'Imagem', sortable: false, alwaysVisible: true },
  { key: 'name', label: 'Nome', sortable: true, alwaysVisible: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'spend', label: 'Investimento', sortable: true, format: 'currency' },
  { key: 'impressions', label: 'Impressões', sortable: true, format: 'number' },
  { key: 'reach', label: 'Alcance', sortable: true, format: 'number' },
  { key: 'frequency', label: 'Frequência', sortable: true, format: 'decimal' },
  { key: 'clicks', label: 'Cliques', sortable: true, format: 'number' },
  { key: 'link_clicks', label: 'Cliques Link', sortable: true, format: 'number' },
  { key: 'ctr_link', label: 'CTR Link', sortable: true, format: 'percent' },
  { key: 'cpc_link', label: 'CPC Link', sortable: true, format: 'currency' },
  { key: 'cpm', label: 'CPM', sortable: true, format: 'currency' },
  { key: 'conversations', label: 'Conversas', sortable: true, format: 'number' },
  { key: 'total_contacts', label: 'Contatos', sortable: true, format: 'number' },
  { key: 'first_reply', label: '1ª Resposta', sortable: true, format: 'number' },
  { key: 'cost_per_conversation', label: 'Custo/Conversa', sortable: true, format: 'currency' },
  { key: 'cost_per_contact', label: 'Custo/Contato', sortable: true, format: 'currency' },
  { key: 'cost_per_first_reply', label: 'Custo/1ª Resp', sortable: true, format: 'currency' },
];

export default function RankingTableConfigurable({ 
  data = [], 
  title = 'Ranking',
  type = 'ads',
  defaultColumns = ['thumbnail', 'name', 'status', 'spend', 'impressions', 'conversations', 'cost_per_conversation']
}) {
  const [sortBy, setSortBy] = useState({ key: 'spend', direction: 'desc' });
  const [visibleColumns, setVisibleColumns] = useState(defaultColumns);

  const sortedData = useMemo(() => {
    if (!sortBy.key) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[sortBy.key] || 0;
      const bVal = b[sortBy.key] || 0;
      return sortBy.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortBy]);

  const handleSort = (key) => {
    if (sortBy.key === key) {
      setSortBy({ key, direction: sortBy.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortBy({ key, direction: 'desc' });
    }
  };

  const formatValue = (value, format) => {
    if (value === undefined || value === null) return '—';
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
      case 'number':
        return new Intl.NumberFormat('pt-BR').format(Math.round(value));
      case 'percent':
        return `${value.toFixed(2)}%`;
      case 'decimal':
        return value.toFixed(2);
      default:
        return value;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'ACTIVE': { color: 'bg-green-100 text-green-800', label: 'Ativo' },
      'PAUSED': { color: 'bg-gray-100 text-gray-800', label: 'Pausado' },
      'DISAPPROVED': { color: 'bg-red-100 text-red-800', label: 'Reprovado' },
      'ERROR': { color: 'bg-red-100 text-red-800', label: 'Erro' },
    };
    const config = variants[status] || { color: 'bg-gray-100 text-gray-800', label: status || '—' };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const availableColumns = ALL_COLUMNS.filter(col => {
    if (type === 'campaigns' && col.key === 'thumbnail') return false;
    if (type === 'adsets' && col.key === 'thumbnail') return false;
    return true;
  });

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="w-4 h-4 mr-2" />
                Configurar Colunas
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Configurar Colunas</SheetTitle>
                <SheetDescription>Selecione quais colunas exibir</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3">
                {availableColumns.map(col => (
                  <div key={col.key} className="flex items-center gap-2">
                    <Checkbox
                      id={col.key}
                      checked={visibleColumns.includes(col.key)}
                      disabled={col.alwaysVisible}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setVisibleColumns([...visibleColumns, col.key]);
                        } else {
                          setVisibleColumns(visibleColumns.filter(c => c !== col.key));
                        }
                      }}
                    />
                    <Label htmlFor={col.key} className="cursor-pointer">{col.label}</Label>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                {availableColumns
                  .filter(col => visibleColumns.includes(col.key))
                  .map(col => (
                    <th
                      key={col.key}
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        {col.label}
                        {col.sortable && (
                          <button
                            onClick={() => handleSort(col.key)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  {availableColumns
                    .filter(col => visibleColumns.includes(col.key))
                    .map(col => (
                      <td key={col.key} className="py-3 px-4 text-sm">
                        {col.key === 'thumbnail' ? (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                            {item.creative_thumbnail_url ? (
                              <img
                                src={item.creative_thumbnail_url}
                                alt="Thumbnail"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div style={{ display: item.creative_thumbnail_url ? 'none' : 'flex' }} className="w-full h-full items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-gray-400" />
                            </div>
                          </div>
                        ) : col.key === 'status' ? (
                          getStatusBadge(item.ad_effective_status || item.status)
                        ) : col.key === 'name' ? (
                          <div className="max-w-xs truncate font-medium">{item[col.key] || '—'}</div>
                        ) : (
                          formatValue(item[col.key], col.format)
                        )}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}