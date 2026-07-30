'use client';

import { findTeamBadge } from '@ovalia/domain';
import { useCallback, useRef, useState } from 'react';

import { TeamBadge } from '../../components/team-badge';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import type { ApiFormResult, ApiMatchContext, ApiTeamPosition } from '../../lib/api/types';
import { formatMatchTime, type AgendaMatch } from './agenda-data';
import { useMatchContext } from './use-match-context';

type MatchContextTab = 'form' | 'history' | 'standings';

const TAB_LABELS: Array<{ key: MatchContextTab; label: string }> = [
  { key: 'form', label: 'Forma' },
  { key: 'history', label: 'Historial' },
  { key: 'standings', label: 'Posiciones' },
];

function teamCode(team: string): string {
  return findTeamBadge({ name: team })?.shortCode ?? team.slice(0, 3).toUpperCase();
}

function matchStatus(match: AgendaMatch): string {
  if (match.status === 'live') return 'EN VIVO';
  if (match.status === 'final') return 'FINAL';
  if (match.status === 'postponed') return 'POSTERGADO';
  if (match.status === 'cancelled') return 'CANCELADO';
  return formatMatchTime(match.startsAt);
}

function FormStrip({ results }: { results: ApiFormResult[] }) {
  if (results.length === 0) return <p className="match-modal__empty">Sin partidos anteriores</p>;
  const labels: Record<ApiFormResult, string> = { win: 'Ganó', draw: 'Empató', loss: 'Perdió' };
  return (
    <div className="match-form-strip" aria-label="Últimos resultados">
      {results.map((result, index) => (
        <span className={`is-${result}`} title={labels[result]} key={`${result}-${index}`}>
          {result === 'win' ? 'G' : result === 'draw' ? 'E' : 'P'}
        </span>
      ))}
    </div>
  );
}

function FormPanel({ match, context }: { match: AgendaMatch; context: ApiMatchContext | null }) {
  return (
    <div className="match-modal__form-grid">
      <section>
        <small>Local</small>
        <h3>{match.homeTeam}</h3>
        <FormStrip results={context?.form.home ?? []} />
      </section>
      <section>
        <small>Visitante</small>
        <h3>{match.awayTeam}</h3>
        <FormStrip results={context?.form.away ?? []} />
      </section>
    </div>
  );
}

function HistoryPanel({ context }: { context: ApiMatchContext | null }) {
  const history = context?.headToHead;
  if (!history || history.played === 0) {
    return <p className="match-modal__empty">Sin enfrentamientos previos registrados</p>;
  }
  return (
    <div className="match-history">
      <p className="match-history__summary">{history.played} partidos entre ambos</p>
      <div className="match-history__balance" aria-label="Balance histórico">
        <span><b>{history.homeWins}</b> local</span>
        <span><b>{history.draws}</b> empates</span>
        <span><b>{history.awayWins}</b> visitante</span>
      </div>
      <ol className="match-history__recent">
        {history.recent.map((pastMatch) => (
          <li key={pastMatch.id}>
            <time dateTime={pastMatch.startsAt}>{new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(pastMatch.startsAt))}</time>
            <span>{pastMatch.homeTeamSlug.replaceAll('-', ' ')}</span>
            <strong>{pastMatch.homeScore}–{pastMatch.awayScore}</strong>
            <span>{pastMatch.awayTeamSlug.replaceAll('-', ' ')}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PositionCard({ team, side, position }: { team: string; side: string; position: ApiTeamPosition | null }) {
  return (
    <section className="match-position-card">
      <small>{side}</small>
      <h3>{team}</h3>
      {position ? (
        <div><strong>{position.position}°</strong><span>{position.points} pts · {position.played} PJ</span></div>
      ) : (
        <p>Este equipo no figura en la tabla</p>
      )}
    </section>
  );
}

function StandingsPanel({ match, context }: { match: AgendaMatch; context: ApiMatchContext | null }) {
  return (
    <div className="match-modal__positions">
      <PositionCard team={match.homeTeam} side="Local" position={context?.standings.home ?? null} />
      <PositionCard team={match.awayTeam} side="Visitante" position={context?.standings.away ?? null} />
    </div>
  );
}

export function MatchModal({ match, onClose }: { match: AgendaMatch; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<MatchContextTab>('form');
  const dialogRef = useRef<HTMLElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  const { status, context } = useMatchContext(match.id);
  useFocusTrap({ active: true, containerRef: dialogRef, onEscape: close });

  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const loading = status === 'loading';

  return (
    <div className="match-modal-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <section
        className="match-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${match.homeTeam} contra ${match.awayTeam}`}
      >
        <header className="match-modal__header">
          <div className="match-modal__meta">
            <span>{match.competition}</span>
            <small>{match.round} · {matchStatus(match)}</small>
          </div>
          <button className="match-modal__close" type="button" aria-label="Cerrar" onClick={close}>×</button>
          <div className="match-modal__score">
            <div className="match-modal__team">
              <TeamBadge name={match.homeTeam} shortCode={teamCode(match.homeTeam)} badgeUrl={match.homeBadgeUrl ?? undefined} />
              <strong>{match.homeTeam}</strong>
            </div>
            <div className="match-modal__numbers" aria-label={hasScore ? `Resultado ${match.homeScore} a ${match.awayScore}` : 'Partido sin resultado'}>
              {hasScore ? <><b>{match.homeScore}</b><i>—</i><b>{match.awayScore}</b></> : <em>VS</em>}
            </div>
            <div className="match-modal__team match-modal__team--away">
              <TeamBadge name={match.awayTeam} shortCode={teamCode(match.awayTeam)} badgeUrl={match.awayBadgeUrl ?? undefined} />
              <strong>{match.awayTeam}</strong>
            </div>
          </div>
        </header>

        <nav className="match-modal__tabs" aria-label="Información del partido">
          {TAB_LABELS.map((tab) => (
            <button
              className={activeTab === tab.key ? 'is-active' : ''}
              type="button"
              aria-pressed={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              key={tab.key}
            >{tab.label}</button>
          ))}
        </nav>

        <div className="match-modal__body" aria-live="polite">
          {loading ? <p className="match-modal__loading">Cargando contexto…</p> : null}
          {!loading && activeTab === 'form' ? <FormPanel match={match} context={context} /> : null}
          {!loading && activeTab === 'history' ? <HistoryPanel context={context} /> : null}
          {!loading && activeTab === 'standings' ? <StandingsPanel match={match} context={context} /> : null}
        </div>

        <footer className="match-modal__footer">
          <span>Datos deportivos disponibles al momento</span>
          <a href={`/partidos/${encodeURIComponent(match.id)}`}>Ficha completa <span aria-hidden="true">→</span></a>
        </footer>
      </section>
    </div>
  );
}
