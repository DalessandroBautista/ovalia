# Motor del simulador de carrera — plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por tarea. Los
> pasos usan casillas (`- [ ]`) para el seguimiento.

**Goal:** Construir el motor puro de la carrera de rugbier —azar reproducible,
simulación de temporada, pozo de escenarios y cierre con veredicto, puntaje y
comparación— dentro de `packages/domain`, sin interfaz ni base de datos.

**Architecture:** Todo vive en `packages/domain/src/career/`, como funciones
puras que reciben el generador de azar y el catálogo de clubes por parámetro.
Ninguna función consulta la red ni la base. El estado de la carrera es un valor
inmutable: cada operación devuelve un estado nuevo.

**Tech Stack:** TypeScript estricto, Vitest.

## Global Constraints

- TDD obligatorio: prueba primero, verificar que falla, después implementar.
- TypeScript estricto: sin `any`, sin aserciones que apaguen el verificador.
- `packages/domain` no importa framework, base de datos ni nada de `apps/`.
- Prohibido `Math.random` en el código de producción de este motor: el generador
  se recibe por parámetro. Una prueba debe fallar si alguien lo reintroduce.
- Sin datos de menores; sin atribuir estadísticas inventadas a personas reales.
- Usar `corepack pnpm` — `pnpm` no está en el PATH.
- Nunca `vitest` suelto desde la raíz. Correr por paquete.
- Cierre de cada tarea: `corepack pnpm --filter @ovalia/domain test` y commit.

## Especificación de referencia

`docs/superpowers/specs/2026-07-30-career-simulator-design.md`. Leerla antes de
empezar: fija la decisión de diseño central —que la tensión del juego es «¿cuánto
te banca la vida el rugby?», no «¿llegás a profesional?»— y de ahí se derivan los
escenarios y los veredictos.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `career/rng.ts` | Generador determinístico y sus utilidades |
| `career/types.ts` | Tipos compartidos del motor |
| `career/season.ts` | Simulación de una temporada |
| `career/scenarios.ts` | Pozo de escenarios y aplicación de decisiones |
| `career/retirement.ts` | Retiro, veredicto, puntaje y comparación |
| `career/figures.ts` | Catálogo curado de figuras para comparar |
| `career/index.ts` | Superficie pública del motor |

---

### Task 1: Azar reproducible

**Files:**
- Crear: `packages/domain/src/career/rng.ts`
- Crear: `packages/domain/src/career/rng.test.ts`

**Interfaces:**
- Produce: `Rng` (interfaz con `next(): number`), `createSeededRng(seed: number): Rng`,
  `randomInt(rng, min, max): number`, `pickWeighted(rng, items): T | null`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```typescript
import { describe, expect, it } from 'vitest';
import { createSeededRng, pickWeighted, randomInt } from './rng';

describe('createSeededRng', () => {
  it('produce siempre la misma secuencia para la misma semilla', () => {
    const a = createSeededRng(12345);
    const b = createSeededRng(12345);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('produce secuencias distintas para semillas distintas', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('devuelve valores dentro de [0, 1)', () => {
    const rng = createSeededRng(999);
    for (let i = 0; i < 500; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('respeta los límites inclusive', () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 200; i += 1) {
      const value = randomInt(rng, 3, 6);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(6);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('devuelve el mismo valor cuando el rango es de uno', () => {
    expect(randomInt(createSeededRng(1), 5, 5)).toBe(5);
  });
});

describe('pickWeighted', () => {
  it('devuelve null con una lista vacía', () => {
    expect(pickWeighted(createSeededRng(1), [])).toBeNull();
  });

  it('nunca elige un elemento de peso cero', () => {
    const rng = createSeededRng(42);
    const items = [
      { weight: 0, value: 'nunca' },
      { weight: 1, value: 'siempre' },
    ];
    for (let i = 0; i < 100; i += 1) {
      expect(pickWeighted(rng, items)).toBe('siempre');
    }
  });

  it('favorece a los elementos de mayor peso', () => {
    const rng = createSeededRng(2024);
    const items = [
      { weight: 9, value: 'frecuente' },
      { weight: 1, value: 'raro' },
    ];
    let frecuente = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (pickWeighted(rng, items) === 'frecuente') frecuente += 1;
    }
    expect(frecuente).toBeGreaterThan(800);
    expect(frecuente).toBeLessThan(980);
  });
});
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/career/rng.test.ts
```
Esperado: FAIL con «Failed to resolve import "./rng"».

- [ ] **Step 3: Implementar**

Crear `packages/domain/src/career/rng.ts`:

```typescript
/**
 * Generador de azar inyectable. Todo el motor de carrera lo recibe por
 * parámetro en vez de usar `Math.random`, para que una semilla fija produzca
 * siempre la misma carrera: eso hace las reglas verificables con pruebas y
 * permite compartir una trayectoria reproducible.
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
```

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/career/rng.test.ts
```
Esperado: PASS, 8 pruebas.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/career/rng.ts packages/domain/src/career/rng.test.ts
git commit -m "feat(domain): generador de azar reproducible para la carrera"
```

---

### Task 2: Tipos del motor y creación de la carrera

**Files:**
- Crear: `packages/domain/src/career/types.ts`
- Crear: `packages/domain/src/career/create.ts`
- Crear: `packages/domain/src/career/create.test.ts`

**Interfaces:**
- Consume: `Rng`, `randomInt` de la tarea 1.
- Produce: los tipos `CareerPosition`, `CareerAttributes`, `CareerClub`,
  `CareerCatalog`, `SeasonRecord`, `CareerState`; y
  `createCareer(input, rng): CareerState`, `FALLBACK_CATALOG`.

`CareerClub` describe un club jugable: `{ slug, name, level, badgeUrl }`, donde
`level` es el nivel de división (1 es el más alto). `CareerCatalog` es
`{ clubs: CareerClub[] }` y lo provee quien llama —la interfaz lo arma con datos
reales de la base—, de modo que el dominio nunca consulta nada.

- [ ] **Step 1: Escribir las pruebas que fallan**

```typescript
import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';
import { createCareer, FALLBACK_CATALOG } from './create';
import type { CareerCatalog } from './types';

const catalog: CareerCatalog = {
  clubs: [
    { slug: 'club-bajo', name: 'Club Bajo', level: 4, badgeUrl: null },
    { slug: 'club-medio', name: 'Club Medio', level: 2, badgeUrl: null },
    { slug: 'club-alto', name: 'Club Alto', level: 1, badgeUrl: null },
  ],
};

describe('createCareer', () => {
  it('arranca con 18 años, amateur y sin historial', () => {
    const state = createCareer(
      { surname: 'Pérez', position: 'apertura', clubSlug: 'club-bajo', catalog },
      createSeededRng(1),
    );
    expect(state.age).toBe(18);
    expect(state.pro).toBe(false);
    expect(state.retired).toBe(false);
    expect(state.history).toEqual([]);
    expect(state.club.slug).toBe('club-bajo');
  });

  it('es determinística: la misma semilla produce el mismo estado', () => {
    const input = { surname: 'Pérez', position: 'apertura' as const, clubSlug: 'club-bajo', catalog };
    const a = createCareer(input, createSeededRng(77));
    const b = createCareer(input, createSeededRng(77));
    expect(a).toEqual(b);
  });

  it('usa el catálogo de reserva cuando el recibido está vacío', () => {
    const state = createCareer(
      { surname: 'Pérez', position: 'pilar', clubSlug: 'inexistente', catalog: { clubs: [] } },
      createSeededRng(3),
    );
    expect(FALLBACK_CATALOG.clubs.length).toBeGreaterThan(0);
    expect(FALLBACK_CATALOG.clubs.some((c) => c.slug === state.club.slug)).toBe(true);
  });

  it('cae en un club del catálogo cuando el pedido no existe', () => {
    const state = createCareer(
      { surname: 'Pérez', position: 'wing', clubSlug: 'no-existe', catalog },
      createSeededRng(5),
    );
    expect(catalog.clubs.some((c) => c.slug === state.club.slug)).toBe(true);
  });

  it('recorta el apellido y rechaza el vacío usando un valor por defecto', () => {
    const state = createCareer(
      { surname: '   ', position: 'wing', clubSlug: 'club-bajo', catalog },
      createSeededRng(9),
    );
    expect(state.surname.length).toBeGreaterThan(0);
  });

  it('reparte atributos dentro del rango permitido', () => {
    const state = createCareer(
      { surname: 'Pérez', position: 'octavo', clubSlug: 'club-bajo', catalog },
      createSeededRng(11),
    );
    for (const value of Object.values(state.attributes)) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
    }
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/career/create.test.ts
```
Esperado: FAIL por importaciones sin resolver.

- [ ] **Step 3: Implementar los tipos**

Crear `packages/domain/src/career/types.ts`:

```typescript
export type CareerPosition =
  | 'pilar' | 'hooker' | 'segunda' | 'ala' | 'octavo'
  | 'medio-scrum' | 'apertura' | 'centro' | 'wing' | 'fullback';

export interface CareerAttributes {
  power: number;
  speed: number;
  vision: number;
  discipline: number;
}

export interface CareerClub {
  slug: string;
  name: string;
  /** Nivel de división: 1 es el más alto. */
  level: number;
  badgeUrl: string | null;
}

export interface CareerCatalog {
  clubs: CareerClub[];
}

export interface SeasonRecord {
  season: number;
  age: number;
  clubSlug: string;
  clubName: string;
  level: number;
  rating: number;
  note: string;
}

export interface CareerState {
  surname: string;
  position: CareerPosition;
  attributes: CareerAttributes;
  age: number;
  season: number;
  club: CareerClub;
  /** Media general del jugador, de 1 a 100. */
  overall: number;
  morale: number;
  /** Cariño de la hinchada del club actual. */
  support: number;
  fame: number;
  pro: boolean;
  everPro: boolean;
  injured: boolean;
  retired: boolean;
  peakOverall: number;
  history: SeasonRecord[];
}
```

- [ ] **Step 4: Implementar la creación**

Crear `packages/domain/src/career/create.ts`:

```typescript
import { randomInt, type Rng } from './rng.js';
import type { CareerCatalog, CareerClub, CareerPosition, CareerState } from './types.js';

const STARTING_AGE = 18;
const DEFAULT_SURNAME = 'Jugador';

/**
 * Catálogo mínimo para que el juego funcione si la interfaz no pudo traer los
 * clubes reales. No pretende ser fiel: existe para que el juego nunca se rompa.
 */
export const FALLBACK_CATALOG: CareerCatalog = {
  clubs: [
    { slug: 'club-del-barrio', name: 'Club del Barrio', level: 5, badgeUrl: null },
    { slug: 'club-de-ascenso', name: 'Club de Ascenso', level: 3, badgeUrl: null },
    { slug: 'club-grande', name: 'Club Grande', level: 1, badgeUrl: null },
  ],
};

export interface CreateCareerInput {
  surname: string;
  position: CareerPosition;
  clubSlug: string;
  catalog: CareerCatalog;
}

function resolveCatalog(catalog: CareerCatalog): CareerCatalog {
  return catalog.clubs.length > 0 ? catalog : FALLBACK_CATALOG;
}

function resolveClub(catalog: CareerCatalog, slug: string): CareerClub {
  const found = catalog.clubs.find((club) => club.slug === slug);
  if (found) return found;
  // Sin coincidencia, arranca en el club de división más baja disponible:
  // empezar desde abajo es la premisa del juego.
  return [...catalog.clubs].sort((a, b) => b.level - a.level)[0]!;
}

export function createCareer(input: CreateCareerInput, rng: Rng): CareerState {
  const catalog = resolveCatalog(input.catalog);
  const club = resolveClub(catalog, input.clubSlug);
  const surname = input.surname.trim() || DEFAULT_SURNAME;

  const attributes = {
    power: randomInt(rng, 3, 7),
    speed: randomInt(rng, 3, 7),
    vision: randomInt(rng, 3, 7),
    discipline: randomInt(rng, 3, 7),
  };
  const overall = 40 + attributes.power + attributes.speed + attributes.vision;

  return {
    surname,
    position: input.position,
    attributes,
    age: STARTING_AGE,
    season: 1,
    club,
    overall,
    morale: 60,
    support: 20,
    fame: 0,
    pro: false,
    everPro: false,
    injured: false,
    retired: false,
    peakOverall: overall,
    history: [],
  };
}
```

- [ ] **Step 5: Correr y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/career/create.test.ts
```
Esperado: PASS, 6 pruebas.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/career/types.ts packages/domain/src/career/create.ts packages/domain/src/career/create.test.ts
git commit -m "feat(domain): tipos y creacion de la carrera"
```

---

### Task 3: Simulación de temporada

**Files:**
- Crear: `packages/domain/src/career/season.ts`
- Crear: `packages/domain/src/career/season.test.ts`

**Interfaces:**
- Consume: `Rng` y `randomInt` (tarea 1); `CareerState` y `SeasonRecord` (tarea 2).
- Produce: `simulateSeason(state: CareerState, rng: Rng): CareerState`, que
  devuelve un estado nuevo con la temporada jugada, el historial ampliado, la
  edad incrementada y los atributos evolucionados. No decide el retiro: eso es
  de la tarea 5.

Reglas: el rendimiento de la temporada surge de la media del jugador comparada
con el nivel de su división, más azar. Un rendimiento alto sube la media, el
cariño de la hinchada y la fama; uno bajo los baja. A partir de los 30 la media
empieza a caer por edad, y la caída se acelera con los años.

- [ ] **Step 1: Escribir las pruebas que fallan**

```typescript
import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';
import { createCareer } from './create';
import { simulateSeason } from './season';
import type { CareerCatalog, CareerState } from './types';

const catalog: CareerCatalog = {
  clubs: [
    { slug: 'bajo', name: 'Bajo', level: 4, badgeUrl: null },
    { slug: 'alto', name: 'Alto', level: 1, badgeUrl: null },
  ],
};

function baseState(overrides: Partial<CareerState> = {}): CareerState {
  const state = createCareer(
    { surname: 'Pérez', position: 'centro', clubSlug: 'bajo', catalog },
    createSeededRng(1),
  );
  return { ...state, ...overrides };
}

describe('simulateSeason', () => {
  it('avanza una temporada y una edad, y suma un registro al historial', () => {
    const before = baseState();
    const after = simulateSeason(before, createSeededRng(10));
    expect(after.season).toBe(before.season + 1);
    expect(after.age).toBe(before.age + 1);
    expect(after.history).toHaveLength(1);
    expect(after.history[0]?.clubName).toBe(before.club.name);
  });

  it('no muta el estado recibido', () => {
    const before = baseState();
    const copy = structuredClone(before);
    simulateSeason(before, createSeededRng(10));
    expect(before).toEqual(copy);
  });

  it('es determinística con la misma semilla', () => {
    const before = baseState();
    const a = simulateSeason(before, createSeededRng(55));
    const b = simulateSeason(before, createSeededRng(55));
    expect(a).toEqual(b);
  });

  it('a lo largo de muchas temporadas, un jugador mejor rinde más que uno peor', () => {
    const bueno = baseState({ overall: 85 });
    const malo = baseState({ overall: 45 });
    const media = (state: CareerState) => {
      let acc = state;
      for (let i = 0; i < 10; i += 1) acc = simulateSeason(acc, createSeededRng(100 + i));
      return acc.history.reduce((sum, r) => sum + r.rating, 0) / acc.history.length;
    };
    expect(media(bueno)).toBeGreaterThan(media(malo));
  });

  it('registra la media máxima alcanzada', () => {
    let state = baseState({ overall: 60 });
    for (let i = 0; i < 8; i += 1) state = simulateSeason(state, createSeededRng(200 + i));
    expect(state.peakOverall).toBeGreaterThanOrEqual(60);
    expect(state.peakOverall).toBeGreaterThanOrEqual(state.overall);
  });

  it('hace caer la media de un veterano a lo largo de varias temporadas', () => {
    let state = baseState({ age: 34, overall: 80 });
    const inicial = state.overall;
    for (let i = 0; i < 5; i += 1) state = simulateSeason(state, createSeededRng(300 + i));
    expect(state.overall).toBeLessThan(inicial);
  });

  it('mantiene la media dentro de 1 y 100', () => {
    let state = baseState({ overall: 99 });
    for (let i = 0; i < 20; i += 1) state = simulateSeason(state, createSeededRng(400 + i));
    expect(state.overall).toBeLessThanOrEqual(100);
    expect(state.overall).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/career/season.test.ts
```
Esperado: FAIL con «Failed to resolve import "./season"».

- [ ] **Step 3: Implementar**

Crear `packages/domain/src/career/season.ts`:

```typescript
import { randomInt, type Rng } from './rng.js';
import type { CareerState, SeasonRecord } from './types.js';

const DECLINE_AGE = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Exigencia de la división: cuanto más alto el nivel (1 es el máximo), más media
 * hace falta para rendir bien.
 */
function difficultyFor(level: number): number {
  return 90 - (level - 1) * 12;
}

function ratingFor(state: CareerState, rng: Rng): number {
  const gap = state.overall - difficultyFor(state.club.level);
  const luck = randomInt(rng, -12, 12);
  const moraleEffect = (state.morale - 50) / 10;
  return clamp(Math.round(60 + gap * 0.6 + luck + moraleEffect), 1, 99);
}

function ageDelta(age: number): number {
  if (age < DECLINE_AGE) return 0;
  // La caída se acelera: leve a los 30, marcada pasados los 35.
  return -((age - DECLINE_AGE + 1) * 0.8);
}

export function simulateSeason(state: CareerState, rng: Rng): CareerState {
  const rating = ratingFor(state, rng);
  const growth = state.age < DECLINE_AGE ? (rating - 60) / 12 : 0;
  const overall = clamp(Math.round(state.overall + growth + ageDelta(state.age)), 1, 100);

  const record: SeasonRecord = {
    season: state.season,
    age: state.age,
    clubSlug: state.club.slug,
    clubName: state.club.name,
    level: state.club.level,
    rating,
    note: rating >= 75 ? 'Temporada consagratoria.' : rating >= 55 ? 'Temporada sólida.' : 'Temporada para el olvido.',
  };

  return {
    ...state,
    season: state.season + 1,
    age: state.age + 1,
    overall,
    peakOverall: Math.max(state.peakOverall, overall),
    support: clamp(state.support + Math.round((rating - 60) / 6), 0, 100),
    fame: clamp(state.fame + Math.round((rating - 65) / 8), 0, 100),
    morale: clamp(state.morale + Math.round((rating - 60) / 8), 0, 100),
    history: [...state.history, record],
  };
}
```

- [ ] **Step 4: Correr y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/career/season.test.ts
```
Esperado: PASS, 7 pruebas.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/career/season.ts packages/domain/src/career/season.test.ts
git commit -m "feat(domain): simular una temporada de la carrera"
```

---

### Task 4: Pozo de escenarios

**Files:**
- Crear: `packages/domain/src/career/scenarios.ts`
- Crear: `packages/domain/src/career/scenarios.test.ts`

**Interfaces:**
- Consume: `Rng`, `pickWeighted` (tarea 1); `CareerState` (tarea 2).
- Produce: los tipos `ScenarioOption`, `ScenarioPrompt`, `ScenarioEffect`;
  `pickScenario(state, rng): ScenarioPrompt | null` y
  `applyOption(state, option): CareerState`.

Un `ScenarioEffect` es un objeto de deltas: `{ overall?, morale?, support?, fame?,
pro?, injuredRisk?, note }`. `applyOption` los aplica de forma pura y acota los
valores.

**El contenido importa tanto como la mecánica.** El spec fija que la tensión del
juego es «¿cuánto te banca la vida el rugby?». Los escenarios deben reflejar eso:
el trabajo y la facultad compitiendo con los entrenamientos, la lesión que llega
sin aviso, el club que te quiere y el que te ofrece más, el grupo. Ninguna opción
debe ser objetivamente óptima: cada una gana algo y resigna otra cosa.

- [ ] **Step 1: Escribir las pruebas que fallan**

```typescript
import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';
import { createCareer } from './create';
import { applyOption, pickScenario } from './scenarios';
import type { CareerCatalog, CareerState } from './types';

const catalog: CareerCatalog = {
  clubs: [{ slug: 'bajo', name: 'Bajo', level: 4, badgeUrl: null }],
};

function baseState(overrides: Partial<CareerState> = {}): CareerState {
  const state = createCareer(
    { surname: 'Pérez', position: 'ala', clubSlug: 'bajo', catalog },
    createSeededRng(1),
  );
  return { ...state, ...overrides };
}

describe('pickScenario', () => {
  it('siempre devuelve un escenario con al menos dos opciones', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const prompt = pickScenario(baseState(), createSeededRng(seed));
      expect(prompt).not.toBeNull();
      expect(prompt!.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('es determinística con la misma semilla', () => {
    const state = baseState();
    expect(pickScenario(state, createSeededRng(9))).toEqual(pickScenario(state, createSeededRng(9)));
  });

  it('no ofrece escenarios juveniles a un veterano', () => {
    const claves = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const prompt = pickScenario(baseState({ age: 36 }), createSeededRng(seed));
      if (prompt) claves.add(prompt.key);
    }
    expect(claves.has('vida-amateur')).toBe(false);
  });

  it('ofrece la tensión amateur a un jugador joven que no es profesional', () => {
    const claves = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const prompt = pickScenario(baseState({ age: 21, pro: false }), createSeededRng(seed));
      if (prompt) claves.add(prompt.key);
    }
    expect(claves.has('vida-amateur')).toBe(true);
  });
});

describe('applyOption', () => {
  it('aplica los deltas sin mutar el estado recibido', () => {
    const before = baseState({ morale: 50, support: 50 });
    const copy = structuredClone(before);
    const after = applyOption(before, {
      label: 'Meterle a full',
      description: 'Entrenás como animal.',
      risk: 'riesgo',
      effect: { overall: 2, morale: 3, note: 'Dejaste todo.' },
    });
    expect(before).toEqual(copy);
    expect(after.overall).toBe(before.overall + 2);
    expect(after.morale).toBe(53);
  });

  it('acota los valores entre 0 y 100', () => {
    const after = applyOption(baseState({ morale: 99, support: 1 }), {
      label: 'x',
      description: 'y',
      risk: 'seguro',
      effect: { morale: 50, support: -50, note: 'z' },
    });
    expect(after.morale).toBe(100);
    expect(after.support).toBe(0);
  });

  it('marca como profesional cuando el efecto lo indica', () => {
    const after = applyOption(baseState(), {
      label: 'Firmar',
      description: 'Te ofrecen contrato.',
      risk: 'seguro',
      effect: { pro: true, note: 'Firmaste tu primer contrato.' },
    });
    expect(after.pro).toBe(true);
    expect(after.everPro).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/career/scenarios.test.ts
```
Esperado: FAIL con «Failed to resolve import "./scenarios"».

- [ ] **Step 3: Implementar**

Crear `packages/domain/src/career/scenarios.ts`. El pozo arranca con estos cinco
escenarios; ampliarlo después es agregar entradas a `POOL`, sin tocar la
mecánica:

```typescript
import { pickWeighted, type Rng } from './rng.js';
import type { CareerState } from './types.js';

export interface ScenarioEffect {
  overall?: number;
  morale?: number;
  support?: number;
  fame?: number;
  pro?: boolean;
  note: string;
}

export interface ScenarioOption {
  label: string;
  description: string;
  risk: 'riesgo' | 'seguro';
  effect: ScenarioEffect;
}

export interface ScenarioPrompt {
  key: string;
  title: string;
  subtitle: string;
  options: ScenarioOption[];
}

interface ScenarioDefinition {
  key: string;
  weight: number;
  isEligible: (state: CareerState) => boolean;
  build: (state: CareerState) => ScenarioPrompt;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const POOL: ScenarioDefinition[] = [
  {
    key: 'otra-temporada',
    weight: 1,
    isEligible: () => true,
    build: (state) => ({
      key: 'otra-temporada',
      title: `Otra temporada en ${state.club.name}`,
      subtitle: '¿Cómo encarás el año?',
      options: [
        {
          label: 'Meterle a full',
          description: 'Entrenás como animal. Más progreso, más desgaste.',
          risk: 'riesgo',
          effect: { overall: 2, morale: -2, note: 'Dejaste todo en cada entrenamiento.' },
        },
        {
          label: 'Disfrutar el año',
          description: 'Rugby, amigos y tercer tiempo. Sin apuros.',
          risk: 'seguro',
          effect: { overall: 0, morale: 4, support: 3, note: 'Un año a puro disfrute con los muchachos.' },
        },
      ],
    }),
  },
  {
    key: 'vida-amateur',
    weight: 2,
    isEligible: (state) => !state.pro && state.age < 28,
    build: () => ({
      key: 'vida-amateur',
      title: 'La vida amateur aprieta',
      subtitle: 'El rugby no paga las cuentas y la semana se hace cuesta arriba. ¿Qué priorizás?',
      options: [
        {
          label: 'Priorizar el rugby',
          description: 'Todo por el club, aunque el bolsillo llore.',
          risk: 'riesgo',
          effect: { overall: 2, morale: 3, note: 'Elegiste el rugby por encima de todo.' },
        },
        {
          label: 'Meterle a la facultad',
          description: 'Te recibís. El rugby espera, pero asegurás el futuro.',
          risk: 'seguro',
          effect: { overall: -1, fame: -2, morale: 2, note: 'Cerraste la carrera. La cabeza más tranquila.' },
        },
        {
          label: 'Agarrar un laburo',
          description: 'Trabajás toda la semana y llegás muerto al entrenamiento.',
          risk: 'riesgo',
          effect: { overall: -2, morale: -2, note: 'Entre el laburo y el rugby, casi no dormís.' },
        },
      ],
    }),
  },
  {
    key: 'cuerpo-pasa-factura',
    weight: 1.4,
    isEligible: (state) => state.age >= 29,
    build: () => ({
      key: 'cuerpo-pasa-factura',
      title: 'El cuerpo pasa factura',
      subtitle: 'Te levantás dolorido y la recuperación ya no es la de antes.',
      options: [
        {
          label: 'Aguantar y jugar igual',
          description: 'El equipo te necesita. El dolor se banca.',
          risk: 'riesgo',
          effect: { overall: -1, support: 6, morale: 2, note: 'Jugaste infiltrado más de una vez.' },
        },
        {
          label: 'Parar y recuperarte bien',
          description: 'Te perdés media temporada, pero volvés entero.',
          risk: 'seguro',
          effect: { overall: 1, support: -4, note: 'Elegiste cuidarte para durar.' },
        },
      ],
    }),
  },
  {
    key: 'oferta-de-arriba',
    weight: 1.6,
    isEligible: (state) => state.overall >= 70 && state.club.level > 1,
    build: (state) => ({
      key: 'oferta-de-arriba',
      title: 'Te llaman de arriba',
      subtitle: `Un club de una división superior pregunta por vos. En ${state.club.name} te quieren.`,
      options: [
        {
          label: 'Aceptar el desafío',
          description: 'Más nivel, más exigencia, menos minutos asegurados.',
          risk: 'riesgo',
          effect: { overall: 1, fame: 8, support: -10, note: 'Diste el salto a una división superior.' },
        },
        {
          label: 'Quedarte donde sos ídolo',
          description: 'Acá sos referente. Afuera, uno más.',
          risk: 'seguro',
          effect: { support: 12, morale: 4, note: 'Elegiste la camiseta de siempre.' },
        },
      ],
    }),
  },
  {
    key: 'tercer-tiempo',
    weight: 1.2,
    isEligible: (state) => state.age <= 32,
    build: () => ({
      key: 'tercer-tiempo',
      title: 'Después del partido',
      subtitle: 'Se ganó, hubo tercer tiempo y los muchachos quieren seguirla.',
      options: [
        {
          label: 'Seguirla con el plantel',
          description: 'El grupo se hace también acá.',
          risk: 'riesgo',
          effect: { overall: -1, morale: 5, support: 3, note: 'Noche larga con los muchachos.' },
        },
        {
          label: 'Cuidar el físico',
          description: 'Profesionalismo puro, aunque te carguen.',
          risk: 'seguro',
          effect: { overall: 1, morale: -2, note: 'Te volviste temprano. El cuerpo lo agradece.' },
        },
      ],
    }),
  },
];

export function pickScenario(state: CareerState, rng: Rng): ScenarioPrompt | null {
  const eligible = POOL.filter((definition) => definition.isEligible(state));
  const chosen = pickWeighted(
    rng,
    eligible.map((definition) => ({ weight: definition.weight, value: definition })),
  );
  return chosen ? chosen.build(state) : null;
}

export function applyOption(state: CareerState, option: ScenarioOption): CareerState {
  const { effect } = option;
  const pro = effect.pro ?? state.pro;
  return {
    ...state,
    overall: clamp(state.overall + (effect.overall ?? 0), 1, 100),
    morale: clamp(state.morale + (effect.morale ?? 0), 0, 100),
    support: clamp(state.support + (effect.support ?? 0), 0, 100),
    fame: clamp(state.fame + (effect.fame ?? 0), 0, 100),
    pro,
    everPro: state.everPro || pro,
  };
}
```

- [ ] **Step 4: Correr y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/career/scenarios.test.ts
```
Esperado: PASS, 7 pruebas.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/career/scenarios.ts packages/domain/src/career/scenarios.test.ts
git commit -m "feat(domain): pozo de escenarios de la carrera"
```

---

### Task 5: Retiro, veredicto, puntaje y comparación

**Files:**
- Crear: `packages/domain/src/career/figures.ts`
- Crear: `packages/domain/src/career/retirement.ts`
- Crear: `packages/domain/src/career/retirement.test.ts`
- Crear: `packages/domain/src/career/index.ts`
- Modificar: `packages/domain/src/index.ts`

**Interfaces:**
- Consume: `Rng` (tarea 1); `CareerState` (tarea 2).
- Produce: `shouldRetire(state, rng): boolean`,
  `summarizeCareer(state): CareerSummary` y el tipo `CareerSummary`
  `{ tier, verdict, score, comparison, seasons, clubs, peakLevel }`.

**Sobre las figuras.** `figures.ts` contiene una lista curada de figuras públicas
del rugby argentino con la **forma** de su trayectoria (por ejemplo: se fue joven
a Europa; se quedó toda la carrera en su club; llegó tarde a la selección). La
comparación elige la figura cuya forma se parece más a la carrera jugada. Reglas
que la implementación debe respetar, tomadas del spec: sólo figuras públicas y
sólo en su faceta deportiva; el texto describe el tipo de trayectoria y **nunca**
atribuye estadísticas inventadas a la persona real; no se emiten juicios sobre su
vida privada.

Un final quedándose en el club de siempre debe puntuar comparable a uno
emigrando: son caminos distintos, no niveles. El puntaje pondera media máxima,
temporadas jugadas, cariño de la hinchada y fama, de modo que una carrera de
club entera pueda superar a una internacional breve.

- [ ] **Step 1: Escribir las pruebas que fallan**

```typescript
import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';
import { createCareer } from './create';
import { simulateSeason } from './season';
import { shouldRetire, summarizeCareer } from './retirement';
import type { CareerCatalog, CareerState } from './types';

const catalog: CareerCatalog = {
  clubs: [{ slug: 'bajo', name: 'Bajo', level: 4, badgeUrl: null }],
};

function baseState(overrides: Partial<CareerState> = {}): CareerState {
  const state = createCareer(
    { surname: 'Pérez', position: 'centro', clubSlug: 'bajo', catalog },
    createSeededRng(1),
  );
  return { ...state, ...overrides };
}

describe('shouldRetire', () => {
  it('no retira a un joven en buen nivel', () => {
    expect(shouldRetire(baseState({ age: 24, overall: 70 }), createSeededRng(1))).toBe(false);
  });

  it('retira siempre pasada la edad límite', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      expect(shouldRetire(baseState({ age: 41, overall: 80 }), createSeededRng(seed))).toBe(true);
    }
  });

  it('retira a un veterano con la media por el piso', () => {
    expect(shouldRetire(baseState({ age: 35, overall: 20 }), createSeededRng(3))).toBe(true);
  });
});

describe('summarizeCareer', () => {
  it('una carrera completa siempre termina: no hay bucle infinito', () => {
    let state = baseState();
    let guard = 0;
    while (!shouldRetire(state, createSeededRng(guard)) && guard < 100) {
      state = simulateSeason(state, createSeededRng(guard));
      guard += 1;
    }
    expect(guard).toBeLessThan(100);
  });

  it('devuelve un puntaje positivo y un veredicto no vacío', () => {
    let state = baseState();
    for (let i = 0; i < 12; i += 1) state = simulateSeason(state, createSeededRng(i));
    const summary = summarizeCareer(state);
    expect(summary.score).toBeGreaterThan(0);
    expect(summary.verdict.length).toBeGreaterThan(0);
    expect(summary.tier.length).toBeGreaterThan(0);
    expect(summary.seasons).toBe(state.history.length);
  });

  it('premia una carrera larga de club tanto como una internacional breve', () => {
    let deClub = baseState({ support: 95, overall: 62 });
    for (let i = 0; i < 15; i += 1) deClub = simulateSeason(deClub, createSeededRng(i));

    let internacional = baseState({ fame: 90, overall: 88, everPro: true, pro: true });
    for (let i = 0; i < 4; i += 1) internacional = simulateSeason(internacional, createSeededRng(i));

    const a = summarizeCareer(deClub).score;
    const b = summarizeCareer(internacional).score;
    // Ninguna debe aplastar a la otra: son caminos distintos, no niveles.
    expect(Math.abs(a - b) / Math.max(a, b)).toBeLessThan(0.5);
  });

  it('asigna una comparación con una figura', () => {
    let state = baseState();
    for (let i = 0; i < 10; i += 1) state = simulateSeason(state, createSeededRng(i));
    const summary = summarizeCareer(state);
    expect(summary.comparison.figure.length).toBeGreaterThan(0);
    expect(summary.comparison.reason.length).toBeGreaterThan(0);
  });

  it('es determinística: el mismo estado produce el mismo resumen', () => {
    let state = baseState();
    for (let i = 0; i < 6; i += 1) state = simulateSeason(state, createSeededRng(i));
    expect(summarizeCareer(state)).toEqual(summarizeCareer(state));
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/career/retirement.test.ts
```
Esperado: FAIL por importaciones sin resolver.

- [ ] **Step 3: Implementar las figuras**

Crear `packages/domain/src/career/figures.ts`. La lista es de figuras públicas del
rugby argentino, descriptas **sólo por la forma de su trayectoria deportiva**. No
se les atribuyen estadísticas ni se comenta su vida privada. Empezar con estas
cuatro formas y ampliar después:

```typescript
export type CareerShape = 'club-entero' | 'salto-joven' | 'tardio' | 'itinerante';

export interface CareerFigure {
  /** Nombre público, usado sólo en su faceta deportiva. */
  name: string;
  shape: CareerShape;
  /** Describe el TIPO de trayectoria, nunca estadísticas concretas. */
  description: string;
}

export const CAREER_FIGURES: CareerFigure[] = [
  {
    name: 'Hugo Porta',
    shape: 'club-entero',
    description: 'una carrera construida desde el club, siendo referente durante años',
  },
  {
    name: 'Agustín Pichot',
    shape: 'salto-joven',
    description: 'un salto temprano al exterior para competir al máximo nivel',
  },
  {
    name: 'Felipe Contepomi',
    shape: 'itinerante',
    description: 'una trayectoria larga por varios clubes y países',
  },
  {
    name: 'Ledesma',
    shape: 'tardio',
    description: 'un reconocimiento que llegó con los años y la constancia',
  },
];

export function figureForShape(shape: CareerShape): CareerFigure {
  return CAREER_FIGURES.find((figure) => figure.shape === shape) ?? CAREER_FIGURES[0]!;
}
```

- [ ] **Step 4: Implementar el retiro y el resumen**

Crear `packages/domain/src/career/retirement.ts`:

```typescript
import type { Rng } from './rng.js';
import type { CareerState } from './types.js';
import { figureForShape, type CareerShape } from './figures.js';

const HARD_RETIREMENT_AGE = 41;

export interface CareerComparison {
  figure: string;
  reason: string;
}

export interface CareerSummary {
  tier: string;
  verdict: string;
  score: number;
  comparison: CareerComparison;
  seasons: number;
  clubs: string[];
  peakLevel: number;
}

export function shouldRetire(state: CareerState, rng: Rng): boolean {
  if (state.age >= HARD_RETIREMENT_AGE) return true;
  if (state.age >= 33 && state.overall < 35) return true;
  if (state.age >= 36) return rng.next() < 0.5;
  return false;
}

function shapeOf(state: CareerState): CareerShape {
  const clubs = new Set(state.history.map((record) => record.clubSlug));
  if (clubs.size >= 3) return 'itinerante';
  if (clubs.size <= 1) return 'club-entero';
  const salioJoven = state.history.some((record) => record.age <= 23 && record.level === 1);
  return salioJoven ? 'salto-joven' : 'tardio';
}

/**
 * Pondera media máxima, temporadas, cariño de la hinchada y fama. El peso del
 * arraigo es deliberadamente alto: en el rugby amateur, una carrera entera en el
 * club es un final tan válido como emigrar.
 */
function scoreOf(state: CareerState): number {
  return Math.round(
    state.peakOverall * 3 +
    state.history.length * 12 +
    state.support * 2.5 +
    state.fame * 2,
  );
}

function verdictOf(state: CareerState): { tier: string; verdict: string } {
  const clubs = new Set(state.history.map((record) => record.clubSlug));
  const unSoloClub = clubs.size <= 1;

  if (!state.everPro) {
    if (state.support >= 80 && unSoloClub) {
      return {
        tier: 'Ídolo eterno del club',
        verdict: 'Colgaste los botines donde empezaste. Nunca cruzaste el charco, y en tu club sos leyenda para siempre.',
      };
    }
    if (state.support >= 55) {
      return {
        tier: 'Gloria amateur',
        verdict: 'Una vida de rugby amateur, de tercer tiempo y camiseta sudada. Dejaste todo por los colores.',
      };
    }
    return {
      tier: 'Corazón rugbier',
      verdict: 'No llegaste a la cima ni fuiste ídolo, pero jugaste por amor a la camiseta. El rugby también es esto.',
    };
  }

  if (state.peakOverall >= 90) {
    return {
      tier: 'Leyenda',
      verdict: 'Llegaste tan alto como se puede llegar, y tu nombre quedó grabado en la historia grande.',
    };
  }
  return {
    tier: 'Profesional',
    verdict: 'Viviste del rugby, conociste otras canchas y volviste con historias para contar.',
  };
}

export function summarizeCareer(state: CareerState): CareerSummary {
  const { tier, verdict } = verdictOf(state);
  const figure = figureForShape(shapeOf(state));
  const clubs = [...new Set(state.history.map((record) => record.clubName))];

  return {
    tier,
    verdict,
    score: scoreOf(state),
    comparison: {
      figure: figure.name,
      reason: `Tu carrera se parece a la de ${figure.name}: ${figure.description}.`,
    },
    seasons: state.history.length,
    clubs,
    peakLevel: state.history.reduce((best, record) => Math.min(best, record.level), 99),
  };
}
```

- [ ] **Step 5: Exponer la superficie pública**

Crear `packages/domain/src/career/index.ts`:

```typescript
export * from './rng.js';
export * from './types.js';
export * from './create.js';
export * from './season.js';
export * from './scenarios.js';
export * from './figures.js';
export * from './retirement.js';
```

Agregar a `packages/domain/src/index.ts`, respetando el orden existente:

```typescript
export * from './career/index.js';
```

- [ ] **Step 6: Correr y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/domain test
```
Esperado: PASS, incluidas las pruebas previas del paquete.

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src/career packages/domain/src/index.ts
git commit -m "feat(domain): retiro, veredicto, puntaje y comparacion de la carrera"
```

---

### Task 6: Prohibir el azar global y verificar

**Files:**
- Crear: `packages/domain/src/career/purity.test.ts`

**Interfaces:**
- Consume: todo el motor.
- Produce: nada; es una prueba de guardia.

- [ ] **Step 1: Escribir la prueba de guardia**

```typescript
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CAREER_DIR = new URL('.', import.meta.url).pathname;

describe('pureza del motor de carrera', () => {
  it('ningún archivo de producción usa Math.random', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(CAREER_DIR)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const source = readFileSync(join(CAREER_DIR, file), 'utf8');
      if (source.includes('Math.random')) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('ningún archivo del motor importa framework ni base de datos', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(CAREER_DIR)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(join(CAREER_DIR, file), 'utf8');
      if (/from '(react|next|drizzle-orm|@ovalia\/database)/.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr y verificar que pasa**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/career/purity.test.ts
```
Esperado: PASS. Si falla, el motor rompió una restricción global: corregir el
archivo señalado, no la prueba.

- [ ] **Step 3: Verificación integral**

```bash
corepack pnpm verify
corepack pnpm build
```
Esperado: ambos PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/domain/src/career/purity.test.ts
git commit -m "test(domain): prohibir azar global y dependencias en el motor de carrera"
```

---

## Notas de revisión del plan

**Cobertura del spec.** El azar reproducible está en la tarea 1; el catálogo con
reserva, en la 2; la simulación por temporadas, en la 3; el pozo de escenarios y
la tensión amateur, en la 4; el retiro, el veredicto, el puntaje y la comparación
con figuras, en la 5; la garantía de pureza, en la 6.

**Fuera de este plan, por depender de la interfaz o de la base.** La tarjeta
compartible, el ranking con sus tablas y rutas, la separación de `games-hub.tsx`
en un componente por juego, y la conversión de «Camino al XV» en el paso de
creación. Todo eso va en un segundo plan, que se escribe cuando este termine y
existan las firmas reales del motor.

**Sobre los valores numéricos.** Los umbrales de dificultad, crecimiento y
puntaje son un punto de partida jugable, no una verdad. Se ajustan probando el
juego; las pruebas verifican relaciones —que un jugador mejor rinda más, que un
veterano decline, que ningún camino aplaste al otro—, no números concretos, para
que el ajuste no las rompa.
