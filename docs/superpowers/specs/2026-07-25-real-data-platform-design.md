# Ovalia — Diseño de plataforma sin datos operativos hardcodeados

Fecha: 25 de julio de 2026  
Estado: aprobado conceptualmente  
Restricción económica: infraestructura y proveedores por debajo de USD 10 mensuales durante la etapa inicial

## 1. Objetivo

Convertir Ovalia de prototipo demostrativo a plataforma operativa cuya información variable provenga de fuentes reales, quede persistida en PostgreSQL y pueda ser auditada o corregida por un editor autorizado.

La web no deberá consumir páginas de terceros ni datos demo. PostgreSQL será la fuente canónica de lectura para fixtures, resultados, posiciones, torneos, equipos, prodes, noticias, estadísticas de portada y actividad administrativa. Las fuentes externas solo alimentarán procesos de ingestión del backend.

## 2. Definición de “dato hardcodeado”

Debe eliminarse del código cualquier valor que cambie por fecha, temporada, usuario, partido, competencia o actividad editorial:

- fixtures, horarios, resultados, estados y eventos;
- posiciones, rondas, temporadas y participantes;
- catálogo activo de torneos y clubes;
- estadísticas de portada;
- partidos, cierre y ranking de prodes;
- artículos, destacados, autores y cola editorial;
- contadores y estados del panel administrativo;
- año de temporada y cuentas regresivas;
- rutas placeholder que simulan contenido inexistente.

Pueden permanecer versionados en código:

- reglas puras de rugby y puntuación de prodes;
- preguntas y árboles narrativos de juegos, mientras sean contenido del producto y no resultados de usuarios;
- traducciones, design tokens, iconos genéricos y navegación estructural;
- aliases iniciales de normalización, siempre que también puedan ampliarse desde la base;
- datos mínimos exclusivos de tests, claramente confinados a factories o fixtures de prueba.

No se aceptarán fallbacks demo en producción. Ante ausencia o error de una fuente se mostrará el último dato verificado, su antigüedad o un estado no disponible.

## 3. Estrategia de fuentes

### 3.1 Jerarquía

1. Corrección editorial verificada y auditada.
2. Fuente oficial específica de la competencia.
3. Fuente oficial internacional o nacional agregadora.
4. Proveedor externo contratado o gratuito.
5. Aporte manual pendiente de revisión.

Una fuente de menor prioridad no puede sobrescribir silenciosamente una corrección editorial de mayor prioridad.

### 3.2 Fuentes iniciales

| Cobertura | Fuente inicial | Método | Uso |
|---|---|---|---|
| URBA Top 14, Primera A/B/C, Segunda, Tercera, Desarrollo y Femenino | `urba.org.ar` y `fixture.urba.org.ar` | Adaptador HTTP/HTML o endpoint público descubierto y documentado | Equipos, fixtures, resultados y posiciones |
| Torneo del Interior, Nacional de Clubes, Seven de la República, juveniles, femenino y SRA argentino | `uar.com.ar` y publicaciones/documentos oficiales | Adaptadores HTML/PDF/CSV por competencia | Catálogo, fixtures y resultados nacionales |
| Selecciones, mundiales, U20, femenino y SVNS | `world.rugby` y calendarios oficiales | Adaptador HTML/ICS o servicio autorizado | Fixtures/resultados internacionales |
| Rugby Championship | SANZAAR/World Rugby | Adaptador oficial disponible | Fixtures y resultados |
| Partidos en vivo cubiertos | Highlightly plan gratuito | API server-side con caché | Marcador live, nunca agenda canónica completa |
| Competencias sin fuente automatizable | Panel Ovalia | Carga manual o CSV con revisión | Cobertura complementaria |

Cada adaptador debe revisar términos de uso, robots, frecuencia permitida y atribución antes de activarse. Si una fuente prohíbe automatización, se utilizará importación manual/CSV o se solicitará permiso; el sistema no deberá evadir controles.

### 3.3 Frecuencias

- Catálogos y equipos: semanal y bajo demanda.
- Fixtures futuros: cada 6 horas y bajo demanda.
- Resultados del día: cada 10 minutos dentro de una ventana de partido; cada hora fuera de ella.
- Posiciones: después de cada cambio de resultado y conciliación nocturna.
- Live externo: según cuota configurada, con caché compartida y sin superar el límite diario.
- Noticias oficiales para asistencia editorial: cada 30 minutos, sin republicar texto de terceros.

Las frecuencias serán configuración de ambiente y no constantes dispersas en el código.

## 4. Arquitectura

```text
Fuentes oficiales / proveedor live / carga admin
                     │
                     ▼
             Adaptadores de fuente
                     │
                     ▼
       Raw ingestion + checksum + procedencia
                     │
                     ▼
       Parseo y validación de contrato (Zod)
                     │
                     ▼
        Normalización y resolución de identidad
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
     dato válido          conflicto/cuarentena
          │                     │
          ▼                     ▼
 PostgreSQL canónico      revisión en /admin
          │                     │
          └──────────┬──────────┘
                     ▼
                 API Ovalia
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
        Web       Prodes     Worker editorial
```

### 4.1 Límites de módulos

- `packages/domain`: reglas puras, estados y resolución determinista; sin HTTP ni SQL.
- `packages/database`: esquema, migraciones y repositorios Drizzle.
- `apps/api`: endpoints públicos/privados, autorización y composición de servicios.
- `apps/worker`: jobs programados, adaptadores, ingestión y generación editorial.
- `apps/web`: presentación; nunca scraping ni claves externas.
- `packages/config`: validación obligatoria de variables por proceso y ambiente.

Los adaptadores implementarán una interfaz común y producirán contratos internos estables. El resto de la aplicación no conocerá HTML, IDs ni formatos de terceros.

## 5. Persistencia y trazabilidad

El esquema actual se ampliará sin recrear tablas equivalentes. Como mínimo se necesitan:

- organizaciones/uniones;
- competencias, temporadas, fases, rondas y grupos;
- equipos con aliases, escudos y IDs externos por proveedor;
- partidos y eventos;
- snapshots/versiones de posiciones;
- fuentes, registros externos y precedencia;
- ejecuciones de ingestión, payload raw, checksum, parser version y errores;
- conflictos y decisiones de conciliación;
- overrides editoriales con autor, motivo y vigencia;
- prodes, predicciones y rankings;
- artículos, revisiones y publicaciones;
- sesiones, identidades y roles;
- jobs y auditoría.

Todo registro importado debe poder responder: de dónde vino, cuándo se obtuvo, qué versión del parser lo interpretó y quién lo modificó después.

El payload original se conservará por un período configurable para depuración, cuidando tamaño y datos personales. Los procesos serán idempotentes mediante una clave externa estable más checksum.

## 6. Resolución y conciliación

### 6.1 Identidad

Equipos y competencias se resolverán por:

1. ID externo ya asociado;
2. alias exacto normalizado;
3. combinación de unión, categoría y nombre;
4. revisión manual si la coincidencia no supera el umbral configurado.

La IA no podrá crear asociaciones ambiguas automáticamente. Un conflicto se pondrá en cuarentena.

### 6.2 Partidos

La identidad natural de un partido combinará temporada, fase/ronda, local, visitante y fecha aproximada. Cambios de sede u horario actualizarán el mismo partido; una diferencia de rivales o competencia creará un conflicto.

### 6.3 Resultados y posiciones

Los resultados oficiales se almacenarán como hechos versionados. Las posiciones se recalcularán con reglas del dominio y se compararán con la tabla publicada por la fuente. Una diferencia genera alerta; no se corrige silenciosamente.

### 6.4 Overrides

Una corrección manual deberá incluir motivo, editor y fuente de verificación. Los siguientes imports respetarán el override hasta que se cierre o expire explícitamente.

## 7. API productiva

La API deberá consultar repositorios reales y validar input/output. Endpoints mínimos:

- `GET /v1/matches?from=&to=&competition=&status=&cursor=`;
- `GET /v1/matches/:id`;
- `GET /v1/competitions`;
- `GET /v1/competitions/:slug`;
- `GET /v1/competitions/:slug/standings?season=`;
- `GET /v1/competitions/:slug/matches?season=&round=&cursor=`;
- `GET /v1/teams/:slug`;
- `GET /v1/home` para agregados de portada;
- `GET /v1/articles` y `GET /v1/articles/:slug`;
- endpoints autenticados de prodes, favoritos y perfil;
- endpoints editor/admin para imports, conflictos, overrides y artículos;
- `GET /health` y `GET /ready` diferenciados.

`demo-data.ts` deberá desaparecer de la ruta productiva. Los tests utilizarán factories aisladas.

## 8. Migración de cada superficie

### Inicio

- Cobertura, torneos, clubes y cantidad en vivo desde `/v1/home`.
- Agenda desde partidos persistidos.
- Prode destacado desde el próximo concurso abierto.
- Nota destacada desde artículos publicados.
- Año del footer desde fecha actual o configuración.

### Partidos y detalle

- Calendario con rango solicitado al backend y fecha en URL.
- Detalle base desde DB para programados/finales; overlay live cuando corresponda.
- Estados retrasado/no disponible con procedencia y frescura.

### Torneos

- Catálogo, temporada, fixtures, resultados y posiciones desde API.
- Slugs y enlaces reales; ninguna navegación a `#`.

### Prodes

- Partidos y cierre derivados del concurso persistido.
- Login obligatorio para guardar.
- Bloqueo transaccional al cierre, puntuación reproducible y rankings.

### Noticias y CMS

- Solo artículos con estado `published` son públicos.
- El agente crea borradores a partir de hechos verificados; nunca publica.
- El panel muestra cola, procedencia y diff de revisiones reales.

### Login y admin

- Sesiones seguras, Google opcional y roles.
- `/admin` deniega por defecto y registra cada mutación.

### Juegos

- Las preguntas pueden seguir en código.
- Resultados o progreso de usuario solo se persistirán si el producto los expone como historial/ranking.

## 9. Estados de error y degradación

- Si falla una fuente, conservar último snapshot verificado y marcar `stale`.
- Si cambia el HTML, fallar el parser, almacenar evidencia y alertar; nunca importar campos parciales como válidos.
- Si una entidad no se resuelve, enviarla a cuarentena.
- Si PostgreSQL no está listo, `/ready` falla y la API no anuncia disponibilidad.
- Si no hay datos, la UI muestra ausencia real; no inventa fixtures.
- Si el proveedor live agota cuota, la agenda y resultados históricos siguen disponibles desde DB.

## 10. Seguridad y operación

- Helmet, rate limiting, CORS por ambiente y validación Zod.
- Sesiones HTTP-only, rotación, CSRF para mutaciones y RBAC.
- Credenciales externas solo en API/worker.
- Jobs con lock distribuido o singleton garantizado.
- Logs estructurados sin secretos, métricas de ingestión y alertas por antigüedad.
- Backups automáticos y prueba documentada de restauración.
- CI obliga typecheck, tests, lint, build, migración desde cero y E2E.
- `next build` no ignora errores TypeScript.

Para mantener el costo inicial bajo, PostgreSQL puede asumir temporalmente locks y cola de jobs. Redis solo se agregará cuando exista más de una instancia o la carga lo justifique.

## 11. Estrategia de pruebas

- Fixtures HTML/ICS/PDF versionados por adaptador, sin depender de internet en tests.
- Contract tests para cada parser y detección explícita de cambios.
- Tests unitarios de normalización, precedencia, idempotencia y reglas.
- Tests de repositorio contra PostgreSQL real efímero.
- Tests de integración de API, auth, prode y CMS.
- E2E Chrome para calendario, detalle, torneo, login, prode, revisión editorial y fallos de fuente.
- Smoke test opcional contra fuentes reales, programado y no bloqueante para PRs.

## 12. Despliegue incremental

1. Crear infraestructura y repositorios sin cambiar la web.
2. Importar URBA en paralelo y comparar contra la fuente.
3. Cambiar agenda y posiciones a DB detrás de una bandera.
4. Incorporar UAR e internacionales por adaptadores separados.
5. Migrar detalle, torneos y estadísticas de portada.
6. Implementar auth/prode y luego CMS/editorial.
7. Eliminar demo, placeholders y bandera.
8. Ejecutar auditoría final de hardcodes y prueba de restauración.

Cada fuente se activa solo después de alcanzar concordancia verificada en fixtures, resultados y posiciones. El despliegue no espera que todas las competencias tengan automatización: las faltantes entran por admin/CSV con la misma trazabilidad.

## 13. Criterios de aceptación globales

- `rg` no encuentra imports productivos de `demo-data`, enlaces `href="#"`, cuentas regresivas fijas ni arrays de fixtures/posiciones/artículos en componentes.
- Toda pantalla variable obtiene datos desde la API de Ovalia.
- La API productiva obtiene esos datos de PostgreSQL.
- Cada registro deportivo visible conserva fuente y frescura.
- URBA completa, torneos UAR priorizados e internacionales configurados tienen ingestión repetible o flujo manual explícito.
- Ningún error externo produce datos ficticios.
- Partidos programados, live y finales abren un detalle válido.
- Prode, login, admin y CMS persisten y respetan permisos.
- Tests, lint, typecheck, build, migraciones y E2E pasan desde un clon limpio.
- El sistema puede iniciarse localmente con un solo comando documentado.
- El costo recurrente inicial se mantiene por debajo de USD 10, excluyendo dominio y trabajo humano.

## 14. Fuera de alcance inicial

- Reproducción o redistribución de video protegido.
- Automatización contra fuentes que lo prohíban.
- Estadísticas avanzadas de jugadores que ninguna fuente autorizada entregue.
- Aplicaciones móviles nativas.
- Alta disponibilidad multi-región.

Estas exclusiones no autorizan datos falsos: la capacidad se oculta o se declara no disponible.

## 15. Fuentes verificadas durante el diseño

- URBA: `https://urba.org.ar/` y `https://fixture.urba.org.ar/home`.
- UAR: `https://uar.com.ar/torneos/`.
- World Rugby: `https://www.world.rugby/tournaments/fixtures-results`.
- World Rugby Information Management: `https://www.world.rugby/the-game/game-systems/stats`.

La disponibilidad técnica y autorización de automatización debe revalidarse antes de implementar cada adaptador.
