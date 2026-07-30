# Simulador de carrera

Fecha: 2026-07-30

## Objetivo

Sumar al hub de juegos una carrera jugable: se crea un jugador, se arranca en un
club y se avanza temporada a temporada viendo cómo evoluciona. Responde «¿hasta
dónde llegás?», con azar, progresión y rejugabilidad.

## Relación con «Camino al XV»

El hub ya tiene dos juegos: «Tu identidad ovalada», un test de cinco decisiones, y
«Camino al XV», tres deslizadores —potencia, velocidad, visión— que devuelven un
puesto mediante `chooseCareerOutcome` en `packages/domain/src/games.ts`.

«Camino al XV» **se mantiene tal como está**. Es determinístico, dura quince
segundos y responde una pregunta distinta: «¿qué puesto sos?». La carrera no lo
reemplaza.

Se agrega un solo vínculo: al terminar «Camino al XV», el resultado ofrece
arrancar una carrera con ese puesto ya elegido. El juego corto deja de ser un
callejón sin salida y se convierte en la puerta de entrada natural al largo, sin
dejar de funcionar por su cuenta.

## Azar reproducible

Toda la simulación vive en `packages/domain/src/career.ts` como funciones puras,
sin `Math.random` global. El generador de números aleatorios se **recibe como
parámetro**, y el módulo incluye uno determinístico a partir de una semilla.

Es la decisión de diseño central: sin ella, las reglas de una simulación con
veintitantas tiradas de azar no se pueden probar, y `AGENTS.md` exige TDD en toda
regla. Con ella, cada prueba fija una semilla y verifica el resultado exacto.
Además habilita compartir una carrera: la misma semilla y las mismas decisiones
producen la misma historia.

## Datos reales, sin acoplar

Los clubes y divisiones que aparecen en la carrera son los reales, leídos de la
base al cargar la página. Un jugador de URBA reconoce los nombres y las
categorías por las que asciende, y eso es la mitad de la gracia.

Pero el módulo de dominio **no consulta la base**: recibe la lista de clubes y
divisiones como argumento. Así la simulación se prueba con un catálogo mínimo
inventado y sigue siendo pura. Si algún día no hay datos disponibles, el juego
funciona con un catálogo de reserva en lugar de romperse.

## Estructura de una carrera

Se elige puesto y se reparten atributos iniciales. La carrera empieza en una
división baja y avanza por temporadas. Cada temporada produce un rendimiento a
partir de los atributos, del nivel de la división y del azar, y de ahí se derivan
la evolución de los atributos, ofertas de clubes, ascensos o descensos y, en las
carreras destacadas, una convocatoria.

El jugador decide entre temporadas: aceptar una oferta o quedarse, y en qué
enfocar el entrenamiento. Sin decisiones sería una animación, no un juego.

La carrera termina por retiro, decidido por la edad y por la caída sostenida del
rendimiento, y cierra con un resumen: clubes, temporadas, mejor momento y
categoría máxima alcanzada.

## Persistencia

La carrera en curso vive en la sesión del navegador y no se guarda en el
servidor. No hay cuentas involucradas y el juego no depende de la autenticación
del Release 2.

Guardar carreras entre dispositivos es una funcionalidad distinta, que solo tiene
sentido con cuentas y con evidencia de que la gente vuelve a jugar. No se diseña
ahora.

## Interfaz

La carrera se suma como tercera tarjeta del hub, en `/juegos`, siguiendo la
composición existente. Cada temporada se presenta como una tarjeta con lo que
pasó y las decisiones disponibles; el historial queda accesible para revisar la
trayectoria.

`games-hub.tsx` es hoy un único componente con las tres pantallas del hub
resueltas en línea. Sumarle una carrera completa lo volvería ilegible, así que
como parte de este trabajo se separan los juegos en un componente por juego,
dejando el hub como índice.

## Pruebas

En `packages/domain`, pruebas de la simulación con semilla fija: una temporada
produce siempre el mismo resultado, atributos altos rinden mejor que bajos a lo
largo de muchas temporadas, el ascenso ocurre al superar el umbral, el retiro
llega por edad y por rendimiento, y una carrera completa termina siempre —no hay
bucle infinito—. También se prueba que el catálogo de reserva se usa cuando la
lista de clubes llega vacía.

En `apps/web`, pruebas del recorrido: creación del jugador, avance de temporada,
decisión entre ofertas, resumen final y el paso desde «Camino al XV» a la carrera
con el puesto preseleccionado.

## Fuera de alcance

Simular partidos individuales, otros jugadores con carrera propia, mercado de
pases entre clubes controlados por la máquina y tablas de clasificación entre
usuarios.
