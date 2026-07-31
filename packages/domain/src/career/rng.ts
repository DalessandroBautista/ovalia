/**
 * Generador de azar inyectable. Todo el motor de carrera lo recibe por
 * parámetro en vez de usar el azar global del entorno, para que una semilla
 * fija produzca siempre la misma carrera: eso hace las reglas verificables con
 * pruebas y permite compartir una trayectoria reproducible.
 */
export interface Rng {
  next(): number;
}

/** mulberry32: rápido, determinístico y suficiente para un juego. */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Entero en [min, max], ambos inclusive. */
export function randomInt(rng: Rng, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rng.next() * (max - min + 1));
}

export interface Weighted<T> {
  weight: number;
  value: T;
}

/** Elige respetando los pesos. Los pesos no positivos quedan excluidos. */
export function pickWeighted<T>(rng: Rng, items: readonly Weighted<T>[]): T | null {
  const eligible = items.filter((item) => item.weight > 0);
  if (eligible.length === 0) return null;
  const total = eligible.reduce((sum, item) => sum + item.weight, 0);
  let threshold = rng.next() * total;
  for (const item of eligible) {
    threshold -= item.weight;
    if (threshold < 0) return item.value;
  }
  return eligible.at(-1)!.value;
}
