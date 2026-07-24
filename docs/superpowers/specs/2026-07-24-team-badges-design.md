# Ovalia — Diseño del sistema de escudos de equipos

**Fecha:** 2026-07-24
**Estado:** Aprobado para revisión
**Decisión visual:** Opción A — activo oficial sin marco ni rediseño

## Objetivo

Mostrar el escudo oficial de cada club o seleccionado que participe en una competición cubierta por Ovalia, preservando su aspecto y formato original. La interfaz no debe depender de que el servidor de origen esté disponible en cada visita y nunca debe presentar un escudo inventado como si fuera oficial.

## Alcance de cobertura

La cobertura se define por las competiciones habilitadas en Ovalia, no por una lista manual limitada a los equipos hoy visibles.

- Argentina: URBA completa y torneos del interior incorporados al catálogo.
- Selecciones y franquicias que aparezcan en Rugby Championship, Six Nations, Mundial, Super Rugby y las demás competiciones internacionales configuradas.
- Todo equipo nuevo incorporado por sincronización de fixtures o resultados debe entrar automáticamente en la cola de resolución de escudo.
- Los diez equipos actualmente presentes en la interfaz y los equipos del seed inicial deben quedar cubiertos desde la primera entrega.

No se precargarán equipos ajenos a las competiciones habilitadas. La cobertura crecerá de manera determinista junto con el catálogo, sin requerir cambios en componentes visuales.

## Fuentes y fidelidad

Orden de prioridad:

1. Activo entregado por Highlightly cuando el equipo posee un identificador verificado en el proveedor.
2. Activo publicado por la organización, unión, club o seleccionado en un canal oficial.
3. Repositorio público verificable, conservando la referencia de procedencia.
4. Fallback tipográfico existente únicamente cuando no haya un activo oficial verificable.

Se conservará el formato nativo recibido —SVG, PNG o WebP— y no se vectorizarán automáticamente imágenes raster. Tampoco se redibujarán, recolorearán, recortarán ni encerrarán los escudos dentro de una geometría común.

## Registro central

Cada equipo tendrá una identidad estable separada de su nombre visible. El registro de escudos contendrá, como mínimo:

- identificador interno del equipo;
- nombre canónico;
- alias usados por proveedores o feeds;
- identificador de Highlightly, si existe;
- ruta local del activo;
- formato y estado de sincronización;
- URL de origen y fecha de última verificación.

Los alias permitirán resolver variantes como nombres abreviados, nombres históricos o diferencias de idioma sin duplicar equipos ni archivos.

## Almacenamiento local

Los activos se guardarán bajo `apps/web/public/teams/`, agrupados por identificador estable. El nombre del archivo no dependerá del nombre mostrado al usuario.

Ejemplos conceptuales:

```text
apps/web/public/teams/highlightly-251829.png
apps/web/public/teams/argentina.svg
apps/web/public/teams/sic.webp
```

El repositorio conservará los activos iniciales necesarios para que la experiencia local funcione sin conexión al proveedor. Los activos obtenidos posteriormente por sincronización deberán almacenarse en un volumen o bucket persistente en producción; el registro mantendrá la misma ruta pública independientemente del backend de almacenamiento.

## Sincronización

La sincronización tendrá dos caminos complementarios:

- **Carga inicial:** comando repetible que recorre los equipos del catálogo, busca su activo, valida tipo y tamaño, lo descarga y actualiza el registro.
- **Descubrimiento incremental:** cuando un fixture o partido en vivo introduce un equipo desconocido, se registra su identidad y el activo del proveedor; si la descarga local todavía no terminó, la URL remota puede usarse temporalmente.

El proceso será idempotente: ejecutar nuevamente la sincronización no duplicará archivos ni registros. Un activo existente sólo se reemplazará cuando cambie su URL o cuando una verificación explícita indique una versión nueva.

## Renderizado web

`TeamBadge` seguirá siendo el único punto de renderizado. Resolverá en este orden:

1. ruta local registrada;
2. URL remota verificada recibida con el partido;
3. fallback tipográfico existente.

El activo se mostrará con `object-fit: contain`, manteniendo su proporción y transparencia. El contenedor sólo reservará espacio y alineación; no agregará un marco visual. Cada imagen tendrá texto alternativo basado en el nombre del equipo y dimensiones declaradas para evitar saltos de layout.

## Integración con resultados en vivo

El adaptador de Highlightly conservará el identificador y la URL del logo de cada equipo. La normalización del feed no debe convertir esa URL en la identidad principal: primero se intentará asociar el equipo con el registro local mediante el identificador externo y luego mediante alias normalizados.

La ausencia o falla de un escudo nunca debe ocultar un partido, degradar el resultado en vivo ni convertir el estado del feed en error.

## Manejo de errores y seguridad

- Sólo se aceptarán respuestas HTTP exitosas con tipos `image/svg+xml`, `image/png` o `image/webp`.
- Se aplicará un límite de tamaño por archivo y timeout de descarga.
- Los SVG externos se tratarán como archivos de imagen, nunca se inyectarán como HTML en el DOM.
- Una descarga fallida conservará el último activo válido y dejará el equipo pendiente de reintento.
- Las claves del proveedor permanecerán exclusivamente en el backend.
- La procedencia quedará registrada para facilitar auditoría, actualización o retiro de un activo.

## Verificación

La entrega se considerará completa cuando:

- todos los equipos existentes en seeds, datos demo y pantallas tengan un escudo oficial local o una ausencia documentada;
- los partidos de Highlightly muestren el escudo recibido y puedan asociarlo con el registro local;
- el componente mantenga proporciones correctas en tarjetas, tablas, detalle de partido y navegación móvil;
- un activo roto active el fallback sin desplazar ni romper la interfaz;
- la sincronización sea idempotente y rechace formatos o tamaños inválidos;
- las pruebas unitarias cubran resolución por identificador, alias, prioridad local/remota y fallback;
- build, typecheck, tests y lint finalicen correctamente.

## Fuera de alcance de esta entrega

- Redibujar o unificar visualmente escudos.
- Convertir PNG o WebP a SVG.
- Crear un editor administrativo de imágenes.
- Precargar equipos que no pertenezcan a competiciones habilitadas.
- Reemplazar acuerdos de licencia o permisos de uso de las entidades titulares.
