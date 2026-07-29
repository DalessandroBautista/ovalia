# Baseline de verificación — plan de datos reales

Fecha: 2026-07-25T04:10Z
Rama: `feat/real-data-platform`
Commit base: `8faa30d9d95a740e1becbd11822a7f4c5cd46ff5`

## Entorno

- Node: v22.14.0
- pnpm: 11.17.0 (vía corepack; `packageManager` = `pnpm@11.17.0`)
- Docker: 29.1.3 / Compose v2.27.0
- PostgreSQL: contenedor `ovalia-db-1` healthy (Compose `db`)

## Comandos ejecutados

| Comando | Resultado |
|---|---|
| `pnpm install --offline` | OK — 9 proyectos, already up to date |
| `pnpm db:migrate` | OK — migraciones aplicadas |
| `pnpm verify` (typecheck + test + lint) | OK |
| `pnpm build` | OK — 8 paquetes, todas las rutas compiladas |

## Tests (53 totales)

| Paquete | Test files | Tests |
|---|---|---|
| `@ovalia/domain` | 6 | 18 |
| `@ovalia/web` | 4 | 15 |
| `@ovalia/api` | 3 | 19 |
| `@ovalia/worker` | 1 | 1 |
| `@ovalia/config`, `@ovalia/database`, `@ovalia/i18n`, `@ovalia/ui` | 0 | 0 |

## Rutas web compiladas

`/`, `/_not-found`, `/admin`, `/ingresar`, `/juegos`, `/noticias`, `/partidos`,
`/partidos/[slug]` (dynamic), `/prodes`, `/torneos`, `/torneos/urba-top-14`,
`/manifest.webmanifest`.

## Warnings

- Ninguno bloqueante durante `verify`/`build`.
- `next.config.ts` permite compilar ignorando errores TypeScript (riesgo P1 de la
  auditoría, a resolver en Hito 15).

## Notas

- No se corrigieron problemas no relacionados en esta fase (Tarea 0.1).
- Baseline verde: punto de partida válido para el plan maestro.
