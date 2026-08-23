import { Send, FileText, CalendarCheck, TrendingUp, Eye, Target } from 'lucide-react';
import { StatsCard, StatsGrid } from '@/components/ui/stats-card';

export function FourColumns() {
  return (
    <div style={{ width: '100%', maxWidth: 900 }}>
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
        />
        <StatsCard
          label="Response Rate"
          value="18%"
          icon={<TrendingUp />}
          trend={{ value: 2, direction: 'down', label: 'vs last month' }}
        />
      </StatsGrid>
    </div>
  );
}

export function ThreeColumns() {
  return (
    <div style={{ width: 760 }}>
      <StatsGrid columns={3}>
        <StatsCard label="Profile Views" value={412} icon={<Eye />} colorScheme="primary" />
        <StatsCard label="Jobs Matched" value={156} icon={<Target />} colorScheme="success" />
        <StatsCard label="Saved Jobs" value={19} icon={<FileText />} colorScheme="default" />
      </StatsGrid>
    </div>
  );
}

export function TwoColumns() {
  return (
    <div style={{ width: 520 }}>
      <StatsGrid columns={2}>
        <StatsCard
          label="Applications Sent"
          value={24}
          icon={<Send />}
          colorScheme="primary"
          trend={{ value: 12, direction: 'up', label: 'vs last week' }}
        />
        <StatsCard
          label="Interviews Scheduled"
          value={3}
          icon={<CalendarCheck />}
          colorScheme="warning"
        />
      </StatsGrid>
    </div>
  );
}

export function LoadingState() {
  return (
    <div style={{ width: '100%', maxWidth: 900 }}>
      <StatsGrid columns={4}>
        <StatsCard label="Applications Sent" value={24} isLoading />
        <StatsCard label="ATS Avg. Score" value="87%" isLoading />
        <StatsCard label="Interviews Scheduled" value={3} isLoading />
        <StatsCard label="Response Rate" value="18%" isLoading />
      </StatsGrid>
    </div>
  );
}
