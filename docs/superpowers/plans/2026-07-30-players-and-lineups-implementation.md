# Implementación: Jugadores y formaciones por partido (Tramo C)

Fecha: 2026-07-30

Spec de diseño: `2026-07-30-players-and-lineups-design.md`

## Resumen ejecutivo

Implementa la carga manual de formaciones desde el panel de administración,
la persistencia de jugadores y entradas de formación, la API pública de
formaciones y la pestaña en el modal de partido.

## Paso 1 — Dominio: normalizador de nombres

Archivo: `packages/domain/src/player-identity.ts`
Pruebas: `packages/domain/src/player-identity.test.ts`

### Firma

```ts
export function normalizePlayerName(raw: string): string;
```

### Reglas

1. Quitar diacríticos (NFD + eliminar combinantes).
2. Pasar a minúsculas.
3. Descartar caracteres no alfanuméricos.
4. Separar en tokens, ordenar alfabéticamente, unir con espacio.

### Casos de prueba

- `'Juan Cruz Pérez'` → `'cruz juan perez'`
- `'Pérez, Juan Cruz'` → `'cruz juan perez'`
- `'juan cruz perez'` → `'cruz juan perez'`
- `'JUAN CRUZ PÉREZ'` → `'cruz juan perez'`
- `'  Pérez ,  Juan  Cruz  '` → `'cruz juan perez'`
- `''` → `''`
- `'María O\'Connor'` → `'connor maria o'`
- `'N° 10 - García'` → `'garcia'`

## Paso 2 — Dominio: parser de formaciones

Archivo: `packages/domain/src/lineup-parser.ts`
Pruebas: `packages/domain/src/lineup-parser.test.ts`

### Tipos

```ts
export interface ParsedLineupEntry {
  shirtNumber: number;
  name: string;
  isCaptain: boolean;
  isStarter: boolean; // 1-15 titular, 16+ suplente
}

export interface ParsedLineup {
  entries: ParsedLineupEntry[];
  warnings: string[]; // renglones no interpretables
}

export function parseLineupText(raw: string): ParsedLineup;
```

### Reglas del parser

- Cada línea no vacía se intenta parsear.
- Formato esperado: `<número>. <nombre> [(c)]` o `<número> <nombre> [(c)]`
- `(c)`, `(C)`, `[c]`, `[C]`, `©` marcan capitán.
- Titulares: 1–15. Suplentes: 16 en adelante.
- Líneas sin número o con número inválido van a `warnings`.
- Números duplicados van a `warnings` (se conserva el primero).
- Texto vacío produce `{ entries: [], warnings: [] }`.

### Casos de prueba

- Texto estándar de 15 titulares + suplentes.
- Capitán en variantes: `(c)`, `(C)`, `[c]`.
- Renglón sin número → warning.
- Número repetido → warning, se conserva el primero.
- Texto vacío → entries vacías, warnings vacíos.
- Líneas en blanco intercaladas se ignoran.

## Paso 3 — Schema de base de datos

Archivo: `packages/database/src/schema.ts` (agregar tablas)

### Tabla `players`

```ts
export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  fullName: text('full_name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('players_slug_unique').on(table.slug),
  index('players_normalized_idx').on(table.normalizedName),
]);
```

### Tabla `lineup_entries`

```ts
export const lineupEntries = pgTable('lineup_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull().references(() => matches.id),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  shirtNumber: integer('shirt_number').notNull(),
  isStarter: boolean('is_starter').notNull(),
  isCaptain: boolean('is_captain').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('lineup_match_team_shirt_unique').on(table.matchId, table.teamId, table.shirtNumber),
  index('lineup_match_team_idx').on(table.matchId, table.teamId),
  index('lineup_player_idx').on(table.playerId),
]);
```

### Migración

Generar con `pnpm --filter @ovalia/database exec drizzle-kit generate`.
Nombre esperado: `0008_<random>.sql`.

## Paso 4 — Repositorios

### `packages/database/src/repositories/players-repository.ts`

```ts
export async function findPlayerByNormalizedName(db, name): Promise<PlayerRow | null>;
export async function findPlayersByNormalizedName(db, name): Promise<PlayerRow[]>;
export async function upsertPlayer(db, input): Promise<PlayerRow>;
export async function findPlayerById(db, id): Promise<PlayerRow | null>;
```

### `packages/database/src/repositories/lineups-repository.ts`

```ts
export async function getLineupsForMatch(db, matchId): Promise<LineupResult>;
export async function replaceLineup(db, input): Promise<void>;
```

`replaceLineup` borra las entradas existentes del equipo en el partido
e inserta las nuevas, dentro de una transacción. Escribe en `audit_log`.

### Tipos de resultado

```ts
export interface LineupEntryRow {
  shirtNumber: number;
  isStarter: boolean;
  isCaptain: boolean;
  player: { id: string; slug: string; fullName: string };
}

export interface LineupResult {
  home: LineupEntryRow[];
  away: LineupEntryRow[];
}
```

## Paso 5 — API

### Ruta pública

```
GET /v1/matches/:id/lineups
```

Respuesta:
```json
{
  "home": [{ "shirtNumber": 1, "isStarter": true, "isCaptain": false, "player": { "slug": "...", "fullName": "..." } }],
  "away": []
}
```

Sin datos → listas vacías, no error.

### Ruta de administración

```
POST /admin/matches/:id/lineups
Header: x-admin-token
Body: { "side": "home" | "away", "entries": [{ "shirtNumber": 1, "name": "...", "isCaptain": false, "playerId": "..." | null }] }
```

- `playerId: null` → crear jugador nuevo.
- `playerId: "<uuid>"` → vincular a existente.
- Reemplaza solo las entradas del equipo indicado.
- Escribe en `audit_log`.

### Schemas Zod

```ts
export const lineupEntryInputSchema = z.object({
  shirtNumber: z.number().int().min(1).max(99),
  name: z.string().min(1).max(120),
  isCaptain: z.boolean().default(false),
  playerId: z.string().uuid().nullable(),
});

export const adminLineupSchema = z.object({
  side: z.enum(['home', 'away']),
  entries: z.array(lineupEntryInputSchema).min(1).max(30),
});
```

## Paso 6 — Cliente y hook web

### Cliente (`apps/web/src/lib/api/client.ts`)

```ts
export function fetchMatchLineups(id: string, options?): Promise<ApiLineups>;
export function saveMatchLineup(token: string, matchId: string, side: 'home'|'away', entries: LineupEntryInput[]): Promise<void>;
```

### Hook (`apps/web/src/features/matches/use-match-lineups.ts`)

```ts
export function useMatchLineups(matchId: string): {
  status: 'idle' | 'loading' | 'ready' | 'error';
  lineups: ApiLineups | null;
};
```

### Tipos (`apps/web/src/lib/api/types.ts`)

```ts
export interface ApiLineupPlayer { slug: string; fullName: string; }
export interface ApiLineupEntry {
  shirtNumber: number;
  isStarter: boolean;
  isCaptain: boolean;
  player: ApiLineupPlayer;
}
export interface ApiLineups { home: ApiLineupEntry[]; away: ApiLineupEntry[]; }
```

## Paso 7 — Pestaña de formaciones en el modal

Archivo: `apps/web/src/features/matches/match-modal.tsx` (modificar)

- Agregar `'lineups'` al tipo `MatchContextTab`.
- La pestaña solo aparece cuando `lineups.home.length > 0 || lineups.away.length > 0`.
- Panel con dos columnas (local/visitante), titulares (1-15) y suplentes separados.
- Capitán con ícono o marca visual.

## Paso 8 — Pantalla de carga en admin

Archivo: `apps/web/src/features/admin/lineup-editor.tsx` (nuevo)
Integrado en: `apps/web/src/features/admin/admin-page.tsx`

Flujo:
1. Elegir partido (buscador por fecha/torneo).
2. Pegar texto del plantel para cada equipo.
3. Parser muestra previsualización con advertencias.
4. Para cada nombre: si `normalizedName` coincide con jugadores existentes,
   mostrar candidatos con clubes recientes. El editor elige vincular o crear.
5. Confirmar → POST a `/admin/matches/:id/lineups`.
6. Toast de éxito con link al partido.

## Paso 9 — CSS

Agregar estilos para:
- `.match-lineups` (panel de formaciones en modal)
- `.lineup-editor` (pantalla de carga admin)
- `.lineup-preview` (previsualización)
- `.player-candidates` (resolución de ambiguos)

## Orden de ejecución TDD

1. ✅ Pruebas de `normalizePlayerName` → implementación
2. ✅ Pruebas de `parseLineupText` → implementación
3. ✅ Schema + migración
4. ✅ Pruebas de repositorios → implementación
5. ✅ Pruebas de rutas API → implementación
6. ✅ Cliente y hook
7. ✅ Pestaña en modal + pruebas web
8. ✅ Pantalla de carga admin + pruebas web
9. ✅ CSS
10. ✅ `pnpm verify` + `pnpm build` + commit
