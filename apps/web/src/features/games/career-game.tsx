'use client';

import { useState } from 'react';
import {
  FALLBACK_CATALOG,
  effectTone,
  summarizeCareer,
  type CareerPosition,
  type CareerState,
  type SeasonRecord,
} from '@ovalia/domain';
import type { ApiCareerEntry, ApiCareerSeasonRecord } from '../../lib/api/types';
import { TeamBadge } from '../../components/team-badge';
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
    tries: record.tries,
    matchesPlayed: record.matchesPlayed,
    injury: record.injury,
    selected: record.selected,
  };
}

const EFFECT_ICON: Record<'positivo' | 'negativo' | 'neutro', string> = {
  positivo: '▲',
  negativo: '▼',
  neutro: '●',
};

/**
 * Estado compacto y persistente durante la carrera: sin esto el jugador avanza
 * a ciegas, sin saber su edad, club, división ni cómo lo ve la hinchada.
 */
function CareerHud({ state }: { state: CareerState }) {
  return (
    <div className="career-hud">
      <TeamBadge name={state.club.name} shortCode={state.club.name} badgeUrl={state.club.badgeUrl ?? undefined} />
      <div className="career-hud__club">
        <strong>{state.club.name}</strong>
        <small>División {state.club.level}</small>
      </div>
      <dl className="career-hud__stats">
        <div>
          <dt>Edad</dt>
          <dd>{state.age}</dd>
        </div>
        <div>
          <dt>Media</dt>
          <dd>{state.overall}</dd>
        </div>
        <div>
          <dt>Moral</dt>
          <dd>{state.morale}</dd>
        </div>
        <div>
          <dt>Hinchada</dt>
          <dd>{state.support}</dd>
        </div>
      </dl>
    </div>
  );
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
          <fieldset className="club-offer">
            <legend>Club</legend>
            <div className="club-offer__grid" role="radiogroup" aria-label="Elegí el club donde empezás">
              {catalogClubs.map((club) => (
                <button
                  key={club.slug}
                  type="button"
                  className={`club-offer__card${club.slug === effectiveClubSlug ? ' is-selected' : ''}`}
                  role="radio"
                  aria-checked={club.slug === effectiveClubSlug}
                  onClick={() => setClubSlug(club.slug)}
                >
                  <TeamBadge name={club.name} shortCode={club.name} badgeUrl={club.badgeUrl ?? undefined} />
                  <strong>{club.name}</strong>
                  <small>División {club.level}</small>
                </button>
              ))}
            </div>
          </fieldset>
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
        <CareerHud state={run.state} />
        <h2>{prompt.title}</h2>
        <p>{prompt.subtitle}</p>
        <div>
          {prompt.options.map((option, index) => {
            const tone = effectTone(option.effect);
            return (
              <button
                key={option.label}
                className={`career-option career-option--${tone}`}
                onClick={() => choose(index)}
              >
                <span className={`career-option__tag career-option__tag--${tone}`} aria-hidden="true">
                  {EFFECT_ICON[tone]}
                </span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (phase === 'season') {
    const record = run.state.history.at(-1);
    return (
      <section className="game-stage">
        <p className="eyebrow">LA CARRERA DE {run.input.surname.toUpperCase()}</p>
        <CareerHud state={run.state} />
        {record && (
          <div className="game-result compact">
            <small>TEMPORADA {record.season}</small>
            <h2>{record.clubName}</h2>
            <strong>
              Rating {record.rating} · {record.age} años
            </strong>
            <p>
              {record.matchesPlayed} partidos · {record.tries} tries
              {record.selected ? ' · Convocado a la selección' : ''}
            </p>
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
