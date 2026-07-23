# Guía de trabajo de Ovalia

## Arquitectura

- `apps/web`: interfaz Next.js y PWA.
- `apps/api`: API Fastify y tiempo real.
- `apps/worker`: tareas asíncronas e importadores.
- `packages/domain`: reglas puras; no depende de frameworks ni base de datos.
- `packages/database`: Drizzle, PostgreSQL, migraciones y repositorios.
- `packages/ui`: componentes y tokens visuales.
- `packages/i18n`: catálogos ES/EN/PT.

## Reglas

- Aplicar TDD a toda regla o comportamiento.
- Mantener TypeScript estricto.
- Validar entradas en los límites de cada proceso.
- Toda mutación deportiva o editorial sensible produce auditoría.
- Las integraciones externas deben ser opcionales y reemplazables.
- No incluir secretos, contenido copiado ni datos de menores.

## Antes de terminar un cambio

```bash
pnpm verify
pnpm build
```
