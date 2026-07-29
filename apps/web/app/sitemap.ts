import type { MetadataRoute } from 'next';

import { fetchCompetitions } from '../src/lib/api/client';
import { publicSiteUrl } from '../src/lib/site-url';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl();
  const staticPaths = ['', '/partidos', '/torneos', '/noticias'];
  let tournamentPaths: string[] = [];
  try {
    const { competitions } = await fetchCompetitions({ timeoutMs: 4_000 });
    tournamentPaths = competitions
      .filter((competition) => competition.coverage === 'auto')
      .map((competition) => `/torneos/${competition.slug}`);
  } catch {
    // El sitemap base sigue disponible aunque la API esté temporalmente caída.
  }
  const now = new Date();
  return [...staticPaths, ...tournamentPaths].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path.startsWith('/torneos/') ? 'daily' : 'hourly',
    priority: path === '' ? 1 : 0.8,
  }));
}
