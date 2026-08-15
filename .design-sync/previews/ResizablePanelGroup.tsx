import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

const applications = [
  { company: 'Stripe', title: 'Senior Frontend Engineer', status: 'Interview' },
  { company: 'Anthropic', title: 'Staff Product Designer', status: 'Applied' },
  { company: 'Figma', title: 'Design Engineer', status: 'Offer' },
  { company: 'Notion', title: 'Growth Product Manager', status: 'Applied' },
];

export function ApplicationListAndDetails() {
  return (
    <div style={{ height: 340, width: 560, border: '1px solid hsl(var(--border))', borderRadius: 12, overflow: 'hidden' }}>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={38} minSize={25}>
          <div style={{ height: '100%', padding: 12, background: 'hsl(var(--card))' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
              APPLICATIONS (4)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {applications.map((a) => (
                <div
                  key={a.company}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{a.company}</div>
                  <div style={{ color: 'hsl(var(--muted-foreground))' }}>{a.title}</div>
                </div>
              ))}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={62} minSize={30}>
          <div style={{ height: '100%', padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Senior Frontend Engineer</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>
              Stripe · San Francisco, CA · $165k – $210k
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              Currently in the technical interview stage. Next step: system design round scheduled
              for Thursday. ATS match score: 91%.
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export function VerticalSplit() {
  return (
    <div style={{ height: 320, width: 420, border: '1px solid hsl(var(--border))', borderRadius: 12, overflow: 'hidden' }}>
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel defaultSize={50}>
          <div style={{ height: '100%', padding: 14, background: 'hsl(var(--card))' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
              JOB DESCRIPTION
            </div>
            <div style={{ fontSize: 12, marginTop: 6, color: 'hsl(var(--foreground))' }}>
              Own the payments dashboard rebuild in React + TypeScript, partnering with design and
              platform teams.
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50}>
          <div style={{ height: '100%', padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
              YOUR MATCH NOTES
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Missing: "GraphQL" keyword. Strong overlap on React, TypeScript, Design Systems.
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
