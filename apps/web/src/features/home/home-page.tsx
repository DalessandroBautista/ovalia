'use client';

import { findTeamBadge } from '@ovalia/domain';
import { useRef, useState } from 'react';

import { DiamondIcon, HomeIcon, RugbyBallIcon, SearchIcon, TargetIcon, UserIcon, ClockIcon } from '../../components/icons';
import { LiveRailView, type LiveFeedPayload, type UpcomingRailMatch, useLiveFeed, formatUpcomingTime } from '../../components/live-rail';
import { TeamBadge } from '../../components/team-badge';
import {
  argentinaDateKey,
  buildCalendarDays,
  filterMatchesByDate,
  formatMatchTime,
  groupMatchesByCompetition,
  matchScore,
  shiftDateKey,
  sortAgendaGroups,
  type AgendaMatch,
} from '../matches/agenda-data';
import { useAgendaMatches } from '../matches/use-agenda';
import { useUpcomingMatches } from '../matches/use-upcoming';
import { useCompetitions } from '../tournaments/use-tournaments';
import { useCountdown, useHome } from './use-home';
import type { ApiHomeResponse, ApiMatch } from '../../lib/api/types';

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

function toUpcomingRailMatches(matches: ApiMatch[]): UpcomingRailMatch[] {
  return matches.map((m) => ({
    id: m.id,
    competition: m.competition.name,
    startsAt: m.startsAt,
    home: { name: m.home.name, shortCode: m.home.shortName, badgeUrl: m.home.badgeUrl ?? undefined },
    away: { name: m.away.name, shortCode: m.away.shortName, badgeUrl: m.away.badgeUrl ?? undefined },
  }));
}

export function FeaturedMatch({ feed, upcoming = [] }: { feed: LiveFeedPayload; upcoming?: UpcomingRailMatch[] }) {
  const match = feed.matches[0];
  if (!match) {
    const next = upcoming[0];
    if (next) {
      return (
        <article className="featured-match">
          <div className="featured-match__topline">
            <span>PRÓXIMO PARTIDO IMPORTANTE</span>
            <span>{next.competition}</span>
          </div>
          <div className="featured-match__score">
            <div className="featured-team">
              <TeamBadge name={next.home.name} shortCode={next.home.shortCode} badgeUrl={next.home.badgeUrl} size="large" />
              <div><small>{next.home.shortCode}</small><h2>{next.home.name}</h2></div>
            </div>
            <div className="scoreboard"><b>{formatUpcomingTime(next.startsAt)}</b></div>
            <div className="featured-team featured-team--away">
              <div><small>{next.away.shortCode}</small><h2>{next.away.name}</h2></div>
              <TeamBadge name={next.away.name} shortCode={next.away.shortCode} badgeUrl={next.away.badgeUrl} size="large" />
            </div>
          </div>
          <a className="match-link" href={`/partidos/${next.id}`}>Ver detalle <span>↗</span></a>
        </article>
      );
    }
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

function Hero({ feed, home, upcoming = [] }: { feed: LiveFeedPayload; home: ApiHomeResponse | null; upcoming?: UpcomingRailMatch[] }) {
  return (
    <section className="hero" id="inicio">
      <div className="hero__copy">
        <p className="eyebrow">TODO EL RUGBY. UN SOLO LUGAR.</p>
        <h1>Donde el rugby pasa, <em>Ovalia lo cuenta.</em></h1>
        <p className="hero__intro">Resultados, historias y comunidad. Desde tu club hasta el escenario mundial.</p>
        <div className="hero__stats" aria-label="Cobertura de Ovalia">
          <div><strong>{home?.stats.competitions ?? '—'}</strong><span>torneos</span></div>
          <div><strong>{home?.stats.clubs ?? '—'}</strong><span>clubes</span></div>
          <div><strong>{home?.stats.live ?? feed.matches.length}</strong><span>en vivo</span></div>
        </div>
      </div>
      <FeaturedMatch feed={feed} upcoming={upcoming} />
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
      <div className="match-row__team"><TeamBadge name={match.homeTeam} shortCode={teamCode(match.homeTeam)} badgeUrl={match.homeBadgeUrl ?? undefined} /><b>{match.homeTeam}</b></div>
      <time dateTime={match.startsAt}>{isScored ? matchScore(match) : formatMatchTime(match.startsAt)}</time>
      <div className="match-row__team match-row__team--away"><b>{match.awayTeam}</b><TeamBadge name={match.awayTeam} shortCode={teamCode(match.awayTeam)} badgeUrl={match.awayBadgeUrl ?? undefined} /></div>
      <span className="row-arrow">›</span>
    </a>
  );
}

function PillScroller({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollBy = (amount: number) => trackRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  return (
    <div className="pill-scroller">
      <button type="button" className="pill-scroller__arrow" aria-label="Ver anteriores" onClick={() => scrollBy(-220)}>←</button>
      <div className="pill-scroller__track" ref={trackRef}>{children}</div>
      <button type="button" className="pill-scroller__arrow" aria-label="Ver siguientes" onClick={() => scrollBy(220)}>→</button>
    </div>
  );
}

function Agenda() {
  const [selectedDate, setSelectedDate] = useState(() => argentinaDateKey());
  const agenda = useAgendaMatches(selectedDate);
  const { competitions } = useCompetitions();
  const flagshipSlugs = new Set(competitions.filter((c) => c.tier === 'senior').map((c) => c.slug));
  const priorityBySlug = new Map(competitions.map((c) => [c.slug, c.priority]));
  const allGroups = groupMatchesByCompetition(filterMatchesByDate(agenda.matches, selectedDate));
  // Solo se listan los torneos insignia (Superior/Primera); Intermedia, Preintermedia
  // y juveniles se ven entrando al torneo específico en /torneos, no acá.
  const groups = sortAgendaGroups(allGroups
    .filter((g) => {
      const slug = g.matches[0]?.competitionSlug;
      return !slug || flagshipSlugs.size === 0 || flagshipSlugs.has(slug);
    }), priorityBySlug);
  const [selectedCompetition, setSelectedCompetition] = useState<string | undefined>(undefined);
  const today = argentinaDateKey();
  const activeGroup = groups.find((g) => g.competition === selectedCompetition) ?? groups[0];

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
      {groups.length > 1 ? (
        <PillScroller>
          <nav className="agenda-competition-selector" aria-label="Elegir torneo">
            {groups.map((group) => (
              <button
                type="button"
                key={group.competition}
                className={group.competition === activeGroup?.competition ? 'active' : ''}
                onClick={() => setSelectedCompetition(group.competition)}
              >
                {group.competition}
              </button>
            ))}
          </nav>
        </PillScroller>
      ) : null}
      {activeGroup ? (
        <article className="competition" key={`${activeGroup.competition}-${activeGroup.round}`}>
          <header>
            <div className="competition__identity"><span className="competition__mark">XV</span><div><h3>{activeGroup.competition}</h3><p>{activeGroup.round}</p></div></div>
            <a href="/torneos">Ver torneo <span>↗</span></a>
          </header>
          <div>{activeGroup.matches.map((match) => <MatchRow match={match} key={match.id} />)}</div>
        </article>
      ) : null}
    </section>
  );
}

function ProdeCard({ home }: { home: ApiHomeResponse | null }) {
  const contest = home?.contest ?? null;
  const countdown = useCountdown(contest?.closesAt);
  if (!contest) {
    return (
      <section className="prode-card" id="prodes">
        <p className="eyebrow">PRODE</p>
        <h2>Pronto vas a poder jugar la fecha.</h2>
        <p>Todavía no hay un concurso abierto. Cuando se abra, aparece acá.</p>
      </section>
    );
  }
  return (
    <section className="prode-card" id="prodes">
      <p className="eyebrow">PRODE{contest.round ? ` · ${contest.round}` : ''}</p>
      <h2>Tu lectura del partido también juega.</h2>
      <p>{contest.name}</p>
      {countdown ? <div className="prode-card__meta"><span>Cierra en</span><b>{countdown}</b></div> : null}
      <a href="/prodes">Hacer mis pronósticos <span>→</span></a>
    </section>
  );
}

function NewsCard({ home }: { home: ApiHomeResponse | null }) {
  const article = home?.featuredArticle ?? null;
  if (!article) {
    return (
      <section className="news-card" id="noticias">
        <div className="news-card__body">
          <p className="eyebrow">NOTICIAS</p>
          <h3>Sin notas publicadas todavía</h3>
          <p>El equipo editorial está preparando las primeras historias.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="news-card" id="noticias">
      <div className="news-card__label">ANÁLISIS</div>
      <div className="news-card__body">
        <p className="eyebrow">LA PIZARRA</p>
        <h3>{article.title}</h3>
        <p>{article.summary}</p>
        <a href={`/noticias/${article.slug}`}>Leer nota →</a>
      </div>
    </section>
  );
}

function Sidebar({ home }: { home: ApiHomeResponse | null }) {
  return (
    <aside className="sidebar">
      <ProdeCard home={home} />
      <NewsCard home={home} />
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
  const home = useHome();
  const upcoming = useUpcomingMatches(5);
  const upcomingRail = toUpcomingRailMatches(upcoming.matches);
  return (
    <>
      <LiveRailView feed={liveFeed} upcoming={upcomingRail} />
      <div className="page-shell">
        <Header />
        <main>
          <Hero feed={liveFeed} home={home.data} upcoming={upcomingRail} />
          <div className="content-grid">
            <Agenda />
            <Sidebar home={home.data} />
          </div>
        </main>
        <footer className="site-footer"><span><BallMark /> OVALIA</span><p>El rugby entero, en un solo pulso.</p><small>© {new Date().getFullYear()} Ovalia</small></footer>
      </div>
      <BottomNav />
    </>
  );
}
