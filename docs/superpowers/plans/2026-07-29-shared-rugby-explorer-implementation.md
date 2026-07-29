# Explorador compartido de rugby — Plan de implementación

**Objetivo:** implementar el diseño aprobado para `/torneos` y `/partidos`: encabezado compacto, 25 uniones oficiales, navegación Unión → familia de torneo, filtro de agenda por familia y drawer mobile accesible.

**Arquitectura:** catálogo oficial puro en `packages/domain`; persistencia de uniones y relación muchos-a-muchos en `packages/database`; endpoint público de organizaciones en `apps/api`; transformación pura y explorador compartido en `apps/web`. La columna primaria `competitions.organizationId` se conserva y la tabla de asociación agrega participantes regionales.

**Restricciones:** TDD en cada comportamiento; TypeScript estricto; entradas validadas; ningún fixture o resultado ficticio; preservar cambios ajenos y ejecutar `pnpm verify` y `pnpm build` al finalizar.

## Tarea 1 — Catálogo oficial de uniones

**Archivos:**

- Crear `packages/domain/src/rugby-unions.test.ts`
- Crear `packages/domain/src/rugby-unions.ts`
- Modificar `packages/domain/src/index.ts`

1. Escribir pruebas que exijan exactamente 25 slugs únicos y la presencia de URBA, Córdoba, Rosario, Santa Fe y Entre Ríos.
2. Ejecutar la prueba y verificar RED por ausencia del catálogo.
3. Implementar el catálogo mínimo tipado con nombres oficiales y códigos de país.
4. Ejecutar la prueba y verificar GREEN.

## Tarea 2 — Asociación competencia–organizaciones

**Archivos:**

- Modificar `packages/database/src/schema.ts`
- Modificar `packages/database/src/repositories/organizations-repository.ts`
- Modificar `packages/database/src/repositories.test.ts`
- Modificar `packages/database/src/test-support/test-database.ts`
- Crear migración Drizzle `packages/database/drizzle/0007_*.sql` y metadatos

1. Escribir una prueba de repositorio que asocie un Regional del Litoral con Rosario, Santa Fe y Entre Ríos y espere un único slug de competencia por organización.
2. Verificar RED porque la asociación y lectura no existen.
3. Agregar `competition_organizations` con clave primaria compuesta e índices/foreign keys.
4. Implementar `linkCompetitionOrganization` y `listOrganizationsWithCompetitionSlugs` sin duplicar la organización primaria.
5. Generar y revisar la migración; aplicarla al PostgreSQL local.
6. Verificar GREEN y ejecutar la suite de database.

## Tarea 3 — Seed federal y catálogo manual verificado

**Archivos:**

- Crear `packages/database/src/seed-catalog.test.ts`
- Modificar `packages/database/src/seed.ts`

1. Escribir una prueba pura sobre los insumos del seed: 25 uniones, slugs únicos, URBA y las asociaciones del Regional del Litoral.
2. Verificar RED antes de extraer/exportar los datos del seed.
3. Alimentar `organizations` desde el catálogo de dominio.
4. Agregar únicamente familias manuales verificadas necesarias para que Córdoba y el Regional del Litoral tengan contenido visible, sin partidos ni temporadas inventadas.
5. Asociar el Regional del Litoral a Rosario, Santa Fe y Entre Ríos.
6. Ejecutar el seed local de forma idempotente y verificar GREEN.

## Tarea 4 — Endpoint público de organizaciones

**Archivos:**

- Modificar `apps/api/src/app.test.ts`
- Modificar `apps/api/src/create-app.ts`

1. Escribir una prueba de `GET /v1/organizations?countryCode=AR&kind=union` que espere uniones vacías y `competitionSlugs` regionales.
2. Agregar pruebas de validación para códigos/parámetros inválidos.
3. Verificar RED.
4. Implementar el endpoint con Zod y el repositorio de la Tarea 2.
5. Verificar GREEN y regresión de `/v1/competitions`.

## Tarea 5 — Modelo puro del explorador web

**Archivos:**

- Crear `apps/web/src/features/tournaments/rugby-explorer-data.test.ts`
- Crear `apps/web/src/features/tournaments/rugby-explorer-data.ts`
- Modificar `apps/web/src/lib/api/types.ts`
- Modificar `apps/web/src/lib/api/client.ts`
- Crear `apps/web/src/features/tournaments/use-organizations.ts`

1. Escribir pruebas para:
   - conservar uniones sin torneos;
   - agrupar divisiones por `familySlug`;
   - asociar una familia regional a varias uniones sin duplicarla;
   - escoger como destino canónico la división senior de mayor prioridad;
   - filtrar partidos por todas las divisiones de una familia.
2. Verificar RED.
3. Implementar tipos y transformaciones puras.
4. Implementar fetch/hook del endpoint sin mezclarlo con la transformación.
5. Verificar GREEN.

## Tarea 6 — Explorador compartido y catálogo de torneos

**Archivos:**

- Crear `apps/web/src/features/tournaments/rugby-explorer.tsx`
- Modificar `apps/web/src/features/portal/portal-pages.test.tsx`
- Modificar `apps/web/src/features/portal/portal-pages.tsx`
- Modificar `apps/web/app/torneos/page.tsx`
- Modificar `apps/web/app/globals.css`

1. Escribir pruebas de render para las 25 uniones, unión vacía, jerarquía Unión → familia y enlaces canónicos.
2. Verificar RED.
3. Implementar el explorador compartido con una unión expandida, `aria-expanded` y selección explícita.
4. Reemplazar el catálogo actual por la grilla sidebar/contenido aprobada.
5. Persistir `?union=` desde el entrypoint de Next y el estado cliente.
6. Aplicar la franja compacta B sólo a las páginas de catálogo/agenda.
7. Verificar GREEN.

## Tarea 7 — Filtro de partidos y navegación al detalle

**Archivos:**

- Modificar `apps/web/src/features/portal/portal-pages.test.tsx`
- Modificar `apps/web/src/features/portal/portal-pages.tsx`
- Modificar `apps/web/app/partidos/page.tsx`

1. Escribir pruebas para que una familia filtre todas sus divisiones, mantenga fecha y renderice “Ver torneo”.
2. Verificar RED.
3. Incorporar el explorador a `/partidos`.
4. Sincronizar `fecha` y `torneo` en la URL, incluyendo limpiar filtro sin perder fecha.
5. Mostrar estado vacío específico cuando no haya partidos para la familia.
6. Verificar GREEN.

## Tarea 8 — Drawer mobile accesible

**Archivos:**

- Modificar `apps/web/src/features/tournaments/rugby-explorer.tsx`
- Modificar `apps/web/src/features/portal/portal-pages.test.tsx`
- Modificar `apps/web/app/globals.css`

1. Escribir pruebas estructurales para botón, diálogo etiquetado, cierre y controles accesibles.
2. Verificar RED.
3. Implementar drawer con cierre por selección/Escape, restauración de foco y bloqueo de scroll.
4. Ajustar la composición responsive a 760/520/420 px y controles táctiles de 44 px.
5. Verificar GREEN.

## Tarea 9 — Verificación integral

1. Ejecutar pruebas específicas de domain, database, api y web.
2. Ejecutar `pnpm verify`.
3. Ejecutar `pnpm build`.
4. Levantar API/web local con la base migrada y sembrada.
5. Verificar visualmente `/torneos`, `/partidos` y un detalle de torneo en escritorio y mobile.
6. Ejecutar `git diff --check` y revisar que `.gitignore` siga fuera del cambio.

