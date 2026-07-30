'use client';

import { findTeamBadge } from '@ovalia/domain';
import { useEffect, useRef, useState } from 'react';

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
import { useCompetitions, useOrganizations, useTournament } from '../tournaments/use-tournaments';
import { RugbyExplorer } from '../tournaments/rugby-explorer';
import { buildRugbyExplorer, filterMatchesByFamily, splitCompetitionName } from '../tournaments/rugby-explorer-data';
import { track } from '../../lib/analytics';

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

function Frame({ eyebrow, title, intro, className, children }: { eyebrow: string; title: string; intro: string; className?: string; children: React.ReactNode }) {
  return <div className="portal-shell"><PortalHeader /><main className={`portal-main${className ? ` ${className}` : ''}`}><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="portal-intro">{intro}</p>{children}</main></div>;
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

// Lee el estado de /partidos representado en la URL. Una tarea futura sumará
// un parámetro `partido` (para abrir un modal): agregarlo acá basta, sin
// tocar el listener de popstate que la usa.
function readMatchesUrlState(search: string): { date: string; familyKey: string } {
  const params = new URLSearchParams(search);
  return {
    date: params.get('fecha') ?? argentinaDateKey(),
    familyKey: params.get('torneo') ?? '',
  };
}

export function MatchesPage({ initialDate, initialFamily }: { initialDate?: string; initialFamily?: string } = {}) {
  const feed = useLiveFeed();
  const [selectedDate, setSelectedDate] = useState(() => initialDate ?? argentinaDateKey());
  const [selectedFamilyKey, setSelectedFamilyKey] = useState(initialFamily ?? '');
  const [expandedUnionKey, setExpandedUnionKey] = useState('');
  const agenda = useAgendaMatches(selectedDate);
  const { competitions } = useCompetitions();
  const { status: organizationsStatus, organizations } = useOrganizations();
  const explorer = buildRugbyExplorer(organizations, competitions);
  const selectedFamily = explorer.flatMap((union) => union.families).find((family) => family.key === selectedFamilyKey);
  const activeFamilyKey = selectedFamily?.key ?? '';
  const defaultExpandedUnionKey = explorer.find((union) => union.families.some((family) => family.key === activeFamilyKey))?.key
    ?? explorer[0]?.key
    ?? '';
  const activeExpandedUnionKey = explorer.some((union) => union.key === expandedUnionKey)
    ? expandedUnionKey
    : defaultExpandedUnionKey;
  const isSyncingFromHistory = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const { date, familyKey } = readMatchesUrlState(window.location.search);
      isSyncingFromHistory.current = true;
      setSelectedDate(date);
      setSelectedFamilyKey(familyKey);
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('fecha', selectedDate);
    if (activeFamilyKey) url.searchParams.set('torneo', activeFamilyKey);
    else url.searchParams.delete('torneo');
    if (isSyncingFromHistory.current) {
      isSyncingFromHistory.current = false;
      window.history.replaceState(null, '', url.toString());
      return;
    }
    window.history.pushState(null, '', url.toString());
  }, [selectedDate, activeFamilyKey]);

  useEffect(() => {
    track('view_date', { date: selectedDate });
  }, [selectedDate]);

  const slugByName = new Map(competitions.map((competition) => [competition.name, competition.slug]));
  const priorityBySlug = new Map(competitions.map((competition) => [competition.slug, competition.priority]));
  const liveMatches = feed.matches.filter((match) => argentinaDateKey(match.startsAt) === selectedDate);
  const liveIds = new Set(liveMatches.map((match) => match.id));
  const scheduledMatches = filterMatchesByDate(agenda.matches, selectedDate).filter((match) => !liveIds.has(match.id));
  const combinedMatches = [
    ...liveMatches.map((match) => liveToAgendaMatch(match, slugByName.get(match.competition))),
    ...scheduledMatches,
  ];
  const visibleMatches = filterMatchesByFamily(combinedMatches, activeFamilyKey, competitions);
  const visibleScheduledMatches = filterMatchesByFamily(scheduledMatches, activeFamilyKey, competitions);
  const matchGroups = sortAgendaGroups(
    groupMatchesByCompetition(visibleMatches),
    priorityBySlug,
  );
  return (
    <Frame className="portal-main--compact" eyebrow="FIXTURES Y RESULTADOS" title="Centro de partidos" intro="Elegí un torneo y consultá sus partidos por fecha.">
      <div className="rugby-matches-layout">
        {organizationsStatus === 'error' ? (
          <p className="portal-live-status portal-live-status--error">No pudimos cargar el catálogo de torneos. La agenda sigue disponible sin el explorador.</p>
        ) : (
          <RugbyExplorer
            unions={explorer}
            expandedUnionKey={activeExpandedUnionKey}
            selectedFamilyKey={activeFamilyKey}
            mode="matches"
            onUnionSelect={setExpandedUnionKey}
            onFamilySelect={(family, unionKey) => {
              setSelectedFamilyKey(family.key);
              setExpandedUnionKey(unionKey);
            }}
            onClearFamily={() => setSelectedFamilyKey('')}
          />
        )}
        <section className="rugby-match-center">
          {selectedFamily ? (
            <header className="rugby-match-filter">
              <div><small>Torneo seleccionado</small><h2>Partidos de {selectedFamily.title}</h2></div>
              <a href={`/torneos/${selectedFamily.canonicalSlug}`}>Ver torneo <span aria-hidden="true">→</span></a>
            </header>
          ) : (
            <header className="rugby-match-filter rugby-match-filter--all">
              <div><small>Agenda completa</small><h2>Todos los partidos</h2></div>
            </header>
          )}
          <div className="portal-toolbar">
            <button type="button" aria-label="Día anterior" onClick={() => setSelectedDate((date) => shiftDateKey(date, -1))}><ArrowLeftIcon /></button>
            <strong aria-live="polite">{formatAgendaDateLabel(selectedDate)}</strong>
            <button type="button" aria-label="Día siguiente" onClick={() => setSelectedDate((date) => shiftDateKey(date, 1))}><ArrowRightIcon /></button>
          </div>
          <div className="portal-list portal-list--grouped">
            {feed.status === 'loading' ? <p className="portal-live-status">Consultando partidos en vivo…</p> : null}
            {agenda.status === 'loading' ? <p className="portal-live-status">Cargando la agenda…</p> : null}
            {agenda.status === 'error' ? <p className="portal-live-status portal-live-status--error">No pudimos cargar los partidos de esta fecha.</p> : null}
            {agenda.status === 'ready' && visibleMatches.length === 0 ? <p className="portal-live-status">No hay partidos programados para esta fecha{selectedFamily ? ' en este torneo' : ''}.</p> : null}
            {matchGroups.map((group) => (
              <section className="portal-competition-group" key={`${group.competition}-${group.round}`}>
                <header>
                  <div><small>{group.round}</small><h2>{group.competition}</h2></div>
                  <span>{group.matches.length} {group.matches.length === 1 ? 'partido' : 'partidos'}</span>
                </header>
                {group.matches.map((match) => <PortalMatchRow match={match} key={match.id} />)}
              </section>
            ))}
          </div>
          {agenda.status === 'ready' && visibleScheduledMatches.length > 0 ? <DataProvenance source={agenda.source} freshness={agenda.freshness} /> : null}
        </section>
      </div>
    </Frame>
  );
}

interface MatchRound {
  label: string;
  matches: AgendaMatch[];
}

function groupMatchesByRound(matches: AgendaMatch[]): MatchRound[] {
  const groups = new Map<string, AgendaMatch[]>();
  for (const match of [...matches].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const key = match.round || argentinaDateKey(match.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }
  return [...groups.entries()].map(([label, roundMatches]) => ({ label, matches: roundMatches }));
}

function tournamentCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'torneo' : 'torneos'}`;
}

// Lee el estado de /torneos representado en la URL. Igual que en /partidos,
// sumar un parámetro nuevo más adelante sólo requiere extender esta función.
function readTournamentsUrlState(search: string): { unionKey: string } {
  const params = new URLSearchParams(search);
  return { unionKey: params.get('union') ?? '' };
}

export function TournamentsPage({ initialUnion }: { initialUnion?: string } = {}) {
  const { status, competitions } = useCompetitions();
  const { status: organizationsStatus, organizations } = useOrganizations();
  const explorer = buildRugbyExplorer(organizations, competitions);
  const [selectedUnionKey, setSelectedUnionKey] = useState(initialUnion ?? '');
  const selectedUnion = explorer.find((union) => union.key === selectedUnionKey) ?? explorer[0];

  useEffect(() => {
    if (selectedUnion && selectedUnion.key !== selectedUnionKey) {
      setSelectedUnionKey(selectedUnion.key);
    }
  }, [selectedUnion, selectedUnionKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const { unionKey } = readTournamentsUrlState(window.location.search);
      setSelectedUnionKey(unionKey);
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const selectUnion = (unionKey: string) => {
    setSelectedUnionKey(unionKey);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('union', unionKey);
    window.history.pushState(null, '', url.toString());
  };
  return (
    <Frame className="portal-main--compact" eyebrow="COBERTURA" title="Todos los torneos" intro="Elegí una unión y después el torneo que querés consultar.">
      {status === 'loading' || organizationsStatus === 'loading' ? <p className="portal-live-status">Cargando torneos…</p> : null}
      {status === 'error' || organizationsStatus === 'error' ? <p className="portal-live-status portal-live-status--error">No pudimos cargar todo el catálogo.</p> : null}
      {explorer.length > 0 ? (
        <div className="rugby-catalog-layout">
          <RugbyExplorer
            unions={explorer}
            expandedUnionKey={selectedUnion?.key ?? ''}
            mode="catalog"
            onUnionSelect={selectUnion}
          />
          <section className="rugby-union-overview">
            {selectedUnion ? (
              <>
                <header>
                  <div><small>Unión</small><h2>{selectedUnion.label}</h2></div>
                  <span>{tournamentCountLabel(selectedUnion.families.length)}</span>
                </header>
                {selectedUnion.families.length > 0 ? (
                  <div className="rugby-family-grid">
                    {selectedUnion.families.map((family) => (
                      <a href={`/torneos/${family.canonicalSlug}`} key={family.key}>
                        <h3>{family.title}</h3>
                        <span>{family.divisions.length} {family.divisions.length === 1 ? 'categoría' : 'categorías'} <i aria-hidden="true">→</i></span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="rugby-catalog-empty"><small>Próximamente</small><h3>Cobertura en preparación</h3><p>La unión ya forma parte del catálogo. Sus torneos se publicarán cuando estén verificados.</p></div>
                )}
              </>
            ) : null}
          </section>
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

export function TournamentPage({ slug, initialTab = 'posiciones' }: { slug: string; initialTab?: TournamentTab }) {
  const [season, setSeason] = useState<number | undefined>(undefined);
  const [tab, setTab] = useState<TournamentTab>(initialTab);
  const [roundIndex, setRoundIndex] = useState(0);
  const { status, competition, standings, matches } = useTournament(slug, season);
  const { competitions } = useCompetitions();

  useEffect(() => {
    setRoundIndex(0);
  }, [tab, slug, season]);

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

  const familyTitle = splitCompetitionName(competition.name).familyTitle.toLowerCase();
  const siblings = competitions.filter((c) => {
    if (competition.familySlug && c.familySlug) return c.familySlug === competition.familySlug;
    return splitCompetitionName(c.name).familyTitle.toLowerCase() === familyTitle;
  });
  const rounds = groupMatchesByRound(tab === 'resultados' ? results : upcoming);
  const activeRoundIndex = Math.min(roundIndex, Math.max(rounds.length - 1, 0));
  const activeRound = rounds[activeRoundIndex];

  return (
    <Frame className="tournament-detail" eyebrow="ARGENTINA · BUENOS AIRES" title={competition.name} intro={`Temporada ${activeSeason ?? ''} · posiciones, resultados y calendario reales.`}>
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
        <section className="tournament-round-panel">
          {results.length === 0 ? <p className="portal-live-status">Sin resultados todavía.</p> : null}
          {activeRound ? <RoundNavigation index={activeRoundIndex} total={rounds.length} label={activeRound.label} onChange={setRoundIndex} /> : null}
          {activeRound ? <section className="portal-list tournament-results">{activeRound.matches.map((match) => <PortalMatchRow match={match} key={match.id} />)}</section> : null}
        </section>
      ) : null}

      {tab === 'calendario' ? (
        <section className="tournament-round-panel">
          {upcoming.length === 0 ? <p className="portal-live-status">Sin próximos partidos programados.</p> : null}
          {activeRound ? <RoundNavigation index={activeRoundIndex} total={rounds.length} label={activeRound.label} onChange={setRoundIndex} /> : null}
          {activeRound ? <section className="portal-list tournament-results">{activeRound.matches.map((match) => <PortalMatchRow match={match} key={match.id} />)}</section> : null}
        </section>
      ) : null}
    </Frame>
  );
}

function RoundNavigation({ index, total, label, onChange }: { index: number; total: number; label: string; onChange: (index: number) => void }) {
  return (
    <div className="round-toolbar" aria-label="Navegación de fechas">
      <button type="button" aria-label="Fecha anterior" disabled={index === 0} onClick={() => onChange(index - 1)}><ArrowLeftIcon /></button>
      <span><small>JORNADA</small><strong>{label}</strong><em>{index + 1} / {total}</em></span>
      <button type="button" aria-label="Siguiente fecha" disabled={index === total - 1} onClick={() => onChange(index + 1)}><ArrowRightIcon /></button>
    </div>
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
