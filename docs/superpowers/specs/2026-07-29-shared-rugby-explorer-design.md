# Explorador compartido de uniones y torneos

## Objetivo

Reorganizar `/torneos` y `/partidos` alrededor de un explorador lateral de competencias que permita descubrir primero una unión y luego una familia de torneo. El cambio debe reducir el espacio vertical que ocupan los encabezados, incorporar las 25 uniones miembros de la Unión Argentina de Rugby y mantener una experiencia coherente entre catálogo, agenda y detalle de torneo.

La referencia funcional es el índice lateral de Potrero Fútbol, adaptado a la identidad editorial de Ovalia. No se copiarán su estética, publicidad, favoritos ni buscador.

## Dirección visual aprobada

Se implementará una franja compacta para los encabezados de `/torneos` y `/partidos`:

- eyebrow y título en el sector izquierdo;
- introducción breve alineada a la derecha en escritorio;
- reducción sustancial del espacio superior, del tamaño del título y del margen inferior;
- apilado legible en mobile;
- conservación del fondo oscuro, la tipografía display, los bordes finos y el acento lima de Ovalia.

El objetivo es que el contenido útil —explorador, fecha y torneos o partidos— aparezca dentro del primer viewport en un monitor de escritorio comparable al de la captura de referencia.

## Arquitectura de interfaz

### Explorador compartido

`/torneos` y `/partidos` compartirán un componente de navegación con la misma jerarquía:

1. Unión.
2. Familia de torneo.

Sólo una unión permanecerá expandida a la vez. Al expandir URBA, por ejemplo, se mostrarán familias como Top 14, Primera A, Primera B, Primera C, juveniles y femenino según el catálogo verificado disponible.

Las divisiones internas —Superior, Intermedia, Preintermedia, Menores de 22 y equivalentes— no ocuparán el primer nivel del explorador. Se presentarán como filtros dentro del detalle de la familia de torneo.

El explorador será un `nav` dentro de un `aside`, tendrá scroll propio y permanecerá visible mediante `position: sticky` en escritorio. El contenido principal conservará su scroll normal.

### Comportamiento en `/torneos`

La ruta mostrará una vista general de la unión seleccionada:

- nombre y cantidad de familias con catálogo;
- tarjetas compactas para las familias disponibles;
- estado “Cobertura en preparación” cuando la unión todavía no tenga torneos verificados.

Seleccionar una familia desde el explorador o desde una tarjeta abrirá su detalle canónico. El detalle mantendrá:

- selector de divisiones de la familia;
- vistas de resultados, próximos partidos y posiciones;
- navegación de fechas o jornadas que ya exista para la competencia seleccionada.

La unión abierta se persistirá en `?union=<slug>`. Una URL inválida utilizará la primera unión con cobertura disponible sin producir un error de renderizado.

### Comportamiento en `/partidos`

El explorador funcionará primero como filtro de la agenda. Seleccionar una familia:

- conservará la fecha actual;
- mostrará los partidos de todas las divisiones pertenecientes a esa familia;
- mantendrá la agrupación visual por competencia y jornada;
- actualizará la URL a `?fecha=YYYY-MM-DD&torneo=<familySlug>`;
- ofrecerá “Ver torneo” en el encabezado del resultado filtrado para abrir el detalle.

“Limpiar filtro” volverá a mostrar todos los partidos de la fecha sin modificarla. Los controles atrás/adelante del navegador deberán restaurar tanto fecha como familia seleccionada.

## Modelo de datos

### Catálogo de uniones

Las 25 uniones miembros publicadas por la UAR serán registros de `organizations` con `kind: 'union'` y `countryCode: 'AR'`. La interfaz nunca tendrá una lista paralela hardcodeada.

La API expondrá las organizaciones aunque no tengan competencias asociadas. El cliente combinará ese catálogo con las competencias existentes para construir el explorador, de modo que una unión sin cobertura no desaparezca.

Los nombres iniciales se tomarán del listado oficial de la UAR:

- Unión de Rugby del Alto Valle;
- Unión Andina de Rugby;
- Unión de Rugby Austral;
- Unión de Rugby de Buenos Aires;
- Unión de Rugby del Valle de Chubut;
- Unión Cordobesa de Rugby;
- Unión de Rugby de Cuyo;
- Unión Entrerriana de Rugby;
- Unión de Rugby de Formosa;
- Unión Jujeña de Rugby;
- Unión de Rugby de Los Lagos del Sur;
- Unión de Rugby de Mar del Plata;
- Unión de Rugby de Misiones;
- Unión de Rugby del Nordeste;
- Unión de Rugby del Oeste de Buenos Aires;
- Unión de Rugby de Rosario;
- Unión de Rugby de Salta;
- Unión Sanjuanina de Rugby;
- Unión de Rugby de San Luis;
- Unión Santafesina de Rugby;
- Unión Santacruceña de Rugby;
- Unión Santiagueña de Rugby;
- Unión de Rugby del Sur;
- Unión de Rugby de Tierra del Fuego;
- Unión de Rugby de Tucumán.

### Torneos compartidos por varias uniones

Una competencia podrá estar asociada a más de una organización mediante una relación muchos a muchos. La columna `competitions.organizationId` se conservará como organización primaria para compatibilidad con la ingesta y las consultas actuales; una tabla de asociación representará las demás uniones participantes.

Esto permite modelar correctamente, por ejemplo, el Torneo Regional del Litoral bajo Rosario, Santa Fe y Entre Ríos sin duplicar la competencia ni sus partidos.

El catálogo inicial sólo incluirá nombres de torneos verificados mediante fuentes oficiales. Las competencias sin fixtures automáticos tendrán `coverage: 'manual'` y se comunicarán como cobertura en preparación. No se crearán partidos, resultados, posiciones ni temporadas ficticias.

### Contratos de API

La API agregará `GET /v1/organizations?countryCode=AR&kind=union`. Cada organización se serializará con:

- `slug`;
- `name`;
- `kind`;
- `countryCode`;
- `competitionSlugs`, incluyendo las competencias donde la organización sea primaria o participante adicional.

El cliente cruzará `competitionSlugs` con `/v1/competitions` y agrupará esos registros por `familySlug`.

Las entradas se validarán en el límite de la API. Los tipos compartidos del cliente representarán explícitamente el catálogo y sus asociaciones, manteniendo TypeScript estricto.

## Agrupación y selección

La transformación del catálogo será lógica pura y testeable:

1. cargar todas las uniones argentinas;
2. asociar cada competencia por organización primaria y asociaciones adicionales;
3. agrupar divisiones por `familySlug`;
4. ordenar familias por prioridad editorial y nombre;
5. ordenar las uniones con cobertura primero y las restantes alfabéticamente;
6. mantener una sola unión expandida;
7. resolver una familia seleccionada a todas sus divisiones para filtrar partidos.

Una familia sin `familySlug` utilizará una clave normalizada derivada de su nombre mediante la lógica de respaldo existente. La navegación al detalle usará la división senior de mayor prioridad como destino canónico; si no existe, utilizará la división de mayor prioridad disponible.

## Responsive y accesibilidad

En viewports de escritorio, el explorador tendrá una columna de ancho acotado y el contenido utilizará el resto del espacio.

En mobile:

- la columna lateral se reemplazará por un botón “Uniones y torneos”;
- el botón abrirá un drawer con la misma jerarquía;
- el drawer cerrará al seleccionar una familia;
- `Escape` cerrará el panel;
- el foco permanecerá dentro del panel mientras esté abierto y regresará al botón disparador al cerrar;
- el fondo no podrá desplazarse mientras el drawer esté abierto;
- los controles táctiles tendrán al menos 44 px.

Los botones de unión expondrán `aria-expanded`. La familia activa usará `aria-current` o `aria-pressed` según su semántica. El `nav` tendrá un nombre accesible distinto en Torneos y Partidos. Ningún estado dependerá sólo del color.

## Estados y errores

- Si falla el catálogo de organizaciones en `/partidos`, la agenda seguirá visible sin explorador y mostrará un aviso no bloqueante.
- Si falla la agenda, el explorador seguirá disponible y se conservará el filtro elegido.
- Si una unión no tiene familias, la vista mostrará “Cobertura en preparación”.
- Si una familia elegida no tiene partidos en la fecha, se mostrará un estado vacío específico y se mantendrá el acceso “Ver torneo”.
- Parámetros de URL inválidos se ignorarán de forma segura.
- Los estados de carga no cambiarán abruptamente el ancho de la grilla.

## Auditoría y procedencia

El seed inicial es un catálogo estructural y verificable. Toda futura mutación editorial sensible realizada desde procesos administrativos deberá continuar produciendo auditoría según las reglas de Ovalia.

Las integraciones externas seguirán siendo opcionales. La existencia de una unión o familia en el catálogo no implica que haya ingesta automática habilitada.

## Estrategia de pruebas

El cambio se implementará con TDD.

### Dominio y datos

- validar el catálogo de exactamente 25 uniones oficiales, con slugs únicos;
- verificar la asociación de un torneo regional a varias uniones;
- asegurar que una competencia no se duplica al consultarla desde distintas uniones;
- probar el destino canónico de una familia con y sin división senior;
- probar el agrupamiento y orden del explorador.

### API

- devolver uniones aunque no tengan competencias;
- exponer asociaciones regionales válidas;
- validar parámetros y serialización;
- preservar el contrato actual de `/v1/competitions`.

### Interfaz

- expandir una sola unión a la vez;
- renderizar estados sin cobertura;
- filtrar `/partidos` por todas las divisiones de una familia;
- conservar fecha y filtro en la URL;
- limpiar el filtro sin cambiar la fecha;
- navegar al detalle canónico mediante “Ver torneo”;
- operar el drawer con teclado, `Escape` y restauración de foco.

### Verificación final

- pruebas específicas durante cada ciclo rojo-verde-refactor;
- revisión visual de `/torneos`, `/partidos` y detalle de torneo en escritorio y mobile;
- `pnpm verify`;
- `pnpm build`.

## Fuera de alcance

- favoritos de equipos o competiciones;
- publicidad;
- buscador lateral;
- rediseño global de la navegación superior;
- incorporación de fixtures o resultados no verificados;
- automatización obligatoria para las 25 uniones.
