import React from 'react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

export default function FunnelSparkline({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none opacity-5">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#3B82F6" 
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}