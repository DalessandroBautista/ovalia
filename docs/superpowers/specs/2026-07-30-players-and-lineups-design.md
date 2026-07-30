# Jugadores y formaciones por partido

Fecha: 2026-07-30

## Objetivo

Registrar qué jugadores integraron cada equipo en cada partido, para habilitar la
pestaña de formaciones del detalle de partido y, más adelante, el buscador de
jugadores.

## La fuente: por qué carga manual

La API pública de URBA no expone planteles. Se verificó el objeto `match` de
`/api/championship/{id}` y sus únicas claves son identificadores de equipo,
`playdate`, `fulfilled`, `suspended`, marcadores, bonus ofensivo y defensivo, y
referencias de video. No hay jugadores en ningún nivel de la respuesta.

No existe, por lo tanto, una fuente automatizable. El sitio de referencia,
Ovalados, mantiene sus formaciones a mano en un archivo plano. Se adopta la
misma estrategia con mejor soporte: un editor las carga desde el panel de
administración que Ovalia ya tiene, con token, validación y auditoría.

La cobertura inicial es **URBA Top 14**, la misma del Release 1. Ampliar a otras
divisiones es una decisión operativa posterior, no un cambio de diseño.

## Modelo de datos

Dos tablas nuevas en `packages/database/src/schema.ts`.

`players` guarda la identidad del jugador, independiente del club: un jugador
cambia de equipo y sigue siendo el mismo. Contiene identificador, nombre
completo, `slug` canónico y una columna `normalizedName` que es la clave de
deduplicación, más las marcas de auditoría habituales.

`lineup_entries` relaciona jugador, partido y equipo. Contiene número de camiseta,
si fue titular o suplente, y si vistió la cinta de capitán. La combinación de
partido, equipo y número de camiseta es única: no puede haber dos jugadores con
el 10 en el mismo equipo y partido.

No se modela posición. El número de camiseta ya la determina en rugby y una
columna aparte solo abriría la puerta a que ambas se contradigan.

## Identidad y deduplicación

`normalizedName` se calcula con una función pura en
`packages/domain/src/player-identity.ts`: se quitan diacríticos, se pasa a
minúsculas, se descartan los caracteres no alfanuméricos y los tokens restantes
se ordenan alfabéticamente. Así «Juan Cruz Pérez», «Pérez, Juan Cruz» y «juan
cruz perez» producen la misma clave.

Esa normalización agrupa, pero no decide. Los homónimos existen y dos jugadores
distintos pueden compartir clave. Por eso la carga **nunca fusiona sola**: cuando
un nombre coincide con jugadores existentes, la interfaz de carga muestra los
candidatos con sus clubes recientes y el editor elige entre vincular al existente
o crear uno nuevo. La automatización sugiere; la persona confirma.

## Carga desde el panel de administración

La pantalla de carga vive dentro del admin existente (`apps/web/app/admin`), bajo
el mismo token y el mismo registro de auditoría.

El editor elige un partido y pega el plantel de cada equipo como texto, en el
formato en que las instituciones lo publican:

```
1. Marcos Torrillas
2. Juan Cruz Pérez (c)
...
```

Un parser puro en `packages/domain/src/lineup-parser.ts` convierte ese texto en
entradas estructuradas: separa número de nombre, detecta la marca de capitán,
clasifica como titular los números 1 al 15 y como suplentes del 16 en adelante,
e informa los renglones que no pudo interpretar en lugar de descartarlos en
silencio. Pegar texto es órdenes de magnitud más rápido que veintitrés campos de
formulario, y al ser una función pura se prueba exhaustivamente sin interfaz.

La carga se previsualiza antes de confirmarse: el editor ve cómo quedó
interpretado cada renglón y qué jugadores se crearían nuevos. Recién entonces
confirma.

Toda confirmación escribe en `audit_log`, según la regla de `AGENTS.md` sobre
mutaciones deportivas. Volver a cargar un plantel ya existente lo reemplaza y
deja ambos estados registrados.

## Exposición pública

`GET /v1/matches/:id/lineups` devuelve las formaciones de ambos equipos, con
titulares y suplentes separados y ordenados por número. Si no hay datos cargados
responde listas vacías, no un error: la ausencia de formación es el estado normal
de la mayoría de los partidos.

En la interfaz se suma la pestaña **Formaciones** al modal de partido definido en
`2026-07-30-match-modal-design.md`. La pestaña solo aparece cuando el partido
tiene formación cargada; no se muestra una pestaña vacía en los miles de partidos
que no la tendrán.

## Pruebas

Se aplica TDD en las cuatro capas.

En `packages/domain`, pruebas del normalizador de nombres —acentos, orden
invertido, nombres compuestos, sufijos— y del parser de planteles: numeración
correcta, marca de capitán en sus variantes, corte entre titulares y suplentes,
renglones inválidos, números repetidos y texto vacío. En `packages/database`,
pruebas de la escritura de plantel y del reemplazo de una carga previa. En
`apps/api`, pruebas de la ruta pública y de la ruta de administración, incluida
la respuesta ante un partido sin formación y el rechazo sin token. En `apps/web`,
pruebas de la pantalla de carga —previsualización, resolución de un jugador
ambiguo, confirmación— y de la pestaña en el modal.

## Dependencias

Requiere el modal de partido de `2026-07-30-match-modal-design.md`, que aporta la
estructura de pestañas donde se inserta. Habilita el buscador de jugadores de
`2026-07-30-player-search-design.md`, que sin estos datos no tiene qué buscar.

## Riesgo aceptado

Este diseño compromete trabajo humano recurrente: alrededor de siete partidos por
fecha en Top 14. Si esa carga no se sostiene, la pestaña simplemente no aparece y
el resto del producto no se degrada. La decisión de ampliar la cobertura debería
tomarse recién con la beta funcionando, no antes.
