import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatValue = (value, type) => {
  if (value === null || value === undefined) return '-';
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'number':
      return new Intl.NumberFormat('pt-BR').format(Math.round(value));
    default:
      return value;
  }
};

export default function TimeSeriesChart({ 
  data, 
  title, 
  dataKey, 
  type = 'line', 
  valueType = 'number',
  compareData = null,
  color = '#3B82F6'
}) {
  const ChartComponent = type === 'bar' ? BarChart : LineChart;
  const DataComponent = type === 'bar' ? Bar : Line;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(d) => format(new Date(d), 'dd/MM', { locale: ptBR })}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              stroke="#D1D5DB"
            />
            <YAxis 
              tickFormatter={(v) => formatValue(v, valueType)}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              stroke="#D1D5DB"
            />
            <Tooltip 
              formatter={(value) => [formatValue(value, valueType), title]}
              labelFormatter={(date) => format(new Date(date), "dd 'de' MMMM", { locale: ptBR })}
              contentStyle={{ 
                backgroundColor: '#FFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            {compareData && <Legend />}
            
            <DataComponent 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color}
              fill={color}
              strokeWidth={2}
              name="Período atual"
            />
            
            {compareData && (
              <DataComponent 
                type="monotone" 
                data={compareData}
                dataKey={dataKey} 
                stroke="#94A3B8"
                fill="#94A3B8"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Período comparativo"
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}