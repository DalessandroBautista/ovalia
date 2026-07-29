import type { Metadata } from 'next';
import { fetchCompetition } from '../../../src/lib/api/client';
import { TournamentPage } from '../../../src/features/portal/portal-pages';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { competition } = await fetchCompetition(slug, { timeoutMs: 4000 });
    return {
      title: `${competition.name} — posiciones y fixtures — Ovalia`,
      description: `Tabla de posiciones, resultados y calendario de ${competition.name} con datos verificados.`,
    };
  } catch {
    return { title: 'Torneo — Ovalia' };
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TournamentPage slug={slug} />;
}
