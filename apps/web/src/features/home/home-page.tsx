'use client';

import { findTeamBadge } from '@ovalia/domain';
import { useState } from 'react';

import { DiamondIcon, HomeIcon, RugbyBallIcon, SearchIcon, TargetIcon, UserIcon, ClockIcon } from '../../components/icons';
import { LiveRailView, type LiveFeedPayload, useLiveFeed } from '../../components/live-rail';
import { TeamBadge } from '../../components/team-badge';
import {
  argentinaDateKey,
  buildCalendarDays,
  filterMatchesByDate,
  formatMatchTime,
  groupMatchesByCompetition,
  matchScore,
  shiftDateKey,
  type AgendaMatch,
} from '../matches/agenda-data';
import { useAgendaMatches } from '../matches/use-agenda';

export function BallMark() {
  return (
    <span className="ball-mark" aria-hidden="true">
      <RugbyBallIcon />
    </span>
  );
}

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Ovalia, inicio">
        <BallMark /> <span>OVALIA</span>
      </a>
      <nav className="desktop-nav" aria-label="Navegación principal">
        <a className="is-active" href="/partidos">Partidos</a>
        <a href="/torneos">Torneos</a>
        <a href="/prodes">Prodes</a>
        <a href="/juegos">Juegos</a>
        <a href="/noticias">Noticias</a>
      </nav>
      <div className="header-actions">
        <button className="icon-button" type="button" aria-label="Buscar"><SearchIcon /></button>
        <button className="language-button" type="button">ES <span>⌄</span></button>
        <a className="login-button" href="/ingresar">Ingresar</a>
      </div>
    </header>
  );
}

function FeaturedMatch({ feed }: { feed: LiveFeedPayload }) {
  const match = feed.matches[0];
  if (!match) {
    const message = feed.status === 'loading'
      ? 'Consultando partidos en vivo'
      : feed.status === 'error'
        ? 'Datos en vivo temporalmente no disponibles'
        : 'No hay partidos en vivo ahora';
    return (
      <article className="featured-match featured-match--empty">
        <div className="featured-match__topline"><span>VIVO OVALIA</span><span>FUENTE VERIFICADA</span></div>
        <div className="live-empty-hero"><RugbyBallIcon /><p className="eyebrow">ESTADO DEL FEED</p><h2>{message}</h2><p>Cuando comience un partido cubierto, el marcador aparecerá acá automáticamente.</p></div>
        <a className="match-link" href="/partidos">Ver agenda completa <span>↗</span></a>
      </article>
    );
  }
  return (
    <article className="featured-match">
      <div className="featured-match__topline">
        <span><i /> EN VIVO · {match.minute ? `${match.minute}'` : match.phase}</span>
        <span>{match.competition}</span>
      </div>
      <div className="featured-match__score">
        <div className="featured-team">
          <TeamBadge {...match.home} size="large" />
          <div><small>{match.home.shortCode}</small><h2>{match.home.name}</h2></div>
        </div>
        <div className="scoreboard"><b>{match.homeScore}</b><span>—</span><b>{match.awayScore}</b></div>
        <div className="featured-team featured-team--away">
          <div><small>{match.away.shortCode}</small><h2>{match.away.name}</h2></div>
          <TeamBadge {...match.away} size="large" />
        </div>
      </div>
      <div className="featured-match__events">
        <span>{match.phase}</span>
        <span>Fuente: {feed.source === 'highlightly' ? 'Highlightly' : 'Ovalia verificado'}</span>
      </div>
      <a className="match-link" href={`/partidos/${match.id}`}>Seguir minuto a minuto <span>↗</span></a>
    </article>
  );
}

function Hero({ feed }: { feed: LiveFeedPayload }) {
  return (
    <section className="hero" id="inicio">
      <div className="hero__copy">
        <p className="eyebrow">TODO EL RUGBY. UN SOLO LUGAR.</p>
        <h1>Donde el rugby pasa, <em>Ovalia lo cuenta.</em></h1>
        <p className="hero__intro">Resultados, historias y comunidad. Desde tu club hasta el escenario mundial.</p>
        <div className="hero__stats" aria-label="Cobertura de Ovalia">
          <div><strong>26</strong><span>torneos</span></div>
          <div><strong>184</strong><span>clubes</span></div>
          <div><strong>{feed.matches.length}</strong><span>en vivo</span></div>
        </div>
      </div>
      <FeaturedMatch feed={feed} />
    </section>
  );
}

function DatePicker({ selectedDate, onSelect }: { selectedDate: string; onSelect: (date: string) => void }) {
  const days = buildCalendarDays(selectedDate);
  return (
    <div className="date-picker" aria-label="Seleccionar fecha">
      <button type="button" aria-label="Fecha anterior" onClick={() => onSelect(shiftDateKey(selectedDate, -1))}>←</button>
      {days.map((day) => (
        <button
          aria-label={`Ver partidos del ${day.key}`}
          aria-pressed={day.isSelected}
          className={day.isSelected ? 'is-selected' : ''}
          type="button"
          key={day.key}
          onClick={() => onSelect(day.key)}
        >
          <span>{day.weekday}</span><b>{day.dayNumber}</b>{day.isToday ? <small>HOY</small> : null}
        </button>
      ))}
      <button type="button" aria-label="Fecha siguiente" onClick={() => onSelect(shiftDateKey(selectedDate, 1))}>→</button>
    </div>
  );
}

function teamCode(team: string): string {
  return findTeamBadge({ name: team })?.shortCode ?? team.slice(0, 3).toUpperCase();
}

function MatchRow({ match }: { match: AgendaMatch }) {
  const isScored = match.status === 'final' || match.status === 'live';
  return (
    <a className="match-row" href={`/partidos/${match.id}`}>
      <div className="match-row__team"><TeamBadge name={match.homeTeam} shortCode={teamCode(match.homeTeam)} /><b>{match.homeTeam}</b></div>
      <time dateTime={match.startsAt}>{isScored ? matchScore(match) : formatMatchTime(match.startsAt)}</time>
      <div className="match-row__team match-row__team--away"><b>{match.awayTeam}</b><TeamBadge name={match.awayTeam} shortCode={teamCode(match.awayTeam)} /></div>
      <span className="row-arrow">›</span>
    </a>
  );
}

function Agenda() {
  const [selectedDate, setSelectedDate] = useState(() => argentinaDateKey());
  const agenda = useAgendaMatches();
  const groups = groupMatchesByCompetition(filterMatchesByDate(agenda.matches, selectedDate));
  const today = argentinaDateKey();
  return (
    <section className="agenda" id="partidos">
      <div className="section-heading">
        <div><p className="eyebrow">AGENDA</p><h2>{selectedDate === today ? 'Partidos de hoy' : 'Partidos del día'}</h2></div>
        <a href="/partidos">Ver calendario completo <span>↗</span></a>
      </div>
      <DatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
      {agenda.status === 'loading' ? <p className="agenda-status">Cargando la agenda…</p> : null}
      {agenda.status === 'error' ? <p className="agenda-status agenda-status--error">No pudimos cargar la agenda. Intentá nuevamente en unos minutos.</p> : null}
      {agenda.status === 'ready' && groups.length === 0 ? <p className="agenda-status">No hay partidos programados para esta fecha.</p> : null}
      {groups.map((group) => (
        <article className="competition" key={`${group.competition}-${group.round}`}>
          <header>
            <div className="competition__identity"><span className="competition__mark">XV</span><div><h3>{group.competition}</h3><p>{group.round}</p></div></div>
            <a href="/torneos">Ver torneo <span>↗</span></a>
          </header>
          <div>{group.matches.map((match) => <MatchRow match={match} key={match.id} />)}</div>
        </article>
      ))}
    </section>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <section className="prode-card" id="prodes">
        <div className="prode-card__art"><span>?</span><span>5</span><span>3</span></div>
        <p className="eyebrow">PRODE · FECHA 17</p>
        <h2>Tu lectura del partido también juega.</h2>
        <p>Pronosticá la fecha del URBA Top 14 y medite con toda la comunidad.</p>
        <div className="prode-card__meta"><span>Cierra en</span><b>01:42:18</b></div>
        <a href="/prodes">Hacer mis pronósticos <span>→</span></a>
      </section>
      <section className="news-card" id="noticias">
        <div className="news-card__label">ANÁLISIS</div>
        <div className="news-card__field" aria-hidden="true"><i /><i /><i /></div>
        <div className="news-card__body">
          <p className="eyebrow">LA PIZARRA</p>
          <h3>El maul argentino encontró una nueva marcha</h3>
          <p>Las claves del ajuste que cambió el partido en Mendoza.</p>
          <span>Por Equipo Ovalia · 6 min</span>
        </div>
      </section>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navegación móvil">
      <a className="is-active" href="/"><HomeIcon />Inicio</a>
      <a href="/partidos"><ClockIcon />Partidos</a>
      <a href="/prodes"><TargetIcon />Prode</a>
      <a href="/juegos"><DiamondIcon />Juegos</a>
      <a href="/ingresar"><UserIcon />Perfil</a>
    </nav>
  );
}

export function HomePage() {
  const liveFeed = useLiveFeed();
  return (
    <>
      <LiveRailView feed={liveFeed} />
      <div className="page-shell">
        <Header />
        <main>
          <Hero feed={liveFeed} />
          <div className="content-grid">
            <Agenda />
            <Sidebar />
          </div>
        </main>
        <footer className="site-footer"><span><BallMark /> OVALIA</span><p>El rugby entero, en un solo pulso.</p><small>© 2026 Ovalia</small></footer>
      </div>
      <BottomNav />
    </>
  );
}
