import { FileText, Send, CalendarCheck, TrendingUp } from 'lucide-react';
import { StatsCard, StatsGrid } from '@/components/ui/stats-card';

export function Default() {
  return (
    <div style={{ width: 260 }}>
      <StatsCard
        label="Applications Sent"
        value={24}
        icon={<Send />}
        colorScheme="primary"
        trend={{ value: 12, direction: 'up', label: 'vs last week' }}
      />
    </div>
  );
}

export function ColorSchemes() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <div style={{ width: 240 }}>
        <StatsCard label="Applications Sent" value={24} icon={<Send />} colorScheme="primary" />
      </div>
      <div style={{ width: 240 }}>
        <StatsCard
          label="Response Rate"
          value="18%"
          icon={<TrendingUp />}
          colorScheme="success"
          trend={{ value: 4, direction: 'up', label: 'vs last month' }}
        />
      </div>
      <div style={{ width: 240 }}>
        <StatsCard
          label="Interviews Scheduled"
          value={3}
          icon={<CalendarCheck />}
          colorScheme="warning"
          trend={{ value: 1, direction: 'down', label: 'vs last week' }}
        />
      </div>
      <div style={{ width: 240 }}>
        <StatsCard
          label="Rejections"
          value={7}
          icon={<FileText />}
          colorScheme="destructive"
          trend={{ value: 0, direction: 'neutral', label: 'no change' }}
        />
      </div>
    </div>
  );
}

export function WithSparkline() {
  return (
    <div style={{ width: 260 }}>
      <StatsCard
        label="Resume Views"
        value={412}
        icon={<TrendingUp />}
        colorScheme="success"
        trend={{ value: 22, direction: 'up', label: 'vs last week' }}
        sparklineData={[8, 14, 11, 19, 22, 30, 26, 34, 41]}
      />
    </div>
  );
}

export function Loading() {
  return (
    <div style={{ width: 260 }}>
      <StatsCard label="Applications Sent" value={24} isLoading />
    </div>
  );
}

export function Grid() {
  return (
    <div style={{ width: 900 }}>
      <StatsGrid columns={4}>
        <StatsCard
          label="Applications Sent"
          value={24}
          icon={<Send />}
          colorScheme="primary"
          trend={{ value: 12, direction: 'up', label: 'vs last week' }}
        />
        <StatsCard
          label="ATS Avg. Score"
          value="87%"
          icon={<FileText />}
          colorScheme="success"
          trend={{ value: 5, direction: 'up', label: 'vs last batch' }}
        />
        <StatsCard
          label="Interviews Scheduled"
          value={3}
          icon={<CalendarCheck />}
          colorScheme="warning"
          description="Stripe, Figma, Notion"
        />
        <StatsCard
          label="Response Rate"
          value="18%"
          icon={<TrendingUp />}
          colorScheme="default"
          trend={{ value: 2, direction: 'down', label: 'vs last month' }}
        />
      </StatsGrid>
    </div>
  );
}
