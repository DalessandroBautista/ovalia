'use client';

import { useEffect, useState } from 'react';
import { TeamBadge } from './team-badge';

export interface LiveFeedMatch {
  id: string;
  competition: string;
  startsAt: string;
  phase: string;
  minute?: number;
  home: { name: string; shortCode: string; providerId?: number; badgeUrl?: string };
  away: { name: string; shortCode: string; providerId?: number; badgeUrl?: string };
  homeScore: number;
  awayScore: number;
}

export interface LiveFeedPayload {
  status: 'loading' | 'live' | 'empty' | 'unavailable' | 'error';
  source: 'highlightly' | 'database' | 'none';
  freshness: 'fresh' | 'stale' | 'unknown';
  generatedAt: string;
  matches: LiveFeedMatch[];
}

const initialFeed: LiveFeedPayload = {
  status: 'loading',
  source: 'none',
  freshness: 'unknown',
  generatedAt: '',
  matches: [],
};

export function useLiveFeed(): LiveFeedPayload {
  const [feed, setFeed] = useState<LiveFeedPayload>(initialFeed);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
        const response = await fetch(`${baseUrl}/v1/live`, { cache: 'no-store' });
        if (!response.ok) throw new Error('live feed unavailable');
        const payload = (await response.json()) as LiveFeedPayload;
        if (active) setFeed(payload);
      } catch {
        if (active) setFeed({ ...initialFeed, status: 'error', generatedAt: new Date().toISOString() });
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  return feed;
}

function feedMessage(feed: LiveFeedPayload): string {
  if (feed.status === 'loading') return 'Consultando partidos en vivo';
  if (feed.status === 'error') return 'Datos en vivo temporalmente no disponibles';
  return 'No hay partidos en vivo ahora';
}

export function LiveRailView({ feed }: { feed: LiveFeedPayload }) {
  return (
    <section className="live-rail" aria-label="Partidos en vivo" aria-live="polite">
      <div className="live-rail__inner">
        <div className="live-rail__label"><i /> EN VIVO</div>
        <div className="live-rail__track">
          {feed.matches.length ? feed.matches.map((match) => (
            <a className="rail-match" href={`/partidos/${match.id}`} key={match.id}>
              <span className="rail-match__competition">{match.competition}</span>
              <b>{match.minute ? `${match.minute}'` : match.phase}</b>
              <span><TeamBadge {...match.home} />{match.home.shortCode}</span><strong>{match.homeScore}</strong>
              <span><TeamBadge {...match.away} />{match.away.shortCode}</span><strong>{match.awayScore}</strong>
            </a>
          )) : <p className="live-rail__empty"><span className="status-spinner" />{feedMessage(feed)}</p>}
        </div>
        {feed.source !== 'none' ? <small className="live-source">Fuente: {feed.source === 'highlightly' ? 'Highlightly' : 'Ovalia verificado'}</small> : null}
      </div>
    </section>
  );
}
