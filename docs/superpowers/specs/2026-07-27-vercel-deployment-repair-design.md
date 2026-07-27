# Reparación del despliegue Vercel de Ovalia

Fecha: 2026-07-27.

## Objetivo

Dejar el monorepo vinculado a dos proyectos Vercel independientes y conseguir un
preview funcional sin alterar todavía el dominio ni el deployment productivo actual.

## Decisión

- Reutilizar `dalessandrobautistas-projects/ovalia-api`, que ya conserva historial,
  integración Git y `DATABASE_URL`.
- Crear `dalessandrobautistas-projects/ovalia-web` con Root Directory `apps/web`.
- Mantener `apps/api` como Root Directory de la API.
- Usar Node.js 22 en ambos proyectos, igual que CI y desarrollo.
- Desplegar primero la rama `feat/real-data-platform` como preview. Producción requiere
  una autorización separada.

## Reparación Fastify

Vercel detecta `apps/api/src/server.ts` como entrypoint, pero el deployment actual
falla porque ese archivo no importa Fastify directamente. La API conservará
`buildApp` para tests y sumará una frontera que permita registrar la aplicación sobre
una instancia existente. `server.ts` creará esa instancia con un import directo de
`fastify`, registrará rutas/plugins y llamará a `listen`.

Una prueba de contrato del entrypoint debe fallar antes del cambio y verificar el
requisito que usa el detector de Vercel. Después se ejecutarán `pnpm verify`,
`pnpm build` y un build preview en Vercel.

## Variables y secretos

La API ya posee `DATABASE_URL` en Production. Se agregarán, sin imprimir sus valores:

- `WEB_ORIGIN`: URL preview/web autorizada; se ajustará al dominio final al promover.
- `DATABASE_POOL_MAX=3`.
- `NODE_ENV=production` solo si Vercel no lo establece para el runtime.

La web recibirá:

- `NEXT_PUBLIC_API_URL`: URL HTTPS estable de `ovalia-api`.
- `NEXT_PUBLIC_SITE_URL`: URL del preview durante validación y dominio canónico al
  promover a producción.

No se descargará ni mostrará `DATABASE_URL`. Los archivos `.vercel` y `.env.local`
permanecen fuera de Git.

## Secuencia y verificación

1. Corregir el contrato del entrypoint mediante TDD.
2. Ejecutar gates locales completos.
3. Crear/vincular `ovalia-web` y comprobar la configuración de ambos proyectos.
4. Configurar variables de preview.
5. Solicitar autorización antes de hacer `git push`.
6. Observar build logs, probar `/health`, `/ready` y las rutas web principales.
7. Mantener producción sin cambios hasta recibir autorización explícita.

## Errores y rollback

- Si el preview de API falla, conservar el deployment productivo anterior y revisar
  `vercel inspect --logs`.
- Si falta una variable, el build/arranque debe fallar explícitamente; no se agregan
  fallbacks productivos.
- No se ejecutan migraciones ni escrituras sobre PostgreSQL durante este trabajo.
- El proyecto web nuevo puede eliminarse sin afectar `ovalia-api` si la vinculación
  resulta incorrecta.

