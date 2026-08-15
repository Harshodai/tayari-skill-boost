import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const applicationsData = [
  { week: 'Wk 1', applications: 12, interviews: 2 },
  { week: 'Wk 2', applications: 19, interviews: 3 },
  { week: 'Wk 3', applications: 24, interviews: 5 },
  { week: 'Wk 4', applications: 31, interviews: 6 },
  { week: 'Wk 5', applications: 22, interviews: 8 },
  { week: 'Wk 6', applications: 28, interviews: 9 },
];

const applicationsConfig = {
  applications: {
    label: 'Applications sent',
    color: 'hsl(var(--primary))',
  },
  interviews: {
    label: 'Interviews landed',
    color: 'hsl(var(--chart-2, 142 71% 45%))',
  },
} satisfies ChartConfig;

export function ApplicationsOverTime() {
  return (
    <div style={{ width: 480 }}>
      <ChartContainer config={applicationsConfig} style={{ height: 280 }}>
        <BarChart data={applicationsData}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={28} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="applications" fill="var(--color-applications)" radius={4} />
          <Bar dataKey="interviews" fill="var(--color-interviews)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

const atsScoreData = [
  { date: 'Jul 1', score: 58 },
  { date: 'Jul 8', score: 64 },
  { date: 'Jul 15', score: 71 },
  { date: 'Jul 22', score: 79 },
  { date: 'Jul 29', score: 84 },
  { date: 'Aug 5', score: 91 },
];

const atsScoreConfig = {
  score: {
    label: 'ATS match score',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export function AtsScoreTrend() {
  return (
    <div style={{ width: 480 }}>
      <ChartContainer config={atsScoreConfig} style={{ height: 260 }}>
        <LineChart data={atsScoreData}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={8} width={28} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--color-score)"
            strokeWidth={2}
            dot={{ fill: 'var(--color-score)', r: 3 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
