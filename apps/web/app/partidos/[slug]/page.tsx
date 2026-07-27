import type { Metadata } from 'next';
import { fetchMatchById } from '../../../src/lib/api/client';
import { MatchDetailPage } from '../../../src/features/portal/portal-pages';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { match } = await fetchMatchById(slug, { timeoutMs: 4000 });
    const scored = match.status === 'final' && match.homeScore != null;
    const title = scored
      ? `${match.home.name} ${match.homeScore}-${match.awayScore} ${match.away.name} — ${match.competition.name}`
      : `${match.home.name} vs ${match.away.name} — ${match.competition.name}`;
    return {
      title: `${title} — Ovalia`,
      description: `${match.competition.name} · ${match.round}. Datos verificados en Ovalia.`,
    };
  } catch {
    return { title: 'Partido — Ovalia' };
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MatchDetailPage matchId={slug} />;
}
