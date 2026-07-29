import { MatchesPage } from '../../src/features/portal/portal-pages';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { fecha } = await searchParams;
  return <MatchesPage initialDate={fecha} />;
}
