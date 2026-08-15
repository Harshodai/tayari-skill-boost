import { Badge } from '@/components/ui/badge';
import { CardHover, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

export function JobListingCard() {
  return (
    <CardHover style={{ width: 340 }}>
      <CardHeader>
        <CardTitle>Senior Frontend Engineer</CardTitle>
        <CardDescription>Stripe · San Francisco, CA · Remote</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>
          $165k – $210k · React, TypeScript, GraphQL, Design Systems
        </p>
      </CardContent>
      <CardFooter style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Posted 2 days ago</span>
        <Badge variant="success">91% match</Badge>
      </CardFooter>
    </CardHover>
  );
}

export function SavedSearchCard() {
  return (
    <CardHover style={{ width: 300 }}>
      <CardHeader>
        <CardTitle>Staff Product Designer</CardTitle>
        <CardDescription>Anthropic · Remote · Full-time</CardDescription>
      </CardHeader>
      <CardFooter style={{ justifyContent: 'space-between' }}>
        <Badge variant="info">Interview</Badge>
        <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Click to view</span>
      </CardFooter>
    </CardHover>
  );
}

export function CompanyCard() {
  return (
    <CardHover style={{ width: 280 }}>
      <CardContent style={{ paddingTop: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Notion</div>
        <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
          4 open roles matching your profile
        </div>
      </CardContent>
    </CardHover>
  );
}
