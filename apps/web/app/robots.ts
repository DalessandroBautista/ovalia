import type { MetadataRoute } from 'next';

import { publicSiteUrl } from '../src/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const base = publicSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/ingresar'],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
