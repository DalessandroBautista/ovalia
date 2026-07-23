'use client';

import { useState } from 'react';
import { calculateRugbyIdentity, chooseCareerOutcome } from '@ovalia/domain';
import { PortalHeader } from '../portal/portal-pages';

const questions = [
  ['Con cinco minutos por jugar preferís...', 'Jugar en campo rival', 'Cuidar la pelota'],
  ['Tu equipo ideal construye desde...', 'La presión', 'La creatividad'],
  ['En un penal a los palos...', 'Sumo de a tres', 'Voy al line'],
  ['El jugador que más valorás...', 'Ordena al equipo', 'Rompe el partido'],
  ['En defensa importa más...', 'Subir juntos', 'Pescar la pelota']
] as const;

export function GamesHub() {
  const [mode, setMode] = useState<'hub' | 'identity' | 'career'>('hub');
  const [answers, setAnswers] = useState<number[]>([]);
  const [career, setCareer] = useState({ power: 5, speed: 5, vision: 5 });
  const result = answers.length === questions.length ? calculateRugbyIdentity(answers) : null;

  return <div className="portal-shell"><PortalHeader /><main className="portal-main"><p className="eyebrow">JUEGOS OVALIA</p><h1>¿Cómo vivís el rugby?</h1><p className="portal-intro">Dos experiencias originales inspiradas en la cultura, las decisiones y los roles del rugby.</p>{mode === 'hub' && <div className="game-grid"><button onClick={() => setMode('identity')}><small>TEST · 5 DECISIONES</small><h2>Tu identidad ovalada</h2><p>Descubrí si tu rugby vive del territorio, la posesión o el equilibrio.</p><span>Empezar →</span></button><button onClick={() => setMode('career')}><small>SIMULADOR</small><h2>Camino al XV</h2><p>Elegí tus atributos y conocé qué rol ocuparías dentro de un equipo.</p><span>Jugar →</span></button></div>}
  {mode === 'identity' && <section className="game-stage">{result ? <div className="game-result"><small>TU PERFIL</small><h2>{result.profile}</h2><strong>{result.axis}</strong><p>Intensidad táctica {result.intensity}%</p><button onClick={() => { setAnswers([]); setMode('hub'); }}>Volver</button></div> : <><p>Pregunta {answers.length + 1} de {questions.length}</p><h2>{questions[answers.length]?.[0]}</h2><div><button onClick={() => setAnswers([...answers, 1])}>{questions[answers.length]?.[1]}</button><button onClick={() => setAnswers([...answers, -1])}>{questions[answers.length]?.[2]}</button></div></>}</section>}
  {mode === 'career' && <section className="game-stage"><h2>Construí tu jugador</h2>{(['power','speed','vision'] as const).map((key) => <label className="attribute" key={key}><span>{key === 'power' ? 'Potencia' : key === 'speed' ? 'Velocidad' : 'Visión'} <b>{career[key]}</b></span><input type="range" min="1" max="10" value={career[key]} onChange={(event) => setCareer({ ...career, [key]: Number(event.target.value) })} /></label>)}<div className="game-result compact"><small>TU ROL</small><h2>{chooseCareerOutcome(career)}</h2></div><button onClick={() => setMode('hub')}>Volver</button></section>}</main></div>;
}
