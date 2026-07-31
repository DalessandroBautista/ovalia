'use client';

import { useState } from 'react';
import {
  FALLBACK_CATALOG,
  summarizeCareer,
  type CareerPosition,
  type SeasonRecord,
} from '@ovalia/domain';
import type { ApiCareerEntry, ApiCareerSeasonRecord } from '../../lib/api/types';
import { CareerCard } from './career-card';
import { CareerRanking } from './career-ranking';
import { useCareerClubs } from './use-career-clubs';
import { useCareerRun } from './use-career-run';

const CAREER_POSITIONS: Array<{ value: CareerPosition; label: string }> = [
  { value: 'pilar', label: 'Pilar' },
  { value: 'hooker', label: 'Hooker' },
  { value: 'segunda', label: 'Segunda línea' },
  { value: 'ala', label: 'Ala' },
  { value: 'octavo', label: 'Octavo' },
  { value: 'medio-scrum', label: 'Medio scrum' },
  { value: 'apertura', label: 'Apertura' },
  { value: 'centro', label: 'Centro' },
  { value: 'wing', label: 'Wing' },
  { value: 'fullback', label: 'Fullback' },
];

function recordToApi(record: SeasonRecord): ApiCareerSeasonRecord {
  return {
    season: record.season,
    age: record.age,
    clubSlug: record.clubSlug,
    clubName: record.clubName,
    level: record.level,
    rating: record.rating,
    note: record.note,
  };
}

export interface CareerGameProps {
  initialSeed?: number;
  initialPosition?: CareerPosition;
}

export function CareerGame({ initialSeed, initialPosition }: CareerGameProps) {
  const { clubs } = useCareerClubs();
  const { run, phase, prompt, createRun, choose, advance, reset } = useCareerRun();
  const [surname, setSurname] = useState('');
  const [clubSlug, setClubSlug] = useState('');
  const [position, setPosition] = useState<CareerPosition>(initialPosition ?? 'pilar');
  const [myEntry, setMyEntry] = useState<ApiCareerEntry | null>(null);

  const catalogClubs = clubs.length > 0 ? clubs : FALLBACK_CATALOG.clubs;
  const effectiveClubSlug = clubSlug || catalogClubs[0]?.slug || '';
  const summary = run && phase === 'retired' ? summarizeCareer(run.state) : null;

  if (!run) {
    return (
      <section className="game-stage">
        <p className="eyebrow">CREACIÓN</p>
        <h2>Arrancá tu carrera</h2>
        <p>Tu apellido, el club donde empezás y el puesto que ocupás en la cancha.</p>
        <form
          className="career-form"
          onSubmit={(event) => {
            event.preventDefault();
            createRun(
              { surname: surname.trim(), position, clubSlug: effectiveClubSlug },
              initialSeed ?? Math.floor(Math.random() * 2 ** 31),
              { clubs: catalogClubs },
            );
          }}
        >
          <label className="attribute">
            <span>Apellido</span>
            <input value={surname} onChange={(event) => setSurname(event.target.value)} />
          </label>
          <label className="attribute">
            <span>Club</span>
            <select value={effectiveClubSlug} onChange={(event) => setClubSlug(event.target.value)}>
              {catalogClubs.map((club) => (
                <option key={club.slug} value={club.slug}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>
          <label className="attribute">
            <span>Posición</span>
            <select value={position} onChange={(event) => setPosition(event.target.value as CareerPosition)}>
              {CAREER_POSITIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Empezar la carrera</button>
        </form>
      </section>
    );
  }

  if (phase === 'decision' && prompt) {
    return (
      <section className="game-stage">
        <p className="eyebrow">LA CARRERA DE {run.input.surname.toUpperCase()}</p>
        <h2>{prompt.title}</h2>
        <p>{prompt.subtitle}</p>
        <div>
          {prompt.options.map((option, index) => (
            <button key={option.label} onClick={() => choose(index)}>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (phase === 'season') {
    const record = run.state.history.at(-1);
    return (
      <section className="game-stage">
        <p className="eyebrow">LA CARRERA DE {run.input.surname.toUpperCase()}</p>
        {record && (
          <div className="game-result compact">
            <small>TEMPORADA {record.season}</small>
            <h2>{record.clubName}</h2>
            <strong>
              Rating {record.rating} · {record.age} años
            </strong>
            <p>{record.note}</p>
          </div>
        )}
        <button onClick={advance}>Siguiente temporada</button>
      </section>
    );
  }

  if (phase === 'retired' && summary) {
    return (
      <>
        <section className="game-stage">
          <p className="eyebrow">RETIRO</p>
          <CareerCard
            summary={summary}
            history={run.state.history.map(recordToApi)}
            displayName={run.input.surname}
            position={run.input.position}
            entry={myEntry ?? undefined}
          />
          <button onClick={reset}>Jugar de nuevo</button>
        </section>
        <CareerRanking run={run} summary={summary} onPublished={setMyEntry} />
      </>
    );
  }

  return null;
}
