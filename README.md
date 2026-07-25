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

## Qué incluye

- Portada editorial responsive y PWA.
- Agenda, resultados, centro de partido en vivo y tablas de torneos.
- Catálogo de rugby argentino e internacional, masculino, femenino y seven.
- Prode con reglas de puntuación probadas.
- Juegos `Tu identidad ovalada` y `Camino al XV`.
- Acceso, perfiles y mesa CMS preparados para conectar autenticación.
- API Fastify y esquema PostgreSQL con equipos, torneos, temporadas, eventos, tablas, usuarios, pronósticos y artículos.
- Worker editorial OpenAI que produce únicamente borradores estructurados sujetos a revisión humana.
- Gateway de resultados en vivo sin datos inventados, preparado para Highlightly.
- Escudos oficiales almacenados localmente, con resolución por alias y fallback SVG para equipos todavía no catalogados.

Los datos visibles iniciales son demostrativos. La arquitectura deja aislado el proveedor deportivo para conectar una fuente licenciada sin reescribir la experiencia.

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

La especificación funcional y el plan completo están en `docs/superpowers/`.
