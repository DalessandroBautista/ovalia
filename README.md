# Ovalia

Plataforma integral de rugby con resultados en vivo, torneos, prodes, juegos y contenido editorial.

## Requisitos

- Node.js 22+
- Corepack
- Docker con Compose

## Inicio local

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

La web usará `http://localhost:3000`, la API `http://localhost:4000` y PostgreSQL el puerto local `54329`.

## Cargar datos reales (URBA)

El seed no crea partidos ficticios. Para poblar fixtures, resultados y posiciones
reales de las competencias URBA prioritarias desde su API pública:

```bash
pnpm ingest --source urba --all          # catálogo + fixtures + posiciones
pnpm ingest:status                        # ver últimas corridas
```

La ingestión es idempotente (checksum), conserva fuente/frescura y deja en cuarentena
los equipos que no resuelven (revisables en `/admin`). Import manual de respaldo:

```bash
pnpm ingest:csv --file docs/data-sources/templates/matches.csv           # dry-run
pnpm ingest:csv --file docs/data-sources/templates/matches.csv --confirm  # aplica
```

## Panel de control (`/admin`)

`/admin` requiere una sesión de usuario con rol `editor` o `admin`. El `ADMIN_TOKEN`
queda como compatibilidad operativa temporal. El panel muestra conflictos, cola
editorial, edición de artículos, publicación auditada y carga de formaciones.

Las cuentas pueden registrarse, iniciar sesión, solicitar recuperación de contraseña
y verificar el email mediante un notifier de correo inyectable. Sin proveedor de
correo configurado, las solicitudes son aceptadas de forma genérica pero no se envía
ningún mensaje.

## Qué incluye

- Portada editorial responsive y PWA.
- Agenda, resultados, centro de partido en vivo y tablas de torneos.
- Catálogo de rugby argentino e internacional, masculino, femenino y seven.
- Prode con reglas de puntuación probadas.
- Juegos `Tu identidad ovalada` y `Camino al XV`.
- Acceso, perfiles y mesa CMS con sesiones, roles y auditoría.
- API Fastify y esquema PostgreSQL con equipos, torneos, temporadas, eventos, tablas, usuarios, pronósticos y artículos.
- Worker editorial OpenAI que consume jobs, produce borradores estructurados y los deja sujetos a revisión humana.
- Gateway de resultados en vivo sin datos inventados, preparado para Highlightly.
- Escudos oficiales almacenados localmente, con resolución por alias y fallback SVG para equipos todavía no catalogados.

La beta URBA muestra fixtures, resultados y posiciones persistidos desde la fuente
documentada. Cuando una sección todavía no tiene contenido real, muestra un estado
vacío explícito en lugar de datos demostrativos.

Para habilitar el agente editorial, agregá `OPENAI_API_KEY` en `.env`. Sin esa variable el worker arranca normalmente, pero no llama al proveedor externo.

## Resultados en vivo

Ovalia nunca muestra un partido ficticio como si estuviera en vivo. Sin proveedor configurado, la portada informa que no hay un feed disponible.

1. Creá una cuenta gratuita en [Highlightly Rugby API](https://highlightly.net/rugby-api/).
2. Copiá `.env.example` como `.env`.
3. Configurá `HIGHLIGHTLY_API_KEY`.
4. Reiniciá `pnpm dev`.

El plan gratuito permite probar la integración. El frontend consulta únicamente la API de Ovalia; la clave externa nunca se expone al navegador. Los navegadores consultan Ovalia cada 30 segundos, mientras que el backend comparte una única respuesta de Highlightly durante 15 minutos (`LIVE_FEED_CACHE_TTL_MS=900000`). Así el máximo teórico queda en 96 solicitudes externas por día. Si una actualización falla, se conserva el último resultado verificado con estado `stale`.

## Escudos de equipos

Los escudos verificados viven en `apps/web/public/teams/`. La interfaz prioriza siempre el archivo local, tanto para datos estáticos como para partidos recibidos desde Highlightly. Si un equipo aún no está en el registro, conserva la imagen remota del proveedor; si tampoco existe, muestra el monograma de respaldo.

Para volver a sincronizar las fuentes registradas:

```bash
pnpm badges:sync
```

El proceso valida tipo y tamaño, escribe de forma atómica y no reemplaza archivos existentes salvo que se use `pnpm badges:sync -- --force`. La procedencia de cada activo queda registrada en `apps/web/public/teams/manifest.json` y en las columnas de auditoría de la tabla `teams`.

## Verificación

```bash
pnpm verify
pnpm build
```

Para validar integración con el PostgreSQL local:

```bash
DATABASE_URL=postgresql://ovalia:ovalia@localhost:54329/ovalia pnpm db:migrate
DATABASE_URL=postgresql://ovalia:ovalia@localhost:54329/ovalia pnpm verify
```

La especificación funcional y el plan completo están en `docs/superpowers/`.
La configuración, migración, ingestión programada y checklist de publicación están en
[`docs/production-runbook.md`](docs/production-runbook.md).
