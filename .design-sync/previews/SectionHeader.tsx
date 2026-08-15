import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/page-header';

export function Default() {
  return (
    <div style={{ width: 640 }}>
      <SectionHeader title="Recent Applications" />
    </div>
  );
}

export function WithDescriptionAndAction() {
  return (
    <div style={{ width: 640 }}>
      <SectionHeader
        title="Recommended Jobs"
        description="Matched to your resume and search preferences"
        action={<Button size="sm" variant="outline">View all</Button>}
      />
    </div>
  );
}

export function ActionOnly() {
  return (
    <div style={{ width: 640 }}>
      <SectionHeader title="Saved Jobs" action={<Button size="sm">Browse more</Button>} />
    </div>
  );
}
