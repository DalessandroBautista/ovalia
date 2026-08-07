# Investigación técnica: Viabilidad de adaptador de ingesta UAR / Conecta Rugby

**Fecha de verificación:** 2026-08-04  
**Rama:** `feature/carrera-game-improvements`  
**Estado:** Inviable automatizar sin credenciales o acuerdos oficiales. Se mantiene ingesta manual/CSV.

---

## Resumen ejecutivo

Se realizó una investigación sobre la factibilidad técnica y legal de construir un adaptador automatizado de ingesta de datos para la **Unión Argentina de Rugby (UAR)** y su ecosistema **Conecta Rugby APP** (`conecta.rugby` / `conectarugby.com.ar`).

**Conclusión:** No existe una API pública, semi-pública ni tablas HTML públicas scrapeables de fixtures, resultados o posiciones de competencias UAR. Toda la información operativa de partidos se gestiona bajo portales cerrados con autenticación obligatoria o mediante widgets comerciales de terceros (Opta). Por lo tanto, **no se desarrolló código de adaptador ni mock falso**, respetando las reglas de honestidad técnica del proyecto Ovalia.

---

## Análisis detallado por portal y URLs probadas

### 1. Plataforma Conecta Rugby (`conecta.rugby`)

- **URL probada:** `https://conecta.rugby`
- **Resultado HTTP:** `200 OK`
- **Diagnóstico:** Es una página de presentación comercial/institucional desarrollada en React (Babel en cliente). Describe las características de la app Conecta Rugby para clubes, árbitros y entrenadores.
- **Evidencia de endpoints:** Tras revisar todos los archivos JS (`page.jsx`, `app-screens.jsx`, `ecosystem.jsx`, `tweaks-panel.jsx`), **no contiene llamadas fetch/axios a endpoints de datos públicos** ni expone APIs de lectura.

### 2. Portal Administrativo Conecta (`app.conecta.rugby`)

- **URL probada:** `https://app.conecta.rugby`
- **Resultado HTTP:** Redirección forzada `302` / `200` a `https://app.conecta.rugby/login?redirect=%2F`
- **Diagnóstico:** Portal privado de gestión institucional. Requiere credenciales activas de usuario (miembros de clubes, referato o personal de la UAR).

### 3. Aplicación Tarjeta Electrónica de Partidos — TEP (`partidos.conecta.rugby`)

- **URL probada:** `https://partidos.conecta.rugby`
- **Resultado HTTP:** Redirección a `https://partidos.conecta.rugby/login`
- **Backends identificados en los bundles JS (`index-CrHLqs1h.js`):**
  - `https://bduar-v5-backend.azurewebsites.net/api`
  - `https://conecta-backend.azurewebsites.net/api`
- **Pruebas de endpoints HTTP:**
  - `GET https://bduar-v5-backend.azurewebsites.net/api/fixtures` → `401 Unauthorized` (`{"message":"No autenticado","success":false}`)
  - `GET https://bduar-v5-backend.azurewebsites.net/api/matches` → `401 Unauthorized` (`{"message":"No autenticado","success":false}`)
  - `GET https://bduar-v5-backend.azurewebsites.net/api/clubs` → `401 Unauthorized` (`{"message":"secret no válido","success":false}`)
  - `GET https://conecta-backend.azurewebsites.net/api/clubs` → `401 Unauthorized` (`{"message":"No autenticado","success":false}`)
- **Diagnóstico:** Los backends del ecosistema BDUAR v5 / Conecta exigen autenticación por token (JWT/Bearer) o secreto de aplicación en todas las rutas de datos.

### 4. Sistema Histórico BDUAR (`bd.uar.com.ar`)

- **URL probada:** `https://bd.uar.com.ar`
- **Resultado HTTP:** Redirección a `https://bd.uar.com.ar/users/login`
- **Diagnóstico:** Sistema CakePHP legado de administración UAR, 100% protegido por login.

### 5. Portal Institucional UAR (`uar.com.ar`)

- **URL probada:** `https://uar.com.ar/torneos/` y subpáginas (`torneo-del-interior`, `nacional-de-clubes-masculino`, `7-de-la-republica-masculino`, etc.)
- **Resultados de inspección:**
  1. **Seleccionados Nacionales y Equipos Profesionales (Los Pumas, Pampas, Pumas 7s):**
     - Emplean widgets propietarios de Opta (`<opta-widget widget="fixtures" competition="369" ...>` alimentados por `secure.widget.cloud.opta.net`).
     - Opta requiere contrato comercial y claves de API pagas. (Nota: los seleccionados e internacionales están cubiertos en Ovalia vía `highlightly` o ingesta manual).
  2. **Torneos Nacionales Federales (Torneo del Interior A/B, Nacional de Clubes, Argentino Juvenil M17, Seven de la República):**
     - Las páginas de torneos (`https://uar.com.ar/torneos/torneo-del-interior/`) son artículos institucionales/editoriales estáticos desarrollados en WordPress (Elementor).
     - No contienen tablas HTML de posiciones/fixtures ni llamadas a APIs de datos. Los reglamentos y fixtures históricos se publican únicamente como documentos PDF descargables (`REGLAMENTO_GENERAL_UAR-2025.pdf`).

---

## Veredicto técnico y legal

1. **Inexistencia de API pública:** UAR no ofrece una API REST / JSON abierta para consumo de terceros (a diferencia de URBA, que posee `api.urba.org.ar`).
2. **Inviabilidad de Scraping Web:** Las páginas de `uar.com.ar` no renderizan HTML dinámico de partidos o posiciones; únicamente artículos editoriales o documentos PDF.
3. **Barrera de Autenticación:** El acceso a la plataforma "Conecta Rugby" requiere credenciales institucionales. Intentar eludir el login o hacer ingeniería inversa de tokens privados constituiría un acceso no autorizado.

---

## Estado en la base de datos y arquitectura de Ovalia

En `packages/database/src/seed.ts`, la fuente `uar` ya está registrada correctamente como inactiva:

```typescript
await upsertSource(db, {
  slug: 'uar',
  name: 'Unión Argentina de Rugby',
  priority: 85,
  baseUrl: 'https://uar.com.ar',
  capabilities: ['catalog', 'fixtures', 'results'],
  automationAllowed: false,
  active: false,
  attribution: 'UAR — uar.com.ar',
});
```

En `apps/worker/src/ingestion/register-adapters.ts`, la fuente UAR permanece sin registrar hasta contar con un canal autorizado.

---

## Próximos pasos recomendados

1. **Mantener ingesta vía CSV / Carga manual:** Utilizar la infraestructura de ingesta de CSV (`apps/worker/src/ingestion/csv/`) para cargar fixtures y resultados de torneos UAR (Torneo del Interior, Nacional de Clubes, etc.).
2. **Contacto institucional:** En caso de requerir automatización directa con UAR en el futuro, gestionar acceso formal a un API token o convenio de intercambio de datos con el área digital de la UAR.
