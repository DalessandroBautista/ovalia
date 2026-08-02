# Reparación de producción y portada viva

Fecha: 2026-08-02

## Objetivo

Hacer que `www.ovalia.com.ar` vuelva a consumir los datos disponibles en la API y que la portada nunca se perciba vacía cuando no haya partidos en vivo o artículos publicados.

## Diagnóstico

- La API de producción responde correctamente y contiene torneos, clubes, resultados y próximos partidos.
- Las respuestas a requests originados en `https://ovalia.com.ar` y `https://www.ovalia.com.ar` no incluyen un origen CORS permitido, por lo que el navegador bloquea los fetch del frontend.
- La fecha actual puede no tener partidos aunque existan resultados recientes y fixtures futuros.
- No hay artículos publicados; `/v1/articles` devuelve una lista vacía y `/v1/home` no tiene `featuredArticle`.

## Diseño aprobado

La portada mantiene el enfoque “partidos primero”:

1. El hero muestra un partido en vivo o, en su defecto, el próximo partido importante.
2. La agenda muestra el día seleccionado. Si el día está vacío, ofrece próximos partidos en lugar de terminar en un mensaje muerto.
3. Debajo se incorpora un carrusel “Últimas noticias” con imagen, título, resumen y enlace.
4. Si no hay artículos publicados, el carrusel usa resultados recientes como actualidad deportiva verificable, sin inventar notas.

## Datos y API

- Centralizar la lectura y normalización de `WEB_ORIGIN` para CORS y CSRF.
- Aceptar explícitamente ambos dominios canónicos de producción mediante configuración.
- Agregar `coverImageUrl` opcional a artículos, repositorios y respuestas públicas/editoriales.
- Mantener la publicación como decisión humana: los borradores IA continúan en `review`.

## Interfaz

- Carrusel horizontal con scroll-snap, controles anterior/siguiente y rotación automática pausada al interactuar.
- La primera tarjeta tiene mayor peso visual; las restantes anticipan contenido.
- Cuando un artículo no tiene imagen se usa una composición editorial con color, torneo y escudos disponibles.
- Los resultados de fallback se identifican como “Últimos resultados”, no como noticias editoriales.

## Manejo de errores

- La portada distingue entre API caída, fecha sin partidos y ausencia de artículos.
- Un fallo del carrusel no impide mostrar partidos.
- Un fallo de la agenda no oculta el próximo partido ya cargado por el endpoint de próximos.

## Pruebas

- API: CORS permite ambos dominios y rechaza mutaciones desde orígenes ajenos.
- Base/API: `coverImageUrl` se conserva y se expone sólo en artículos publicados o en rutas editoriales autorizadas.
- Web: agenda vacía muestra próximos partidos; carrusel muestra artículos y fallback de resultados; controles tienen nombres accesibles.
- Gates finales: `pnpm verify`, `pnpm build` y comprobación HTTP de headers CORS en producción.

## Operación

- Configurar `WEB_ORIGIN=https://ovalia.com.ar,https://www.ovalia.com.ar` en el proyecto API de Vercel y redeplegar.
- Ejecutar la migración antes de desplegar la API que lea `cover_image_url`.
- Publicar al menos una nota revisada para reemplazar progresivamente el fallback de resultados.
