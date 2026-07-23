# Ovalia — Diseño integral de plataforma

Fecha: 23 de julio de 2026

Estado: validado conversacionalmente; pendiente de revisión documental

Nombre de trabajo: Ovalia

## 1. Objetivo

Ovalia será una plataforma web integral de rugby inspirada en la amplitud funcional de Copero, pero con identidad, diseño, textos y activos originales. Reunirá resultados y eventos en vivo, torneos, estadísticas, prodes, juegos, noticias, perfiles y herramientas operativas para cubrir rugby argentino e internacional.

La primera entrega será una plataforma productiva completa, no una maqueta. Todos los módulos acordados deberán estar conectados a datos persistentes y contar con flujos verificables. El presupuesto operativo inicial será inferior a USD 10 mensuales, sin contar dominio ni consumo opcional de OpenAI.

## 2. Principios del producto

1. Argentina primero, con cobertura amplia del rugby de clubes y uniones.
2. Datos propios primero: ninguna función crítica dependerá obligatoriamente de una API paga.
3. Cobertura híbrida mediante importadores permitidos y colaboradores verificados.
4. Una única fuente de verdad y auditoría completa para datos deportivos.
5. Experiencia rápida, accesible, instalable y trilingüe.
6. Contenido de IA siempre revisado por una persona antes de publicarse.
7. Arquitectura modular que pueda escalar sin introducir microservicios prematuramente.

## 3. Alcance deportivo

### 3.1 Argentina

- URBA mayores: Top 14, Primera A, Primera B, Primera C, Segunda, Tercera y Desarrollo, o los nombres y formatos que correspondan a cada temporada.
- URBA femenino de mayores.
- Nacional de Clubes masculino y femenino.
- Torneo del Interior y competencias mayores de las uniones regionales.
- Seven de la República masculino y femenino.
- Super Rugby Américas.
- Los Pumas, Los Pumas 7s, Las Yaguaretés, Argentina XV, Pampas y otras selecciones o franquicias mayores relevantes.
- El catálogo de uniones, divisiones y temporadas será configurable y no estará fijado en código.

### 3.2 Internacional

- Rugby Championship.
- Seis Naciones.
- Copa Mundial masculina y femenina.
- Investec Champions Cup.
- Premiership Rugby.
- Top 14 de Francia.
- United Rugby Championship.
- Super Rugby Pacific.

### 3.3 Variantes y categorías

- Rugby XV masculino y femenino de mayores.
- Rugby seven masculino y femenino de mayores.
- Juveniles quedan fuera del lanzamiento. El modelo admitirá categorías etarias futuras sin almacenar datos sensibles innecesarios.

## 4. Inventario funcional

### 4.1 Estructura global

- Cinta horizontal de partidos en vivo y próximos partidos.
- Encabezado con Inicio, Partidos, Torneos, Prodes, Juegos y Noticias.
- Selector de idioma español, inglés y portugués.
- Tema claro, oscuro y preferencia del sistema.
- Navegación móvil inferior.
- Pie con secciones, términos, privacidad, cookies, contacto y redes.

### 4.2 Inicio

- Destacado editorial o activación vigente.
- Agenda de partidos por fecha, agrupada por torneo.
- Estados en vivo prioritarios.
- Selector horizontal de días sin renderizar meses completos fuera de pantalla.
- Accesos rápidos a torneos y prodes.
- Resumen del perfil, favoritos y alertas para usuarios autenticados.
- Noticias recientes y espacios patrocinados administrables.

### 4.3 Centro de partidos

- Filtros por fecha, estado, país, unión, torneo, categoría, variante y género.
- Estados: programado, demorado, en vivo, descanso, final, suspendido, cancelado y abandonado.
- Agrupación por competencia con colapsado accesible.
- Páginas indexables y URLs compartibles.

### 4.4 Centro de torneo

Cada torneo tendrá:

- Portada con identidad, organización, temporada y resumen.
- Resultados por fecha o ronda.
- Calendario por mes.
- Posiciones, zonas o grupos.
- Bracket de playoffs cuando corresponda.
- Estadísticas de equipos y jugadores según disponibilidad.
- Equipos y planteles.
- Prode asociado.
- Selector de temporada.

El motor admitirá liga simple, liga con bonus, grupos, eliminación directa, ida y vuelta, mejores terceros, zonas regionales y combinaciones de fases. Las reglas de puntos, bonus y desempate serán datos versionados por temporada.

### 4.5 Ficha de partido

- Competencia, fase, fecha, cancha, ciudad, hora local y zona horaria.
- Equipos, escudos, marcador y reloj de juego.
- Marcador desglosado cuando los datos lo permitan.
- Minuto a minuto con tries, conversiones, penales, drops, tarjetas, reemplazos y otros eventos configurables.
- Formaciones 1 a 15, suplentes, capitanes, entrenadores y árbitros.
- Estadísticas disponibles: posesión, territorio, scrums, lineouts, tackles, quiebres, metros, penales y tarjetas.
- Forma reciente, enfrentamientos, tabla contextual y próximos partidos.
- Estados explícitos para datos faltantes, retrasados o bajo corrección.
- No incluirá streaming ni enlaces “dónde ver”.

### 4.6 Prodes

- Prode global por torneo.
- Grupos privados mediante enlace o código de invitación.
- Rankings globales, por grupo, por fecha y acumulados.
- Pronóstico de ganador, empate cuando aplique y marcador.
- Preguntas bonus, clasificados y campeón.
- Cierre automático por partido o etapa.
- Puntuación y desempates configurables y versionados.
- Recálculo seguro cuando se corrige un partido.
- Premios, bases legales y activaciones patrocinadas.
- Historial del usuario y medallas.

### 4.7 Juegos

#### Ideología rugbística

- Cuestionario binario o multirrespuesta sobre identidad y decisiones tácticas.
- Ejes configurables, por ejemplo: territorio/posesión, estructura/improvisación, riesgo/control y pragmatismo/identidad.
- Resultado con perfil, afinidad, porcentajes y referentes rugbísticos.
- Contenido traducido y resultados compartibles.

#### Simulador de carrera

- Creación de identidad con apellido, número, nacionalidad, lateralidad y puesto de rugby.
- Historia ramificada por etapas, clubes, seleccionados, lesiones, contratos, decisiones y consecuencias.
- Variables de carrera, reputación, rendimiento y bienestar.
- Guardado local para invitados y persistencia para usuarios autenticados.
- Español, inglés y portugués.

No se incorporarán trivia, fantasy, manager ni “Armá tu XV” en esta entrega.

### 4.8 Usuarios y comunidad

- Registro por email y contraseña.
- Inicio con Google opcional cuando existan credenciales.
- Verificación de email y recuperación de contraseña.
- Perfil público con alias, avatar, biografía breve y favoritos.
- Clubes, selecciones y torneos favoritos.
- Historial y medallas de prodes y juegos.
- Seguir y dejar de seguir perfiles.
- Compartir resultados mediante enlaces y tarjetas.
- Sin comentarios, chat, publicaciones sociales ni mensajes privados.

### 4.9 Personalización y notificaciones

- Favoritos de equipos, seleccionados y torneos.
- Preferencias por tipo de alerta.
- Avisos de inicio, tries, resultado final, recordatorios de prode y noticias relevantes.
- Push web para la PWA y preferencias de email opcionales.
- Cola, reintentos, deduplicación y registro de entregas.

### 4.10 CMS editorial

- Artículos, autores, categorías, etiquetas y relaciones con torneos, equipos y partidos.
- Estados: borrador, revisión, programado, publicado y archivado.
- Editor, imágenes, SEO, canonical, Open Graph y traducciones.
- Flujo de revisión y permisos.
- Notas propias; fuentes externas sólo mediante enlaces, resúmenes originales y atribución permitida.

### 4.11 Asistente editorial de IA

- OpenAI será el proveedor inicial detrás de una interfaz reemplazable.
- Se usará la Responses API para generar borradores desde datos estructurados del partido.
- La salida tendrá un esquema validado: títulos, copete, cuerpo, destacados, etiquetas, advertencias y propuestas de traducción.
- Entradas permitidas: datos almacenados en Ovalia, contexto editorial aprobado y guía de estilo. No navegará ni inventará fuentes.
- Guardará modelo configurado, versión del prompt, entrada normalizada, respuesta, uso, costo estimado, editor solicitante y revisiones.
- Nunca publicará automáticamente. Sólo creará una revisión de borrador que un editor podrá editar, aprobar o descartar.
- Mostrará advertencias cuando falten datos o existan inconsistencias.
- Tendrá límites diarios, por rol y por artículo, además de interruptor global.
- Si OpenAI no está configurado o falla, el CMS seguirá funcionando y ofrecerá una plantilla determinista.
- La clave de API permanecerá exclusivamente en el servidor.

Referencias oficiales: [generación de texto](https://developers.openai.com/api/docs/guides/text), [salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs) y [prácticas de seguridad](https://developers.openai.com/api/docs/guides/safety-best-practices).

### 4.12 Publicidad y sponsors

- Inventario de ubicaciones publicitarias con fechas, prioridad y segmentación básica.
- Sponsors de torneos, prodes y contenidos.
- Etiquetado visible de contenido patrocinado.
- Métricas de impresiones y clics sin perfiles invasivos.
- Acceso gratuito para usuarios.

### 4.13 Operación y administración

- Roles: usuario, colaborador, editor, moderador, administrador y propietario.
- Asignaciones de colaboradores por organización, torneo o equipo.
- Consola de partido para cargar eventos rápidamente.
- Importación y exportación CSV.
- Gestión de uniones, torneos, temporadas, reglas, equipos, planteles y árbitros.
- Bandeja de inconsistencias y correcciones.
- Registro de auditoría para datos deportivos, permisos, publicaciones, prodes y premios.
- Estado y última sincronización de cada fuente externa.

## 5. Arquitectura

### 5.1 Monorepo

```text
apps/
  web       Next.js, sitio, PWA, panel y SEO
  api       API Node.js modular, autenticación y tiempo real
  worker    importaciones, recálculos, alertas y tareas programadas
packages/
  database  esquema, migraciones, repositorios y seeds
  domain    reglas deportivas, prodes y permisos
  ui        sistema visual compartido
  i18n      catálogos y utilidades de traducción
  config    configuración compartida
```

Frontend y backend serán aplicaciones independientes dentro del mismo repositorio. Los módulos del backend conservarán límites internos claros, pero no se desplegarán como microservicios inicialmente.

### 5.2 Persistencia

PostgreSQL será la fuente única de verdad. Las entidades principales serán:

- organizaciones, uniones, competencias, torneos, temporadas, fases, rondas y grupos;
- equipos, personas, jugadores, árbitros, planteles y alineaciones;
- partidos, períodos, eventos, estadísticas y fuentes;
- usuarios, perfiles, favoritos, seguidores, roles y asignaciones;
- prodes, reglas, predicciones, grupos, rankings, premios y puntajes;
- artículos, revisiones, traducciones, categorías y activos;
- suscripciones push, preferencias, notificaciones y entregas;
- anuncios, sponsors, campañas, impresiones y clics;
- auditoría, importaciones, trabajos y ejecuciones de IA.

### 5.3 Tiempo real

1. Un colaborador, administrador o importador envía un evento.
2. La API valida permisos, estado del partido, secuencia e idempotencia.
3. Una transacción guarda evento, marcador derivado y auditoría.
4. El sistema publica un mensaje de dominio después del commit.
5. WebSocket o Server-Sent Events actualiza los clientes.
6. El worker recalcula estadísticas, tabla, prodes y notificaciones.
7. Cada consumidor es idempotente y puede reintentarse.

Redis no será obligatorio al inicio. La abstracción de mensajería permitirá incorporarlo cuando la escala lo justifique.

### 5.4 Fuentes e importaciones

- Adaptadores por proveedor o formato.
- Uso exclusivo de fuentes con permiso o condiciones compatibles.
- Importación manual CSV como capacidad base.
- Identificadores externos desacoplados del modelo interno.
- Ejecuciones repetibles, transaccionales y observables.
- Ningún importador podrá sobrescribir silenciosamente una corrección editorial.

## 6. Diseño visual y experiencia

### 6.1 Dirección

La identidad aprobada es “rugby editorial moderno”:

- verde profundo como fondo principal;
- lima energético como acento;
- superficies oscuras con jerarquía clara;
- tipografía editorial/deportiva;
- alta densidad de datos sin perder legibilidad;
- versión clara equivalente.

### 6.2 Responsive

- Escritorio: cinta en vivo, encabezado compacto y navegación horizontal.
- Móvil: cinta desplazable, contenido en una columna y navegación inferior.
- Tablas se transforman en tarjetas o vistas compactas sin ocultar información esencial.
- La consola en vivo se optimiza para uso táctil.

### 6.3 Accesibilidad

- Objetivo WCAG 2.2 AA.
- Teclado completo, foco visible y estructura semántica.
- Estados identificados por texto e iconos, no sólo color.
- Contraste suficiente y tamaños táctiles adecuados.
- Regiones `aria-live` moderadas para marcadores.
- Preferencia de reducción de movimiento.

## 7. Seguridad y privacidad

- Autorización en servidor y principio de mínimo privilegio.
- Validación de esquemas en toda entrada.
- Consultas parametrizadas y transacciones.
- Hash seguro de contraseñas, sesiones rotables y cookies seguras.
- Protección CSRF, CORS restringido, cabeceras seguras y límites de solicitudes.
- Validación de archivos, tamaños, formatos y metadatos.
- Secretos sólo en variables de entorno del servidor.
- Auditoría de cambios sensibles.
- Exportación y eliminación de cuenta.
- Documentos de privacidad, cookies, términos y bases de concursos.

## 8. Manejo de errores y degradación

- Estados de carga, vacío, error, conexión perdida, fuente atrasada y corrección.
- Importaciones con reintentos exponenciales y cuarentena de registros inválidos.
- Bloqueo optimista para edición concurrente.
- Recálculos reconstruibles desde eventos y reglas versionadas.
- Caché sólo para lectura; PostgreSQL conserva autoridad.
- Si faltan estadísticas avanzadas, la ficha muestra el subconjunto disponible.
- Si falla OpenAI, se conserva el flujo editorial manual.
- Si falla el canal en vivo, el cliente reconecta y recupera cambios desde una versión conocida.

## 9. Desarrollo y ejecución local

- Un comando levantará web, API, worker y PostgreSQL.
- Podrá ejecutarse con Node.js y PostgreSQL locales o mediante Docker Compose.
- Datos semilla cubrirán liga, grupos, playoffs, seven, femenino, partidos incompletos, prodes y artículos.
- Habrá cuentas demo documentadas para administrador, editor, colaborador y usuario.
- Email y push usarán adaptadores locales por defecto.
- La consola en vivo podrá probarse en una ventana y la ficha pública en otra.
- `.env.example` documentará cada variable sin incluir secretos.

## 10. Producción y presupuesto

- Los tres procesos podrán convivir inicialmente en un VPS económico.
- No se dependerá del plan Hobby de Vercel para una operación comercial.
- PostgreSQL podrá ser local al VPS o administrado cuando exista presupuesto.
- OpenAI será opcional y su consumo se limitará y medirá por separado.
- El dominio y sus renovaciones no forman parte del presupuesto mensual de infraestructura.
- Al crecer, web, API y worker podrán separarse sin dividir prematuramente el dominio en microservicios.

## 11. Estrategia de pruebas

- Unitarias para puntuación, bonus, desempates, eventos, estados, prodes y permisos.
- Integración para PostgreSQL, autenticación, importaciones, recálculos, notificaciones e IA simulada.
- Contratos para cada adaptador externo.
- E2E para registro, favoritos, prode, vivo, partido, CMS, asistente editorial e idiomas.
- Accesibilidad automatizada y revisión por teclado.
- Concurrencia para edición simultánea de partidos.
- Rendimiento de portada y canales en vivo.
- Pruebas de migración y restauración de datos.

## 12. Criterios de aceptación

1. Todos los módulos del inventario son navegables y persistentes.
2. Un administrador puede crear una temporada completa sin modificar código.
3. Un colaborador autorizado puede actualizar un partido y los usuarios reciben el cambio en vivo.
4. Una corrección recalcula tabla, estadísticas, prodes y notificaciones sin duplicados.
5. Un usuario puede registrarse, elegir favoritos, jugar prodes, completar juegos y configurar alertas.
6. Un editor puede publicar una nota manual o revisar un borrador generado con OpenAI.
7. La plataforma funciona en español, inglés y portugués.
8. La PWA es instalable y usable en móvil y escritorio.
9. La aplicación funciona localmente sin servicios pagos ni claves externas.
10. Tipos, lint, pruebas automatizadas y build terminan correctamente.

## 13. Decisiones explícitas

- Nombre de trabajo: Ovalia.
- Plataforma: web responsive y PWA, sin aplicaciones nativas iniciales.
- Modelo comercial: gratuito con anuncios y sponsors.
- Modelo de datos en vivo: híbrido, priorizando operación propia.
- Presupuesto inicial: menos de USD 10 mensuales.
- Idiomas: español, inglés y portugués.
- Comunidad: perfiles y seguidores, sin chat ni comentarios.
- Video: fuera de alcance.
- Juveniles: fuera de alcance.
- Juegos iniciales: ideología y simulador de carrera.
- IA editorial: OpenAI externo, sólo borradores con aprobación humana.
