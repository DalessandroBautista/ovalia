# Ovalia: datos en vivo, escudos y navegación

Estado: aprobado el 23 de julio de 2026.

## Objetivo

Eliminar toda representación engañosa de partidos en vivo y unificar portada, agenda y detalle sobre una sola fuente de datos. Completar la interfaz con escudos reales cuando estén disponibles, iconos SVG consistentes y un retorno visible al inicio en cada página interna.

## Fuente de datos

Ovalia usará un gateway propio con adaptadores intercambiables:

- `HighlightlyProvider` consulta rugby internacional cuando existe `HIGHLIGHTLY_API_KEY`.
- `DatabaseProvider` sirve partidos argentinos cargados o verificados desde PostgreSQL.
- Si no existe una fuente configurada o está caída, la API devuelve una colección vacía con estado `unavailable`; nunca fabrica un partido en vivo.

Cada respuesta pública incluirá `source`, `generatedAt` y `freshness`. Un dato pasa a `stale` al superar 90 segundos sin actualización. Las credenciales sólo viven en el backend.

## Actualización

La portada consumirá `/v1/live` y refrescará cada 30 segundos mientras la pestaña esté visible. El primer render tendrá un estado de carga discreto; una respuesta vacía mostrará “No hay partidos en vivo ahora” y una caída del proveedor mostrará “Datos en vivo temporalmente no disponibles”. Los últimos datos válidos podrán mantenerse marcados como desactualizados, nunca como actuales.

## Escudos e iconos

El modelo de equipo tendrá `badgeUrl` y `shortCode`. El componente `TeamBadge` renderizará una imagen cuando exista y un escudo SVG con monograma como fallback. Highlightly aportará imágenes internacionales; los clubes argentinos podrán cargarse desde el CMS con activos autorizados.

Los símbolos Unicode de búsqueda, navegación, reloj, perfil y flechas se reemplazarán por un pequeño set SVG propio, con tamaño, trazo y etiquetas accesibles uniformes. No se incorporará una biblioteca completa de iconos.

## Navegación

Todas las páginas internas compartirán el encabezado de Ovalia. Debajo del encabezado aparecerá un enlace visible `Volver al inicio` con icono de flecha. El logo seguirá enlazando a `/`. En móvil, el elemento Inicio de la barra inferior también navegará a `/`.

## Errores y seguridad

El adaptador aplicará timeout, validación de esquema y normalización antes de exponer datos. Un error del proveedor no filtrará credenciales ni payloads internos. La interfaz distinguirá vacío, obsoleto y error sin bloquear el resto de la portada.

## Pruebas

- Contrato del gateway: proveedor disponible, sin credencial, payload inválido y timeout.
- API: metadatos de fuente/frescura y ausencia de resultados inventados.
- Componentes: carga, vacío, vivo, obsoleto, escudo remoto y fallback.
- Navegador: navegación a inicio, detalle en vivo, estados sin proveedor y vistas de escritorio/móvil.

## Fuera de alcance inmediato

La suscripción y clave de Highlightly dependen del usuario. Sin esa clave la integración quedará funcional pero mostrará honestamente ausencia de feed externo. La carga completa de escudos URBA/interior requiere recopilar activos con autorización; el fallback evita imágenes rotas mientras se completa esa biblioteca.
