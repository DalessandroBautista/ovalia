# Auditoría histórica de preparación para producción — 25/07/2026

> Este documento describe el estado anterior a la consolidación de autenticación,
> prode persistente y flujo editorial. No usarlo como checklist vigente; consultar
> `docs/production-runbook.md` y los borradores de privacidad/licencias.

## Veredicto

**No-Go para publicar como producto operativo.** El proyecto compila, las pruebas actuales pasan y la UI base es funcional, pero todavía es un prototipo conectado parcialmente: fixtures, posiciones, prode, autenticación, CMS y noticias no tienen un flujo productivo completo.

## Bloqueantes P0

1. **Fixtures y posiciones provienen de datos demo.** `apps/api/src/app.ts` importa `apps/api/src/demo-data.ts`. Solo existen cuatro partidos y cuatro filas de posiciones; PostgreSQL tiene el esquema correcto, pero la API no lo consulta.
2. **No existe ingestión de agenda/resultados.** Highlightly se usa solamente para consultar partidos en vivo del día. No hay proceso que traiga calendario completo, actualice resultados, normalice equipos/torneos y persista eventos en `matches`, `match_events` y `standings`.
3. **Autenticación y autorización inexistentes.** `/ingresar` es una maqueta sin submit real; `/admin` es público; no hay sesiones, OAuth, recuperación de contraseña ni control de roles.
4. **Prode sin persistencia.** Los partidos, fecha de cierre y valores están hardcodeados. “Guardar pronósticos” no ejecuta ninguna acción y la API no expone endpoints para crear, bloquear, puntuar ni rankear pronósticos.
5. **CMS/agente editorial sin ejecución real.** El generador de borradores existe y está probado aisladamente, pero el worker solo crea el cliente y registra un mensaje. No consume partidos finalizados, no guarda artículos ni existe flujo de revisión/publicación. El panel admin y sus contadores son estáticos.
6. **Detalle de partido incompleto.** La pantalla busca únicamente dentro del feed en vivo. Un fixture programado o resultado histórico obtenido desde `/v1/matches` termina mostrando “Sin datos en vivo” en vez de consultar `/v1/matches/:id`.

## Riesgos P1

1. **Seguridad HTTP incompleta.** `@fastify/helmet` y `@fastify/rate-limit` están instalados pero no registrados. Tampoco hay autenticación de endpoints administrativos ni validación declarativa de parámetros/query.
2. **Caché de live en memoria del proceso.** Al escalar la API a varias instancias, cada instancia consume su propia cuota externa. Se necesita caché compartida y un lock distribuido, además de persistir el último feed verificado.
3. **API no escalable para agenda.** `/v1/matches` devuelve todo sin filtros de fecha, rango, paginación ni contrato validado. El frontend hace cast de JSON sin validación runtime.
4. **Configuración productiva débil.** Hay un paquete de validación de entorno, pero API/web/worker no lo usan al iniciar. `next.config.ts` permite compilar ignorando errores de TypeScript; hoy `pnpm verify` los detecta, pero un build aislado no.
5. **Sin despliegue completo ni observabilidad.** Compose levanta únicamente PostgreSQL. Faltan imágenes/servicios productivos, migraciones automatizadas, CI visible, health/readiness de dependencias, métricas, alertas y captura centralizada de errores.
6. **Cobertura insuficiente.** Varias pruebas son render estático. No hay suite E2E versionada para autenticación, agenda, prode, CMS, navegación y fallos de API.

## Datos y acciones hardcodeados encontrados

| Área | Estado actual | Acción productiva |
|---|---|---|
| Partidos/posiciones API | `apps/api/src/demo-data.ts` | Leer/escribir PostgreSQL y poblar mediante ingestión |
| Stats de portada | `26 torneos`, `184 clubes` | Consultar agregados reales o configuración editorial |
| Prode de portada | Fecha 17 y cuenta regresiva fija | Derivar del próximo cierre real |
| Prode | Fecha, partidos, inputs y reglas visibles fijos | API + usuario + bloqueo por horario + ranking |
| Catálogo de torneos | Array local; casi todos los enlaces apuntan a `#` | Tabla `competitions` + rutas reales |
| URBA Top 14 | Tabla local de cinco equipos | Endpoint de standings respaldado por DB |
| Noticias | Tres notas locales con enlaces `#` | Consultar artículos publicados del CMS |
| Portada editorial | Nota y autor fijos | Bloque destacado configurable/publicado |
| Admin | Contadores, cola y botón fijos | Datos protegidos + workflow de revisión |
| Login | Botones e inputs sin handlers | OAuth/email, sesiones y recuperación |
| Buscar/idioma | Botones sin comportamiento | Implementar o retirar antes de publicar |
| Navegación de torneo | Anclas sin secciones reales | Resultados, posiciones y calendario reales |
| Juegos | Preguntas estáticas | Aceptable como contenido versionado; agregar analytics/persistencia si se desea ranking |
| Equipos/escudos | Registro local de diez equipos | Expandir catálogo, procedencia/licencias y sincronización |
| Año/footer/temporada | `2026` fijo | Derivar fecha/temporada o gestionar en CMS |

## Hoja de ruta recomendada

### Etapa 1 — núcleo de datos

- Reemplazar `demo-data.ts` por repositorios Drizzle.
- Implementar ingestión programada de fixtures, resultados, eventos y standings.
- Agregar endpoints con filtros por fecha/competencia y contratos Zod.
- Resolver detalle de cualquier partido desde DB y superponer live cuando exista.

### Etapa 2 — identidad y participación

- Implementar OAuth/sesiones, roles y protección de `/admin`.
- Conectar prodes con usuario, cierres transaccionales, puntuación y rankings.
- Registrar Helmet, rate limiting, auditoría y políticas CORS por ambiente.

### Etapa 3 — editorial

- Crear cola del worker para partidos finalizados.
- Persistir borradores IA con trazabilidad, revisión humana y publicación.
- Reemplazar noticias y portada por queries de artículos publicados.

### Etapa 4 — operación

- Docker/hosting para web, API, worker y base administrada.
- Caché compartida, jobs idempotentes, reintentos y límites del proveedor.
- CI con verify, build, migraciones de prueba y E2E Chrome.
- Monitoreo, backups, restauración probada, privacidad, términos y licencias de datos/escudos.

## Verificaciones ejecutadas en esta revisión

- `pnpm verify`: correcto, 53 pruebas totales.
- `pnpm build`: correcto, todas las rutas compiladas.
- Chrome desktop y móvil: agenda del 25/07, navegación al 24/07 vacío y 23/07 con Argentina 24–21 Sudáfrica.
- Consola de la aplicación: sin errores propios durante el flujo probado.
