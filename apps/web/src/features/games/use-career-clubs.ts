import { useEffect, useState } from 'react';
import { FALLBACK_CATALOG, type CareerClub } from '@ovalia/domain';
import { fetchCareerClubs } from '../../lib/api/client';

export function useCareerClubs(): { clubs: CareerClub[]; loading: boolean } {
  const [clubs, setClubs] = useState<CareerClub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchCareerClubs()
      .then(({ clubs: reales }) => {
        if (!alive) return;
        // El juego nunca se rompe: si no hay datos reales, catálogo de reserva.
        setClubs(reales.length > 0 ? reales : FALLBACK_CATALOG.clubs);
      })
      .catch(() => {
        if (alive) setClubs(FALLBACK_CATALOG.clubs);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { clubs, loading };
}
