import { useEffect, useRef, useState } from 'react';
import {
  applyOption,
  createCareer,
  createSeededRng,
  pickScenario,
  shouldRetire,
  simulateSeason,
  type CareerCatalog,
  type CareerPosition,
  type CareerState,
  type Rng,
  type ScenarioPrompt,
} from '@ovalia/domain';

const STORAGE_KEY = 'ovalia.career.run';

export interface CareerRunInput {
  surname: string;
  position: CareerPosition;
  clubSlug: string;
}

export interface CareerRun {
  seed: number;
  input: CareerRunInput;
  decisions: number[];
  state: CareerState;
}

export type CareerRunPhase = 'decision' | 'season' | 'retired';

interface StoredRun {
  seed: number;
  input: CareerRunInput;
  decisions: number[];
  state: CareerState;
  phase: CareerRunPhase;
}

export interface CareerRunApi {
  run: CareerRun | null;
  phase: CareerRunPhase | null;
  prompt: ScenarioPrompt | null;
  createRun(input: CareerRunInput, seed: number, catalog: CareerCatalog): void;
  choose(optionIndex: number): void;
  advance(): void;
  reset(): void;
}

function isStoredRun(value: unknown): value is StoredRun {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as StoredRun;
  return (
    typeof candidate.seed === 'number' &&
    typeof candidate.input === 'object' &&
    candidate.input !== null &&
    typeof candidate.input.surname === 'string' &&
    typeof candidate.input.position === 'string' &&
    typeof candidate.input.clubSlug === 'string' &&
    Array.isArray(candidate.decisions) &&
    typeof candidate.state === 'object' &&
    candidate.state !== null &&
    (candidate.phase === 'decision' || candidate.phase === 'season' || candidate.phase === 'retired')
  );
}

/**
 * Reproduce el consumo de azar de la carrera (el mismo bucle que `replayCareer`)
 * para reubicar el RNG en el punto exacto en que quedó la sesión. El catálogo
 * no importa para el consumo: se usa el club ya resuelto en el estado guardado.
 */
function rngAfterDecisions(seed: number, decisions: readonly number[], state: CareerState): Rng {
  const rng = createSeededRng(seed);
  let cursor = createCareer(
    { surname: 'x', position: state.position, clubSlug: state.club.slug, catalog: { clubs: [state.club] } },
    rng,
  );
  for (const decision of decisions) {
    if (shouldRetire(cursor, rng)) break;
    const prompt = pickScenario(cursor, rng);
    if (!prompt) {
      cursor = simulateSeason(cursor, rng);
      continue;
    }
    const option = prompt.options[Math.min(decision, prompt.options.length - 1)];
    if (!option) return rng;
    cursor = simulateSeason(applyOption(cursor, option), rng);
  }
  return rng;
}

function readStoredRun(): StoredRun | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredRun(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredRun(run: CareerRun, phase: CareerRunPhase): void {
  if (typeof window === 'undefined') return;
  const stored: StoredRun = { seed: run.seed, input: run.input, decisions: run.decisions, state: run.state, phase };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function useCareerRun(): CareerRunApi {
  const [run, setRun] = useState<CareerRun | null>(null);
  const [phase, setPhase] = useState<CareerRunPhase | null>(null);
  const [prompt, setPrompt] = useState<ScenarioPrompt | null>(null);
  const rngRef = useRef<Rng | null>(null);

  useEffect(() => {
    const stored = readStoredRun();
    if (!stored) return;
    const rng = rngAfterDecisions(stored.seed, stored.decisions, stored.state);
    rngRef.current = rng;
    setRun({ seed: stored.seed, input: stored.input, decisions: stored.decisions, state: stored.state });
    if (stored.phase === 'retired') {
      setPhase('retired');
      return;
    }
    if (stored.phase === 'season') {
      setPhase(shouldRetire(stored.state, rng) ? 'retired' : 'season');
      return;
    }
    setPhase(shouldRetire(stored.state, rng) ? 'retired' : 'decision');
    setPrompt(pickScenario(stored.state, rng));
  }, []);

  useEffect(() => {
    if (run && phase) writeStoredRun(run, phase);
  }, [run, phase]);

  const createRun = (input: CareerRunInput, seed: number, catalog: CareerCatalog) => {
    const rng = createSeededRng(seed);
    const state = createCareer({ surname: input.surname, position: input.position, clubSlug: input.clubSlug, catalog }, rng);
    rngRef.current = rng;
    setRun({ seed, input, decisions: [], state });
    if (!shouldRetire(state, rng)) {
      setPrompt(pickScenario(state, rng));
      setPhase('decision');
    } else {
      setPrompt(null);
      setPhase('retired');
    }
  };

  const choose = (optionIndex: number) => {
    if (!run || !prompt || phase !== 'decision' || !rngRef.current) return;
    const option = prompt.options[Math.min(optionIndex, prompt.options.length - 1)];
    if (!option) return;
    const state = simulateSeason(applyOption(run.state, option), rngRef.current);
    const decision = Math.min(optionIndex, prompt.options.length - 1);
    const decisions = [...run.decisions, decision];
    setRun({ ...run, decisions, state });
    setPrompt(null);
    setPhase(shouldRetire(state, rngRef.current) ? 'retired' : 'season');
  };

  const advance = () => {
    if (!run || phase !== 'season' || !rngRef.current) return;
    if (shouldRetire(run.state, rngRef.current)) {
      setPhase('retired');
      return;
    }
    const nextPrompt = pickScenario(run.state, rngRef.current);
    if (!nextPrompt) {
      // Sin escenario elegible no hay decisión que mostrar; el pool actual
      // siempre ofrece al menos «Otra temporada».
      setPhase('retired');
      return;
    }
    setPrompt(nextPrompt);
    setPhase('decision');
  };

  const reset = () => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
    rngRef.current = null;
    setRun(null);
    setPrompt(null);
    setPhase(null);
  };

  return { run, phase, prompt, createRun, choose, advance, reset };
}
