# Simulador de carrera

Fecha: 2026-07-30 · Revisado: 2026-07-31

## Objetivo

Sumar al hub de juegos una carrera de rugbier jugable en pocos minutos: se crea
un jugador, se arranca en un club real y se avanza tomando decisiones hasta el
retiro, que cierra con una tarjeta compartible, una comparación y un puntaje que
entra en un ranking.

## Referencias estudiadas

Se analizaron tres juegos del género. Se adopta su **estructura**; no se copian
su código, su estética ni sus textos.

**Copero** (fútbol) crea el jugador con apellido, nacionalidad, número, pierna
hábil y posición, y avanza por bloques de dos años con decisiones de traspaso,
préstamo, pelea por la titularidad y entrenamiento. Su acierto es la velocidad
—dos décadas en menos de dos minutos, sin cuenta ni instalación— y el resumen
final pensado para compartir.

**El Ídolo** (Potrero, fútbol) hace empezar en el Ascenso y liga cada decisión al
prestigio y a la relación con la hinchada. Su acierto es el cierre: compara la
trayectoria con una figura histórica, asigna un puntaje y lo mete en un ranking
general.

**Ovalados** (rugby) ya adaptó la fórmula: maneja edad, media, club, división,
condición amateur o profesional, moral, hinchada y fama, con un pozo de
escenarios ponderados y condicionados por edad y nivel. Su acierto no es la
mecánica sino el contenido: la vida amateur que aprieta, el tercer tiempo, la
noche, la tentación de "el plan". Sus finales premian quedarse —«Ídolo eterno del
club», «Gloria amateur»— en vez de tratar el amateurismo como un fracaso.

## La decisión de diseño central

En el fútbol argentino la carrera es una escalera: todos aspiran a ser
profesionales y el que no llega, fracasa. En el rugby de URBA no: la enorme
mayoría juega toda su vida siendo amateur, con trabajo o facultad en paralelo, y
eso no es un fracaso sino la norma.

Por eso la tensión que organiza el juego no es «¿llegás a profesional?» sino
**«¿cuánto te banca la vida el rugby?»**. Trabajo, estudio, lesiones, familia y
club compiten por el mismo tiempo. Un final quedándose en el club de siempre debe
valer tanto como uno emigrando a Europa: son caminos distintos, no niveles.

Ese es el motivo por el que este juego no puede ser un reskin de Copero.

## Relación con los juegos existentes

El hub tiene «Tu identidad ovalada» (test de cinco decisiones) y «Camino al XV»
(tres deslizadores que devuelven un puesto mediante `chooseCareerOutcome` en
`packages/domain/src/games.ts`).

**«Camino al XV» tiene un defecto que se corrige acá:** hoy muestra el resultado
antes de que el usuario interactúe —los deslizadores actualizan la etiqueta en
vivo—, así que no hay decisión ni revelación, y sus cuatro salidas posibles no
justifican volver a jugarlo. Pasa a ser el paso de creación de la carrera:
elegís tus atributos, y el juego te dice tu puesto **al confirmar**, ofreciendo
arrancar la carrera con él. Deja de ser un callejón sin salida sin dejar de
poder jugarse solo.

«Tu identidad ovalada» no se toca.

## Azar reproducible

Toda la simulación vive en `packages/domain` como funciones puras, sin
`Math.random` global: el generador se **recibe como parámetro**, y el módulo
incluye uno determinístico a partir de una semilla.

Es la decisión técnica que sostiene todo lo demás. Sin ella, las reglas de una
simulación con decenas de tiradas no se pueden probar, y `AGENTS.md` exige TDD en
toda regla. Con ella, cada prueba fija una semilla y verifica el resultado
exacto. Además habilita compartir una carrera: misma semilla y mismas decisiones
producen la misma historia, así que la tarjeta compartida es reproducible.

## Datos reales

Los clubes y divisiones de la carrera son los reales, leídos de la base al cargar
la página, con sus escudos. Un jugador de URBA reconoce los nombres y las
categorías por las que asciende, y eso es la mitad de la gracia. Es también la
única ventaja que los tres juegos de referencia no pueden copiar: ellos
hardcodean sus catálogos.

El módulo de dominio **no consulta la base**: recibe la lista de clubes y
divisiones como argumento. Así la simulación se prueba con un catálogo mínimo
inventado y sigue siendo pura. Si los datos no están disponibles, el juego
funciona con un catálogo de reserva en lugar de romperse.

Los clubes del exterior —Europa, Súper Rugby— no están en la base y se definen
como catálogo fijo del juego, claramente separado del catálogo real.

## Estructura de una carrera

Se elige apellido, club de origen y puesto, y se reparten atributos iniciales.
La carrera arranca en una división baja y avanza por temporadas.

Cada temporada produce un rendimiento a partir de los atributos, del nivel de la
división y del azar, y de ahí se derivan la evolución de los atributos, ofertas,
ascensos o descensos, lesiones y, en las carreras destacadas, convocatorias.

Entre temporada y temporada el jugador decide. Sin decisiones sería una
animación, no un juego. Los escenarios salen de un pozo ponderado y condicionado
por edad, nivel y situación, de modo que dos carreras no se parezcan.

Las familias de escenario son: **club** (seguir, aceptar una oferta, cambiar de
división), **vida** (trabajo, estudio, familia, lesión, cuerpo), **grupo**
(tercer tiempo, liderazgo, conflicto de vestuario) y **encrucijada** (las
decisiones que cambian el rumbo, incluida la tentación de acortar camino).

La carrera termina por retiro, decidido por edad y por caída sostenida del
rendimiento.

## Cierre

El retiro produce tres cosas.

**Una tarjeta compartible** con la trayectoria: clubes, temporadas, partidos,
títulos, mejor momento y categoría máxima. Es lo que hace que el juego salga de
la pantalla del que lo jugó.

**Una comparación con una figura histórica del rugby argentino**, según la forma
de la carrera, no según los números. La lista es curada y vive en el dominio,
como ya vive `TEAM_BADGES`. Reglas de uso, que la implementación debe respetar:
solo figuras públicas y solo en su faceta deportiva; la comparación describe el
**tipo de trayectoria** («una carrera parecida a la de X: se fue joven y volvió a
terminar en su club»), nunca atribuye estadísticas inventadas a la persona real,
y no emite juicios sobre su vida privada.

**Un puntaje** derivado de la trayectoria, que alimenta el ranking.

## Ranking

El ranking es híbrido, para no quedar bloqueado por la autenticación:

- Si hay sesión iniciada, la carrera se publica con ese usuario.
- Si no la hay, se pide un apodo al momento de publicar.

Publicar es siempre una acción explícita del jugador, nunca automática al
retirarse. Se guardan el puntaje, el apodo o usuario, y el resumen de la
trayectoria; **no** se guarda ningún dato personal adicional.

Como la vía anónima no depende del Hito 10, el juego se puede publicar antes de
que exista autenticación, y la vía con cuenta se activa sola cuando exista.

El apodo se valida en el servidor —largo máximo y filtro de contenido— y hay un
límite de publicaciones por origen para que la tabla no se llene de basura.

## Persistencia

La carrera en curso vive en la sesión del navegador. Sólo se persiste en el
servidor lo que se publica al ranking.

## Interfaz

La carrera se suma como tercera tarjeta del hub, en `/juegos`. Cada temporada se
presenta como una tarjeta con lo que pasó y las decisiones disponibles, y el
historial queda accesible para revisar la trayectoria.

`games-hub.tsx` es hoy un único componente de 24 líneas con las tres pantallas
del hub resueltas en línea. Sumarle una carrera completa lo volvería ilegible, así
que como parte de este trabajo se separan los juegos en un componente por juego,
dejando el hub como índice.

## Pruebas

En `packages/domain`, pruebas de la simulación con semilla fija: una temporada
produce siempre el mismo resultado; atributos altos rinden mejor que bajos a lo
largo de muchas temporadas; el ascenso ocurre al superar el umbral; el retiro
llega por edad y por rendimiento; una carrera completa siempre termina —no hay
bucle infinito—; el catálogo de reserva se usa cuando la lista de clubes llega
vacía; y el pozo de escenarios respeta sus condiciones de edad y nivel.

En `packages/database` y `apps/api`, pruebas de la publicación al ranking: alta
con apodo, alta con sesión, rechazo de apodo inválido y corte por límite de
frecuencia.

En `apps/web`, pruebas del recorrido con Testing Library: creación del jugador,
avance de temporada, decisión entre opciones, resumen final, publicación al
ranking y el paso desde «Camino al XV» a la carrera con el puesto elegido.

## Fuera de alcance

Simular partidos individuales, otros jugadores con carrera propia, mercado de
pases entre clubes controlados por la máquina, y grupos privados de ranking.
