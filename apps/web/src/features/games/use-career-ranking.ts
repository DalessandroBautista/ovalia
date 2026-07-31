import { useCallback, useEffect, useState } from 'react';
import type { SeasonRecord } from '@ovalia/domain';
import type { ApiCareerEntry, ApiCareerSummary } from '../../lib/api/types';
import { ApiError, fetchCareerRanking, publishCareerEntry } from '../../lib/api/client';
import { getVisitorId, hashVisitorId } from '../../lib/visitor-id';

export interface CareerPublishInput {
  displayName: string;
  surname: string;
  position: string;
  clubSlug: string;
  seed: number;
  decisions: number[];
  summary: ApiCareerSummary;
  history: SeasonRecord[];
}

export interface CareerRankingApi {
  top: ApiCareerEntry[];
  myEntry: ApiCareerEntry | null;
  error: string | null;
  publish(input: CareerPublishInput): Promise<ApiCareerEntry | undefined>;
}

export function useCareerRanking(): CareerRankingApi {
  const [top, setTop] = useState<ApiCareerEntry[]>([]);
  const [myEntry, setMyEntry] = useState<ApiCareerEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCareerRanking(10)
      .then(({ entries }) => setTop(entries))
      .catch(() => setTop([]));
  }, []);

  const publish = useCallback(async (input: CareerPublishInput) => {
    setError(null);
    const originKey = await hashVisitorId(getVisitorId());
    try {
      const { entry } = await publishCareerEntry({ ...input, score: input.summary.score, originKey });
      setMyEntry(entry);
      const { entries } = await fetchCareerRanking(10);
      setTop(entries);
      return entry;
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Ya publicaste muchas veces hoy. Volvé mañana.'
          : 'No se pudo publicar. Probá de nuevo.',
      );
      return undefined;
    }
  }, []);

  return { top, myEntry, error, publish };
}
