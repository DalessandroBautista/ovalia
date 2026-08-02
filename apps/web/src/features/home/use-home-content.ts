'use client';

import { useEffect, useState } from 'react';

import { fetchArticles, fetchMatches } from '../../lib/api/client';
import type { ApiArticleSummary, ApiMatch } from '../../lib/api/types';
import { argentinaDateKey, argentinaDayRange, shiftDateKey } from '../matches/agenda-data';

export function recentResultsRange(now: Date = new Date()): { from: string; to: string } {
  const today = argentinaDateKey(now);
  return {
    from: argentinaDayRange(shiftDateKey(today, -14)).from,
    to: argentinaDayRange(today).to,
  };
}

export function selectRecentResults(matches: ApiMatch[], limit = 6): ApiMatch[] {
  return matches
    .filter((match) => match.status === 'final')
    .sort((left, right) => right.startsAt.localeCompare(left.startsAt))
    .slice(0, limit);
}

interface HomeContentState {
  articles: ApiArticleSummary[];
  recentResults: ApiMatch[];
}

const initialState: HomeContentState = { articles: [], recentResults: [] };

export function useHomeContent(): HomeContentState {
  const [state, setState] = useState<HomeContentState>(initialState);

  useEffect(() => {
    const controller = new AbortController();
    const range = recentResultsRange();
    void Promise.allSettled([
      fetchArticles({ signal: controller.signal }),
      fetchMatches({ ...range, status: 'final', limit: 100 }, { signal: controller.signal }),
    ]).then(([articlesResult, matchesResult]) => {
      if (controller.signal.aborted) return;
      setState({
        articles: articlesResult.status === 'fulfilled' ? articlesResult.value.articles : [],
        recentResults: matchesResult.status === 'fulfilled' ? selectRecentResults(matchesResult.value.matches) : [],
      });
    });
    return () => controller.abort();
  }, []);

  return state;
}
