# Ovalia — Plan maestro de ejecución: eliminar datos operativos hardcodeados

Fecha: 25 de julio de 2026  
Especificación obligatoria: `docs/superpowers/specs/2026-07-25-real-data-platform-design.md`  
Auditoría inicial: `docs/production-readiness-audit-2026-07-25.md`

## Instrucción principal para la IA ejecutora

Ejecutá **todo este plan**, en orden, dentro del repositorio. No te detengas al terminar la base de datos, un scraper o una pantalla. El objetivo solo está cumplido cuando todas las superficies variables leen datos persistidos reales, el modo productivo no importa `demo-data.ts`, no quedan controles ficticios y pasan todos los gates finales.

Trabajá con autonomía dentro del alcance. Si una fuente externa no permite automatización o cambió su formato:

1. documentá la evidencia;
2. no evadas controles ni inventes datos;
3. implementá el adaptador manual/CSV equivalente;
4. continuá con el resto del plan;
5. reportá como bloqueo externo únicamente la activación automática de esa fuente, no el proyecto completo.

No publiques, no contrates servicios pagos y no superes el presupuesto mensual sin autorización. Highlightly gratuito se usa únicamente para live; no presupongas endpoints pagos.

## Reglas de ejecución

- Leé por completo `AGENTS.md`, la especificación y la auditoría antes de editar.
- Preservá cambios del usuario y empezá cada hito con `git status --short`.
- Usá TDD: prueba fallida, implementación mínima, refactor, verificación.
- Usá `apply_patch` para ediciones manuales.
- No uses datos demo como fallback productivo.
- Los fixtures de tests deben vivir en carpetas de test y tener nombres explícitos.
- PostgreSQL es la única fuente canónica consumida por la API pública.
- La web solo consume la API de Ovalia; nunca scrapea ni contiene claves.
- Todo dato importado conserva fuente, fecha, checksum y versión del parser.
- Toda mutación admin conserva usuario y motivo en auditoría.
- Cada hito termina con tests específicos, `pnpm verify`, revisión de diff y un commit enfocado.
- No declares una tarea terminada porque la UI “se ve bien”; verificá persistencia, recarga y error states.
- Si un test existente valida contenido demo, reemplazalo por una aserción de comportamiento real; no debilites la cobertura.

## Definition of Done global

El trabajo termina únicamente cuando:

- `apps/api/src/app.ts` no importa `demo-data.ts`;
- `rg` no encuentra fixtures, resultados, tablas, artículos, contadores o cierres operativos embebidos en componentes;
- no quedan `href="#"`, botones visibles sin comportamiento ni rutas de detalle ficticias;
- Inicio, Partidos, Detalle, Torneos, Prodes, Noticias y Admin consultan datos persistidos;
- cada partido programado, live o final abre un detalle válido;
- URBA completa tiene ingestión oficial automatizada o importación manual trazable;
- UAR e internacionales priorizados tienen adaptadores independientes o fallback CSV explícito;
- las caídas externas muestran datos verificados stale o ausencia honesta;
- auth, prode, CMS y admin persisten y respetan permisos;
- migraciones, tests, lint, typecheck, build y E2E pasan desde un clon limpio;
- el README permite levantar todo localmente con un único flujo;
- existe informe final de cobertura, fuentes activas, fuentes manuales y costo estimado.

---

## Hito 0 — Baseline, inventario y guardas automáticas

### Tarea 0.1 — Verificar baseline

Ejecutar:

```bash
git status --short
pnpm install --offline
pnpm db:up
pnpm db:migrate
pnpm verify
pnpm build
```

Guardar resultados en `docs/verification/real-data-baseline.md`, incluyendo commit, versiones, tests y cualquier warning. No arreglar todavía problemas no relacionados.

### Tarea 0.2 — Crear inventario machine-readable

Crear `docs/data-sources/hardcoded-data-inventory.md` con una fila por hallazgo:

- archivo y línea;
- dato o acción;
- clasificación: operativo, editorial, configuración o test;
- fuente real destino;
- endpoint/repositorio destino;
- hito responsable;
- criterio de eliminación.

Debe incluir como mínimo:

- `apps/api/src/demo-data.ts` y su import en `apps/api/src/app.ts`;
- `tournamentGroups`, prode y `rows` de `portal-pages.tsx`;
- stats, prode, countdown, nota y año de `home-page.tsx`;
- artículos de `apps/web/app/noticias/page.tsx`;
- contadores/cola de `apps/web/app/admin/page.tsx`;
- controles de `apps/web/app/ingresar/page.tsx`;
- preguntas de juegos, marcadas como contenido estático permitido;
- catálogo de escudos, separando aliases permitidos de cobertura incompleta;
- configuración local válida de `.env.example`.

### Tarea 0.3 — Agregar guard test contra regresiones

Crear `scripts/audit-production-hardcodes.mjs` y un test que falle ante:

- imports productivos de `demo-data`;
- `href="#"` en `apps/web`;
- nombres prohibidos `matchCards`, `urbaStandings` o arrays operativos conocidos;
- cuentas regresivas literales con formato `HH:MM:SS` en componentes;
- URLs de proveedores en código cliente fuera de la API Ovalia;
- credenciales o secrets versionados.

Permitir fixtures de test mediante paths explícitos. Agregar `pnpm audit:hardcodes` y ejecutarlo dentro de `pnpm verify` solo al final del Hito 17; mientras tanto mantener una allowlist documentada que se reduzca hito a hito.

Commit sugerido: `test: inventory production hardcodes`

---

## Hito 1 — Modelo de datos canónico y migraciones

Dependencia: Hito 0.

### Tarea 1.1 — Diseñar ampliación incremental

Revisar `packages/database/src/schema.ts` y migraciones existentes. No duplicar `teams`, `competitions`, `seasons`, `matches`, `standings`, `articles`, `predictions` ni `ingestionRuns`.

Agregar mediante migraciones Drizzle:

- `organizations` o `unions`;
- `competition_phases`, `rounds` y grupos si el formato lo requiere;
- `external_sources`;
- `external_entities` para IDs remotos por tipo/proveedor;
- `ingestion_artifacts` con URL, fetchedAt, status, contentType, checksum, parserVersion y payload/rawPath;
- `ingestion_conflicts` con estado, candidates y resolution;
- `editorial_overrides` con target, patch, reason, author y vigencia;
- `standings_snapshots` o versión/fetchedAt/source sobre standings;
- `audit_log`;
- tablas de sesión/cuenta/verificación requeridas por la solución auth elegida;
- `prediction_contests`, grupos/rankings si no están cubiertos;
- campos de fuente/frescura en registros deportivos o relación equivalente;
- tabla de jobs si PostgreSQL actuará como cola inicial.

Agregar índices por `startsAt`, competencia/temporada, estado, external ID, checksum, job status y publicación.

### Tarea 1.2 — Probar constraints primero

Crear tests de base que fallen antes de migrar y luego validen:

- external ID único por proveedor y tipo;
- partido sin local/visitante iguales;
- predicción única por usuario/partido/concurso;
- slug/temporada únicos;
- ingestión idempotente por fuente/checksum;
- override con autor y motivo obligatorios;
- relaciones y cascadas/restricciones esperadas;
- índices relevantes presentes.

### Tarea 1.3 — Repositorios

Crear módulos focalizados en `packages/database/src/repositories/`:

- `teams-repository.ts`;
- `competitions-repository.ts`;
- `matches-repository.ts`;
- `standings-repository.ts`;
- `ingestion-repository.ts`;
- `articles-repository.ts`;
- `predictions-repository.ts`;
- `users-repository.ts`;
- `audit-repository.ts`.

Cada repositorio recibe la conexión; no usa singleton oculto. Implementar transacciones para upsert de lotes, conciliación y mutaciones de prode.

Tests: PostgreSQL real de test, rollback/limpieza determinista, ningún mock de SQL para comportamiento crítico.

### Tarea 1.4 — Seed honesto

Modificar `packages/database/src/seed.ts` para sembrar únicamente:

- configuración de fuentes;
- competencias/temporadas estructurales necesarias para bootstrap;
- roles y usuario admin de desarrollo si está explícitamente marcado;
- aliases/equipos verificados existentes;
- contenido de desarrollo solo bajo `SEED_DEMO=true`, nunca por defecto en producción.

El seed normal no debe crear partidos que puedan aparecer como reales.

Gate:

```bash
pnpm db:migrate
pnpm --filter @ovalia/database test
pnpm verify
```

Commit sugerido: `feat: add canonical sports data repositories`

---

## Hito 2 — Contratos de ingestión y normalización

Dependencia: Hito 1.

### Tarea 2.1 — Contratos comunes

Crear en `packages/domain/src/ingestion/`:

- `source.ts`: identificador, prioridad y capabilities;
- `external-team.ts`;
- `external-competition.ts`;
- `external-match.ts`;
- `external-standing.ts`;
- `external-article-reference.ts`;
- schemas Zod para parsear límites de entrada;
- tipos de resultado: valid, conflict, quarantined, skipped.

Definir `SportsDataAdapter` con métodos opcionales por capability: catálogo, fixtures, resultados, standings y noticias de referencia.

### Tarea 2.2 — Normalizador determinista

Crear `apps/worker/src/ingestion/normalization/` con servicios para:

- Unicode, mayúsculas, tildes y abreviaturas;
- aliases persistidos;
- resolución por external ID;
- detección de coincidencias ambiguas;
- conversión de fechas con timezone de la competencia;
- estados de partido;
- score y bonus;
- identidad natural de un partido.

Escribir tests antes de implementar para Hindú/Hindu, CASI/nombre completo, CUBA, Nueva Zelanda/New Zealand, Sudáfrica/South Africa, cambios horarios y equipos con nombres parecidos.

Nunca aceptar automáticamente una coincidencia ambigua basada solo en similitud.

### Tarea 2.3 — Orquestador idempotente

Crear `apps/worker/src/ingestion/run-ingestion.ts`:

1. registrar run;
2. descargar con timeout, user-agent y rate limit;
3. guardar checksum/artifact;
4. omitir checksum ya procesado;
5. parsear con versión explícita;
6. normalizar;
7. persistir lote en transacción;
8. crear conflictos/cuarentena;
9. recalcular/conciliar standings;
10. finalizar run con métricas.

Agregar retries acotados para errores transitorios, pero no para errores de parser.

### Tarea 2.4 — Scheduler económico

Implementar scheduler en worker con PostgreSQL advisory lock o tabla de jobs. Configurar frecuencias por env. Garantizar que dos workers no ejecuten el mismo job simultáneamente.

Agregar CLI:

```bash
pnpm ingest --source urba --capability fixtures --dry-run
pnpm ingest --source urba --all
pnpm ingest:status
```

Gate: tests de idempotencia, lock, timeout, parser roto y reintento.

Commit sugerido: `feat: add traceable ingestion pipeline`

---

## Hito 3 — Adaptador URBA completo

Dependencia: Hito 2. Es la primera fuente prioritaria.

### Tarea 3.1 — Descubrimiento técnico y legal

Documentar en `docs/data-sources/urba.md`:

- URLs oficiales;
- categorías: Top 14, Primera A/B/C, Segunda, Tercera, Desarrollo y Femenino Top 9;
- endpoint JSON público si existe; si no, estructura HTML;
- términos/robots y frecuencia aceptable;
- timezone, IDs y formato de rondas;
- atribución requerida;
- fecha de verificación.

No usar endpoints privados o autenticados. Si automatización no está permitida, saltar a Tarea 3.6 CSV sin detener los demás hitos.

### Tarea 3.2 — Fixtures de contrato

Guardar muestras reducidas y atribuidas en `apps/worker/src/ingestion/adapters/urba/__fixtures__/` para:

- catálogo;
- fixture futuro;
- resultados con bonus;
- posiciones completas;
- fecha sin resultados;
- respuesta rota.

Eliminar datos personales innecesarios y documentar fecha/URL.

### Tarea 3.3 — Parser y adapter

Crear:

- `urba-adapter.ts`;
- `urba-parser.ts`;
- `urba-mappers.ts`;
- tests de contrato.

El parser debe devolver datos tipados sin escribir DB. El adapter maneja HTTP sin conocer repositorios.

### Tarea 3.4 — Cobertura total

Importar por cada competencia:

- nombre, categoría y temporada;
- equipos y escudos/URLs oficiales permitidas;
- todas las fechas publicadas;
- horarios/sedes disponibles;
- resultados y estados;
- tabla completa con PJ, G, E, P, BO, BD y PTS.

Comparar posiciones calculadas vs oficiales y crear conflicto si difieren.

### Tarea 3.5 — Validación real

Ejecutar dry-run y luego import contra la fuente actual. Generar `docs/data-sources/reports/urba-2026-validation.md` con:

- conteo esperado/obtenido por competencia;
- primera/última fecha;
- equipos no resueltos;
- conflictos;
- checksum y hora;
- muestra de comparación manual.

### Tarea 3.6 — Importación CSV de respaldo

Crear template CSV, validador, dry-run y confirmación para las mismas entidades. La importación conserva archivo, usuario y checksum. Debe funcionar aunque el adapter automático quede deshabilitado.

Gate: Top 14 completo y al menos una competencia de cada formato importada; cero fixture inventado.

Commit sugerido: `feat: ingest official urba competitions`

---

## Hito 4 — Adaptadores UAR y competencias del interior

Dependencia: Hito 2; puede comenzar después de estabilizar el contrato URBA.

### Tarea 4.1 — Matriz de cobertura

Crear `docs/data-sources/uar.md` con fuente y método por:

- Torneo del Interior A/B;
- Nacional de Clubes masculino/femenino;
- Seven de la República masculino/femenino;
- Argentino Juvenil M17;
- Super Rugby Américas;
- otras competencias UAR visibles en catálogo.

No asumir que una noticia es un fixture completo. Priorizar página/documento oficial estructurado; usar noticias solo como referencia y enviar datos incompletos a revisión.

### Tarea 4.2 — Parsers por formato

Crear adaptadores pequeños por formato real:

- HTML estructurado;
- PDF oficial;
- CSV/planilla oficial;
- carga manual.

No crear un parser monolítico con condicionales por torneo. Compartir utilidades puras de tablas/fechas cuando el formato sea idéntico.

### Tarea 4.3 — Tests y validación

Para cada competencia habilitada:

- fixture de contrato;
- test de parser;
- test de normalización;
- dry-run real;
- reporte de conteos;
- import idempotente.

Las competencias sin fuente completa deben aparecer en admin como `manual`, no como vacías “automatizadas”.

Commit sugerido: `feat: ingest official uar competitions`

---

## Hito 5 — Internacionales y proveedor live

### Tarea 5.1 — World Rugby/SANZAAR

Documentar y adaptar fuentes autorizadas para:

- selecciones argentinas;
- Rugby Championship;
- mundiales masculino/femenino;
- World Rugby U20;
- SVNS;
- Six Nations y competencias internacionales visibles en Ovalia.

Preferir feeds/calendarios oficiales. Normalizar timezone y nombres multilingües. Si solo existe calendario de fixtures, resultados se completan mediante otra fuente oficial o revisión manual.

### Tarea 5.2 — Persistir live verificado

Modificar `apps/api/src/live/live-feed.ts` y/o worker para:

- mantener la clave únicamente server-side;
- usar caché compartida en PostgreSQL mientras exista una instancia económica;
- almacenar último feed verificado y fetchedAt;
- asociar un evento live al partido canónico por external ID o resolución segura;
- no crear automáticamente un partido ambiguo;
- servir stale cuando el proveedor falla;
- registrar cuota y errores sin exponer secretos.

### Tarea 5.3 — Overlay, no reemplazo

La agenda y detalle base siempre vienen de DB. El live solo superpone marcador/fase/frescura al partido asociado. Cuando termina, ejecutar conciliación con la fuente oficial y persistir resultado final.

Tests: cuota agotada, timeout, respuesta inválida, dos instancias, asociación ambigua, stale y finalización.

Commit sugerido: `feat: reconcile official fixtures with live scores`

---

## Hito 6 — API real y segura

Dependencias: Hitos 1–5 para datos; implementar por slices.

### Tarea 6.1 — Configuración y plugins

- Usar `packages/config` en API/worker/web.
- Fallar al iniciar producción si faltan variables obligatorias.
- Registrar Helmet y rate limit.
- Configurar CORS por ambiente.
- Agregar handler uniforme de errores y request IDs.
- Crear `/ready` que compruebe DB.

### Tarea 6.2 — Reemplazar demo-data

Escribir primero tests de integración contra repositorios reales. Luego modificar `apps/api/src/app.ts` para inyectar servicios/repositorios y eliminar el import de `./demo-data`.

Mover `apps/api/src/demo-data.ts` a factories de test o eliminarlo. Ningún build productivo debe incluirlo.

### Tarea 6.3 — Endpoints deportivos

Implementar con schemas de request/response:

- rango/paginación de partidos;
- detalle completo;
- catálogo y detalle de competencias;
- temporadas, rondas y standings;
- equipos;
- agregado de home;
- source/freshness donde corresponda.

Evitar N+1 con queries/joins medidos. Limitar rangos máximos.

### Tarea 6.4 — OpenAPI y contratos

Publicar OpenAPI generado desde schemas. Agregar contract tests y generar/compartir tipos con la web sin casts manuales inseguros.

Gate:

```bash
curl -sS http://localhost:4000/ready
curl -sS 'http://localhost:4000/v1/matches?from=2026-07-01&to=2026-08-01'
pnpm --filter @ovalia/api test
pnpm verify
```

Commit sugerido: `feat: serve canonical sports data from postgres`

---

## Hito 7 — Inicio, calendario y centro de partidos

### Tarea 7.1 — Cliente API compartido

Crear `apps/web/src/lib/api/` con cliente tipado, timeout, errores y base URL validada. Elegir server fetching para contenido indexable y client fetching solo donde haya interacción/live. Evitar dos hooks independientes solicitando el mismo recurso.

### Tarea 7.2 — Agenda por URL y rango

Actualizar:

- `apps/web/src/features/matches/use-agenda.ts`;
- `agenda-data.ts`;
- `home-page.tsx`;
- `portal-pages.tsx`.

Requisitos:

- backend filtra por rango;
- `/partidos?fecha=YYYY-MM-DD` es compartible;
- botones cambian URL/estado sin perder accesibilidad;
- la home pide solo la ventana necesaria;
- loading/error/empty/stale son distintos;
- no existe array local de fixtures.

### Tarea 7.3 — Detalle real

Reescribir `MatchDetailPage` para consultar `/v1/matches/:id` aunque no haya live. Mostrar datos disponibles según estado y superponer live asociado.

Tests/E2E:

- fecha con partidos;
- fecha vacía;
- navegación anterior/siguiente;
- programado abre detalle;
- final muestra score;
- live muestra frescura;
- API caída muestra error honesto;
- desktop y móvil Chrome.

Commit sugerido: `feat: connect match experiences to canonical data`

---

## Hito 8 — Torneos, posiciones, equipos y escudos

### Tarea 8.1 — Catálogo real

Eliminar `tournamentGroups` de `portal-pages.tsx`. Crear rutas por slug/temporada basadas en API. No mostrar una competencia sin datos como si estuviera implementada; sí puede mostrarse como catálogo con estado de cobertura explícito.

### Tarea 8.2 — Página de torneo

Eliminar `rows` y temporada literal. Implementar:

- selector de temporada;
- resultados;
- próximos partidos;
- posiciones completas;
- rondas/fases;
- procedencia y actualización;
- tabs con URLs o secciones reales.

### Tarea 8.3 — Equipos

Expandir equipos desde fuentes/imports. Mantener assets locales verificados y fallback; no bloquear imports por escudo ausente. Crear página o componente de equipo si la navegación lo expone.

### Tarea 8.4 — Concordancia

E2E debe comparar una muestra importada de URBA con DB/API/UI. Testear bonus, orden y desempates.

Commit sugerido: `feat: render real competitions and standings`

---

## Hito 9 — Agregados reales de portada

### Tarea 9.1 — `/v1/home`

Crear servicio que devuelva:

- torneos activos cubiertos;
- clubes/equipos activos únicos;
- partidos live;
- agenda de la fecha;
- próximo prode abierto;
- artículo destacado publicado;
- generatedAt/freshness por bloque.

### Tarea 9.2 — Eliminar literales

Eliminar de `home-page.tsx`:

- `26`, `184`;
- `PRODE · FECHA 17`;
- `01:42:18`;
- nota, autor y tiempo de lectura fijos;
- `© 2026` literal.

La cuenta regresiva se calcula a partir de `closesAt` y se actualiza en cliente; al vencer refresca/bloquea el prode.

Tests: home sin prode, sin artículo, con datos stale y cambio de año.

Commit sugerido: `feat: derive home content from live platform data`

---

## Hito 10 — Autenticación, sesiones y autorización

### Tarea 10.1 — Elegir e integrar solución compatible

Usar una solución mantenida compatible con Next.js/PostgreSQL o implementar sesiones robustas existentes en la arquitectura. Documentar decisión. Debe soportar email/contraseña o magic link y Google opcional sin obligar una credencial externa para desarrollo.

### Tarea 10.2 — Flujos

Implementar registro/login/logout, expiración, recuperación y verificación. Correo de desarrollo se captura localmente.

### Tarea 10.3 — RBAC

Roles `fan`, `contributor`, `editor`, `admin`. Proteger API y `/admin` server-side; ocultar botones no sustituye autorización.

### Tarea 10.4 — Seguridad

Cookies HTTP-only/Secure/SameSite, CSRF para mutaciones, rate limit en auth, hashing seguro, rotación/revocación y auditoría.

Reemplazar todos los botones/links ficticios de `ingresar/page.tsx` por formularios funcionales.

E2E: login válido/inválido, logout, sesión expirada, recuperación y acceso admin denegado/permitido.

Commit sugerido: `feat: add authenticated roles and protected admin`

---

## Hito 11 — Prode completamente persistido

### Tarea 11.1 — Modelo y reglas

Completar concursos, reglas versionadas, cierre, predictions, groups y rankings. Reutilizar tests del dominio existentes y agregar casos de concurrencia/cierre.

### Tarea 11.2 — API

Endpoints autenticados para:

- concurso activo;
- guardar/editar antes del cierre;
- obtener predicción propia;
- ranking global/privado;
- crear/unirse a grupo si está en alcance visible.

Validar scores, ownership e idempotencia. El backend usa su reloj transaccional para cerrar.

### Tarea 11.3 — UI

Eliminar arrays de `PredictionPage`. Cargar partidos del concurso; guardar con feedback; restaurar al recargar; bloquear al cierre; mostrar error/reintento.

Actualizar destacado de home desde el mismo concurso.

E2E: usuario predice, recarga, edita, llega el cierre, no puede mutar y aparece en ranking tras puntuación.

Commit sugerido: `feat: connect predictions to users and real matches`

---

## Hito 12 — CMS, noticias y agente editorial

### Tarea 12.1 — API de artículos

Implementar drafts/review/published/archived, slug, autor, tags, SEO, revisión y publicación autorizada. Público solo ve `published` con `publishedAt` válido.

### Tarea 12.2 — Worker real

Modificar `apps/worker/src/index.ts` para procesar jobs de partidos finalizados verificados:

1. reunir hechos persistidos;
2. crear job idempotente;
3. llamar `generateMatchDraft` si hay clave/cuota;
4. validar salida;
5. persistir artículo `review` con modelo/prompt/input/costo;
6. nunca publicar automáticamente.

Sin `OPENAI_API_KEY`, permitir creación editorial manual y dejar job pendiente/deshabilitado sin romper el worker.

### Tarea 12.3 — Noticias reales

Eliminar `articles` local de `noticias/page.tsx`. Crear listado, detalle por slug, empty state y metadata. Home usa artículo destacado publicado.

### Tarea 12.4 — Cola de revisión

Reemplazar contadores y nota fija de `/admin` con queries reales. Implementar abrir, editar, aprobar, rechazar y publicar con auditoría.

Tests: output inválido, timeout, duplicado, sin clave, editor no autorizado, publicación manual y artículo visible después de publicar.

Commit sugerido: `feat: persist editorial drafts and published stories`

---

## Hito 13 — Administración de datos e importaciones

### Tarea 13.1 — Dashboard real

Contadores desde DB: live, conflictos, runs fallidos, drafts, freshness y jobs.

### Tarea 13.2 — Conflictos y overrides

UI/API para:

- ver raw vs normalizado;
- asociar team/competition;
- corregir partido/resultado;
- ingresar motivo;
- cerrar conflicto;
- revertir override cuando sea seguro.

### Tarea 13.3 — CSV/manual

Subida validada, dry-run, diff, confirmación y reporte. Proteger tamaño/tipo y no ejecutar fórmulas de CSV. Registrar usuario/checksum.

### Tarea 13.4 — Runs y reintentos

Lista de imports, métricas, errores de parser, retry seguro y botón de ingestión bajo rate limit.

E2E: editor carga CSV, resuelve conflicto y el cambio aparece en API/web después de recargar.

Commit sugerido: `feat: add audited sports data operations console`

---

## Hito 14 — Buscar, idioma, navegación y acciones pendientes

### Tarea 14.1 — Inventario de controles

Recorrer toda la web con browser automation y enumerar botones/links. Cada uno debe:

- navegar a una ruta real;
- ejecutar una acción real;
- estar deshabilitado con explicación;
- o eliminarse.

### Tarea 14.2 — Buscar

Si permanece visible, implementar búsqueda real sobre equipos, torneos y artículos con endpoint, debounce, teclado y empty state. Si no se implementa en este release, retirar el botón.

### Tarea 14.3 — Idiomas

Si permanece el selector ES, conectar i18n y persistir locale. Si EN/PT no están completos, mostrar solo ES y retirar selector engañoso.

### Tarea 14.4 — Rutas

Eliminar todos los `href="#"`; agregar páginas 404/500, links reales y estados de capacidad no disponible.

Commit sugerido: `fix: remove placeholder navigation and controls`

---

## Hito 15 — Operación económica y despliegue

### Tarea 15.1 — Servicios

Agregar Dockerfiles multi-stage para web, API y worker. Extender Compose de desarrollo con healthchecks, sin introducir servicios pagos obligatorios.

### Tarea 15.2 — Configuración

Separar dev/test/prod. Validar secrets y origins. Eliminar `typescript.ignoreBuildErrors` o hacer que `next build` valide tipos.

### Tarea 15.3 — Observabilidad

Logs JSON, request IDs, métricas básicas y alertas por:

- fuente stale;
- parser fallido;
- conflicto creciente;
- job trabado;
- cuota live;
- DB no disponible.

Implementación inicial puede usar logs/health y un monitor gratuito, sin Redis ni SaaS pagos obligatorios.

### Tarea 15.4 — Backups

Documentar backup/restore PostgreSQL y ejecutar una restauración de prueba. Guardar evidencia sin datos sensibles.

### Tarea 15.5 — CI

Pipeline desde clon limpio:

- install frozen;
- audit de secretos;
- typecheck;
- tests;
- lint;
- build;
- DB temporal + migraciones;
- contract parsers;
- E2E Chrome;
- hardcode audit.

Commit sugerido: `chore: add production verification and operations`

---

## Hito 16 — Suite E2E y pruebas de resiliencia

### Tarea 16.1 — E2E versionado

Agregar Playwright o framework ya disponible, con API/DB controladas localmente. Flujos mínimos:

1. Inicio muestra agregados reales.
2. Calendario cambia fecha y conserva URL.
3. Programado/final/live abren detalle.
4. Torneo cambia temporada y tabla.
5. Usuario inicia sesión y guarda prode.
6. Admin queda protegido.
7. Editor resuelve import y publica borrador.
8. Noticia publicada aparece en home/listado/detalle.
9. Mobile 390 px y desktop.

### Tarea 16.2 — Resiliencia

Simular:

- fuente oficial caída;
- HTML cambiado;
- Highlightly 429;
- DB reiniciada;
- worker duplicado;
- conflicto de identidad;
- timezone cerca de medianoche;
- import repetido;
- dos usuarios guardando al cierre.

Verificar ausencia de datos ficticios, duplicados y mutaciones después del cierre.

Commit sugerido: `test: cover real data user journeys end to end`

---

## Hito 17 — Eliminación definitiva de demo y hardcodes

### Tarea 17.1 — Vaciar allowlist

Ejecutar el inventario del Hito 0 y resolver cada fila. La allowlist del script debe quedar solo con contenido estático aprobado y fixtures de test.

### Tarea 17.2 — Eliminar código obsoleto

- borrar `apps/api/src/demo-data.ts` si ya no lo usan tests;
- borrar hooks/componentes duplicados;
- retirar CSS de pantallas eliminadas;
- eliminar rutas placeholder;
- eliminar copy que prometa funcionalidades no implementadas.

### Tarea 17.3 — Escaneo final

Ejecutar y revisar manualmente:

```bash
rg -n "demo-data|matchCards|urbaStandings|href=\"#\"|01:42:18|Fecha 12|© 2026" apps packages
rg -n "localhost|HIGHLIGHTLY|OPENAI_API_KEY|DATABASE_URL" apps/web
pnpm audit:hardcodes
```

Resultados válidos solo en tests/docs/config apropiada. No ocultar falsos positivos sin documentarlos.

Commit sugerido: `refactor: remove remaining production demo data`

---

## Hito 18 — Gate final y entrega

### Tarea 18.1 — Clon limpio

Desde checkout limpio y DB vacía:

```bash
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm verify
pnpm build
pnpm e2e
pnpm audit:hardcodes
```

Iniciar web/API/worker, ejecutar import URBA o CSV oficial y comprobar datos visibles.

### Tarea 18.2 — Auditoría visual/funcional Chrome

Recorrer todas las rutas desktop y móvil. Guardar consola, red y screenshots en `.artifacts/real-data-final/`. Cero 404 de assets propios, errores React, controles muertos o enlaces `#`.

### Tarea 18.3 — Documentación final

Actualizar `README.md` con:

- arquitectura;
- setup de un comando;
- migraciones/seeds;
- fuentes y frecuencia;
- import manual;
- auth/admin;
- worker editorial;
- backups;
- troubleshooting;
- limitaciones honestas.

Crear `docs/production-readiness-final.md` con:

- cobertura por competencia;
- fuente/método/última verificación;
- automatizada vs manual;
- resultados de gates;
- riesgos residuales;
- costo mensual estimado;
- pasos de despliegue/rollback.

### Tarea 18.4 — Cierre

Revisar `git diff --check`, estado, migraciones, secretos y commits. No hacer push/deploy sin autorización explícita.

Commit sugerido: `docs: certify real data production readiness`

---

## Orden crítico y paralelización permitida

Camino crítico:

```text
0 → 1 → 2 → 3 → 6 → 7/8/9 → 10 → 11 → 12/13 → 14 → 15/16 → 17 → 18
```

Después del Hito 2 pueden desarrollarse UAR e internacionales en paralelo con URBA, pero ninguna rama debe modificar simultáneamente los contratos comunes sin coordinación. Auth puede avanzar después del esquema del Hito 1. CMS puede avanzar después de auth y repositorios. Integrar por slices pequeños y mantener `main` verde.

## Riesgos y contingencias

| Riesgo | Señal | Mitigación | Contingencia |
|---|---|---|---|
| Fuente cambia HTML | contract test/parser falla | parser versionado + alerta | CSV/manual, conservar snapshot stale |
| Automatización no permitida | términos/robots | revisión antes de activar | import oficial manual/CSV |
| IDs inconsistentes | conflictos crecientes | external IDs + aliases revisados | cuarentena/admin |
| Cuota live agotada | 429/contador | caché/lock/frecuencia | último feed verificado, agenda DB |
| Costos exceden USD 10 | forecast mensual | PostgreSQL como cola/cache inicial | reducir frecuencia/cobertura; pedir decisión |
| Dos workers duplican | runs simultáneos | advisory lock/idempotencia | cancelar duplicado y reconciliar |
| Prode muta al cierre | test concurrencia falla | transacción/reloj servidor | bloquear concurso y auditar |
| IA editorial inventa | schema/hechos no coinciden | structured output + revisión | rechazar draft, creación manual |

## Formato de reporte de la IA ejecutora

Al finalizar cada hito, informar:

1. outcome obtenido;
2. archivos/migraciones principales;
3. pruebas ejecutadas y resultado;
4. datos reales validados y fuente;
5. conflictos o cobertura manual;
6. costo/impacto operativo;
7. commit creado;
8. siguiente hito.

El informe final debe distinguir claramente:

- implementado y verificado;
- implementado pero pendiente de credencial/permiso externo;
- fuera de alcance aprobado.

No usar “listo para producción” mientras falle cualquier punto de la Definition of Done global.

---

## Anexo A — Lista concreta de hardcodes actuales y destino obligatorio

Esta lista es el baseline conocido. La IA debe ampliarla con el escaneo del Hito 0 si encuentra más casos.

| Archivo/área | Hardcode actual | Clasificación | Destino obligatorio | Hito |
|---|---|---|---|---|
| `apps/api/src/demo-data.ts` | Cuatro partidos 2026 | Operativo prohibido | Ingestión → PostgreSQL → repositorio | 3–6 |
| `apps/api/src/demo-data.ts` | Cuatro posiciones URBA | Operativo prohibido | Standings oficiales + cálculo/conciliación | 3–6 |
| `apps/api/src/app.ts` | Import de `demo-data` | Operativo prohibido | Repositorios inyectados | 6 |
| `apps/api/src/app.ts` | Solo slug `urba-top-14` y temporada `2026` | Operativo prohibido | Competencia/temporada desde DB | 6/8 |
| `apps/web/src/features/home/home-page.tsx` | `26` torneos y `184` clubes | Operativo prohibido | Agregados `/v1/home` | 9 |
| `home-page.tsx` Sidebar | `PRODE · FECHA 17` | Operativo prohibido | Concurso abierto real | 11 |
| `home-page.tsx` Sidebar | Countdown `01:42:18` | Operativo prohibido | Diferencia entre reloj y `closesAt` | 9/11 |
| `home-page.tsx` Sidebar | Nota, resumen, autor y lectura | Editorial prohibido | Artículo destacado publicado | 12 |
| `home-page.tsx` Footer | Año `2026` | Presentación variable | Año corriente/configuración | 9 |
| `portal-pages.tsx` | `tournamentGroups` | Operativo prohibido | `GET /v1/competitions` | 8 |
| `portal-pages.tsx` | Links de torneo a `#` | Control ficticio | Rutas por slug o capacidad deshabilitada | 8/14 |
| `PredictionPage` | URBA, Fecha 12, cierre y tres partidos | Operativo prohibido | Concurso y partidos persistidos | 11 |
| `PredictionPage` | Inputs `defaultValue=0` sin carga/guardado | Acción ficticia | Predicción del usuario/API | 11 |
| `TournamentPage` | Cinco filas de tabla | Operativo prohibido | Standings completos desde API | 8 |
| `TournamentPage` | Temporada 2026 | Operativo prohibido | Selector/temporada activa DB | 8 |
| `TournamentPage` | Tabs con anclas sin contenido real | Control ficticio | URLs/secciones reales | 8/14 |
| `MatchDetailPage` | Solo busca en feed live | Comportamiento incompleto | DB por ID + overlay live | 7 |
| `apps/web/app/noticias/page.tsx` | Tres artículos | Editorial prohibido | Artículos `published` | 12 |
| `noticias/page.tsx` | “Leer nota” a `#` | Control ficticio | Ruta `/noticias/:slug` | 12/14 |
| `apps/web/app/admin/page.tsx` | Contadores 3/7/4 | Operativo prohibido | Queries de dashboard | 13 |
| `admin/page.tsx` | Borrador y botón fijos | Editorial/acción ficticia | Cola y workflow real | 12/13 |
| `apps/web/app/ingresar/page.tsx` | Botones/form sin handlers | Acción ficticia | Auth y recuperación reales | 10 |
| `ingresar/page.tsx` | Recuperación a `#` | Control ficticio | Ruta/flujo real | 10/14 |
| Header de home | Buscar sin acción | Control ficticio | Búsqueda real o retirar | 14 |
| Headers | Selector ES sin cambio | Control ficticio | i18n real o retirar | 14 |
| `packages/database/src/seed.ts` | Diez equipos y cuatro competencias como cobertura | Bootstrap incompleto | Catálogo importado; conservar solo aliases/config necesarios | 1/3–5 |
| `packages/domain/src/team-badges.ts` | Diez identidades/escudos | Configuración incompleta | DB/ext IDs importados; mantener assets verificados como fallback | 1/8 |
| `apps/worker/src/editorial-agent.ts` | Modelo `gpt-5-mini` literal | Configuración variable | `OPENAI_MODEL` validado con default documentado | 12/15 |
| `apps/worker/src/index.ts` | Solo inicializa cliente | Comportamiento incompleto | Cola/job persistido | 12 |
| `apps/api/src/live/live-feed.ts` | Caché en memoria | Estado operativo no compartido | Snapshot/lock en PostgreSQL | 5/15 |
| `apps/web/src/features/games/games-hub.tsx` | Preguntas y decisiones | Contenido estático permitido | Puede permanecer; documentar | 0/17 |
| `packages/domain` scoring/games | Reglas y perfiles | Regla estática permitida | Puede permanecer con tests/versionado | 0/17 |
| `packages/i18n` | Lista de locales | Configuración permitida | Puede permanecer si coincide con UI real | 14/17 |
| `apps/web/public/teams/manifest.json` | Procedencia de assets | Metadata permitida | Mantener y sincronizar con DB | 8/17 |
| `.env.example` | URLs localhost y defaults dev | Configuración permitida | Mantener solo como ejemplo; prod validado | 15 |

## Anexo B — Datos que nunca deben obtenerse de scraping no autorizado

- credenciales, paneles privados o endpoints internos autenticados;
- datos personales de jugadores/usuarios no necesarios;
- video, fotografías o texto editorial completo protegido;
- contenido obtenido evadiendo rate limits, CAPTCHA o controles técnicos;
- datos de un proveedor pago mediante endpoints no incluidos en el plan contratado.

Cuando una competencia solo publique PDF/planilla descargable oficialmente, el archivo puede procesarse como artifact con atribución y trazabilidad si sus condiciones lo permiten. Cuando no sea posible, usar carga manual verificada.
