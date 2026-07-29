# Ovalia — runbook de producción

Fecha de revisión: 2026-07-27.

## Topología

La beta se publica como dos proyectos Vercel conectados al mismo monorepo:

1. **Web** con Root Directory `apps/web`.
2. **API** con Root Directory `apps/api` (Fastify se detecta desde `src/server.ts`).

Ambos proyectos deben incluir los archivos del workspace fuera de su Root Directory.
La base PostgreSQL debe ofrecer una URL pooled para el runtime y una URL directa para
migraciones. Conviene ubicar API y base en la misma región.

## Variables de Vercel

### Web

- `NEXT_PUBLIC_API_URL`: URL HTTPS de la API, sin `/` final.
- `NEXT_PUBLIC_SITE_URL`: dominio canónico de la web, sin `/` final.

### API

- `NODE_ENV=production`.
- `DATABASE_URL`: conexión pooled con SSL.
- `DATABASE_POOL_MAX=3`: límite por instancia serverless.
- `WEB_ORIGIN`: dominio canónico y previews permitidas, separados por coma.
- `ADMIN_TOKEN`: secreto aleatorio; vacío mantiene `/admin` deshabilitado.
- `RATE_LIMIT_MAX` y `RATE_LIMIT_WINDOW`.
- `HIGHLIGHTLY_API_KEY`: opcional; sin ella no se publica live externo.
- `HIGHLIGHTLY_API_BASE_URL` y `LIVE_FEED_CACHE_TTL_MS`.

La API falla al iniciar en producción si faltan `DATABASE_URL` o `WEB_ORIGIN`. La web
falla su build de Vercel si falta `NEXT_PUBLIC_API_URL` o `NEXT_PUBLIC_SITE_URL`.

## GitHub Environment `production`

Crear el environment protegido `production` y cargar:

- `DATABASE_URL`: conexión pooled usada por la ingestión.
- `DATABASE_URL_DIRECT`: conexión directa usada exclusivamente por migraciones.

Los workflows versionados hacen lo siguiente:

- `CI`: PostgreSQL efímero, migraciones, tests, lint, build, hardcodes y dependencias.
- `Production database migration`: migración manual y serializada.
- `Refresh URBA data`: resultados cada 10 minutos y refresh completo cada 6 horas.

Los schedules de GitHub pueden demorarse bajo carga. Si la latencia de resultados se
vuelve crítica, mover la ingestión a un worker/cron dedicado. Vercel Hobby no sirve
para este SLA porque sus cron jobs se ejecutan como máximo una vez por día.

## Orden de primera publicación

1. Crear la base y guardar ambos secretos en GitHub.
2. Ejecutar manualmente `Production database migration`.
3. Ejecutar `Refresh URBA data` en modo `full` y revisar `ingest:status`/auditoría.
4. Configurar y desplegar la API; comprobar `/health` y `/ready`.
5. Configurar `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` y desplegar la web.
6. Comprobar portada, agenda, Top 14, detalle, feedback y admin en preview.
7. Asociar dominios y restringir `WEB_ORIGIN` a los orígenes definitivos.

## Operación y alertas

- Alertar por `/ready != 200`, corridas fallidas y ausencia de una corrida exitosa
  dentro del SLA.
- Revisar conflictos abiertos antes y después de cada fecha.
- Mantener backups/PITR del proveedor PostgreSQL y probar restauración.
- Rotar `ADMIN_TOKEN` ante sospecha; no se persiste en el navegador.
- Los logs deben conservar el `reqId` de errores sin registrar secretos ni contactos.

## Rollback

- Web/API: promover el deployment Vercel anterior.
- Base: las migraciones son forward-only; crear una migración correctiva. No revertir
  archivos SQL ya aplicados.
- Ingestión: deshabilitar temporalmente el workflow y conservar artifacts/auditoría.

## Límites conscientes de la beta

- El admin usa un token compartido, no identidad/RBAC; reemplazar en Release 2.
- El cache live es por instancia. No prometer una cuota global sin cache distribuido.
- Analytics es propio, anónimo y básico; falta un tablero operativo.
- Antes de abrir al público general hacen falta dominio final, política de privacidad,
  monitoreo externo, backups verificados y responsable humano de datos de fin de semana.
