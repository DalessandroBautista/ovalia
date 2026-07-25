# Agenda compartida por fecha

## Problema

Inicio y Centro de partidos mantienen calendarios y fixtures hardcodeados distintos. La fecha visible no representa los partidos listados y los controles no modifican el día seleccionado.

## Diseño aprobado

- La fuente de fixtures será `GET /v1/matches`.
- Ambas pantallas compartirán tipos, carga, filtrado y utilidades de calendario.
- La fecha inicial será el día corriente en `America/Argentina/Buenos_Aires`.
- Inicio mostrará una tira de siete días clickeables y controles para desplazarla un día.
- Centro de partidos permitirá avanzar y retroceder un día.
- `HOY` solo aparecerá sobre la fecha corriente.
- Horarios y pertenencia a un día se calcularán en la zona horaria argentina.
- Los resultados finalizados mostrarán el marcador; los programados, la hora local.
- Una fecha sin fixtures tendrá un estado vacío explícito y un error de API no se presentará como ausencia de partidos.

## Verificación

- Pruebas unitarias de conversión de fecha, desplazamiento, filtrado y agrupación.
- Pruebas de render de los estados iniciales.
- Typecheck, tests, lint y build del monorepo.
- Recorrido en Chrome de Inicio y Centro de partidos, incluidos los controles de fecha.

## Revisión para producción

Después del arreglo se inventariarán datos estáticos, acciones sin persistencia, rutas placeholder, fuentes demo y configuración de desarrollo. El informe separará bloqueantes de producción de contenido editorial/configurable legítimamente estático.
