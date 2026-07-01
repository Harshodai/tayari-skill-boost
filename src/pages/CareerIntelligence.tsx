import React, { useEffect, useState } from 'react';
import { trendingSkills } from '@/api';
import { Chart } from '@/components/charts/Chart';
import { Card, CardContent } from '@/components/ui/card';
import { AppShell } from "@/components/layout";

export interface TrendingSkill {
  skill: string;
  popularity: number;
}

function SkillCards({ trending, error }: { trending: TrendingSkill[]; error: string | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {trending.map((s) => (
        <Card key={s.skill}>
          <CardContent className="p-4">
            <h2 className="text-xl font-semibold">{s.skill}</h2>
            <p>Popularity: {s.popularity}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TrendChart({ trending }: { trending: TrendingSkill[] }) {
  return (
    <Chart data={trending.map(s => ({ name: s.skill, value: s.popularity }))} title="Trending Skills" />
  );
}

export function CareerIntelligence() {
  const [trending, setTrending] = useState<TrendingSkill[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trendingSkills()
      .then(setTrending)
      .catch((e) => {
        console.error('Failed to load trending skills', e);
        setError('Could not load data');
      });
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trending Skills</h1>
          <p className="text-muted-foreground mt-1">Real-time demand metrics for top engineering skills.</p>
        </div>
        
        {error && <p className="text-red-500">{error}</p>}
        
        <SkillCards trending={trending} error={error} />
        
        <div className="mt-8">
          <TrendChart trending={trending} />
        </div>
      </div>
    </AppShell>
  );
}
