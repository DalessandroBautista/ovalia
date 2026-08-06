'use client';

import { findTeamBadge, findCountryByCode } from '@ovalia/domain';
import { useEffect, useMemo, useRef, useState } from 'react';

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
import { MatchModal } from '../matches/match-modal';
import { useAgendaMatches } from '../matches/use-agenda';
import { useMatchDetail } from '../matches/use-match-detail';
import { useCompetitions, useOrganizations, useTournament } from '../tournaments/use-tournaments';
import { RugbyExplorer } from '../tournaments/rugby-explorer';
import { buildRugbyExplorer, sortDivisions, splitCompetitionName } from '../tournaments/rugby-explorer-data';
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

function PortalMatchRow({ match, onOpen }: { match: AgendaMatch; onOpen?: (match: AgendaMatch) => void }) {
  const homeCode = teamCode(match.homeTeam);
  const awayCode = teamCode(match.awayTeam);
  const status = match.status === 'live'
    ? 'EN VIVO'
    : match.status === 'final'
      ? 'FINAL'
      : formatMatchTime(match.startsAt);
  const content = <>
      <small>{match.round}</small>
      <span className={match.status === 'live' ? 'live-text' : ''}>{status}</span>
      <div>
        <b><TeamBadge name={match.homeTeam} shortCode={homeCode} badgeUrl={match.homeBadgeUrl ?? undefined} />{match.homeTeam}</b>
        <strong>{match.status === 'scheduled' ? 'vs' : matchScore(match)}</strong>
        <b>{match.awayTeam}<TeamBadge name={match.awayTeam} shortCode={awayCode} badgeUrl={match.awayBadgeUrl ?? undefined} /></b>
      </div>
    </>;
  if (onOpen) {
    return <button className="portal-match" type="button" aria-label={`${match.homeTeam} contra ${match.awayTeam}`} onClick={() => onOpen(match)}>{content}</button>;
  }
  return <a className="portal-match" href={`/partidos/${match.id}`}>{content}</a>;
}

function readMatchesUrlState(search: string): { date: string; familyKey: string; matchId: string | null } {
  const params = new URLSearchParams(search);
  return {
    date: params.get('fecha') ?? argentinaDateKey(),
    familyKey: params.get('torneo') ?? '',
    matchId: params.get('partido'),
  };
}

function nearestMatchDate(dates: string[], reference: string): string | undefined {
  if (dates.length === 0) return undefined;
  const future = dates.filter((date) => date >= reference);
  return future.length > 0 ? future[0] : dates[dates.length - 1];
}

export function MatchesPage({ initialDate, initialFamily, initialMatchId }: { initialDate?: string; initialFamily?: string; initialMatchId?: string } = {}) {
  const feed = useLiveFeed();
  const [selectedDate, setSelectedDate] = useState(() => initialDate ?? argentinaDateKey());
  const [selectedFamilyKey, setSelectedFamilyKey] = useState(initialFamily ?? '');
  const [selectedDivisionSlug, setSelectedDivisionSlug] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(initialMatchId ?? null);
  const agenda = useAgendaMatches(selectedDate);
  const { competitions } = useCompetitions();
  const { status: organizationsStatus, organizations } = useOrganizations();
  const explorer = buildRugbyExplorer(organizations, competitions);
  const allUnions = explorer.flatMap((country) => country.unions);
  const selectedFamily = allUnions.flatMap((union) => union.families).find((family) => family.key === selectedFamilyKey);
  const activeFamilyKey = selectedFamily?.key ?? '';
  // Categoría activa dentro del torneo elegido (Superior por defecto): si la selección
  // manual no pertenece a la familia actual, se cae al canonicalSlug (primera división).
  const activeDivisionSlug = selectedFamily
    ? (selectedFamily.divisions.some((division) => division.slug === selectedDivisionSlug) ? selectedDivisionSlug : selectedFamily.canonicalSlug)
    : '';
  const divisionTournament = useTournament(activeDivisionSlug);
  const divisionMatchDates = useMemo(
    () => [...new Set(divisionTournament.matches.map((match) => argentinaDateKey(match.startsAt)))].sort(),
    [divisionTournament.matches],
  );
  
  // Encontrar el país y unión que contiene la familia seleccionada
  const containingCountry = explorer.find((country) => 
    country.unions.some((union) => union.families.some((family) => family.key === activeFamilyKey))
  );
  const containingUnion = containingCountry?.unions.find((union) => 
    union.families.some((family) => family.key === activeFamilyKey)
  );

  // Expansión por defecto: solo el primer país y su primera unión,
  // o el país/uníón que contiene al torneo activo si viene en la URL.
  const firstCountry = explorer[0];
  const defaultCountryCode = containingCountry?.code ?? firstCountry?.code ?? '';
  const defaultUnionKey = containingUnion?.key ?? containingCountry?.unions[0]?.key ?? firstCountry?.unions[0]?.key ?? '';
  const [expandedCountryCodes, setExpandedCountryCodes] = useState<ReadonlySet<string>>(
    () => new Set(defaultCountryCode ? [defaultCountryCode] : []),
  );
  const [expandedUnionKeys, setExpandedUnionKeys] = useState<ReadonlySet<string>>(
    () => new Set(defaultUnionKey ? [defaultUnionKey] : []),
  );

  const toggleCountry = (countryCode: string) => {
    setExpandedCountryCodes((prev) => {
      const next = new Set(prev);
      if (next.has(countryCode)) next.delete(countryCode);
      else next.add(countryCode);
      return next;
    });
  };

  const toggleUnion = (unionKey: string) => {
    setExpandedUnionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(unionKey)) next.delete(unionKey);
      else next.add(unionKey);
      return next;
    });
  };

  // Si el catálogo llega después del primer render (datos asíncronos),
  // inicializar la expansión por defecto sin pisar la interacción del usuario.
  useEffect(() => {
    if (!defaultCountryCode) return;
    setExpandedCountryCodes((prev) => (prev.size > 0 ? prev : new Set([defaultCountryCode])));
    setExpandedUnionKeys((prev) => (prev.size > 0 || !defaultUnionKey ? prev : new Set([defaultUnionKey])));
  }, [defaultCountryCode, defaultUnionKey]);

  // Si el torneo activo viene de la URL, autoexpandir el país y la unión que lo contienen
  useEffect(() => {
    if (!activeFamilyKey) return;
    if (containingCountry?.code) {
      setExpandedCountryCodes((prev) => (prev.has(containingCountry.code) ? prev : new Set(prev).add(containingCountry.code)));
    }
    if (containingUnion?.key) {
      setExpandedUnionKeys((prev) => (prev.has(containingUnion.key) ? prev : new Set(prev).add(containingUnion.key)));
    }
  }, [activeFamilyKey, containingCountry?.code, containingUnion?.key]);
  const isSyncingFromHistory = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const { date, familyKey, matchId } = readMatchesUrlState(window.location.search);
      isSyncingFromHistory.current = true;
      setSelectedDate(date);
      setSelectedFamilyKey(familyKey);
      setSelectedMatchId(matchId);
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

  // Al elegir un torneo (o cambiar de categoría), saltar directo a la fecha real más
  // cercana en vez de quedarse en un día de calendario sin partidos programados.
  useEffect(() => {
    if (!selectedFamily || divisionMatchDates.length === 0) return;
    if (divisionMatchDates.includes(selectedDate)) return;
    const next = nearestMatchDate(divisionMatchDates, selectedDate);
    if (next) setSelectedDate(next);
  }, [selectedFamily?.key, activeDivisionSlug, divisionMatchDates.join(',')]);

  const slugByName = new Map(competitions.map((competition) => [competition.name, competition.slug]));
  const priorityBySlug = new Map(competitions.map((competition) => [competition.slug, competition.priority]));
  const liveMatchesRaw = feed.matches
    .filter((match) => argentinaDateKey(match.startsAt) === selectedDate)
    .map((match) => liveToAgendaMatch(match, slugByName.get(match.competition)));
  const liveMatches = selectedFamily
    ? liveMatchesRaw.filter((match) => match.competitionSlug === activeDivisionSlug)
    : liveMatchesRaw;
  const liveIds = new Set(liveMatches.map((match) => match.id));
  const scheduleSource = selectedFamily ? divisionTournament.matches : agenda.matches;
  const scheduledMatches = filterMatchesByDate(scheduleSource, selectedDate).filter((match) => !liveIds.has(match.id));
  const combinedMatches = [...liveMatches, ...scheduledMatches];
  const visibleMatches = combinedMatches;
  const visibleScheduledMatches = scheduledMatches;
  const matchGroups = sortAgendaGroups(
    groupMatchesByCompetition(visibleMatches),
    priorityBySlug,
  );
  const scheduleStatus = selectedFamily ? divisionTournament.status : agenda.status;
  const provenanceSource = selectedFamily ? (scheduledMatches[0]?.source ?? null) : agenda.source;
  const provenanceFreshness = selectedFamily
    ? (scheduledMatches.some((match) => match.freshness === 'stale') ? 'stale' : (scheduledMatches[0]?.freshness ?? 'unknown'))
    : agenda.freshness;
  const divisionDateIndex = divisionMatchDates.indexOf(selectedDate);
  const goToAdjacentDate = (direction: 1 | -1) => {
    if (selectedFamily && divisionMatchDates.length > 0) {
      if (divisionDateIndex === -1) {
        const next = nearestMatchDate(divisionMatchDates, selectedDate);
        if (next) setSelectedDate(next);
        return;
      }
      const nextIndex = divisionDateIndex + direction;
      if (nextIndex >= 0 && nextIndex < divisionMatchDates.length) setSelectedDate(divisionMatchDates[nextIndex]!);
      return;
    }
    setSelectedDate((date) => shiftDateKey(date, direction));
  };
  const selectedMatch = visibleMatches.find((match) => match.id === selectedMatchId) ?? null;
  const selectMatch = (matchId: string | null) => {
    setSelectedMatchId(matchId);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (matchId) url.searchParams.set('partido', matchId);
    else url.searchParams.delete('partido');
    window.history.pushState(null, '', url.toString());
  };
  return (
    <><Frame className="portal-main--compact" eyebrow="FIXTURES Y RESULTADOS" title="Centro de partidos" intro="Elegí un torneo y consultá sus partidos por fecha.">
      <div className="rugby-matches-layout">
        {organizationsStatus === 'error' ? (
          <p className="portal-live-status portal-live-status--error">No pudimos cargar el catálogo de torneos. La agenda sigue disponible sin el explorador.</p>
        ) : (
          <RugbyExplorer
            countries={explorer}
            expandedCountryCodes={expandedCountryCodes}
            expandedUnionKeys={expandedUnionKeys}
            selectedFamilyKey={activeFamilyKey}
            mode="matches"
            onCountrySelect={toggleCountry}
            onUnionSelect={toggleUnion}
            onFamilySelect={(family, unionKey) => {
              setSelectedFamilyKey(family.key);
              setSelectedDivisionSlug(family.canonicalSlug);
              setExpandedUnionKeys((prev) => new Set(prev).add(unionKey));
            }}
            onClearFamily={() => { setSelectedFamilyKey(''); setSelectedDivisionSlug(''); }}
          />
        )}
        <section className="rugby-match-center">
          {selectedFamily ? (
            <header className="rugby-match-filter">
              <div><small>Torneo seleccionado</small><h2>Partidos de {selectedFamily.title}</h2></div>
              <a href={`/torneos/${activeDivisionSlug}`}>Ver torneo <span aria-hidden="true">→</span></a>
            </header>
          ) : (
            <header className="rugby-match-filter rugby-match-filter--all">
              <div><small>Agenda completa</small><h2>Todos los partidos</h2></div>
            </header>
          )}
          {selectedFamily && selectedFamily.divisions.length > 1 ? (
            <nav className="family-selector" aria-label="Categorías del torneo">
              {selectedFamily.divisions.map((division) => (
                <button
                  key={division.slug}
                  type="button"
                  className={division.slug === activeDivisionSlug ? 'active' : ''}
                  onClick={() => setSelectedDivisionSlug(division.slug)}
                >
                  {splitCompetitionName(division.name).divisionLabel}
                </button>
              ))}
            </nav>
          ) : null}
          <div className="portal-toolbar">
            <button
              type="button"
              aria-label="Fecha anterior"
              disabled={Boolean(selectedFamily) && divisionMatchDates.length > 0 && divisionDateIndex === 0}
              onClick={() => goToAdjacentDate(-1)}
            ><ArrowLeftIcon /></button>
            <strong aria-live="polite">{formatAgendaDateLabel(selectedDate)}</strong>
            <button
              type="button"
              aria-label="Fecha siguiente"
              disabled={Boolean(selectedFamily) && divisionMatchDates.length > 0 && divisionDateIndex === divisionMatchDates.length - 1}
              onClick={() => goToAdjacentDate(1)}
            ><ArrowRightIcon /></button>
          </div>
          <div className="portal-list portal-list--grouped">
            {feed.status === 'loading' ? <p className="portal-live-status">Consultando partidos en vivo…</p> : null}
            {scheduleStatus === 'loading' ? <p className="portal-live-status">Cargando la agenda…</p> : null}
            {scheduleStatus === 'error' ? <p className="portal-live-status portal-live-status--error">No pudimos cargar los partidos de esta fecha.</p> : null}
            {scheduleStatus === 'ready' && visibleMatches.length === 0 ? <p className="portal-live-status">No hay partidos programados para esta fecha{selectedFamily ? ' en este torneo' : ''}.</p> : null}
            {matchGroups.map((group) => (
              <section className="portal-competition-group" key={`${group.competition}-${group.round}`}>
                <header>
                  <div><small>{group.round}</small><h2>{group.competition}</h2></div>
                  <span>{group.matches.length} {group.matches.length === 1 ? 'partido' : 'partidos'}</span>
                </header>
                {group.matches.map((match) => <PortalMatchRow match={match} onOpen={() => selectMatch(match.id)} key={match.id} />)}
              </section>
            ))}
          </div>
          {scheduleStatus === 'ready' && visibleScheduledMatches.length > 0 ? <DataProvenance source={provenanceSource} freshness={provenanceFreshness} /> : null}
        </section>
      </div>
    </Frame>{selectedMatch ? <MatchModal match={selectedMatch} onClose={() => selectMatch(null)} /> : null}</>
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

function teamsFromMatches(matches: AgendaMatch[]): Array<{ name: string; badgeUrl: string | null }> {
  const byName = new Map<string, string | null>();
  for (const match of matches) {
    if (!byName.has(match.homeTeam)) byName.set(match.homeTeam, match.homeBadgeUrl);
    if (!byName.has(match.awayTeam)) byName.set(match.awayTeam, match.awayBadgeUrl);
  }
  return [...byName.entries()]
    .map(([name, badgeUrl]) => ({ name, badgeUrl }))
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

function formatRoundDateRange(matches: AgendaMatch[]): string {
  const dates = matches
    .map((match) => new Date(match.startsAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
  if (dates.length === 0) return '';
  const format = (date: Date) => date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' });
  const first = format(dates[0]!);
  const last = format(dates.at(-1)!);
  return first === last ? first : `${first} – ${last}`;
}

// Lee el estado de /torneos representado en la URL. Igual que en /partidos,
// sumar un parámetro nuevo más adelante sólo requiere extender esta función.
function readTournamentsUrlState(search: string): { countryCode: string; unionKey: string } {
  const params = new URLSearchParams(search);
  return {
    countryCode: params.get('pais') ?? '',
    unionKey: params.get('union') ?? '',
  };
}

export function TournamentsPage({ initialCountry, initialUnion }: { initialCountry?: string; initialUnion?: string } = {}) {
  const { status, competitions } = useCompetitions();
  const { status: organizationsStatus, organizations } = useOrganizations();
  const explorer = buildRugbyExplorer(organizations, competitions);
  // Selección (parametros de la URL + panel derecho)
  const [selectedCountryCode, setSelectedCountryCode] = useState(initialCountry ?? '');
  const [selectedUnionKey, setSelectedUnionKey] = useState(initialUnion ?? '');
  
  const allUnions = explorer.flatMap((country) => country.unions);
  const selectedUnion = allUnions.find((union) => union.key === selectedUnionKey) ?? allUnions[0];
  
  // Encontrar el país que contiene la unión seleccionada
  const containingCountry = explorer.find((country) => 
    country.unions.some((union) => union.key === selectedUnion?.key)
  );
  
  const activeCountryCode = containingCountry?.code ?? explorer.find((c) => c.code === selectedCountryCode)?.code ?? explorer[0]?.code ?? 'AR';
  const selectedCountry = explorer.find((country) => country.code === activeCountryCode);

  // Expansión por defecto: solo el primer país (Argentina) y su primera unión
  const firstCountryCode = explorer[0]?.code ?? '';
  const firstUnionKey = explorer[0]?.unions[0]?.key ?? '';
  // Expansión visual (acumulativa, no afecta la URL)
  const [expandedCountryCodes, setExpandedCountryCodes] = useState<ReadonlySet<string>>(
    () => new Set(firstCountryCode ? [firstCountryCode] : []),
  );
  const [expandedUnionKeys, setExpandedUnionKeys] = useState<ReadonlySet<string>>(
    () => new Set(firstUnionKey ? [firstUnionKey] : []),
  );

  const toggleCountry = (countryCode: string) => {
    setExpandedCountryCodes((prev) => {
      const next = new Set(prev);
      if (next.has(countryCode)) next.delete(countryCode);
      else next.add(countryCode);
      return next;
    });
  };

  const toggleUnion = (unionKey: string) => {
    setExpandedUnionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(unionKey)) next.delete(unionKey);
      else next.add(unionKey);
      return next;
    });
  };

  // Si el catálogo llega después del primer render (datos asíncronos),
  // inicializar la expansión por defecto sin pisar la interacción del usuario.
  useEffect(() => {
    if (!firstCountryCode) return;
    setExpandedCountryCodes((prev) => (prev.size > 0 ? prev : new Set([firstCountryCode])));
    setExpandedUnionKeys((prev) => (prev.size > 0 || !firstUnionKey ? prev : new Set([firstUnionKey])));
  }, [firstCountryCode, firstUnionKey]);

  useEffect(() => {
    if (selectedUnion && selectedUnion.key !== selectedUnionKey) {
      setSelectedUnionKey(selectedUnion.key);
    }
  }, [selectedUnion, selectedUnionKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const { countryCode, unionKey } = readTournamentsUrlState(window.location.search);
      setSelectedCountryCode(countryCode);
      setSelectedUnionKey(unionKey);
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const selectCountry = (countryCode: string) => {
    setSelectedCountryCode(countryCode);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('pais', countryCode);
    window.history.pushState(null, '', url.toString());
  };

  const selectUnion = (unionKey: string) => {
    setSelectedUnionKey(unionKey);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('union', unionKey);
    window.history.pushState(null, '', url.toString());
  };
  return (
    <Frame className="portal-main--compact" eyebrow="COBERTURA GLOBAL" title="Todos los torneos" intro="Elegí un país, una organización y después el torneo que querés consultar.">
      {status === 'loading' || organizationsStatus === 'loading' ? <p className="portal-live-status">Cargando torneos…</p> : null}
      {status === 'error' || organizationsStatus === 'error' ? <p className="portal-live-status portal-live-status--error">No pudimos cargar todo el catálogo.</p> : null}
      {explorer.length > 0 ? (
        <div className="rugby-catalog-layout">
          <RugbyExplorer
            countries={explorer}
            expandedCountryCodes={expandedCountryCodes}
            expandedUnionKeys={expandedUnionKeys}
            mode="catalog"
            onCountrySelect={(countryCode) => {
              toggleCountry(countryCode);
              selectCountry(countryCode);
            }}
            onUnionSelect={(unionKey) => {
              toggleUnion(unionKey);
              selectUnion(unionKey);
            }}
          />
          <section className="rugby-union-overview">
            {selectedCountry ? (
              <header className="rugby-country-header">
                <div>
                  <small>{selectedCountry.flag} País</small>
                  <h2>{selectedCountry.name}</h2>
                </div>
                <span>{selectedCountry.unions.length} {selectedCountry.unions.length === 1 ? 'organización' : 'organizaciones'}</span>
              </header>
            ) : null}
            {selectedUnion ? (
              <>
                <header>
                  <div><small>Organización</small><h2>{selectedUnion.label}</h2></div>
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
                  <div className="rugby-catalog-empty"><small>Próximamente</small><h3>Cobertura en preparación</h3><p>La organización ya forma parte del catálogo. Sus torneos se publicarán cuando estén verificados.</p></div>
                )}
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </Frame>
  );
}

const PRODE_COMPETITION_SLUG = 'urba-top-14';

export function PredictionPage() {
  const { matches, competition } = useTournament(PRODE_COMPETITION_SLUG);
  const [guesses, setGuesses] = useState<Record<string, { home: string; away: string }>>({});
  const [saved, setSaved] = useState(false);

  const scheduled = matches.filter((match) => match.status === 'scheduled');
  const rounds = groupMatchesByRound(scheduled);
  const nextRound = rounds[0];
  const roundMatches = nextRound?.matches ?? [];
  const closesAt = roundMatches.length > 0
    ? roundMatches.map((match) => match.startsAt).sort()[0]
    : null;

  const setGuess = (matchId: string, side: 'home' | 'away', value: string) => {
    setSaved(false);
    setGuesses((prev) => ({
      ...prev,
      [matchId]: { home: prev[matchId]?.home ?? '0', away: prev[matchId]?.away ?? '0', [side]: value },
    }));
  };

  return (
    <Frame eyebrow="JUGÁ LA FECHA" title="Prode Ovalia" intro="Pronosticá resultados, sumá puntos y competí en rankings generales o privados.">
      <section className="prediction-panel">
        <div className="prediction-heading">
          <div><small>{competition?.name ?? 'URBA TOP 14'}</small><h2>{nextRound?.label ?? 'Sin fecha próxima'}</h2></div>
          {closesAt ? <span>Cierra {formatMatchTime(closesAt)}</span> : null}
        </div>
        {roundMatches.length === 0 ? (
          <p className="portal-live-status">No hay partidos programados para pronosticar todavía.</p>
        ) : (
          roundMatches.map((match) => {
            const guess = guesses[match.id] ?? { home: '0', away: '0' };
            const homeCode = findTeamBadge({ name: match.homeTeam })?.shortCode ?? match.homeTeam.slice(0, 3).toUpperCase();
            const awayCode = findTeamBadge({ name: match.awayTeam })?.shortCode ?? match.awayTeam.slice(0, 3).toUpperCase();
            return (
              <div className="prediction-row" key={match.id}>
                <b><TeamBadge name={match.homeTeam} shortCode={homeCode} badgeUrl={match.homeBadgeUrl ?? undefined} size="small" />{match.homeTeam}</b>
                <label><span>Local</span><input aria-label={`Goles de ${match.homeTeam}`} inputMode="numeric" value={guess.home} onChange={(e) => setGuess(match.id, 'home', e.target.value)} /></label>
                <em>—</em>
                <label><span>Visitante</span><input aria-label={`Goles de ${match.awayTeam}`} inputMode="numeric" value={guess.away} onChange={(e) => setGuess(match.id, 'away', e.target.value)} /></label>
                <b>{match.awayTeam}<TeamBadge name={match.awayTeam} shortCode={awayCode} badgeUrl={match.awayBadgeUrl ?? undefined} size="small" /></b>
              </div>
            );
          })
        )}
        <button className="primary-action" type="button" disabled={roundMatches.length === 0} onClick={() => setSaved(true)}>
          {saved ? 'Pronósticos guardados' : 'Guardar pronósticos'}
        </button>
        <p className="fine-print">5 pts resultado exacto · 3 pts diferencia exacta · 1 pt ganador</p>
      </section>
    </Frame>
  );
}

type TournamentTab = 'posiciones' | 'resultados' | 'calendario';

export function TournamentPage({ slug, initialTab = 'posiciones', initialSeason }: { slug: string; initialTab?: TournamentTab; initialSeason?: string }) {
  const [season, setSeason] = useState<number | undefined>(() => {
    if (!initialSeason) return undefined;
    const parsed = Number(initialSeason);
    return Number.isFinite(parsed) ? parsed : undefined;
  });
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

  // Persistir la temporada elegida en la URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (season) url.searchParams.set('temporada', String(season));
    else url.searchParams.delete('temporada');
    window.history.replaceState(null, '', url.toString());
  }, [season]);

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
  const siblings = sortDivisions(competitions.filter((c) => {
    if (competition.familySlug && c.familySlug) return c.familySlug === competition.familySlug;
    return splitCompetitionName(c.name).familyTitle.toLowerCase() === familyTitle;
  }));
  // Agrupar las divisiones hermanas por categoría real (sin la letra de variante):
  // "Preintermedia B/C/D..." comparten la pill de nivel 1 "Preintermedia".
  const segments: Array<{ key: string; slug: string; divisions: ApiCompetition[] }> = [];
  for (const sibling of siblings) {
    const key = splitCompetitionName(sibling.name).divisionLabel.replace(/\s+[A-Z]$/, '').trim();
    const last = segments[segments.length - 1];
    if (last && last.key === key) last.divisions.push(sibling);
    else segments.push({ key, slug: sibling.slug, divisions: [sibling] });
  }
  const currentSegment = segments.find((segment) => segment.divisions.some((division) => division.slug === slug)) ?? segments[0];
  const rounds = groupMatchesByRound(tab === 'resultados' ? results : upcoming);
  const activeRoundIndex = Math.min(roundIndex, Math.max(rounds.length - 1, 0));
  const activeRound = rounds[activeRoundIndex];

  // Determinar el país/organización para el eyebrow
  const organizationName = competition.organization?.name ?? '';
  const countryCode = competition.countryCode;
  const country = countryCode ? findCountryByCode(countryCode) : undefined;
  const eyebrowText = country 
    ? `${country.flag} ${country.name.toUpperCase()}${organizationName ? ` · ${organizationName}` : ''}`
    : organizationName 
      ? organizationName.toUpperCase()
      : 'TORNEO';

  return (
    <Frame className="tournament-detail" eyebrow={eyebrowText} title={competition.name} intro={`Temporada ${activeSeason ?? ''} · posiciones, resultados y calendario reales.`}>
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

      {segments.length > 1 ? (
        <nav className="tournament-segment-selector" aria-label="Otras categorías de este torneo">
          {segments.map((segment) => (
            <a
              key={segment.slug}
              href={`/torneos/${segment.slug}`}
              className={segment === currentSegment ? 'is-active' : ''}
            >
              <strong>{segment.key}</strong>
            </a>
          ))}
        </nav>
      ) : null}
      {currentSegment && currentSegment.divisions.length > 1 ? (
        <nav className="family-selector" aria-label="Variantes de la categoría activa">
          {currentSegment.divisions.map((division) => (
            <a
              key={division.slug}
              href={`/torneos/${division.slug}`}
              className={division.slug === slug ? 'active' : ''}
            >
              {splitCompetitionName(division.name).divisionLabel}
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
          ) : (
            <>
              {(() => {
                const fallbackTeams = standings?.fallbackTeams && standings.fallbackTeams.length > 0
                  ? standings.fallbackTeams
                  : teamsFromMatches(matches);
                if (fallbackTeams.length === 0) {
                  return <p className="portal-live-status">Todavía no hay posiciones para esta temporada.</p>;
                }
                return (
                  <>
                    <p className="table-card__note">Todavía no hay tabla oficial para esta temporada. Estos son los equipos confirmados, en 0.</p>
                    <div className="standing-row standing-head"><span>#</span><span>Equipo</span><span>PJ</span><span>PTS</span></div>
                    {fallbackTeams.map((team, index) => {
                      const shortCode = findTeamBadge({ name: team.name })?.shortCode ?? team.name.slice(0, 3).toUpperCase();
                      return (
                        <div className="standing-row standing-row--placeholder" key={team.name}>
                          <span>{index + 1}</span>
                          <span className="standing-team">
                            <TeamBadge name={team.name} shortCode={shortCode} badgeUrl={team.badgeUrl ?? undefined} size="small" />
                            {team.name}
                          </span>
                          <span>0</span><span>0</span>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </>
          )}
        </section>
      ) : null}

      {tab === 'resultados' ? (
        <section className="tournament-round-panel">
          {results.length === 0 ? <p className="portal-live-status">Sin resultados todavía.</p> : null}
          {activeRound ? <RoundNavigation index={activeRoundIndex} total={rounds.length} label={activeRound.label} dateLabel={formatRoundDateRange(activeRound.matches)} onChange={setRoundIndex} /> : null}
          {activeRound ? <section className="portal-list tournament-results">{activeRound.matches.map((match) => <PortalMatchRow match={match} key={match.id} />)}</section> : null}
        </section>
      ) : null}

      {tab === 'calendario' ? (
        <section className="tournament-round-panel">
          {upcoming.length === 0 ? <p className="portal-live-status">Sin próximos partidos programados.</p> : null}
          {activeRound ? <RoundNavigation index={activeRoundIndex} total={rounds.length} label={activeRound.label} dateLabel={formatRoundDateRange(activeRound.matches)} onChange={setRoundIndex} /> : null}
          {activeRound ? <section className="portal-list tournament-results">{activeRound.matches.map((match) => <PortalMatchRow match={match} key={match.id} />)}</section> : null}
        </section>
      ) : null}
    </Frame>
  );
}

function RoundNavigation({ index, total, label, dateLabel, onChange }: { index: number; total: number; label: string; dateLabel?: string; onChange: (index: number) => void }) {
  return (
    <div className="round-toolbar" aria-label="Navegación de fechas">
      <button type="button" aria-label="Fecha anterior" disabled={index === 0} onClick={() => onChange(index - 1)}><ArrowLeftIcon /></button>
      <span><small>JORNADA</small><strong>{label}</strong>{dateLabel ? <b className="round-toolbar__date">{dateLabel}</b> : null}<em>{index + 1} / {total}</em></span>
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
  const title = `${match.home.name} vs ${match.away.name}`;
  const statusLabel = live
    ? `EN VIVO · ${live.minute ? `${live.minute} min` : live.phase}`
    : match.status === 'final'
      ? 'RESULTADO FINAL'
      : 'PRÓXIMO PARTIDO';
  const intro = `${match.round} · ${formatMatchTime(match.startsAt)}`;

  return (
    <Frame eyebrow={match.competition.name.toUpperCase()} title={title} intro={intro}>
      <section className="match-hero">
        <p className={`match-hero__status${live ? ' match-hero__status--live' : ''}`}>{statusLabel}</p>
        <div className="match-hero__teams">
          <div className="match-hero__team">
            <TeamBadge name={match.home.name} shortCode={homeCode} badgeUrl={match.home.badgeUrl ?? undefined} size="large" />
            <strong>{match.home.name}</strong>
          </div>
          <div className="match-hero__center">
            {isScored ? (
              <div className="match-hero__score"><b>{homeScore ?? 0}</b><i>—</i><b>{awayScore ?? 0}</b></div>
            ) : (
              <span className="match-hero__vs">VS</span>
            )}
          </div>
          <div className="match-hero__team match-hero__team--away">
            <TeamBadge name={match.away.name} shortCode={awayCode} badgeUrl={match.away.badgeUrl ?? undefined} size="large" />
            <strong>{match.away.name}</strong>
          </div>
        </div>
        {match.venue ? <p className="match-hero__venue">Sede: {match.venue}</p> : null}
        <DataProvenance source={live ? 'highlightly' : match.source} freshness={match.freshness} />
      </section>
    </Frame>
  );
}
