import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

export default function CampaignTable({ data, title = "Campanhas", level = "campaign" }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-gray-500 text-center py-8">Nenhum dado disponível</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold text-gray-700">Nome</TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">Investimento</TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">Impressões</TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">Cliques</TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">CTR</TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">CPC</TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">Resultados</TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">CPR</TableHead>
              <TableHead className="font-semibold text-gray-700">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => {
              const ctr = item.impressions > 0 ? ((item.clicks / item.impressions) * 100) : 0;
              const cpc = item.clicks > 0 ? (item.spend / item.clicks) : 0;
              
              return (
                <TableRow key={item.entity_id || index} className="hover:bg-gray-50">
                  <TableCell className="font-medium text-gray-900 max-w-xs truncate">
                    {item.entity_name}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.spend)}
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {formatNumber(item.impressions)}
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {formatNumber(item.clicks)}
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {ctr.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {formatCurrency(cpc)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-gray-900">
                    {formatNumber(item.results)}
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {formatCurrency(item.cpr)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-xs",
                        item.status === 'active' && "bg-green-50 text-green-700 border-green-200",
                        item.status === 'paused' && "bg-yellow-50 text-yellow-700 border-yellow-200",
                        item.status === 'deleted' && "bg-gray-50 text-gray-500 border-gray-200"
                      )}
                    >
                      {item.status === 'active' ? 'Ativo' : item.status === 'paused' ? 'Pausado' : 'Inativo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}