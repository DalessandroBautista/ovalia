import type { ApiMatch, Freshness } from '../../lib/api/types';

export const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const ARGENTINA_OFFSET = '-03:00';

export interface AgendaMatch {
  id: string;
  competition: string;
  competitionSlug?: string;
  round: string;
  startsAt: string;
  status: 'scheduled' | 'live' | 'halftime' | 'final' | 'postponed' | 'cancelled';
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  source?: string | null;
  freshness?: Freshness;
}

/** Rango UTC (con offset AR) que cubre un día calendario argentino. */
export function argentinaDayRange(dateKey: string): { from: string; to: string } {
  return {
    from: `${dateKey}T00:00:00${ARGENTINA_OFFSET}`,
    to: `${dateKey}T23:59:59${ARGENTINA_OFFSET}`,
  };
}

/** Mapea el DTO de la API al modelo plano de agenda. */
export function mapApiMatch(api: ApiMatch): AgendaMatch {
  return {
    id: api.id,
    competition: api.competition.name,
    competitionSlug: api.competition.slug,
    round: api.round,
    startsAt: api.startsAt,
    status: api.status,
    homeTeam: api.home.name,
    awayTeam: api.away.name,
    homeScore: api.homeScore,
    awayScore: api.awayScore,
    source: api.source,
    freshness: api.freshness,
  };
}

export interface AgendaGroup {
  competition: string;
  round: string;
  matches: AgendaMatch[];
}

const datePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ARGENTINA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function partsToDateKey(parts: Intl.DateTimeFormatPart[]): string {
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

export function argentinaDateKey(value: Date | string = new Date()): string {
  return partsToDateKey(datePartsFormatter.formatToParts(typeof value === 'string' ? new Date(value) : value));
}

export function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function calendarDate(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

export function buildCalendarDays(selectedDate: string, now: Date = new Date()) {
  const today = argentinaDateKey(now);
  return Array.from({ length: 7 }, (_, index) => {
    const key = shiftDateKey(selectedDate, index - 3);
    const date = calendarDate(key);
    return {
      key,
      weekday: new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' }).format(date).replace('.', '').toUpperCase(),
      dayNumber: new Intl.DateTimeFormat('es-AR', { day: '2-digit', timeZone: 'UTC' }).format(date),
      isToday: key === today,
      isSelected: key === selectedDate,
    };
  });
}

export function formatAgendaDateLabel(selectedDate: string, now: Date = new Date()): string {
  const formatted = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(calendarDate(selectedDate)).replace(/[.,]/g, '').toUpperCase();
  return `${selectedDate === argentinaDateKey(now) ? 'HOY · ' : ''}${formatted}`;
}

export function formatMatchTime(startsAt: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ARGENTINA_TIME_ZONE,
  }).format(new Date(startsAt));
}

export function filterMatchesByDate(matches: AgendaMatch[], selectedDate: string): AgendaMatch[] {
  return matches
    .filter((match) => argentinaDateKey(match.startsAt) === selectedDate)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

export function groupMatchesByCompetition(matches: AgendaMatch[]): AgendaGroup[] {
  const groups = new Map<string, AgendaGroup>();
  for (const match of matches) {
    const key = `${match.competition}\u0000${match.round}`;
    const group = groups.get(key) ?? { competition: match.competition, round: match.round, matches: [] };
    group.matches.push(match);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function matchScore(match: AgendaMatch): string {
  if (match.status === 'final' || match.status === 'live') {
    return `${match.homeScore ?? 0} — ${match.awayScore ?? 0}`;
  }
  return '—';
}
