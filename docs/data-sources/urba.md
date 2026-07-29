# Fuente URBA — descubrimiento técnico y legal

Fecha de verificación: 2026-07-26

## URLs oficiales

- Sitio: `https://urba.org.ar/`
- Fixture (SPA Next.js): `https://fixture.urba.org.ar/home?id=<championshipId>&view=results|positions`
- API pública JSON: `https://api.urba.org.ar/api/...`
- Imágenes de clubes: `https://api.urba.org.ar/img/clubs/<archivo>`

## Endpoints públicos descubiertos

Descubiertos observando las llamadas XHR de la propia SPA pública (sin autenticación,
sin cabeceras privadas). Todos responden JSON con `GET`:

| Endpoint | Devuelve |
|---|---|
| `/api/seasons` | Temporadas |
| `/api/championships/{year}` | Catálogo de competencias de la temporada |
| `/api/championship/{id}` | Detalle: temporada, equipos y `rounds[].matches[]` |
| `/api/positions/{id}` | Tabla de posiciones oficial |
| `/api/clubs` | Catálogo de clubes con escudo |

No se usan endpoints privados, autenticados ni de intranet (`intraweb.urba.org.ar`).

## Términos / robots

- `https://fixture.urba.org.ar/robots.txt` → 404 (no existe archivo de robots).
- No se localizó una cláusula de términos de uso que prohíba el consumo del API
  público. Ante la ausencia, se procede de forma conservadora: user-agent
  identificable, rate limit bajo, sin evadir controles y con **atribución** a URBA.
- La activación automática (`external_sources.active = true`) queda como **decisión
  del operador** tras confirmar autorización. Mientras tanto el adaptador funciona
  contra fixtures de contrato y puede correrse manualmente (dry-run/import puntual).

## Categorías (temporada 2026) y IDs prioritarios

| Competencia | championshipId |
|---|---|
| TOP 14 - Superior | 2025176 |
| PRIMERA A - Superior | 2025177 |
| PRIMERA B - Superior | 2025178 |
| PRIMERA C - Superior | 2025179 |
| SEGUNDA - Superior | 2025180 |
| TERCERA - Superior | 2025181 |
| DESARROLLO - Superior | 2025182 |
| FEMENINO - TOP 9 | 2025208 |

El catálogo completo (intermedias, formativas, menores) se obtiene de
`/api/championships/{year}` y puede sumarse luego.

## Formato de datos

- **Fechas**: `playdate` en `YYYY-MM-DDTHH:MM:SS` **sin offset** = hora local de
  Argentina (`America/Argentina/Buenos_Aires`, UTC-03:00). Se convierte a UTC con
  offset fijo -180.
- **Partido**: `local_team_id`, `visit_team_id`, `fulfilled` (jugado), `suspended`,
  `local_team_score`/`visit_team_score`, bonus ofensivo/defensivo por lado,
  `local_team.club.name` / `visit_team.club.name`.
- **Posiciones**: `position`, `played`, `won`, `tied`, `lost`, `points_favor`,
  `points_against`, `bonus_offensive`, `bonus_defensive`, `points_total`.
- **Rondas**: `rounds[].name` ("Fecha 1"…), `playdate`.
- Quirk: `/api/championship/{id}` envuelve el objeto en `{ "championship": { "0": {...} } }`.

## Atribución requerida

Mostrar "Fuente: URBA (urba.org.ar)" en datos derivados de esta fuente.

## Frecuencia aceptable

Conservadora: catálogo semanal; fixtures cada 6 h; resultados cada 10 min en ventana
de partido; posiciones tras resultados. Configurable por env (ver `schedule.ts`).
