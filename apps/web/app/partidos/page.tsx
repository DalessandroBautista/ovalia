import { MatchesPage } from '../../src/features/portal/portal-pages';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; torneo?: string; partido?: string }>;
}) {
  const { fecha, torneo, partido } = await searchParams;
  return <MatchesPage initialDate={fecha} initialFamily={torneo} initialMatchId={partido} />;
}
