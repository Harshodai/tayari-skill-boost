import { SpotlightGrid } from '@/components/ui/spotlight-card';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { FileText, Briefcase, Mic, Search } from 'lucide-react';

const products = [
  { icon: FileText, title: 'Resume Optimizer', desc: 'ATS-safe rewrites in seconds' },
  { icon: Mic, title: 'Interview Coach', desc: 'Real-time practice feedback' },
  { icon: Briefcase, title: 'Job AutoPilot', desc: 'Daily ranked matches' },
  { icon: Search, title: 'Cover Letter Studio', desc: 'Tailored to each posting' },
];

export function ProductGrid() {
  return (
    <div style={{ width: 560 }}>
      <SpotlightGrid className="grid grid-cols-2 gap-4">
        {products.map((p) => (
          <SpotlightCard key={p.title} className="bg-card/40 border-input" style={{ padding: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'hsl(var(--primary) / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))', marginBottom: 12 }}>
              <p.icon size={18} />
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{p.title}</h4>
            <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>{p.desc}</p>
          </SpotlightCard>
        ))}
      </SpotlightGrid>
    </div>
  );
}

export function TwoUpComparison() {
  return (
    <div style={{ width: 520 }}>
      <SpotlightGrid className="flex gap-4">
        <SpotlightCard className="bg-card/40 border-input" style={{ padding: 20, flex: 1 }}>
          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Before optimization</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4, color: 'hsl(38 92% 50%)' }}>58%</div>
        </SpotlightCard>
        <SpotlightCard className="bg-card/40 border-input" style={{ padding: 20, flex: 1 }}>
          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>After optimization</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4, color: 'hsl(142 71% 40%)' }}>91%</div>
        </SpotlightCard>
      </SpotlightGrid>
    </div>
  );
}
