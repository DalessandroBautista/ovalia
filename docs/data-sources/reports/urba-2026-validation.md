# Validación de ingestión URBA — temporada 2026

Fecha de corrida: 2026-07-26
Fuente: API público `api.urba.org.ar` (parser `urba-1`)
Comando: `pnpm ingest --source urba --all`

## Resultado global

- Catálogo: **success**, 107 upserts (competencias + clubes + enlaces external ID).
- Idempotencia verificada: segunda corrida → `skipped` en catálogo, fixtures y posiciones (checksum).
- Total en DB tras import: 103 equipos, 1182 partidos, 100 filas de posiciones, 40 conflictos en cuarentena.

## Por competencia

| Competencia | Partidos | Primera fecha | Última fecha | Posiciones | Conflictos |
|---|---|---|---|---|---|
| TOP 14 - Superior | 182 | 2026-03-14 | 2026-10-17 | 14 | 0 |
| PRIMERA A - Superior | 182 | 2026-03-14 | 2026-10-24 | 14 | 0 |
| PRIMERA B - Superior | 182 | 2026-03-14 | 2026-10-24 | 14 | 0 |
| PRIMERA C - Superior | 182 | 2026-03-14 | 2026-10-24 | 14 | 0 |
| SEGUNDA - Superior | 182 | 2026-03-14 | 2026-10-24 | 14 | 0 |
| TERCERA - Superior | 110 | 2026-04-11 | 2026-10-17 | 11 | 22 |
| DESARROLLO - Superior | 90 | 2026-04-11 | 2026-09-12 | 10 | 0 |
| FEMENINO - TOP 9 | 72 | 2026-04-12 | 2026-11-08 | 9 | 18 |

## Comparación manual de posiciones (TOP 14) vs fuente oficial

| Pos | Equipo (DB) | Pts (DB) | Pts (oficial) | PJ | ✔ |
|---|---|---|---|---|---|
| 1 | Newman | 66 | 66 | 16 | ✔ |
| 2 | CASI | 56 | 56 | 16 | ✔ |
| 3 | Hindú | 53 | 53 | 16 | ✔ |

Coincidencia exacta con `fixture.urba.org.ar` (view=positions).

## Conflictos (cuarentena, no se inventó nada)

Los 40 conflictos son partidos de **Tercera** y **Femenino Top 9** cuyos clubes
(ids remotos ausentes de `/api/clubs`, probablemente equipos formativos/invitados)
no resolvieron a una entidad canónica. Quedaron en `ingestion_conflicts` para
resolución manual en `/admin` (Hito 13). Ninguno se persistió como partido válido.

## Checksums

Cada capacidad por competencia registró un `ingestion_artifact` con checksum
SHA-256 y `parser_version = urba-1`, garantizando idempotencia y trazabilidad.

## Notas de reconciliación pendiente

- Los slugs derivados del nombre oficial (`top-14-superior`) conviven con el slug
  bootstrap `urba-top-14` del seed. La reconciliación de slugs para la web se hace
  en Hito 8. No afecta la trazabilidad de datos.
- Activación automática programada: queda como decisión del operador
  (`external_sources.active`), documentada en `docs/data-sources/urba.md`.
