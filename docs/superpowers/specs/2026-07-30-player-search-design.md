# Buscador de jugadores

Fecha: 2026-07-30

## Objetivo

Permitir escribir el nombre de un jugador y ver dónde jugó: en qué clubes, en qué
divisiones y en qué partidos. Es la consulta natural del usuario inicial de
Ovalia —jugador o exjugador de URBA— sobre sí mismo, sus conocidos y los rivales
de su club.

## Dependencia

Depende por completo de `2026-07-30-players-and-lineups-design.md`. El buscador
no incorpora ninguna fuente de datos propia: lee lo que la carga manual de
formaciones haya registrado. Su cobertura es exactamente la cobertura de esas
formaciones, y eso debe quedar visible en la interfaz.

## Búsqueda del lado del servidor

El sitio de referencia descarga al navegador un archivo con todas las formaciones
y lo recorre con expresiones regulares en el cliente. Ese enfoque crece de forma
lineal con la cobertura y castiga a quien entra desde el teléfono, que es la
mayoría del público de Ovalia.

Acá la búsqueda ocurre en PostgreSQL. La columna `normalizedName` de `players`
—definida en el spec de formaciones— lleva un índice, y la consulta busca por
prefijo de token sobre ella. El navegador recibe únicamente los resultados.

`GET /v1/players?q=<texto>` devuelve hasta veinte coincidencias, cada una con
nombre, `slug` y los clubes más recientes en los que figuró, que es lo que
permite distinguir dos homónimos de un vistazo. Una consulta de menos de tres
caracteres se rechaza con `400`: evita barridos de tabla y no sirve a nadie.

## Ficha de jugador

Cada resultado lleva a `/jugadores/[slug]`, una ruta renderizada en el servidor
con su propia metadata, igual que las de partido y torneo.

La ficha muestra el nombre, los clubes en los que figuró y la lista de partidos
en los que integró un plantel: fecha, competencia, rival, resultado, número de
camiseta y si fue titular o suplente. Los partidos enlazan al detalle
correspondiente.

Un jugador que pasó por el equipo superior y por la intermedia del mismo club
aparece como una sola ficha con ambas divisiones, no como dos jugadores
distintos.

## Honestidad de la cobertura

La ficha y los resultados advierten que la información proviene de las
formaciones cargadas manualmente y que la cobertura es parcial. No decir esto
convierte un vacío de carga en una afirmación falsa sobre la carrera de una
persona real: que alguien no aparezca en un partido no significa que no lo haya
jugado.

Por la misma razón, una búsqueda sin resultados responde «No encontramos ese
nombre en las formaciones cargadas», no «Ese jugador no existe».

## Datos de personas

Solo se publica lo que las instituciones ya publican: nombre y número de camiseta
en una formación. No se registran fecha de nacimiento, documento, contacto ni
ningún otro dato personal, y no se cargan formaciones de categorías infantiles,
según la regla de `AGENTS.md` sobre datos de menores. La cobertura queda limitada
a divisiones de adultos.

## Pruebas

En `packages/domain`, pruebas de la construcción de la consulta normalizada
—acentos, mayúsculas, un solo apellido, orden invertido—. En
`packages/database`, pruebas de la búsqueda contra la base de test: coincidencia
por prefijo, homónimos, límite de resultados y agrupación de divisiones de un
mismo club. En `apps/api`, pruebas de la ruta, incluido el rechazo de consultas
demasiado cortas. En `apps/web`, pruebas del buscador y de la ficha, con especial
atención al estado sin resultados y al aviso de cobertura parcial.
