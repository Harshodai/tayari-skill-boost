import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function ApplicationStages() {
  return (
    <Tabs defaultValue="active" style={{ width: 420 }}>
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="interviews">Interviews</TabsTrigger>
        <TabsTrigger value="offers">Offers</TabsTrigger>
        <TabsTrigger value="archived">Archived</TabsTrigger>
      </TabsList>
      <TabsContent value="active">
        <p style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>
          6 applications in progress, including Stripe and Vercel.
        </p>
      </TabsContent>
      <TabsContent value="interviews">
        <p style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>
          Figma — Design Systems Engineer, second round scheduled Aug 20.
        </p>
      </TabsContent>
      <TabsContent value="offers">
        <p style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>
          Anthropic — Staff Product Designer, offer expires Aug 30.
        </p>
      </TabsContent>
      <TabsContent value="archived">
        <p style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>
          Notion — Full-stack Engineer, marked rejected on Jul 15.
        </p>
      </TabsContent>
    </Tabs>
  );
}

export function ResumeBuilderPanels() {
  return (
    <Tabs defaultValue="summary" style={{ width: 460 }}>
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="experience">Experience</TabsTrigger>
        <TabsTrigger value="ats">ATS score</TabsTrigger>
      </TabsList>
      <TabsContent value="summary">
        <p style={{ fontSize: 14 }}>Senior engineer with 8 years building design systems.</p>
      </TabsContent>
      <TabsContent value="experience">
        <p style={{ fontSize: 14 }}>Stripe · Senior Frontend Engineer · 2023–present</p>
      </TabsContent>
      <TabsContent value="ats">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'hsl(var(--primary))' }}>91%</span>
          <Badge variant="success">Strong match</Badge>
        </div>
      </TabsContent>
    </Tabs>
  );
}
