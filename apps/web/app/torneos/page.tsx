import { TournamentsPage } from '../../src/features/portal/portal-pages';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pais?: string; union?: string }>;
}) {
  const { pais, union } = await searchParams;
  return <TournamentsPage initialCountry={pais} initialUnion={union} />;
}
