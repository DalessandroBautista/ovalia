# Modal de partido con contexto deportivo

Fecha: 2026-07-30

## Objetivo

Dar a la agenda de `/partidos` una vista rápida de cada partido sin abandonar la
fecha que el usuario está mirando, y llenar el detalle de partido —hoy limitado a
escudos, marcador, sede y procedencia— con el contexto que un seguidor consulta
antes y después de un encuentro: cómo llega cada equipo, cuántas veces se
enfrentaron y en qué puesto vienen.

La referencia funcional es el modal de partido de Ovalados. Se adopta su
estructura de pestañas y su patrón de apertura desde la lista; no se copian su
estética, su paleta ni su contenido. La identidad visual de Ovalia se conserva sin
cambios.

## Alcance

El trabajo se entrega en dos partes consecutivas.

**Parte A — Cierre del explorador compartido.** Las tareas 1 a 8 del plan
`2026-07-29-shared-rugby-explorer-implementation.md` ya están implementadas en el
árbol de trabajo y las pruebas de `apps/web` pasan. Resta ejecutar la tarea 9
—verificación integral con `pnpm verify` y `pnpm build`, revisión visual de
`/torneos` y `/partidos` en escritorio y mobile— y confirmar el cambio en un
commit enfocado. No se rediseña ninguna decisión del explorador.

**Parte B — Modal de partido.** Se construye sobre la agenda ya filtrada por el
explorador.

Quedan explícitamente fuera, por depender de tablas y fuentes que el proyecto no
tiene: formaciones y jugadores, buscador de jugadores, foro de debate por partido
y simulador de carrera. Cada uno requiere su propio ciclo de spec y plan.

## Estado de partida

El esquema no tiene tablas `players`, `lineups` ni `comments`. La tabla
`match_events` está declarada en `packages/database/src/schema.ts` pero ningún
código la escribe ni la lee, por lo que está vacía y no puede alimentar la
interfaz.

Todo el contenido de este diseño se calcula a partir de datos ya poblados:
`matches` (1182 partidos de URBA Top 14 importados y validados) y `standings`
(coincidente con la fuente oficial).

## Arquitectura

El contexto deportivo se expone en un endpoint único, `GET
/v1/matches/:id/context`, que devuelve en una sola respuesta lo que consumen las
tres pestañas. Una llamada por apertura de modal evita tres viajes de red y deja
el cálculo del lado del servidor, junto a los datos.

La responsabilidad se reparte siguiendo la separación vigente en el monorepo:

- `packages/domain/src/match-context.ts` recibe los partidos previos y los dos
  equipos, y devuelve el balance de enfrentamientos y la forma reciente. Es un
  módulo puro, sin dependencia de framework ni de base de datos.
- `packages/database` incorpora a `matches-repository.ts` la consulta de partidos
  finalizados anteriores de ambos equipos, y reutiliza la lectura de posiciones
  existente en `standings-repository.ts`.
- `apps/api` publica la ruta y valida su entrada en `schemas.ts`.
- `apps/web` suma `fetchMatchContext` al cliente tipado, el hook
  `use-match-context.ts` y el componente `MatchModal`.

## Definiciones de datos

Las tres definiciones se fijan aquí para que la implementación no tenga que
elegir.

**Enfrentamientos previos.** Partidos con estado `final` entre los dos equipos
cuya fecha de inicio sea anterior a la del partido mostrado, sin restringir por
competencia: dos clubes que se cruzaron en Top 14 y en Intermedia comparten
historial. Se informa el balance completo —victorias de cada lado y empates— y se
listan los diez encuentros más recientes con su resultado.

**Forma reciente.** Los cinco partidos `final` más recientes de cada equipo con
fecha anterior a la del partido mostrado. Definir la ventana como *anterior a este
partido* hace que el mismo cálculo sirva para un encuentro ya jugado —muestra la
forma con la que cada equipo llegaba— y para uno futuro —muestra la forma
actual—, sin ramas condicionales.

**Posición en la tabla.** La fila de `standings` de cada equipo en la competencia
y temporada del partido, con puesto y puntos.

## Interfaz

El modal se abre con el parámetro `partido`, que lleva el identificador de
partido que ya usa la ruta `/partidos/[slug]`. Convive con los parámetros que el
explorador administra:

```
/partidos?fecha=2026-07-30&torneo=top14&partido=<id>
```

La página `/partidos/[slug]` permanece como destino canónico del partido y
conserva su `generateMetadata`, de modo que el SEO incorporado en el Release 1 no
se ve afectado. El modal ofrece un enlace a esa página. Los controles de
retroceso y avance del navegador cierran y reabren el modal, con el mismo
comportamiento que hoy tienen la fecha y la familia de torneo.

La cabecera del modal —escudos, marcador, competencia y jornada— se dibuja de
inmediato con los datos que la agenda ya tiene en memoria; las pestañas resuelven
su carga después. No existe un estado en el que el modal aparezca vacío
esperando la red.

`rugby-explorer.tsx` contiene hoy un atrapado de foco escrito a mano para su
drawer mobile, y el modal necesita el mismo comportamiento. Se extrae a un hook
`use-focus-trap.ts` que ambos consumen, en lugar de duplicar la lógica.

## Errores y estados vacíos

Un fallo de `/v1/matches/:id/context` no rompe el modal: la cabecera permanece
visible y cada pestaña degrada por separado con un mensaje honesto —«Sin
enfrentamientos previos registrados», «Sin partidos anteriores», «Este equipo no
figura en la tabla»—. La ausencia de datos es un caso corriente, no una
excepción: un equipo recién ascendido no tiene historial contra sus nuevos
rivales. La política es la misma de vacíos honestos adoptada en el Release 1.

Un identificador de partido inexistente en el parámetro `partido` no produce un
error de renderizado: el modal no se abre y la agenda se muestra normalmente.

## Pruebas

Se aplica TDD en las cuatro capas, según la regla vigente en `AGENTS.md`.

En `packages/domain`, pruebas del cálculo puro, incluidos los bordes: sin
historial previo, empates, un único enfrentamiento, y menos de cinco partidos
disponibles para la forma reciente. En `packages/database`, prueba de la consulta
contra la base de test del paquete. En `apps/api`, prueba de la ruta en
`app.test.ts`, cubriendo la respuesta correcta y el partido inexistente. En
`apps/web`, pruebas con Testing Library en `portal-pages.test.tsx` para la
apertura y el cierre del modal, la sincronización del parámetro en la URL, el
degradado de cada pestaña ante un error y los atributos de accesibilidad del
diálogo.

El cierre de cada parte exige `pnpm verify` y `pnpm build` en verde.

## Sub-proyectos derivados

El pedido original abarcaba cinco subsistemas. Los restantes conservan su orden
de dependencia y se diseñarán por separado:

| Sub-proyecto | Depende de | Bloqueante |
|---|---|---|
| Jugadores y formaciones | — | Tablas nuevas y una fuente de datos por definir |
| Buscador de jugadores | Jugadores y formaciones | Hereda el anterior |
| Foro de debate por partido | — | Moderación y anti-spam; corresponde al Release 3 |
| Simulador de carrera | — | Ninguno; encaja en el hub `/juegos` existente |
