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

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ temporada?: string }>;
}) {
  const { slug } = await params;
  const { temporada } = await searchParams;
  return <TournamentPage slug={slug} initialSeason={temporada} />;
}
