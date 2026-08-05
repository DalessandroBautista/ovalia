'use client';

import { useState } from 'react';
import type { CareerPosition } from '@ovalia/domain';

interface PitchSpot {
  position: CareerPosition;
  code: string;
  top: string;
  left: string;
}

const POSITION_LABELS: Record<CareerPosition, string> = {
  pilar: 'Pilar',
  hooker: 'Hooker',
  segunda: 'Segunda línea',
  ala: 'Ala',
  octavo: 'Octavo',
  'medio-scrum': 'Medio scrum',
  apertura: 'Apertura',
  centro: 'Centro',
  wing: 'Wing',
  fullback: 'Fullback',
};

const PITCH_SPOTS: PitchSpot[] = [
  { position: 'wing', code: 'WI', top: '10%', left: '18%' },
  { position: 'fullback', code: 'FB', top: '6%', left: '50%' },
  { position: 'wing', code: 'WI', top: '10%', left: '82%' },
  { position: 'centro', code: 'CE', top: '26%', left: '35%' },
  { position: 'centro', code: 'CE', top: '26%', left: '65%' },
  { position: 'apertura', code: 'AP', top: '42%', left: '35%' },
  { position: 'medio-scrum', code: 'MS', top: '42%', left: '65%' },
  { position: 'octavo', code: '8', top: '56%', left: '50%' },
  { position: 'ala', code: 'AL', top: '68%', left: '25%' },
  { position: 'ala', code: 'AL', top: '68%', left: '75%' },
  { position: 'segunda', code: '2L', top: '80%', left: '38%' },
  { position: 'segunda', code: '2L', top: '80%', left: '62%' },
  { position: 'hooker', code: 'HK', top: '92%', left: '50%' },
  { position: 'pilar', code: 'PI', top: '96%', left: '30%' },
  { position: 'pilar', code: 'PI', top: '96%', left: '70%' },
];

export function XvPath({ onStartCareer }: { onStartCareer: (position?: CareerPosition) => void }) {
  const [position, setPosition] = useState<CareerPosition | null>(null);

  return (
    <section className="game-stage">
      <h2>Elegí tu posición</h2>
      <p>Tocá un puesto en la cancha y descubrí a quién representás dentro del equipo.</p>
      <div className="rugby-pitch" role="group" aria-label="Posiciones en la cancha">
        <div className="rugby-pitch__tryline rugby-pitch__tryline--top" />
        <div className="rugby-pitch__tryline rugby-pitch__tryline--bottom" />
        <div className="rugby-pitch__halfway" />
        <div className="rugby-pitch__circle" />
        {PITCH_SPOTS.map((spot, index) => (
          <button
            key={`${spot.position}-${index}`}
            type="button"
            className={`rugby-pitch__spot${position === spot.position ? ' is-selected' : ''}`}
            style={{ top: spot.top, left: spot.left }}
            aria-pressed={position === spot.position}
            onClick={() => setPosition(spot.position)}
          >
            {spot.code}
          </button>
        ))}
      </div>
      {position ? (
        <div className="game-result compact">
          <small>TU ROL</small>
          <h2>{POSITION_LABELS[position]}</h2>
        </div>
      ) : null}
      {position ? (
        <button onClick={() => onStartCareer(position)}>Arrancar la carrera con este puesto</button>
      ) : null}
    </section>
  );
}
