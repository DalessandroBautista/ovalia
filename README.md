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

Los datos visibles iniciales son demostrativos. La arquitectura deja aislado el proveedor deportivo para conectar una fuente licenciada sin reescribir la experiencia.

Para habilitar el agente editorial, agregá `OPENAI_API_KEY` en `.env`. Sin esa variable el worker arranca normalmente, pero no llama al proveedor externo.

## Verificación

```bash
pnpm verify
pnpm build
```

La especificación funcional y el plan completo están en `docs/superpowers/`.
