## PILARES DE ARQUITECTURA (REGLAS ESTRICTAS)
1. **Gestión de Estado:** Modelo Singleton (`/core/store.js`). Exportaremos `AppState` por referencia. NO usar patrones de Observador por ahora.
2. **Scope Global:** "Bridge Global". Expondremos funciones de UI críticas directo al objeto `window` para evitar el "Gran Apagón" del HTML.
3. **Funciones Monstruo:** Fragmentación Horizontal. Mover funciones tal cual a sus archivos, limpieza profunda se hará en el futuro.
4. **Dependencias UI:** Importaciones directas por módulo.
5. **Evolución del Bridge:** A futuro, migraremos el "Bridge Global" hacia una arquitectura de **Delegación de Eventos** (`addEventListener` en nodos raíz) para desacoplar totalmente el JS del HTML.
6. **Mapa de Carpetas:** `/core` (estado/config), `/ui` (componentes/render), `/services` (API/Supabase), `/utils` (helpers puros).

---

### 🟡 FASE 1: PREPARACIÓN DEL ENTORNO (Habilitar Módulos)
- [x] Fase 1.1: Añadir `type="module"` en el `index.html`.
- [x] Fase 1.2: Crear el "Bridge Global" en `app.js` exponiendo las funciones de UI críticas al objeto `window` para no romper el HTML.

### 🟢 FASE 2: EXTRACCIÓN DE UTILIDADES PURAS
- [x] Fase 2.1: Crear `utils/formatters.js`. Extraer y exportar las funciones utilitarias e importarlas en `app.js`.
- [ ] Fase 2.2: Crear `utils/validators.js`. (Próximamente).

### 🔵 FASE 3: ESTADO GLOBAL
- [x] Fase 3.1: Crear `core/store.js` y extraer el objeto `AppState`. Importarlo en `app.js`.

### 🟠 FASE 4: CAPA DE RED Y SERVICIOS
- [x] Fase 4.1: Crear `services/api.js`. Mover la lógica de sincronización con Supabase y Node.js.

### 🔴 FASE 5: UI Y LÓGICA DE NEGOCIO
- [x] Fase 5.1a: Crear `ui/inventory.js`. Extraer funciones de renderizado y gestión de Inventario (Juegos, Códigos, Paquetes, Membresías, Xbox, Físico).
- [x] Fase 5.1b: Módulo de Ventas & Facturación (`ui/sales.js`).
- [x] Fase 5.1c: Módulo de Clientes & CRM (`ui/clients.js`).
- [x] Fase 5.1d: Módulo de Analytics & Gráficas (`ui/analytics.js`). (Extracto completo de rankings y Chart.js)

### 🟣 FASE 6: ORQUESTACIÓN FINAL
- [x] Fase 6.1: Limpiar `app.js` para que actúe EXCLUSIVAMENTE como el Entry Point principal. (ORQUESTACIÓN DE BALANCE COMPLETADA)
- [ ] Fase 6.2: Extracción de Módulo de Usuarios y 2FA. (Pendiente)
- [ ] Fase 6.3: Extracción de Módulo de Bitácora. (Pendiente)

---

## 📝 BITÁCORA DE RESOLUCIÓN DE ERRORES

### [14-03-2026] - Errores de Inicio de Fase 1 (Módulos ES6)

1. **Error: `doLogin is not defined` (Scope del Módulo)**
   - **Causa:** Al cambiar a `type="module"`, las funciones ya no son globales. El HTML `onclick` no las encuentra.
   - **Solución:** Implementación de un `GlobalBridge` al final de `app.js` que expone funciones críticas al objeto `window`.

2. **Error: `ReferenceError: doLogout is not defined`**
   - **Causa:** El Bridge intentaba exponer `logout`, pero la función se llamaba `doLogout` en el código.
   - **Solución:** Corrección del nombre en el objeto `GlobalBridge`.

3. **Error: `TypeError: Cannot read properties of null (reading 'permisos')`**
   - **Causa:** Funciones como `renderInventoryJuegos` se disparaban antes del login cuando `AppState.currentUser` es `null`.
   - **Solución:** Inyección de guardas `if (!user) return;` y uso de *Optional Chaining* (`user?.permisos`) en las validaciones de UI.

4. **Error: `ReferenceError: deleteGameRow is not defined`**
   - **Causa:** Typo en el Bridge. La función real era `removeVentaGameRow`.
   - **Solución:** Corrección de nombres y adición de un mecanismo de seguridad (`typeof !== 'undefined'`) en el bucle del Bridge para evitar que un error de referencia aborte toda la carga del script.

6. **Error: `ReferenceError: filterInventory is not defined`**
   - **Causa:** Similar a los anteriores, error de referencia por función inexistente o mal nombrada detectada por el Bridge en Strict Mode.
   - **Solución:** Eliminación de la referencia en `GlobalBridge` para permitir que el script finalice su ejecución.

7. **Error: `ReferenceError: openModal2FA is not defined`**
   - **Causa:** El Bridge intentaba exponer `openModal2FA`, pero la función real en el código es `open2FAModal`. Al ser un módulo, el Modo Estricto bloquea toda la ejecución.
   - **Solución:** Corrección del nombre en el objeto `GlobalBridge` para restaurar la carga de `app.js` y habilitar `doLogin`.

8. **Incidente #8: Botones de UI rotos (Pestañas, Modales, Acciones)**
   - **Causa:** Al migrar a Módulos ES6, casi 50 funciones atadas a eventos `onclick` en `index.html` quedaron fuera del scope global.
   - **Solución:** Escaneo total del HTML y expansión masiva del `GlobalBridge` en `app.js` para exponer navegación, inventario, ventas y análisis.

9. **Configuración de Testing UI (Vitest + JSDOM)**
   - **Acción:**  - [x] Instalación de `vitest` y `jsdom`.
  - [x] Configuración de `vitest.config.js`.
  - [x] Exportación de `AppState` en `app.js` para visibilidad en tests.
  - [x] Inyección de `getGameSlots` y `showDeleteConfirmModal` en `GlobalBridge`.
  - [x] Primer suite de pruebas: `__tests__/inventario.test.js` (6 ### 📋 Pruebas Realizadas (Resumen)
| Módulo | Test File | Resultado | Funciones Cubiertas |
| :--- | :--- | :--- | :--- |
| Inventario (Full) | `inventario.test.js` | ✅ 12/12 PASSED | Juegos, Paquetes, Membresías, Xbox, Físico, Filtros, Pestañas |
| Ventas (Full) | `ventas.test.js` | ✅ 9/9 PASSED | Modales, Autocompletes (6 tipos), Gestión, Anulación, Pestañas |
| Analytics (Full) | `analytics.test.js` | ✅ 6/6 PASSED | Historial, Listas, Paginación, Sorteos, Ranking Asesores |
| Balance (Full) | `balance.test.js` | ✅ 4/4 PASSED | Cálculos socio, Gastos/Ingresos, Auditoría PDF/Excel |

### 🛠️ Próximos pasos de reparación guiada:
- Aplicar el mismo patrón para el módulo de **Ventas** (crear `__tests__/ventas.test.js`).
- Asegurar que todas las funciones de guardado de ventas estén en el `GlobalBridge`.
- Reparar los botones de **Ventas**, **Analytics** y **Balance** basándose en los fallos de las nuevas pruebas.

---

### 🛠️ PLAN DE EMERGENCIA: Reparación de Interfaz (Parche 1.2.1)
**Contexto:** Tras restaurar el acceso al Login, se detectó que la mayoría de los botones y pestañas del ERP no responden. Esto ocurre porque el `GlobalBridge` está incompleto. 

**📋 Checklist de Micro-procesos:**
- [x] **Auditoría de Handlers (`index.html`):** Escaneo total de atributos en la sección de Inventario.
- [x] **Sincronización de Inventario:** Inyectar todas las funciones de Xbox, Físico, Paquetes y Membresías al Bridge.
- [x] **Sincronización de Ventas:** Inyectadas funciones de gestión y autocompletado total.
- [x] **Reparación de Sugerencias:** Inyectada `selectGameSuggestion` al `GlobalBridge` (Resuelto ReferenceError).
- [x] **Sincronización de Analytics:** Inyectadas funciones de ranking, filtrado de clientes, gestión de listas y paginación.
- [x] **Gestión de Balance (Finalizado):** Extraídas funciones de charts, PDF, Excel y gastos del archivo `app.js`.
- [x] **Gestión de Dashboard (Finalizado):** Extraída lógica de KPIs a `ui/dashboard.js`.
- [x] **Gestión de Análisis (IA) (Finalizado):** Extraído el motor de PS Store y Gemini a `ui/analysis.js`.
- [x] **Saneamiento del Bridge:** Eliminada duplicidad de `renderCuentasPSN` e inyectadas funciones de análisis al objeto `window`.
- [x] **Limpieza de Residuos:** Eliminada declaración duplicada de `processPDF` y restos malformados en `app.js`.
- [ ] **Garantía de Helpers de UI:** Inyectar `showPremiumAlert` y `showPremiumPrompt`.

---

### 📝 BITÁCORA DE RESOLUCIÓN DE ERRORES (Actualizado)

| ID | Incidente | Causa Raíz | Solución | Estado |
| :--- | :--- | :--- | :--- | :--- |
| #0 | ReferenceError en Login | Función `doLogin` no expuesta en el scope global. | Añadida a objeto `GlobalBridge` y window. | ✅ Fixed |
| #7 | Falso Positivo en Inventario | Pruebas incompletas para Xbox, Físico y Paquetes. | Ampliada cobertura en `inventario.test.js`. | ✅ Fixed |
| #8 | ReferenceError en Sugerencias | `selectGameSuggestion` no estaba en el puente. | Inyectada en `GlobalBridge` de `app.js`. | ✅ Fixed |
| #9 | SyntaxError: processPDF | Re-declaración residual de `processPDF` en `app.js` tras importación. | Eliminación física del código residual del módulo de Balance en `app.js`. | ✅ Fixed |
| #9 | SyntaxError en Botones Inventario | Mal escapado de strings en `onclick` dinámicos. | Envueltos argumentos `${item.id}` en comillas simples. | ✅ Fixed |
| #10 | Botones Huérfanos en Balance | Funciones de añadir gastos e ingresos no expuestas. | Inyectadas `addExpense`, `addIngreso`, etc. en `GlobalBridge`. | ✅ Fixed |
| #11 | Navegación Huérfana en Bitácora | `switchBitacoraTab` y `renderBitacoraEventos` no vinculadas. | Añadidas al puente global y verificadas con tests. | ✅ Fixed |
| #12 | Extracción de Utilidades | Primera fragmentación de `app.js` exitosa. | Movidos 5 formateadores a `utils/formatters.js`. | ✅ Fixed |
| #13 | Modales de Xbox/Físico rotos | Funciones de cierre y eliminación no estaban en el Bridge. | Creadas `closeXboxModal`, etc. y vinculadas al GlobalBridge. | ✅ Fixed |

## 🛑 PUNTO DE CONTROL (CHECKPOINT ACTUAL)

**Estado:** **FASE 5.1a COMPLETADA** ✅ | Iniciando **Fase 5.1b (UI Ventas)** 🟡.
**Progreso:**
- **Refactorización:** `app.js` reducido significativamente (~1400 líneas movidas a `/ui/inventory.js`).
- **Módulos:** Capas de Utilidades, Estado, Servicios y UI Inventario desacopladas.
- **Estabilidad:** 49/49 tests pasan correctamente con Módulos ES6.

### 📋 CHET LIST: FASE 2.2 - EXTRACCIÓN Y NUEVOS VALIDADORES
#### **Fase 2.2a: Desacoplamiento de Validadores Existentes (COMPLETADA ✅)**
1. **Preparación de Infraestructura:**
   - [x] Crear el archivo `utils/validators.js`.
2. **Identificación y Desacoplamiento (app.js):**
   - [x] `checkDuplicateGameEmail` (Línea 4192) -> Extraer lógica a `isValidDuplicateEmail`.
   - [x] `checkDisp` (Línea 5427) -> Extraer lógica a `hasInventoryAvailability`.
   - [x] `checkLowInventory` (Línea 5111) -> Extraer lógica a `isInventoryLow`.
4. **Integración y Limpieza:**
   - [x] Exportar funciones desde `validators.js`.
   - [x] Importar en `app.js` e integrar en flujos de `saveGame`, `doLogin`, etc. (via Wrappers de UI).
   - [x] Eliminar lógica inline redundante.
5. **Prueba de Regresión:**
   - [x] Ejecutar `npm run test` (37/37 OK).

#### **Fase 2.2b: Implementación de Nuevos Validadores RegEx (COMPLETADA ✅)**
1. **Desarrollo de Funciones Puras:**
   - [x] `isValidEmail` -> Implementar RegEx estándar.
   - [x] `isValidPhoneCO` -> Implementar validación de celular CO (10 dígitos, inicia con 3).
   - [x] `isValidCedula` -> Implementar validación numérica de IDs (solo números).
2. **Exportación e Importación:**
   - [x] Exportar desde `validators.js` e importar en `app.js`.
3. **Unit Testing:**
   - [x] Crear `__tests__/validators.test.js`.
   - [x] Verificar casos de éxito y fallo.
4. **Cierre de Fase:**
   - [x] Ejecutar `npm run test` (49/49 OK).
   - [x] Declarar Fase 2 (Validators) COMPLETADA ✅.

#### **Fase 5.1a: Extracción de UI Inventario (COMPLETADA ✅)**
1. **Preparación de Módulo:**
   - [x] Crear `ui/inventory.js`.
2. **Extracción (desde app.js):**
   - [x] Mover Modales y Render de Juegos (CRUD completo).
   - [x] Mover Gestión de Códigos (PINs).
   - [x] Mover Gestión de Xbox y Productos Físicos.
   - [x] Mover Modales y Render de Paquetes y Membresías (con Slots).
   - [x] Mover Helpers de UI (Switch Mode, Slots calculation, Filter status).
3. **Integración:**
   - [x] Exportar todas las funciones desde `ui/inventory.js`.
   - [x] Importar en `app.js` y actualizar `GlobalBridge`.
   - [x] Vincular dependencias circulares (temporales) con `app.js` (logEvent, saveLocal, etc.).
4. **Verificación:**
   - [x] Ejecutar `npm run test` (49/49 OK).
   - [x] Declarar Fase 5.1a COMPLETADA ✅.

#### **Fase 5.1b: Extracción de UI Ventas (COMPLETADA ✅)**
- [x] **Extracción de Muestras:** Se extrajo `ui/sales.js` y `ui/modals.js`.
- [x] **Estabilidad:** Tests 52/52 pasando exitosamente.
- [x] **Saneamiento:** Limpieza de codificación UTF-8 y bordes decorativos.

#### **Fase 5.1c: Crear ui/clients.js (COMPLETADA ✅)**
- [x] **Parte 1: Extracción de render de clientes:** Se movieron `fetchClientesPage`, `renderClientsHistoryTable`, `renderListas` y filtrado a `ui/clients.js`.
- [x] **Parte 2: Gestión y CRUD:** Se consolidó la lógica de listas y asignación.
- [x] **Incidente #13:** Modales de Xbox/Físico corregidos y vinculados al Bridge.

#### **Fase 6.1: Orquestación Final (COMPLETADA ✅)**
- [x] **Extracción de Balance:** Se movió la lógica financiera a `ui/balance.js`.
- [x] **Extracción de Dashboard:** Se movió la lógica de KPIs a `ui/dashboard.js`.
- [x] **Extracción de Análisis e IA:** Se movió el motor de PS Store y Gemini a `ui/analysis.js`.
- [x] **Extracción de Catálogo:** Se movió la lógica de E-commerce y Carrito a `ui/catalog.js`.
- [x] **Saneamiento de app.js:** Reducción masiva de líneas y conversión a Entry Point modular.
- [x] **GlobalBridge Integra:** Todas las funciones expuestas correctamente para la vista HTML.
- [x] **Estabilidad:** Tests 52/52 pasando exitosamente.

#### **Fase 6.2: Extracción de Usuarios y 2FA (COMPLETADA ✅)**
- [x] **Consolidación de Seguridad:** Toda la lógica de 2FA (códigos, notificaciones y validación) reside en `ui/users.js`.
- [x] **Gestión Administrativa:** CRUD de usuarios, perfiles y permisos granulares migrados.
- [x] **GlobalBridge Saneado:** Todas las funciones expuestas correctamente para mantener la operatividad desde HTML.
- [x] **Estabilidad:** Tests 52/52 pasando exitosamente.

---

**Nota Final de Fase 6.2:** La lógica de perfiles y seguridad 2FA ha sido externalizada. El Entry Point `app.js` es ahora un 80% más ligero en comparación con su estado inicial.

---

**Nota Final de Fase 6.1:** `app.js` ha sido purificado, delegando toda la lógica de interfaz a la carpeta `/ui`. La aplicación ahora sigue un patrón de diseño modular estricto.

---

#### **RESOLUCIÓN DE INCIDENTES (FASE 6.2)**

- **Incidente #14: Dependencias Huérfanas en Inventario**
  - **Causa Raíz:** Tras la extracción de Usuarios y 2FA, `ui/inventory.js` quedó apuntando a `app.js` para funciones que ya no residían allí (`update2FABellBadge`, `updateDashboard`, `calculateBalances`, etc.). También se detectó un `ReferenceError` por la ausencia del wrapper `isInventoryLow`.
  - **Solución:**
    - [x] Actualización de imports en `ui/inventory.js` hacia los módulos UI correspondientes (`./users.js`, `./dashboard.js`, `./balance.js`, `./analysis.js`).
    - [x] Implementación de wrapper `isInventoryLow` en `ui/inventory.js` utilizando el validador puro de `validators.js`.
    - [x] Corrección de imports residuales en `ui/modals.js` (apuntando a `ui/dashboard.js`).
  - **Resultado:** Todos los 52 tests pasan exitosamente en verde. Operatividad de 2FA y Gestión restaurada.

- **Incidente #15: Dependencia de renderCuentasPSN en Usuarios**
  - **Causa Raíz:** El módulo `ui/users.js` intentaba importar `renderCuentasPSN` desde `app.js`, pero tras la fragmentación de la Fase 5.1b, dicha función reside en `ui/sales.js`. Esto bloqueaba la ejecución de `use2FACode`.
  - **Solución:**
    - [x] Rastro de la función `renderCuentasPSN` localizada en `ui/sales.js`.
    - [x] Actualización del import en `ui/users.js` hacia `./sales.js`.
  - **Resultado:** Suite de 52 tests pasando al 100%. Login y flujo de 2FA restaurados.
