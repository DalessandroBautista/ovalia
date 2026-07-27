import { TournamentPage } from '../../../src/features/portal/portal-pages';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TournamentPage slug={slug} />;
}
