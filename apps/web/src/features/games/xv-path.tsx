'use client';

import { useState } from 'react';
import { chooseCareerOutcome, roleToCareerPosition } from '@ovalia/domain';
import type { CareerPosition } from '@ovalia/domain';

interface RoleAttributes {
  power: number;
  speed: number;
  vision: number;
}

export function XvPath({ onStartCareer }: { onStartCareer: (position?: CareerPosition) => void }) {
  const [attributes, setAttributes] = useState<RoleAttributes>({ power: 5, speed: 5, vision: 5 });
  const [role, setRole] = useState<string | null>(null);

  const labels = { power: 'Potencia', speed: 'Velocidad', vision: 'Visión' } as const;

  return <section className="game-stage"><h2>Construí tu jugador</h2>{(['power', 'speed', 'vision'] as const).map((key) => <label className="attribute" key={key}><span>{labels[key]} <b>{attributes[key]}</b></span><input type="range" min="1" max="10" value={attributes[key]} onChange={(event) => setAttributes({ ...attributes, [key]: Number(event.target.value) })} /></label>)}{role && <div className="game-result compact"><small>TU ROL</small><h2>{role}</h2></div>}{role ? <button onClick={() => onStartCareer(roleToCareerPosition(role) ?? undefined)}>Arrancar la carrera con este puesto</button> : <button onClick={() => setRole(chooseCareerOutcome(attributes))}>Descubrí tu puesto</button>}</section>;
}
