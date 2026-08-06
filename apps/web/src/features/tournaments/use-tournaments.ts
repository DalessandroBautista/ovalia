'use client';

import { useEffect, useState } from 'react';

import {
  fetchCompetition,
  fetchCompetitionMatches,
  fetchCompetitions,
  fetchOrganizations,
  fetchStandings,
} from '../../lib/api/client';
import { mapApiMatch, type AgendaMatch } from '../matches/agenda-data';
import type {
  ApiCompetition,
  ApiCompetitionDetail,
  ApiOrganization,
  ApiStandingsResponse,
} from '../../lib/api/types';

type Status = 'loading' | 'ready' | 'error';

export function useCompetitions(): { status: Status; competitions: ApiCompetition[] } {
  const [state, setState] = useState<{ status: Status; competitions: ApiCompetition[] }>({
    status: 'loading',
    competitions: [],
  });
  useEffect(() => {
    const controller = new AbortController();
    fetchCompetitions({ signal: controller.signal })
      .then((res) => setState({ status: 'ready', competitions: res.competitions }))
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState({ status: 'error', competitions: [] });
        }
      });
    return () => controller.abort();
  }, []);
  return state;
}

export function useOrganizations(): { status: Status; organizations: ApiOrganization[] } {
  const [state, setState] = useState<{ status: Status; organizations: ApiOrganization[] }>({
    status: 'loading',
    organizations: [],
  });
  useEffect(() => {
    const controller = new AbortController();
    fetchOrganizations({ signal: controller.signal })
      .then((response) => setState({ status: 'ready', organizations: response.organizations }))
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState({ status: 'error', organizations: [] });
        }
      });
    return () => controller.abort();
  }, []);
  return state;
}

export interface TournamentState {
  status: Status;
  competition: ApiCompetitionDetail['competition'] | null;
  standings: ApiStandingsResponse | null;
  matches: AgendaMatch[];
}

/** Carga detalle + posiciones + partidos de una competencia/temporada. */
export function useTournament(slug: string, season?: number): TournamentState {
  const [state, setState] = useState<TournamentState>({
    status: 'loading',
    competition: null,
    standings: null,
    matches: [],
  });

  useEffect(() => {
    if (!slug) {
      setState({ status: 'ready', competition: null, standings: null, matches: [] });
      return;
    }
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    setState((prev) => ({ ...prev, status: 'loading' }));
    Promise.all([
      fetchCompetition(slug, opts),
      fetchStandings(slug, season, opts).catch(() => null),
      fetchCompetitionMatches(slug, { season, limit: 200 }, opts).catch(() => null),
    ])
      .then(([detail, standings, matchesRes]) => {
        setState({
          status: 'ready',
          competition: detail.competition,
          standings,
          matches: matchesRes ? matchesRes.matches.map(mapApiMatch) : [],
        });
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState({ status: 'error', competition: null, standings: null, matches: [] });
        }
      });
    return () => controller.abort();
  }, [slug, season]);

  return state;
}
