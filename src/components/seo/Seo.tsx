import { Helmet } from "react-helmet-async";

export const SITE_URL = "https://tayari-skill-boost.lovable.app";

interface SeoProps {
  title: string;
  description: string;
  /** Route path beginning with "/" — used for canonical + og:url */
  path: string;
  ogType?: "website" | "article";
  /** Optional JSON-LD structured data for this route */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

/**
 * Per-route head metadata. Keeps title/description/canonical/og:* unique
 * per page instead of inheriting the sitewide tags from index.html.
 */
export const Seo = ({ title, description, path, ogType = "website", jsonLd, noindex }: SeoProps) => {
  const url = `${SITE_URL}${path === "/" ? "/" : path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {noindex && <meta name="robots" content="noindex" />}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default Seo;
