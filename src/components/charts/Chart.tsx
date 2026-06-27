import React from 'react';
import { Bar } from 'recharts'; // placeholder, assumes recharts is installed

interface DataPoint {
  name: string;
  value: number;
}

interface ChartProps {
  data: DataPoint[];
  title?: string;
}

export const Chart: React.FC<ChartProps> = ({ data, title }) => {
  return (
    <div className="p-4 bg-white rounded shadow">
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      {/* Simple bar chart – replace with actual chart library as needed */}
      <Bar dataKey="value" data={data as any} />
    </div>
  );
};
