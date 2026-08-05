'use client';

import { useState } from 'react';
import type { CareerPosition } from '@ovalia/domain';
import { PortalHeader } from '../portal/portal-pages';
import { CareerGame } from './career-game';
import { IdentityGame } from './identity-game';
import { XvPath } from './xv-path';

type Mode = 'hub' | 'identity' | 'xv' | 'career';

function IdentityCover() {
  return (
    <svg className="game-cover" viewBox="0 0 220 120" aria-hidden="true">
      <circle cx="110" cy="60" r="46" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1" />
      <circle cx="110" cy="60" r="30" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1" strokeDasharray="2 6" />
      <line x1="110" y1="10" x2="110" y2="110" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
      <line x1="60" y1="60" x2="160" y2="60" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
      <text x="110" y="22" textAnchor="middle" className="game-cover__axis">TERRITORIO</text>
      <text x="110" y="103" textAnchor="middle" className="game-cover__axis">POSESIÓN</text>
      <polygon points="110,28 138,52 126,88 94,88 82,52" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="110" cy="60" r="4" fill="currentColor" />
    </svg>
  );
}

function XvPathCover() {
  return (
    <svg className="game-cover" viewBox="0 0 220 120" aria-hidden="true">
      <rect x="26" y="10" width="168" height="100" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="1.5" />
      <line x1="110" y1="10" x2="110" y2="110" stroke="currentColor" strokeOpacity=".3" strokeWidth="1" />
      <circle cx="110" cy="60" r="16" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="1" />
      <circle cx="60" cy="30" r="6" fill="currentColor" fillOpacity=".85" />
      <circle cx="160" cy="30" r="6" fill="currentColor" fillOpacity=".85" />
      <circle cx="110" cy="60" r="7" fill="currentColor" />
      <circle cx="60" cy="90" r="6" fill="currentColor" fillOpacity=".5" />
      <circle cx="160" cy="90" r="6" fill="currentColor" fillOpacity=".5" />
    </svg>
  );
}

function CareerCover() {
  return (
    <svg className="game-cover" viewBox="0 0 220 120" aria-hidden="true">
      <path d="M84 14 62 24v14c0 26 16 42 38 50 22-8 38-24 38-50V24L116 14Z" fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth="1.5" />
      <text x="100" y="70" textAnchor="middle" className="game-cover__number">10</text>
      <path d="M28 100 66 84 96 96 128 78 160 92 194 74" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.5" strokeDasharray="3 5" />
      <circle cx="28" cy="100" r="3" fill="currentColor" /><circle cx="96" cy="96" r="3" fill="currentColor" /><circle cx="194" cy="74" r="3" fill="currentColor" />
    </svg>
  );
}

export function GamesHub() {
  const [mode, setMode] = useState<Mode>('hub');
  // Posición prefijada por «Camino al XV». Task 5 la lee para arrancar la
  // carrera con el puesto elegido.
  const [careerPosition, setCareerPosition] = useState<CareerPosition | undefined>(undefined);

  return <div className="portal-shell"><PortalHeader /><main className="portal-main"><p className="eyebrow">JUEGOS OVALIA</p><h1>¿Cómo vivís el rugby?</h1><p className="portal-intro">Tres experiencias originales inspiradas en la cultura, las decisiones y los roles del rugby.</p>
  {mode === 'hub' && <div className="game-grid">
    <button onClick={() => setMode('identity')}><IdentityCover /><small>TEST · 5 DECISIONES</small><h2>Tu identidad ovalada</h2><p>Descubrí si tu rugby vive del territorio, la posesión o el equilibrio.</p><span>Empezar →</span></button>
    <button onClick={() => setMode('xv')}><XvPathCover /><small>SIMULADOR</small><h2>Camino al XV</h2><p>Elegí tu posición en la cancha y conocé qué rol ocuparías dentro de un equipo.</p><span>Jugar →</span></button>
    <button onClick={() => setMode('career')}><CareerCover /><small>SIMULADOR</small><h2>Carrera de rugbier</h2><p>Jugá tu carrera de principio a fin: creación, decisiones y cierre.</p><span>Jugar →</span></button>
  </div>}
  {mode === 'identity' && <IdentityGame onExit={() => setMode('hub')} />}
  {mode === 'xv' && <XvPath onStartCareer={(position) => { setCareerPosition(position); setMode('career'); }} />}
  {mode === 'career' && <CareerGame initialPosition={careerPosition} />}
  </main></div>;
}
