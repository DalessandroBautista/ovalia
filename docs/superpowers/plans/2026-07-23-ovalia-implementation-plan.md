# Ovalia — Plan completo de implementación

Fecha: 23 de julio de 2026

Especificación base: `docs/superpowers/specs/2026-07-23-ovalia-platform-design.md`

## Objetivo de ejecución

Construir Ovalia como monorepo TypeScript productivo, ejecutable localmente con un comando, con frontend Next.js, API Node.js, worker, PostgreSQL, datos demo, tiempo real, prodes, juegos, CMS, asistente editorial OpenAI, PWA trilingüe, panel operativo y pruebas.

## Reglas de ejecución

- Mantener `main` compilable al cerrar cada hito.
- Implementar reglas de dominio mediante TDD.
- No mezclar reglas deportivas con componentes UI ni controladores HTTP.
- Toda mutación sensible debe validar permisos y producir auditoría.
- Cada integración externa debe tener adaptador, simulación y modo deshabilitado.
- Los datos de demo deben permitir verificar cada flujo sin credenciales.
- Ningún módulo se considera terminado si sólo presenta una maqueta.

## Hito 0 — Fundación del repositorio

### Tarea 0.1 — Monorepo y herramientas

Crear:

- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `.editorconfig`
- `.env.example`
- `apps/web/`
- `apps/api/`
- `apps/worker/`
- `packages/database/`
- `packages/domain/`
- `packages/ui/`
- `packages/i18n/`
- `packages/config/`

Configurar TypeScript estricto, ESLint, Prettier, Vitest y scripts `dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed` y `verify`.

Verificación: instalación limpia, typecheck y tests vacíos exitosos.

### Tarea 0.2 — Entorno local

Crear `compose.yaml` para PostgreSQL y servicios de desarrollo necesarios. Agregar comprobación de salud y script de bootstrap idempotente. El comando de desarrollo debe iniciar web, API y worker con logs identificables.

Verificación: clonar, copiar `.env.example`, instalar e iniciar sin claves externas.

### Tarea 0.3 — Convenciones y documentación

Crear `README.md`, `CONTRIBUTING.md` y `AGENTS.md` con arquitectura, comandos, límites de módulos, política de migraciones y flujo de verificación.

## Hito 1 — Dominio deportivo y base de datos

### Tarea 1.1 — Tipos y reglas de rugby

En `packages/domain/src/sport/` implementar con tests:

- estados de partido y transiciones válidas;
- eventos y valores de puntuación configurables;
- reloj, períodos, tiempo extra y definición;
- rugby XV y seven;
- masculino y femenino sin bifurcar reglas innecesariamente;
- reglas de tabla, bonus y desempate configurables;
- formatos de liga, grupos y playoffs.

Verificación: suites unitarias con casos URBA, internacionales, seven, suspensiones y correcciones.

### Tarea 1.2 — Esquema PostgreSQL

En `packages/database/src/schema/` crear migraciones para:

- organizaciones, uniones, competencias, temporadas, fases, rondas y grupos;
- equipos, personas, jugadores, árbitros, planteles y alineaciones;
- partidos, períodos, eventos, estadísticas, fuentes y versiones;
- usuarios, perfiles, roles, asignaciones, favoritos y seguidores;
- prodes, reglas, predicciones, grupos, membresías, rankings y premios;
- artículos, revisiones, traducciones, categorías y activos;
- notificaciones, suscripciones, entregas, anuncios y campañas;
- importaciones, auditoría, trabajos y ejecuciones de IA.

Agregar índices, restricciones, claves compuestas y borrado lógico donde corresponda.

Verificación: migración desde cero, rollback de desarrollo y pruebas de constraints.

### Tarea 1.3 — Seeds representativos

Crear temporada demo con:

- URBA Top 14 y Primera A;
- competencia femenina;
- seven;
- torneo internacional por grupos y playoffs;
- partidos programados, en vivo, finales, suspendidos e incompletos;
- usuarios y roles demo;
- prode activo y cerrado;
- artículos y campañas.

## Hito 2 — API, autenticación y permisos

### Tarea 2.1 — Base de la API

Crear servidor Node.js modular con configuración tipada, logging estructurado, manejo central de errores, OpenAPI, validación de schemas, health/readiness y cierre ordenado.

Módulos iniciales: auth, users, organizations, competitions, teams, matches, predictions, content, notifications, ads, imports y audit.

### Tarea 2.2 — Identidad

Implementar registro, login, logout, refresh/rotación de sesión, verificación de email, recuperación de contraseña y proveedor Google opcional. En desarrollo, capturar emails localmente.

Verificación: tests de integración de cada flujo y casos de token expirado o reutilizado.

### Tarea 2.3 — RBAC contextual

Implementar roles globales y asignaciones por organización/torneo/equipo. Crear políticas reutilizables para lectura, carga en vivo, corrección, publicación, premios y administración.

Verificación: matriz automatizada de permisos y denegación por defecto.

### Tarea 2.4 — Auditoría y protección

Implementar auditoría transaccional, rate limiting, idempotency keys, bloqueo optimista, CORS/CSRF, cabeceras seguras y validación de archivos.

## Hito 3 — Motor de partidos y tiempo real

### Tarea 3.1 — Comandos de partido

Implementar crear, programar, iniciar, pausar, reanudar, finalizar, suspender, cancelar y corregir partidos. Agregar/quitar/corregir eventos deberá recalcular el estado derivado.

### Tarea 3.2 — Proyección y reconstrucción

Construir proyecciones de marcador, timeline, estadísticas y tabla. Permitir reconstrucción completa desde eventos versionados.

Verificación: mismos resultados al aplicar incrementalmente o reconstruir.

### Tarea 3.3 — Canal en vivo

Implementar WebSocket o SSE autenticado y público, números de versión, reconexión y recuperación desde cursor. Publicar sólo después de confirmar la transacción.

Verificación: dos navegadores reciben eventos; desconexión y reconexión recuperan cambios sin duplicados.

### Tarea 3.4 — Importadores

Implementar interfaz de proveedor, importador CSV, dry-run, reporte de diferencias, cuarentena y precedencia de correcciones editoriales.

## Hito 4 — Sistema visual, i18n y PWA

### Tarea 4.1 — Design tokens

En `packages/ui` implementar tokens para verde profundo, lima, superficies, tipografía, espaciado, estados y temas. Crear componentes base accesibles: botones, inputs, tabs, dialogs, tables, cards, badges, toasts, skeletons y navegación.

### Tarea 4.2 — Shell responsive

Implementar cinta en vivo, encabezado, navegación desktop, navegación móvil inferior, pie y contenedor editorial. Evitar duplicación de contenido entre breakpoints.

### Tarea 4.3 — Internacionalización

Configurar rutas/locales ES, EN y PT, catálogos, fechas, horarios, zonas horarias y fallbacks. Los datos deportivos propios conservan nombre oficial y alias traducibles.

### Tarea 4.4 — PWA

Crear manifest, iconos originales, service worker, estrategia de caché, pantalla offline y suscripción push. No almacenar respuestas privadas en cachés públicas.

## Hito 5 — Experiencia pública

### Tarea 5.1 — Inicio

Implementar destacado, agenda por fecha, agrupación por torneo, partidos en vivo, accesos rápidos, prodes, noticias y anuncios.

### Tarea 5.2 — Centro de partidos

Implementar filtros, URLs compartibles, paginación/ventanas de fecha y estados vacíos o atrasados.

### Tarea 5.3 — Torneos

Implementar portada, resultados, calendario, posiciones, grupos, playoffs, estadísticas, equipos, planteles y selector de temporada.

### Tarea 5.4 — Ficha de partido

Implementar resumen, vivo, formaciones, estadísticas, tabla, forma reciente y próximos partidos con degradación por disponibilidad.

### Tarea 5.5 — SEO y metadatos

Agregar metadata, canonical, Open Graph, sitemap, robots, datos estructurados válidos y páginas 404/500.

## Hito 6 — Panel operativo

### Tarea 6.1 — Administración deportiva

CRUD de uniones, competencias, temporadas, reglas, equipos, personas, planteles, fixtures y fuentes. Formularios con validación y previsualización.

### Tarea 6.2 — Consola en vivo

Diseñar flujo táctil rápido para reloj, marcador, tries, conversiones, penales, drops, tarjetas y cambios. Incluir deshacer seguro, correcciones y conflictos de versión.

### Tarea 6.3 — Importaciones y calidad

Panel para cargar CSV, revisar diferencias, confirmar lote, ver errores y revertir importación cuando sea seguro.

### Tarea 6.4 — Colaboradores

Invitar, verificar, asignar alcance, suspender y revisar actividad de colaboradores.

## Hito 7 — Prodes

### Tarea 7.1 — Motor de reglas

Implementar cierre, puntaje, bonus, campeón, desempates y versionado con tests exhaustivos.

### Tarea 7.2 — Experiencia de pronóstico

Implementar guardado automático, validación, indicador de cierre, edición permitida y resumen de pronósticos.

### Tarea 7.3 — Grupos y rankings

Crear grupos privados, invitaciones, membresías, rankings globales/privados y paginación estable.

### Tarea 7.4 — Premios patrocinados

Implementar bases, elegibilidad, auditoría, estados y administración sin automatizar adjudicaciones irreversibles.

## Hito 8 — Juegos

### Tarea 8.1 — Ideología rugbística

Crear contenido original, ejes, algoritmo de afinidad, perfiles, referentes, progreso, reinicio, traducciones y tarjeta compartible.

### Tarea 8.2 — Simulador de carrera

Crear motor narrativo declarativo, variables, condiciones, consecuencias, guardado y reanudación. Implementar contenido inicial completo para puestos de forwards y backs.

Verificación: recorrer ramas principales y detectar nodos muertos o finales inalcanzables.

## Hito 9 — CMS y asistente editorial OpenAI

### Tarea 9.1 — CMS

Implementar editor, revisiones, workflow, autores, categorías, etiquetas, imágenes, programación, relaciones deportivas, SEO y traducciones.

### Tarea 9.2 — Capa de IA

Crear interfaz `EditorialDraftProvider`, implementación OpenAI Responses API y proveedor simulado. La clave sólo se lee en API/worker.

### Tarea 9.3 — Salida estructurada

Definir schema para títulos, copete, cuerpo, destacados, etiquetas, advertencias y traducciones. Validar la respuesta antes de crear una revisión.

### Tarea 9.4 — Gobernanza

Guardar prompt/versiones, modelo configurable, input, output, tokens, costo estimado y editor. Implementar límites diarios, por rol y por nota, cancelación y switch global.

### Tarea 9.5 — Revisión humana

El resultado crea únicamente una revisión de borrador. Publicar exige un editor autorizado y queda auditado.

Verificación: API simulada, respuesta inválida, timeout, límite excedido, clave ausente y aprobación manual.

## Hito 10 — Perfiles, alertas y comercial

### Tarea 10.1 — Perfiles y favoritos

Implementar perfil público, alias, avatar, biografía, favoritos, seguimiento, historial y medallas.

### Tarea 10.2 — Notificaciones

Implementar preferencias, push web, email opcional, deduplicación, reintentos, quiet hours y registro de entregas.

### Tarea 10.3 — Ads y sponsors

Implementar campañas, ubicaciones, fechas, prioridad, segmentación contextual, impresión/clic y etiquetado patrocinado.

## Hito 11 — Calidad, seguridad y entrega

### Tarea 11.1 — Suite E2E

Automatizar registro, login, favoritos, prode, consola en vivo, actualización pública, CMS, IA simulada, idiomas, temas y PWA.

### Tarea 11.2 — Accesibilidad y rendimiento

Ejecutar auditoría WCAG 2.2 AA, teclado, lector, contraste, reducción de movimiento y presupuestos de rendimiento.

### Tarea 11.3 — Seguridad

Revisar autenticación, autorización, secretos, archivos, inyección, XSS, CSRF, SSRF, rate limits y logs. Agregar tests de abuso razonables.

### Tarea 11.4 — Operación

Documentar backups, restauración, migraciones, logs, health checks, actualización y despliegue en VPS. Crear configuración de producción sin secretos.

### Tarea 11.5 — Verificación final

Ejecutar desde instalación limpia:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm verify
pnpm build
pnpm dev
```

Verificar manualmente los criterios de aceptación de la especificación y registrar cualquier limitación externa real.

## Orden de dependencias

```text
Fundación
  → Dominio y DB
    → API/Auth/RBAC
      → Vivo e importaciones
        → UI/i18n/PWA
          → Experiencia pública y panel
            → Prodes + Juegos + CMS/IA
              → Perfiles/Alertas/Ads
                → QA, seguridad y entrega
```

Los componentes visuales pueden desarrollarse en paralelo después de estabilizar los contratos del dominio, pero ningún flujo se declara terminado hasta integrarse con API y persistencia reales.

## Definición global de terminado

- Criterios de aceptación de la especificación cumplidos.
- Sin botones o rutas principales sin comportamiento.
- Datos demo suficientes para todos los módulos.
- Cero errores de typecheck, lint y build.
- Tests unitarios, integración y E2E críticos en verde.
- Accesibilidad AA en flujos principales.
- Inicio local documentado y reproducible.
- Sin secretos ni dependencias pagas obligatorias.
