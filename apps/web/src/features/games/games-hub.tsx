'use client';

import { useState } from 'react';
import type { CareerPosition } from '@ovalia/domain';
import { PortalHeader } from '../portal/portal-pages';
import { IdentityGame } from './identity-game';
import { XvPath } from './xv-path';

type Mode = 'hub' | 'identity' | 'xv' | 'career';

export function GamesHub() {
  const [mode, setMode] = useState<Mode>('hub');
  // Posición prefijada por «Camino al XV». Task 5 la lee para arrancar la
  // carrera con el puesto elegido.
  const [careerPosition, setCareerPosition] = useState<CareerPosition | undefined>(undefined);

  return <div className="portal-shell"><PortalHeader /><main className="portal-main"><p className="eyebrow">JUEGOS OVALIA</p><h1>¿Cómo vivís el rugby?</h1><p className="portal-intro">Dos experiencias originales inspiradas en la cultura, las decisiones y los roles del rugby.</p>
  {mode === 'hub' && <div className="game-grid"><button onClick={() => setMode('identity')}><small>TEST · 5 DECISIONES</small><h2>Tu identidad ovalada</h2><p>Descubrí si tu rugby vive del territorio, la posesión o el equilibrio.</p><span>Empezar →</span></button><button onClick={() => setMode('xv')}><small>SIMULADOR</small><h2>Camino al XV</h2><p>Elegí tus atributos y conocé qué rol ocuparías dentro de un equipo.</p><span>Jugar →</span></button>{/* Task 5: habilitar y montar CareerGame. */}<button disabled><small>SIMULADOR</small><h2>Carrera de rugbier</h2><p>Jugá tu carrera de principio a fin: creación, decisiones y cierre.</p><span>Jugar →</span></button></div>}
  {mode === 'identity' && <IdentityGame onExit={() => setMode('hub')} />}
  {mode === 'xv' && <XvPath onStartCareer={(position) => { setCareerPosition(position); setMode('career'); }} />}
  {mode === 'career' && <section className="game-stage">{/* Task 5: reemplazar este placeholder por CareerGame. */}<p>Preparando la carrera…</p></section>}
  </main></div>;
}
