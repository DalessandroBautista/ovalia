# Autenticación y sesiones (Hito 10)

Fecha: 2026-07-30

## Objetivo

Dar a Ovalia registro, ingreso y sesiones de usuario, con autorización efectiva
tanto en la aplicación Next.js como en la API Fastify. Es el prerequisito del
Release 2 —favoritos, alertas y prode— y el bloqueante declarado del foro por
partido (`2026-07-30-match-forum-design.md`).

## Decisión adoptada

Se usa **Auth.js v5 (`next-auth`) con el adaptador de Drizzle**, con estrategia
de sesión en **base de datos**.

La decisión la tomó el responsable del producto sobre una recomendación contraria
—implementar sesiones propias sobre el esquema ya existente—. Las razones a favor
son una librería mantenida, proveedores OAuth casi gratuitos y menos código
propio de seguridad.

Las contras se aceptan explícitamente y se documentan acá para que no se
descubran tarde:

- `next-auth@5.0.0-beta.32` sigue en **beta**, sin versión estable publicada. Se
  fija la versión exacta en `package.json`, sin rango, y se revisa antes de cada
  actualización.
- Auth.js guarda el **token de sesión en texto plano** en la tabla `sessions`. El
  esquema actual guarda su hash. Es una regresión de seguridad deliberada: quien
  obtenga lectura de la base podrá suplantar sesiones activas.
- Auth.js no ofrece ningún mecanismo oficial para que un proceso externo valide
  sus sesiones. La solución de abajo es una decisión de arquitectura propia.

## Migración del esquema

Las tablas `users`, `sessions`, `accounts` y `verification_tokens` de
`packages/database/src/schema.ts` no coinciden con lo que exige el adaptador y se
migran a su forma: `accounts` suma las columnas de OAuth que hoy no tiene, y las
claves primarias pasan a la forma que el adaptador espera.

La migración es segura en un punto concreto: se verificó que hoy **no hay filas
reales** en `sessions`, `accounts` ni `verification_tokens`, y que el único
usuario existente es el administrador de desarrollo, creado solo bajo la variable
`SEED_DEMO`. No hay datos productivos que preservar.

La migración se aplica primero en local y después en la base de la nube, y su
archivo queda en `packages/database/drizzle/` como cualquier otra.

## Autorización en la API Fastify

Este es el punto que ninguna documentación resuelve, porque Auth.js vive en el
proceso de Next.js y la API es un proceso separado.

**Fastify valida la sesión leyendo la tabla `sessions`** con el mismo cliente
Drizzle que ya usa. Recibe la cookie de sesión del navegador, busca su token en
la tabla, comprueba la expiración y resuelve el usuario.

Se eligió sobre las alternativas por una razón: es la única que **no depende del
formato interno de Auth.js**. Su cookie por defecto es un JWE cifrado cuyo
formato puede cambiar entre versiones beta; una tabla, en cambio, es un contrato
estable. Se descartó que Next.js expusiera un endpoint de verificación consultado
por Fastify, porque agrega un viaje de red por pedido y convierte a Next.js en
punto único de falla para autorizar.

La lógica de validación vive en un solo lugar —un plugin de Fastify— y no se
esparce por las rutas. Las rutas declaran si requieren sesión; no repiten la
comprobación.

Esto obliga a que Fastify duplique la expiración y la revocación que Auth.js
aplica del otro lado. Esa duplicación es el costo de la opción y se concentra en
el plugin, con sus propias pruebas.

El token de administración por encabezado que hoy protege las rutas de admin
(`apps/api/src/create-app.ts`) **no se toca**: es un secreto de servidor a
servidor, un concepto distinto de la sesión de usuario, y sigue conviviendo.

## Métodos de ingreso

Se habilitan enlace mágico por correo y Google. No se habilita contraseña: es el
método que más superficie de ataque agrega —almacenamiento, rotación,
recuperación, fuerza bruta— para un producto donde nadie espera tener una
contraseña de rugby.

La columna `passwordHash` queda en el esquema sin uso, para no cerrar la puerta.

## Autorización

El rol vive en `users.role`, con el enum que ya existe. La API decide por rol, no
por identidad. Ningún endpoint acepta un identificador de usuario enviado por el
cliente para decidir permisos: el usuario sale siempre de la sesión validada.

## Errores y estados

Una sesión vencida o inválida produce `401`, nunca un `500` ni una pantalla
rota. La interfaz distingue «no ingresaste» de «no tenés permiso», y quien no
tiene sesión conserva su destino al ingresar.

## Pruebas

En `packages/database`, pruebas del alta, la búsqueda por token y la expiración
de sesiones. En `apps/api`, pruebas del plugin de validación: sesión válida,
token inexistente, sesión vencida, ausencia de cookie, y que una ruta protegida
responda `401` sin sesión. En `apps/web`, pruebas del flujo de ingreso y de la
conservación del destino.

Las pruebas de la API no deben depender de Next.js: construyen la fila de sesión
directamente en la base de test. Esa independencia es justamente lo que hace
verificable la opción elegida.

## Riesgo a revisar

Si Auth.js v5 llega a estable con cambios de esquema, la migración se repite. Si
antes de eso el token en texto plano resulta inaceptable, la salida es volver a
sesiones propias: el plugin de Fastify ya concentra la validación, así que el
cambio quedaría acotado a él y a la escritura del token.
