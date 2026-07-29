'use client';

import { findTeamBadge } from '@ovalia/domain';
import { useEffect, useState } from 'react';

import { ArrowLeftIcon, ArrowRightIcon, ClockIcon, DiamondIcon, HomeIcon, RugbyBallIcon, TargetIcon, UserIcon } from '../../components/icons';
import { type LiveFeedMatch, useLiveFeed } from '../../components/live-rail';
import { TeamBadge } from '../../components/team-badge';
import {
  argentinaDateKey,
  filterMatchesByDate,
  formatAgendaDateLabel,
  formatMatchTime,
  groupMatchesByCompetition,
  matchScore,
  shiftDateKey,
  sortAgendaGroups,
  type AgendaMatch,
} from '../matches/agenda-data';
import { useAgendaMatches } from '../matches/use-agenda';
import { useMatchDetail } from '../matches/use-match-detail';
import { useCompetitions, useTournament } from '../tournaments/use-tournaments';
import { track } from '../../lib/analytics';
import type { ApiCompetition } from '../../lib/api/types';

export function PortalHeader() {
  return (
    <><header className="portal-header">
      <a className="portal-brand" href="/" aria-label="Ovalia, inicio"><RugbyBallIcon /> <span>OVALIA</span></a>
      <nav aria-label="Navegación principal">
        <a href="/partidos">Partidos</a><a href="/torneos">Torneos</a><a href="/prodes">Prodes</a><a href="/juegos">Juegos</a><a href="/noticias">Noticias</a>
      </nav>
      <a className="portal-login" href="/ingresar">Ingresar</a>
    </header><a className="back-home" href="/"><ArrowLeftIcon />Volver al inicio</a>
    <nav className="bottom-nav portal-mobile-nav" aria-label="Navegación móvil">
      <a href="/"><HomeIcon />Inicio</a>
      <a href="/partidos"><ClockIcon />Partidos</a>
      <a href="/torneos"><RugbyBallIcon />Torneos</a>
      <a href="/prodes"><TargetIcon />Prode</a>
      <a href="/juegos"><DiamondIcon />Juegos</a>
      <a href="/ingresar"><UserIcon />Perfil</a>
    </nav></>
  );
}

function Frame({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <div className="portal-shell"><PortalHeader /><main className="portal-main"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="portal-intro">{intro}</p>{children}</main></div>;
}

function DataProvenance({ source, freshness }: { source: string | null; freshness?: string }) {
  if (!source && (!freshness || freshness === 'unknown')) return null;
  const freshnessLabel = freshness === 'stale' ? 'dato guardado (puede estar desactualizado)' : 'actualizado';
  return (
    <p className="data-provenance">
      {source ? <>Fuente: {source.toUpperCase()} · </> : null}
      {freshnessLabel}
    </p>
  );
}

function teamCode(team: string): string {
  return findTeamBadge({ name: team })?.shortCode ?? team.slice(0, 3).toUpperCase();
}

function liveToAgendaMatch(match: LiveFeedMatch, competitionSlug?: string): AgendaMatch {
  return {
    id: match.id,
    competition: match.competition,
    competitionSlug,
    round: match.phase,
    startsAt: match.startsAt,
    status: 'live',
    homeTeam: match.home.name,
    awayTeam: match.away.name,
    homeBadgeUrl: match.home.badgeUrl ?? null,
    awayBadgeUrl: match.away.badgeUrl ?? null,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  };
}

function PortalMatchRow({ match }: { match: AgendaMatch }) {
  const homeCode = teamCode(match.homeTeam);
  const awayCode = teamCode(match.awayTeam);
  const status = match.status === 'live'
    ? 'EN VIVO'
    : match.status === 'final'
      ? 'FINAL'
      : formatMatchTime(match.startsAt);
  return (
    <a className="portal-match" href={`/partidos/${match.id}`}>
      <small>{match.round}</small>
      <span className={match.status === 'live' ? 'live-text' : ''}>{status}</span>
      <div>
        <b><TeamBadge name={match.homeTeam} shortCode={homeCode} badgeUrl={match.homeBadgeUrl ?? undefined} />{match.homeTeam}</b>
        <strong>{match.status === 'scheduled' ? 'vs' : matchScore(match)}</strong>
        <b>{match.awayTeam}<TeamBadge name={match.awayTeam} shortCode={awayCode} badgeUrl={match.awayBadgeUrl ?? undefined} /></b>
      </div>
    </a>
  );
}

export function MatchesPage({ initialDate }: { initialDate?: string } = {}) {
  const feed = useLiveFeed();
  const [selectedDate, setSelectedDate] = useState(() => initialDate ?? argentinaDateKey());
  const agenda = useAgendaMatches(selectedDate);
  const { competitions } = useCompetitions();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('fecha', selectedDate);
    window.history.replaceState(null, '', url.toString());
    track('view_date', { date: selectedDate });
  }, [selectedDate]);

  const slugByName = new Map(competitions.map((competition) => [competition.name, competition.slug]));
  const priorityBySlug = new Map(competitions.map((competition) => [competition.slug, competition.priority]));
  const liveMatches = feed.matches.filter((match) => argentinaDateKey(match.startsAt) === selectedDate);
  const liveIds = new Set(liveMatches.map((match) => match.id));
  const scheduledMatches = filterMatchesByDate(agenda.matches, selectedDate).filter((match) => !liveIds.has(match.id));
  const matchGroups = sortAgendaGroups(
    groupMatchesByCompetition([
      ...liveMatches.map((match) => liveToAgendaMatch(match, slugByName.get(match.competition))),
      ...scheduledMatches,
    ]),
    priorityBySlug,
  );
  return (
    <Frame eyebrow="FIXTURES Y RESULTADOS" title="Centro de partidos" intro="La agenda del rugby argentino, con datos verificados y actualización en vivo.">
      <div className="portal-toolbar">
        <button type="button" aria-label="Día anterior" onClick={() => setSelectedDate((date) => shiftDateKey(date, -1))}><ArrowLeftIcon /></button>
        <strong aria-live="polite">{formatAgendaDateLabel(selectedDate)}</strong>
        <button type="button" aria-label="Día siguiente" onClick={() => setSelectedDate((date) => shiftDateKey(date, 1))}><ArrowRightIcon /></button>
      </div>
      <div className="portal-list portal-list--grouped">
        {feed.status === 'loading' ? <p className="portal-live-status">Consultando partidos en vivo…</p> : null}
        {agenda.status === 'loading' ? <p className="portal-live-status">Cargando la agenda…</p> : null}
        {agenda.status === 'error' ? <p className="portal-live-status portal-live-status--error">No pudimos cargar los partidos de esta fecha.</p> : null}
        {agenda.status === 'ready' && liveMatches.length === 0 && scheduledMatches.length === 0 ? <p className="portal-live-status">No hay partidos programados para esta fecha.</p> : null}
        {matchGroups.map((group) => (
          <section className="portal-competition-group" key={`${group.competition}-${group.round}`}>
            <header>
              <div><small>{group.round}</small><h2>{group.competition}</h2></div>
              <span>{group.matches.length} partidos</span>
            </header>
            {group.matches.map((match) => <PortalMatchRow match={match} key={match.id} />)}
          </section>
        ))}
      </div>
      {agenda.status === 'ready' && scheduledMatches.length > 0 ? <DataProvenance source={agenda.source} freshness={agenda.freshness} /> : null}
    </Frame>
  );
}

interface OrgGroup {
  orgName: string;
  families: TournamentFamily[];
}

interface CountryGroup {
  key: string;
  label: string;
  id: string;
  organizations: OrgGroup[];
  tournamentCount: number;
}

interface TournamentFamily {
  key: string;
  title: string;
  priority: number;
  divisions: ApiCompetition[];
}

function organizationName(competition: ApiCompetition): string {
  if (competition.organization?.name) return competition.organization.name;
  if (competition.category === 'national-teams' || competition.countryCode == null) return 'Rugby Internacional';
  if (competition.countryCode === 'AR') return 'Rugby argentino';
  return 'Otros torneos';
}

const countryNames: Record<string, string> = {
  AR: 'Argentina',
  AU: 'Australia',
  CL: 'Chile',
  FR: 'Francia',
  GB: 'Reino Unido',
  IE: 'Irlanda',
  IT: 'Italia',
  NZ: 'Nueva Zelanda',
  UY: 'Uruguay',
  ZA: 'Sudáfrica',
};

function countryKey(competition: ApiCompetition): string {
  if (competition.category === 'national-teams' || competition.countryCode == null) return 'international';
  return competition.countryCode.toUpperCase();
}

function countryLabel(key: string): string {
  if (key === 'international') return 'Internacional';
  return countryNames[key] ?? key;
}

function countryId(label: string): string {
  return `pais-${label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function splitCompetitionName(name: string): { familyTitle: string; divisionLabel: string } {
  const parts = name.split(' - ');
  if (parts.length >= 2) {
    return {
      familyTitle: parts[0]!,
      divisionLabel: parts.slice(1).join(' - '),
    };
  }
  return { familyTitle: name, divisionLabel: 'Principal' };
}

function divisionRank(competition: ApiCompetition): number {
  const label = splitCompetitionName(competition.name).divisionLabel.toLowerCase();
  if (/^(superior|primera\b|primera divisi[oó]n)/.test(label)) return 0;
  if (/^intermedia/.test(label)) return 1;
  if (/^pre[\s-]?intermedia/.test(label)) return 2;
  if (/menores de 22|^m22/.test(label)) return 3;
  if (/^m19|menores de 19/.test(label)) return 10;
  if (/^m17|menores de 17/.test(label)) return 11;
  if (/^m16|menores de 16/.test(label)) return 12;
  if (/^m15|menores de 15/.test(label)) return 13;
  if (competition.tier === 'women') return 20;
  if (competition.tier === 'youth') return 30;
  return 50;
}

function sortDivisions(competitions: ApiCompetition[]): ApiCompetition[] {
  return [...competitions].sort((a, b) => {
    const rankDiff = divisionRank(a) - divisionRank(b);
    if (rankDiff !== 0) return rankDiff;
    const priorityDiff = b.priority - a.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return splitCompetitionName(a.name).divisionLabel.localeCompare(splitCompetitionName(b.name).divisionLabel);
  });
}

function groupByOrganization(competitions: ApiCompetition[]): OrgGroup[] {
  const groups = new Map<string, { orgName: string; families: Map<string, TournamentFamily> }>();
  for (const competition of competitions) {
    const orgName = organizationName(competition);
    if (!groups.has(orgName)) groups.set(orgName, { orgName, families: new Map() });
    const group = groups.get(orgName)!;
    const familyKey = competition.familySlug ?? competition.slug;
    const family = group.families.get(familyKey) ?? {
      key: familyKey,
      title: splitCompetitionName(competition.name).familyTitle,
      priority: competition.priority,
      divisions: [],
    };
    family.priority = Math.max(family.priority, competition.priority);
    if (competition.priority >= family.priority) {
      family.title = splitCompetitionName(competition.name).familyTitle;
    }
    family.divisions.push(competition);
    group.families.set(familyKey, family);
  }
  return [...groups.values()]
    .map((group) => ({
      orgName: group.orgName,
      families: [...group.families.values()]
        .map((family) => ({ ...family, divisions: sortDivisions(family.divisions) }))
        .sort((a, b) => {
          const priorityDiff = b.priority - a.priority;
          if (priorityDiff !== 0) return priorityDiff;
          return a.title.localeCompare(b.title);
        }),
    }))
    .sort((a, b) => {
      const priorityA = a.families[0]?.priority ?? 0;
      const priorityB = b.families[0]?.priority ?? 0;
      return priorityB - priorityA;
    });
}

function groupByCountry(competitions: ApiCompetition[]): CountryGroup[] {
  const groups = new Map<string, ApiCompetition[]>();
  for (const competition of competitions) {
    const key = countryKey(competition);
    groups.set(key, [...(groups.get(key) ?? []), competition]);
  }

  return [...groups.entries()]
    .map(([key, countryCompetitions]) => {
      const label = countryLabel(key);
      const organizations = groupByOrganization(countryCompetitions);
      return {
        key,
        label,
        id: countryId(label),
        organizations,
        tournamentCount: organizations.reduce((total, organization) => total + organization.families.length, 0),
      };
    })
    .sort((a, b) => {
      const rank = (key: string) => key === 'AR' ? 0 : key === 'international' ? 1 : 2;
      const rankDiff = rank(a.key) - rank(b.key);
      return rankDiff !== 0 ? rankDiff : a.label.localeCompare(b.label, 'es');
    });
}

function tournamentCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'torneo' : 'torneos'}`;
}

export function TournamentsPage() {
  const { status, competitions } = useCompetitions();
  const countries = groupByCountry(competitions);
  return (
    <Frame eyebrow="COBERTURA" title="Todos los torneos" intro="Competencias con datos verificados y las que estamos incorporando.">
      {status === 'loading' ? <p className="portal-live-status">Cargando torneos…</p> : null}
      {status === 'error' ? <p className="portal-live-status portal-live-status--error">No pudimos cargar los torneos.</p> : null}
      {countries.length > 0 ? (
        <div className="tournament-catalog">
          <nav className="tournament-country-nav" aria-label="Países con torneos">
            <p>Países</p>
            {countries.map((country, index) => (
              <a className={index === 0 ? 'is-primary' : ''} href={`#${country.id}`} key={country.key}>
                <strong>{country.label}</strong>
                <span>{tournamentCountLabel(country.tournamentCount)}</span>
              </a>
            ))}
          </nav>
          <div className="tournament-country-list">
            {countries.map((country) => (
              <section className="tournament-country" id={country.id} key={country.key}>
                <header className="tournament-country__header">
                  <div><small>País</small><h2>{country.label}</h2></div>
                  <span>{tournamentCountLabel(country.tournamentCount)}</span>
                </header>
                {country.organizations.map((organization) => (
                  <section className="tournament-group" key={organization.orgName}>
                    <header className="tournament-group__header">
                      <h3>{organization.orgName}</h3>
                      <span>{tournamentCountLabel(organization.families.length)}</span>
                    </header>
                    <div className="tournament-grid">
                      {organization.families.map((family) => (
                        <article className="tournament-family" key={family.key}>
                          <h4>{family.title}</h4>
                          <div className="tournament-divisions">
                            {family.divisions.map((division) => {
                              const label = splitCompetitionName(division.name).divisionLabel;
                              return division.coverage === 'auto' ? (
                                <a href={`/torneos/${division.slug}`} key={division.slug}><span>{label}</span><i>→</i></a>
                              ) : (
                                <div className="tournament-upcoming" key={division.slug} aria-disabled="true">
                                  <span>{label}</span>
                                  <small>Cobertura en preparación</small>
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </Frame>
  );
}

export function PredictionPage() {
  return (
    <Frame eyebrow="JUGÁ LA FECHA" title="Prode Ovalia" intro="Pronosticá resultados, sumá puntos y competí en rankings generales o privados.">
      <section className="prediction-panel"><div className="prediction-heading"><div><small>URBA TOP 14</small><h2>Fecha 12</h2></div><span>Cierra el sábado · 15:25</span></div>{[['SIC','Hindú'],['CASI','Newman'],['Alumni','CUBA']].map(([home,away]) => <div className="prediction-row" key={home}><b>{home}</b><label><span>Local</span><input aria-label={`Goles de ${home}`} inputMode="numeric" defaultValue="0" /></label><em>—</em><label><span>Visitante</span><input aria-label={`Goles de ${away}`} inputMode="numeric" defaultValue="0" /></label><b>{away}</b></div>)}<button className="primary-action" type="button">Guardar pronósticos</button><p className="fine-print">5 pts resultado exacto · 3 pts diferencia exacta · 1 pt ganador</p></section>
    </Frame>
  );
}

type TournamentTab = 'posiciones' | 'resultados' | 'calendario';

export function TournamentPage({ slug }: { slug: string }) {
  const [season, setSeason] = useState<number | undefined>(undefined);
  const [tab, setTab] = useState<TournamentTab>('posiciones');
  const { status, competition, standings, matches } = useTournament(slug, season);
  const { competitions } = useCompetitions();

  useEffect(() => {
    track('view_tournament', { slug });
  }, [slug]);

  if (status === 'loading' && !competition) {
    return <Frame eyebrow="TORNEO" title="Cargando…" intro="Consultando los datos verificados del torneo."><p className="portal-live-status">Cargando…</p></Frame>;
  }
  if (status === 'error' || !competition) {
    return <Frame eyebrow="TORNEO" title="Torneo no disponible" intro="No encontramos este torneo en nuestros datos verificados."><section className="match-detail match-detail--empty"><RugbyBallIcon /><a className="primary-action inline-action" href="/torneos">Ver todos los torneos</a></section></Frame>;
  }

  const results = matches.filter((m) => m.status === 'final');
  const upcoming = matches.filter((m) => m.status !== 'final');
  const activeSeason = season ?? competition.seasons[0]?.year;

  const siblings = competitions.filter((c) => c.familySlug && c.familySlug === competition.familySlug);

  return (
    <Frame eyebrow="ARGENTINA · BUENOS AIRES" title={competition.name} intro={`Temporada ${activeSeason ?? ''} · posiciones, resultados y calendario reales.`}>
      {competition.seasons.length > 1 ? (
        <label className="season-picker">Temporada
          <select value={activeSeason} onChange={(e) => setSeason(Number(e.target.value))}>
            {competition.seasons.map((s) => <option key={s.year} value={s.year}>{s.name}</option>)}
          </select>
        </label>
      ) : null}
      <nav className="tab-bar">
        <button type="button" className={tab === 'posiciones' ? 'active' : ''} onClick={() => setTab('posiciones')}>Posiciones</button>
        <button type="button" className={tab === 'resultados' ? 'active' : ''} onClick={() => setTab('resultados')}>Resultados</button>
        <button type="button" className={tab === 'calendario' ? 'active' : ''} onClick={() => setTab('calendario')}>Calendario</button>
      </nav>

      {siblings.length > 1 ? (
        <nav className="family-selector" aria-label="Otras categorías de este torneo">
          {siblings.map((s) => (
            <a
              key={s.slug}
              href={`/torneos/${s.slug}`}
              className={s.slug === slug ? 'active' : ''}
            >
              {s.name.split(' - ').at(-1) ?? s.name}
            </a>
          ))}
        </nav>
      ) : null}

      {tab === 'posiciones' ? (
        <section className="table-card">
          <h2>Tabla de posiciones</h2>
          {standings && standings.rows.length > 0 ? (
            <>
              <div className="standing-row standing-head"><span>#</span><span>Equipo</span><span>PJ</span><span>PTS</span></div>
              {standings.rows.map((row) => {
                const shortCode = findTeamBadge({ name: row.team.name })?.shortCode ?? row.team.name.slice(0, 3).toUpperCase();
                return (
                  <div className="standing-row" key={row.team.slug}>
                    <span>{row.position}</span>
                    <span className="standing-team">
                      <TeamBadge name={row.team.name} shortCode={shortCode} badgeUrl={row.team.badgeUrl ?? undefined} size="small" />
                      {row.team.name}
                    </span>
                    <span>{row.played}</span><span>{row.points}</span>
                  </div>
                );
              })}
              <DataProvenance source={standings.source} freshness={standings.freshness} />
            </>
          ) : <p className="portal-live-status">Todavía no hay posiciones para esta temporada.</p>}
        </section>
      ) : null}

      {tab === 'resultados' ? (
        <section className="portal-list">
          {results.length === 0 ? <p className="portal-live-status">Sin resultados todavía.</p> : null}
          {results.map((m) => (
            <a className="portal-match" href={`/partidos/${m.id}`} key={m.id}><small>{m.round}</small><span>FINAL</span><div><b>{m.homeTeam}</b><strong>{matchScore(m)}</strong><b>{m.awayTeam}</b></div></a>
          ))}
        </section>
      ) : null}

      {tab === 'calendario' ? (
        <section className="portal-list">
          {upcoming.length === 0 ? <p className="portal-live-status">Sin próximos partidos programados.</p> : null}
          {upcoming.map((m) => (
            <a className="portal-match" href={`/partidos/${m.id}`} key={m.id}><small>{m.round}</small><span>{formatMatchTime(m.startsAt)}</span><div><b>{m.homeTeam}</b><em>vs</em><b>{m.awayTeam}</b></div></a>
          ))}
        </section>
      ) : null}
    </Frame>
  );
}

export function MatchDetailPage({ matchId }: { matchId: string }) {
  const detail = useMatchDetail(matchId);
  const feed = useLiveFeed();

  if (detail.status === 'loading') {
    return <Frame eyebrow="CENTRO DE PARTIDO" title="Información del partido" intro="Consultando los datos verificados del partido…"><section className="match-detail match-detail--empty"><RugbyBallIcon /><p>Cargando…</p></section></Frame>;
  }
  if (detail.status === 'not-found') {
    return <Frame eyebrow="CENTRO DE PARTIDO" title="Partido no encontrado" intro="No encontramos este partido en nuestros datos verificados."><section className="match-detail match-detail--empty"><RugbyBallIcon /><h2>Sin información</h2><p>Puede que el enlace sea antiguo o el partido ya no esté disponible.</p><a className="primary-action inline-action" href="/partidos">Ver todos los partidos</a></section></Frame>;
  }
  if (detail.status === 'error' || !detail.match) {
    return <Frame eyebrow="CENTRO DE PARTIDO" title="No disponible" intro="No pudimos cargar el detalle en este momento."><section className="match-detail match-detail--empty"><RugbyBallIcon /><h2>Error de conexión</h2><p>Intentá nuevamente en unos minutos.</p><a className="primary-action inline-action" href="/partidos">Ver todos los partidos</a></section></Frame>;
  }

  const match = detail.match;
  const live = feed.matches.find((item) => item.id === match.id);
  const isScored = match.status === 'final' || match.status === 'live' || live != null;
  const homeScore = live?.homeScore ?? match.homeScore;
  const awayScore = live?.awayScore ?? match.awayScore;
  const homeCode = findTeamBadge({ name: match.home.name })?.shortCode ?? match.home.shortName;
  const awayCode = findTeamBadge({ name: match.away.name })?.shortCode ?? match.away.shortName;
  const title = isScored
    ? `${match.home.name} ${homeScore ?? 0} — ${awayScore ?? 0} ${match.away.name}`
    : `${match.home.name} vs ${match.away.name}`;
  const intro = live
    ? `EN VIVO · ${live.minute ? `${live.minute} min` : live.phase}`
    : `${match.round} · ${formatMatchTime(match.startsAt)}`;

  return (
    <Frame eyebrow={match.competition.name.toUpperCase()} title={title} intro={intro}>
      <section className="match-detail">
        <div className="live-detail-teams">
          <TeamBadge name={match.home.name} shortCode={homeCode} badgeUrl={match.home.badgeUrl ?? undefined} size="large" />
          <strong>{isScored ? `${homeScore ?? 0} — ${awayScore ?? 0}` : '—'}</strong>
          <TeamBadge name={match.away.name} shortCode={awayCode} badgeUrl={match.away.badgeUrl ?? undefined} size="large" />
        </div>
        <h2>{live ? 'Actualización en vivo' : match.status === 'final' ? 'Resultado final' : 'Próximo partido'}</h2>
        {match.venue ? <p>Sede: {match.venue}</p> : null}
        <DataProvenance source={live ? 'highlightly' : match.source} freshness={match.freshness} />
      </section>
    </Frame>
  );
}
