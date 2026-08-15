import { CompanyLogo } from '@/components/ui/job-card';

// Inline data-URI "logos" so the image-provided path renders deterministically
// without depending on external network access inside the preview sandbox.
const stripeLogo =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%23635BFF"/><text x="16" y="21" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700" fill="white" text-anchor="middle">S</text></svg>'.replace(
      /%23/g,
      '#'
    )
  );
const figmaLogo =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1E1E1E"/><text x="16" y="21" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700" fill="white" text-anchor="middle">F</text></svg>'
  );

export function WithLogoImage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <CompanyLogo company="Stripe" logoUrl={stripeLogo} size="lg" />
      <CompanyLogo company="Figma" logoUrl={figmaLogo} size="md" />
    </div>
  );
}

export function FallbackInitial() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <CompanyLogo company="Anthropic" size="lg" />
      <CompanyLogo company="Notion" size="md" />
      <CompanyLogo company="Vercel" size="sm" />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <CompanyLogo company="Stripe" size="sm" />
      <CompanyLogo company="Stripe" size="md" />
      <CompanyLogo company="Stripe" size="lg" />
    </div>
  );
}
