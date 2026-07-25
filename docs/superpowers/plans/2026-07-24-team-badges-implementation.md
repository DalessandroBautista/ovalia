# Plan de implementación — escudos oficiales

## Resultado esperado

Ovalia mostrará el activo oficial de cada equipo conocido en todas sus superficies. Los equipos actuales funcionarán sin conexión al proveedor; los equipos descubiertos en vivo usarán temporalmente el activo remoto y podrán incorporarse al cache mediante un comando idempotente.

## 1. Identidad y resolución

- Crear un registro canónico compartido en `@ovalia/domain`.
- Incluir slug, nombre, código, alias, ruta local, fuente e identificador externo cuando exista.
- Resolver nombres ignorando mayúsculas, tildes y signos.
- Prioridad: activo local registrado, URL remota verificada, fallback.
- Escribir primero pruebas unitarias para nombre canónico, alias, prioridad y ausencia.

## 2. Sincronización segura

- Implementar un sincronizador con dependencias inyectables para poder probarlo sin red ni disco real.
- Validar HTTP 2xx, MIME permitido, límite de tamaño, extensión y timeout.
- Mantener el proceso idempotente y no reemplazar un activo válido innecesariamente.
- Añadir comando raíz `pnpm badges:sync`.
- Probar descarga válida, rechazo de MIME y conservación del activo previo ante error.

## 3. Inventario y activos iniciales

- Resolver en Highlightly los equipos hoy usados por fixtures, seeds, tablas y prodes.
- Descargar los activos oficiales disponibles en formato nativo a `apps/web/public/teams/`.
- Registrar la fuente y documentar cualquier ausencia.
- Cubrir inicialmente SIC, Hindú, CASI, Newman, Alumni, CUBA, Argentina, Sudáfrica, Nueva Zelanda y Australia.
- Mantener descubrimiento incremental para clubes o seleccionados agregados después.

## 4. Persistencia

- Extender `teams` con aliases, identificadores externos y metadatos de procedencia/verificación.
- Crear migración Drizzle aditiva.
- Actualizar el seed para que los equipos actuales posean rutas locales y aliases.
- No romper instalaciones existentes ni exigir recrear la base.

## 5. API y feed en vivo

- Conservar IDs externos de Highlightly durante la normalización.
- Resolver primero contra el registro local por ID y luego por alias.
- Devolver `badgeUrl` local cuando exista; conservar la URL remota como fallback.
- Garantizar que una falla de imagen nunca convierta el feed en error.
- Añadir pruebas de normalización y prioridad local.

## 6. Interfaz

- Hacer que `TeamBadge` resuelva automáticamente por nombre.
- Mostrar una sola imagen oficial, sin marco ni rediseño, con proporción preservada.
- Ocultar una imagen rota y revelar el fallback tipográfico accesible.
- Integrar el componente en tarjetas, rail en vivo, agenda, detalle y páginas de portal.
- Ajustar tamaños para siluetas horizontales y verticales sin recorte.

## 7. Verificación y entrega

- Ejecutar pruebas por paquete durante cada ciclo TDD.
- Ejecutar `pnpm verify` y `pnpm build` al finalizar.
- Revisar visualmente escritorio y móvil con el servidor local.
- Confirmar que todos los equipos visibles usan activos locales y que un equipo nuevo del feed usa el remoto.
- Documentar sincronización, fuentes y mantenimiento.
- Separar commits por comportamiento: dominio/sync, datos/API, interfaz/activos y documentación.
