import React, { useEffect, useState } from 'react';
import { trendingSkills } from '@/api';
import { Chart } from '@/components/charts/Chart';
import { Card, CardContent } from '@/components/ui/card';

export interface TrendingSkill {
  skill: string;
  popularity: number;
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
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Trending Skills</h1>
      {error && <p className="text-red-500">{error}</p>}
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
    </div>
    <div className="mt-8">
      <Chart data={trending.map(s => ({ name: s.skill, value: s.popularity }))} title="Trending Skills" />
    </div>
  );
}
