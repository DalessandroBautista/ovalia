import { fetchCareerEntry } from '../../../../src/lib/api/client';
import { CareerCard } from '../../../../src/features/games/career-card';

export default async function CareerCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { entry } = await fetchCareerEntry(id);
    return <CareerCard entry={entry} />;
  } catch {
    return <p>Esa carrera no existe o ya no está publicada.</p>;
  }
}
