'use client';

import { useState } from 'react';
import { calculateRugbyIdentity } from '@ovalia/domain';

const questions = [
  ['Con cinco minutos por jugar preferís...', 'Jugar en campo rival', 'Cuidar la pelota'],
  ['Tu equipo ideal construye desde...', 'La presión', 'La creatividad'],
  ['En un penal a los palos...', 'Sumo de a tres', 'Voy al line'],
  ['El jugador que más valorás...', 'Ordena al equipo', 'Rompe el partido'],
  ['En defensa importa más...', 'Subir juntos', 'Pescar la pelota']
] as const;

export function IdentityGame({ onExit }: { onExit?: () => void }) {
  const [answers, setAnswers] = useState<number[]>([]);
  const result = answers.length === questions.length ? calculateRugbyIdentity(answers) : null;

  return <section className="game-stage">{result ? <div className="game-result"><small>TU PERFIL</small><h2>{result.profile}</h2><strong>{result.axis}</strong><p>Intensidad táctica {result.intensity}%</p><button onClick={() => { setAnswers([]); onExit?.(); }}>Volver</button></div> : <><p>Pregunta {answers.length + 1} de {questions.length}</p><h2>{questions[answers.length]?.[0]}</h2><div><button onClick={() => setAnswers([...answers, 1])}>{questions[answers.length]?.[1]}</button><button onClick={() => setAnswers([...answers, -1])}>{questions[answers.length]?.[2]}</button></div></>}</section>;
}
