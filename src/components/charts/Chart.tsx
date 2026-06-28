import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

export interface DataPoint {
  name: string;
  value: number;
}

export interface ChartProps {
  data: DataPoint[];
  title?: string;
}

export const Chart: React.FC<ChartProps> = ({ data, title }) => {
  return (
    <section role="img" aria-label={title ?? "Chart"} className="p-4" style={{ backgroundColor: 'var(--secondary)' }}>
      {title && <h3 className="text-lg font-semibold mb-2" data-testid="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="var(--accent)" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
};
