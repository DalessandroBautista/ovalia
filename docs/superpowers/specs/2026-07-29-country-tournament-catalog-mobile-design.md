# Catálogo de torneos por país y adaptación mobile

## Objetivo

Convertir `/torneos` en un catálogo navegable para una cobertura amplia, evitando el listado vertical de competiciones. La jerarquía visible será País → Unión u organizador → Torneo → División. En paralelo, completar la adaptación responsive de las superficies públicas de Ovalia para que las tareas principales funcionen correctamente desde 320 px de ancho.

## Dirección visual aprobada

Se implementará la opción A del comparativo visual: índice lateral de países y grilla de torneos.

- En escritorio, un índice compacto y persistente dentro del contenido permite saltar entre países. El país activo se distingue con el acento lima de Ovalia.
- En mobile, ese índice se transforma en una barra horizontal desplazable situada antes del catálogo.
- Cada país contiene sus uniones u organizadores como secciones sin tarjetas anidadas.
- Los torneos de una unión se distribuyen en una grilla densa de tarjetas individuales. Cada tarjeta muestra sus divisiones como enlaces o estados de cobertura en preparación.
- El orden interno mantiene la prioridad editorial existente: torneos con mayor prioridad primero y divisiones en el orden Superior, Intermedia, Preintermedia, M22 y juveniles.

La estética conserva el lenguaje editorial oscuro de Ovalia, con bordes finos, tipografía serif en títulos y lima como acento. Se evita convertir cada nivel de la jerarquía en un contenedor visual independiente.

## Modelo de presentación

El agrupamiento del catálogo será una transformación pura y testeable de `ApiCompetition`:

1. Determinar el país de presentación. `AR` se muestra como Argentina; las competencias de selecciones o sin país se agrupan como Internacional; otros códigos usan un nombre conocido o el código como respaldo.
2. Agrupar por país.
3. Dentro de cada país, agrupar por organización usando el nombre provisto por la API y los respaldos actuales.
4. Dentro de cada organización, agrupar por `familySlug` y ordenar por prioridad.
5. Ordenar divisiones con las reglas deportivas ya existentes.

Argentina aparecerá primero, Internacional después y el resto de los países en orden alfabético. El índice mostrará la cantidad de familias de torneos, no la cantidad de divisiones, para evitar cifras infladas.

## Componentes y comportamiento

`TournamentsPage` renderizará:

- un `nav` de países con enlaces internos;
- una columna de contenido con una sección identificable por país;
- encabezados de unión con conteo de torneos;
- una grilla de familias de torneo;
- enlaces de división para cobertura automática y estados no interactivos para cobertura pendiente.

Los enlaces internos usarán anclas estables y `scroll-margin-top`. No se agregará estado cliente para el país activo: la navegación seguirá siendo nativa, accesible y resistente a fallas de JavaScript.

## Alcance mobile

La revisión responsive abarcará las superficies públicas compartidas, no sólo `/torneos`:

- Header del portal: marca, acceso y navegación principal accesibles mediante una barra inferior consistente en mobile.
- Home: rail en vivo, hero, fecha, selector de torneo, filas de partidos y contenido lateral sin desbordes.
- Partidos: barra de fecha, encabezados de competición y enfrentamientos legibles en una sola columna.
- Torneos: índice horizontal, uniones y tarjetas a una columna en pantallas angostas.
- Detalle de torneo y partido: tablas, pestañas, marcadores y timeline con scroll o reflujo controlado.
- Prodes, Juegos, Noticias e Ingreso: grillas a una columna, controles táctiles de al menos 40 px y texto sin recortes.

Se usarán breakpoints compatibles con los existentes (`980`, `760` y `680` px), agregando un ajuste estrecho cerca de `420` px sólo donde haga falta. No se cambiará la identidad visual ni la arquitectura de navegación de escritorio.

## Estados y accesibilidad

- Carga y error seguirán usando los estados existentes.
- El índice de países tendrá etiqueta accesible y foco visible.
- Los destinos de ancla tendrán encabezados semánticos.
- Los elementos en preparación seguirán sin actuar como enlaces.
- Se respetará `prefers-reduced-motion` y no se dependerá de animaciones para comunicar estado.

## Verificación

El cambio seguirá TDD para el agrupamiento por país y el orden del catálogo. Se agregarán pruebas que demuestren:

- Argentina se renderiza antes que Internacional y otros países.
- Las organizaciones quedan dentro del país correcto.
- El conteo del índice corresponde a familias de torneo.
- El orden de torneos y divisiones existente se conserva.

Después se ejecutarán las pruebas específicas, `pnpm verify` y `pnpm build`. La verificación visual cubrirá `/`, `/partidos`, `/torneos`, `/prodes`, `/juegos` y `/noticias` en un viewport mobile y uno desktop, prestando atención a desbordes horizontales, solapamientos y legibilidad.
