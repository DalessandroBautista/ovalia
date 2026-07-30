import { MatchesPage } from '../../src/features/portal/portal-pages';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; torneo?: string }>;
}) {
  const { fecha, torneo } = await searchParams;
  return <MatchesPage initialDate={fecha} initialFamily={torneo} />;
}
