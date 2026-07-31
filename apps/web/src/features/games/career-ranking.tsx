'use client';

import { useState, type FormEvent } from 'react';
import type { ApiCareerEntry, ApiCareerSummary } from '../../lib/api/types';
import type { CareerRun } from './use-career-run';
import { useCareerRanking } from './use-career-ranking';

export interface CareerRankingProps {
  run?: CareerRun | null;
  summary?: ApiCareerSummary | null;
  onPublished?: (entry: ApiCareerEntry) => void;
}

export function CareerRanking({ run, summary, onPublished }: CareerRankingProps) {
  const { top, myEntry, error, publish } = useCareerRanking();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [publishing, setPublishing] = useState(false);

  const canPublish = displayName.trim().length > 0 && !publishing;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!run || !summary || !canPublish) return;
    setPublishing(true);
    const entry = await publish({
      displayName: displayName.trim(),
      surname: run.input.surname,
      position: run.input.position,
      clubSlug: run.input.clubSlug,
      seed: run.seed,
      decisions: run.decisions,
      summary,
      history: run.state.history,
    });
    if (entry) onPublished?.(entry);
    setPublishing(false);
  };

  return (
    <section className="game-stage ranking">
      <p className="eyebrow">RANKING</p>
      <h2>Top 10</h2>
      <p className="portal-intro">Las carreras mejor puntuadas publicadas por la comunidad.</p>
      {top.length === 0 && <p>Aún no hay publicaciones. ¡La primera puede ser la tuya!</p>}
      <ol className="ranking-list">
        {top.map((entry, index) => (
          <li key={entry.id} className={myEntry?.id === entry.id ? 'ranking-entry mine' : 'ranking-entry'}>
            <span className="ranking-position">{index + 1}</span>
            <b>{entry.displayName}</b>
            <span className="ranking-score">Score {entry.score}</span>
            {myEntry?.id === entry.id && <small>ESTA SOY YO</small>}
          </li>
        ))}
      </ol>
      {!myEntry && (
        <>
          <button onClick={() => setOpen((value) => !value)}>Publicar en el ranking</button>
          {open && (
            <form className="career-form" onSubmit={submit}>
              <label className="attribute">
                <span>Apodo</span>
                <input
                  value={displayName}
                  maxLength={24}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Elegí tu apodo (máx. 24)"
                />
              </label>
              <button type="submit" disabled={!canPublish}>
                Confirmar
              </button>
            </form>
          )}
        </>
      )}
      {error && <p className="ranking-error">{error}</p>}
    </section>
  );
}
