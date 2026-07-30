# Foro de debate por partido

Fecha: 2026-07-30

## Objetivo

Dar a cada partido un espacio de discusión: el hincha que fue a la cancha
comenta el resultado, el arbitraje o una jugada, y encuentra a otros haciendo lo
mismo. Es la pieza de comunidad del Release 3 del roadmap.

## Identidad: lectura libre, comentario con cuenta

Cualquiera lee el debate sin registrarse. Publicar exige una cuenta.

Se descarta el modelo anónimo con apodo y huella de navegador que usa el sitio de
referencia. La huella es un identificador de seguimiento que hay que declarar,
resulta trivial de evadir cambiando de navegador, y deja la moderación sin la
única herramienta que sirve de verdad: poder sancionar a una cuenta. Exigir
cuenta reduce la participación inicial, y es un precio consciente.

Que la lectura sea libre importa además por posicionamiento: el debate se
renderiza en el servidor y queda indexable junto al partido.

## Dependencia bloqueante

Requiere autenticación y sesiones, que en el plan maestro son el Hito 10 y en el
roadmap corresponden al Release 2. Las tablas `users`, `sessions` y `accounts`
existen en el esquema, pero `apps/api/src/create-app.ts` no expone hoy ninguna
ruta de sesión.

**Este spec no puede implementarse antes que el Hito 10.** No se diseña aquí un
mecanismo de identidad provisorio: sería trabajo desechable y crearía un segundo
concepto de usuario que después habría que reconciliar.

## Modelo de datos

`match_comments` guarda identificador, partido, autor, cuerpo, momento de
creación, momento de edición y momento de borrado. El borrado es lógico: un
comentario eliminado deja el hueco visible como «Comentario eliminado» y conserva
el rastro para la moderación.

Las respuestas admiten **un solo nivel**. Un comentario responde a otro de primer
nivel y nada más. Los árboles profundos son costosos de renderizar, difíciles de
leer en un teléfono y desplazan la conversación del partido hacia discusiones
entre dos personas.

`comment_reports` registra las denuncias: comentario, denunciante, motivo y
momento. Un mismo usuario no puede denunciar dos veces el mismo comentario.

## Moderación

La moderación vive en el panel de administración existente, con su token y su
auditoría. El editor ve la cola de comentarios denunciados ordenada por cantidad
de denuncias, y puede eliminar un comentario o suspender a un autor. Cada acción
queda en `audit_log`.

Los límites automáticos son tres: un máximo de comentarios por usuario y por
minuto, un largo máximo por comentario, y el bloqueo de publicación en partidos
cuya fecha sea muy anterior, para que los hilos viejos no se conviertan en
depósito de spam.

Nada de esto se hace en el cliente. El límite de frecuencia se aplica en la API,
donde no se puede evadir.

## Interfaz

El debate aparece en la página `/partidos/[slug]`, no en el modal. El modal
resuelve la consulta rápida desde la agenda; leer y escribir comentarios es una
actividad larga que merece la página completa y una URL propia.

Quien no tiene sesión ve el debate completo y, en lugar del formulario, una
invitación a ingresar que preserva el partido de destino.

El cuerpo del comentario se trata siempre como texto plano y se escapa al
renderizarse. No se admite HTML ni marcado enriquecido.

## Pruebas

En `packages/domain`, pruebas de las reglas puras: validación de largo, cálculo
del límite de frecuencia y decisión de si un partido admite comentarios por su
antigüedad. En `packages/database`, pruebas del alta, del borrado lógico, de la
unicidad de la denuncia y del orden de la cola de moderación. En `apps/api`,
pruebas de la lectura sin sesión, del rechazo de publicación sin sesión, del
corte por frecuencia y de las rutas de moderación con y sin token. En
`apps/web`, pruebas del hilo con y sin sesión, del estado sin comentarios y del
escapado de contenido con caracteres de marcado.

## Fuera de alcance

Votos, reputación, menciones, notificaciones e imágenes adjuntas. Cada uno es una
decisión de producto por derecho propio y ninguno es necesario para validar si la
gente quiere debatir en Ovalia.
