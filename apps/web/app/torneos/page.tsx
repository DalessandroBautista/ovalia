import { TournamentsPage } from '../../src/features/portal/portal-pages';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ union?: string }>;
}) {
  const { union } = await searchParams;
  return <TournamentsPage initialUnion={union} />;
}
