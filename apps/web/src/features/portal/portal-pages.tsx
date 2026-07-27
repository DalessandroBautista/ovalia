'use client';

import { findTeamBadge } from '@ovalia/domain';
import { useEffect, useState } from 'react';

import { ArrowLeftIcon, ArrowRightIcon, RugbyBallIcon } from '../../components/icons';
import { useLiveFeed } from '../../components/live-rail';
import { TeamBadge } from '../../components/team-badge';
import {
  argentinaDateKey,
  filterMatchesByDate,
  formatAgendaDateLabel,
  formatMatchTime,
  matchScore,
  shiftDateKey,
} from '../matches/agenda-data';
import { useAgendaMatches } from '../matches/use-agenda';
import { useMatchDetail } from '../matches/use-match-detail';

const tournamentGroups = [
  { title: 'Argentina · Buenos Aires', items: ['URBA Top 14', 'Primera A', 'Primera B', 'Primera C', 'Segunda', 'Tercera', 'Desarrollo', 'Femenino Top 9'] },
  { title: 'Argentina · Federal', items: ['Torneo del Interior A', 'Torneo del Interior B', 'Nacional de Clubes', 'Super Rugby Américas', 'Seven de la República'] },
  { title: 'Selecciones', items: ['Rugby Championship', 'Six Nations', 'Mundial', 'Mundial Femenino', 'World Rugby U20', 'SVNS'] },
  { title: 'Clubes internacionales', items: ['Top 14', 'Premiership', 'United Rugby Championship', 'Champions Cup', 'Challenge Cup'] }
];

export function PortalHeader() {
  return (
    <><header className="portal-header">
      <a className="portal-brand" href="/" aria-label="Ovalia, inicio"><RugbyBallIcon /> <span>OVALIA</span></a>
      <nav aria-label="Navegación principal">
        <a href="/partidos">Partidos</a><a href="/torneos">Torneos</a><a href="/prodes">Prodes</a><a href="/juegos">Juegos</a><a href="/noticias">Noticias</a>
      </nav>
      <a className="portal-login" href="/ingresar">Ingresar</a>
    </header><a className="back-home" href="/"><ArrowLeftIcon />Volver al inicio</a></>
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

export function MatchesPage({ initialDate }: { initialDate?: string } = {}) {
  const feed = useLiveFeed();
  const [selectedDate, setSelectedDate] = useState(() => initialDate ?? argentinaDateKey());
  const agenda = useAgendaMatches(selectedDate);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('fecha', selectedDate);
    window.history.replaceState(null, '', url.toString());
  }, [selectedDate]);

  const liveMatches = feed.matches.filter((match) => argentinaDateKey(match.startsAt) === selectedDate);
  const liveIds = new Set(liveMatches.map((match) => match.id));
  const scheduledMatches = filterMatchesByDate(agenda.matches, selectedDate).filter((match) => !liveIds.has(match.id));
  return (
    <Frame eyebrow="FIXTURES Y RESULTADOS" title="Centro de partidos" intro="La agenda del rugby argentino, con datos verificados y actualización en vivo.">
      <div className="portal-toolbar">
        <button type="button" aria-label="Día anterior" onClick={() => setSelectedDate((date) => shiftDateKey(date, -1))}><ArrowLeftIcon /></button>
        <strong aria-live="polite">{formatAgendaDateLabel(selectedDate)}</strong>
        <button type="button" aria-label="Día siguiente" onClick={() => setSelectedDate((date) => shiftDateKey(date, 1))}><ArrowRightIcon /></button>
      </div>
      <div className="portal-list">
        {liveMatches.map((match) => <a className="portal-match" href={`/partidos/${match.id}`} key={match.id}><small>{match.competition}</small><span className="live-text">EN VIVO · {match.minute ? `${match.minute}'` : match.phase}</span><div><b><TeamBadge {...match.home} />{match.home.name}</b><strong>{match.homeScore} — {match.awayScore}</strong><b>{match.away.name}<TeamBadge {...match.away} /></b></div></a>)}
        {feed.status === 'loading' ? <p className="portal-live-status">Consultando partidos en vivo…</p> : null}
        {agenda.status === 'loading' ? <p className="portal-live-status">Cargando la agenda…</p> : null}
        {agenda.status === 'error' ? <p className="portal-live-status portal-live-status--error">No pudimos cargar los partidos de esta fecha.</p> : null}
        {agenda.status === 'ready' && liveMatches.length === 0 && scheduledMatches.length === 0 ? <p className="portal-live-status">No hay partidos programados para esta fecha.</p> : null}
        {scheduledMatches.map((match) => {
          const homeCode = findTeamBadge({ name: match.homeTeam })?.shortCode ?? match.homeTeam.slice(0, 3).toUpperCase();
          const awayCode = findTeamBadge({ name: match.awayTeam })?.shortCode ?? match.awayTeam.slice(0, 3).toUpperCase();
          const status = match.status === 'final' ? 'FINAL' : formatMatchTime(match.startsAt);
          return <a className="portal-match" href={`/partidos/${match.id}`} key={match.id}><small>{match.competition} · {match.round}</small><span>{status}</span><div><b><TeamBadge name={match.homeTeam} shortCode={homeCode} />{match.homeTeam}</b><strong>{matchScore(match)}</strong><b>{match.awayTeam}<TeamBadge name={match.awayTeam} shortCode={awayCode} /></b></div></a>;
        })}
      </div>
      {agenda.status === 'ready' && scheduledMatches.length > 0 ? <DataProvenance source={agenda.source} freshness={agenda.freshness} /> : null}
    </Frame>
  );
}

export function TournamentsPage() {
  return (
    <Frame eyebrow="COBERTURA" title="Todos los torneos" intro="Desde cada unión argentina hasta las grandes competencias de selecciones y clubes.">
      <div className="tournament-grid">{tournamentGroups.map((group) => <section className="tournament-group" key={group.title}><h2>{group.title}</h2>{group.items.map((item) => <a href={item === 'URBA Top 14' ? '/torneos/urba-top-14' : '#'} key={item}><span>{item}</span><i>→</i></a>)}</section>)}</div>
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

export function TournamentPage() {
  const rows = [['1','SIC','11','43'],['2','Hindú','11','40'],['3','Newman','11','37'],['4','Alumni','11','36'],['5','CUBA','11','31']];
  return <Frame eyebrow="ARGENTINA · BUENOS AIRES" title="URBA Top 14" intro="Temporada 2026 · resultados, calendario, posiciones, estadísticas y prode."><nav className="tab-bar"><a href="#resultados">Resultados</a><a className="active" href="#posiciones">Posiciones</a><a href="#calendario">Calendario</a><a href="/prodes">Prode</a></nav><section className="table-card"><h2>Tabla de posiciones</h2><div className="standing-row standing-head"><span>#</span><span>Equipo</span><span>PJ</span><span>PTS</span></div>{rows.map((row) => <div className="standing-row" key={row[1]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}</section></Frame>;
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
          <TeamBadge name={match.home.name} shortCode={homeCode} size="large" />
          <strong>{isScored ? `${homeScore ?? 0} — ${awayScore ?? 0}` : '—'}</strong>
          <TeamBadge name={match.away.name} shortCode={awayCode} size="large" />
        </div>
        <h2>{live ? 'Actualización en vivo' : match.status === 'final' ? 'Resultado final' : 'Próximo partido'}</h2>
        {match.venue ? <p>Sede: {match.venue}</p> : null}
        <DataProvenance source={live ? 'highlightly' : match.source} freshness={match.freshness} />
      </section>
    </Frame>
  );
}
