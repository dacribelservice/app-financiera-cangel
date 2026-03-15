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
- [ ] Fase 3.1: Crear `core/store.js` y extraer el objeto `AppState`. Importarlo en `app.js`.

### 🟠 FASE 4: CAPA DE RED Y SERVICIOS
- [ ] Fase 4.1: Crear `services/api.js`. Mover la lógica de sincronización con Supabase y Node.js.

### 🔴 FASE 5: UI Y LÓGICA DE NEGOCIO
- [ ] Fase 5.1: Crear módulos en `/ui` para aislar la lógica de Ventas, Inventario y Clientes.

### 🟣 FASE 6: ORQUESTACIÓN FINAL
- [ ] Fase 6.1: Limpiar `app.js` para que actúe EXCLUSIVAMENTE como el Entry Point principal.

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
- [ ] **Restauración del Módulo de Análisis (PS Store):** Inyectar funciones de la tabla de análisis: `updateGlobalTRM`, `deleteAnalysis`, `updateAnalysisData`, `editAnalysisImage`.
- [ ] **Garantía de Helpers de UI:** Inyectar `showPremiumAlert` y `showPremiumPrompt`.

---

### 📝 BITÁCORA DE RESOLUCIÓN DE ERRORES (Actualizado)

| ID | Incidente | Causa Raíz | Solución | Estado |
| :--- | :--- | :--- | :--- | :--- |
| #0 | ReferenceError en Login | Función `doLogin` no expuesta en el scope global. | Añadida a objeto `GlobalBridge` y window. | ✅ Fixed |
| #7 | Falso Positivo en Inventario | Pruebas incompletas para Xbox, Físico y Paquetes. | Ampliada cobertura en `inventario.test.js`. | ✅ Fixed |
| #8 | ReferenceError en Sugerencias | `selectGameSuggestion` no estaba en el puente. | Inyectada en `GlobalBridge` de `app.js`. | ✅ Fixed |
| #9 | SyntaxError en Botones Inventario | Mal escapado de strings en `onclick` dinámicos. | Envueltos argumentos `${item.id}` en comillas simples. | ✅ Fixed |
| #10 | Botones Huérfanos en Balance | Funciones de añadir gastos e ingresos no expuestas. | Inyectadas `addExpense`, `addIngreso`, etc. en `GlobalBridge`. | ✅ Fixed |
| #11 | Navegación Huérfana en Bitácora | `switchBitacoraTab` y `renderBitacoraEventos` no vinculadas. | Añadidas al puente global y verificadas con tests. | ✅ Fixed |
| #12 | Extracción de Utilidades | Primera fragmentación de `app.js` exitosa. | Movidos 5 formateadores a `utils/formatters.js`. | ✅ Fixed |

## 🛑 PUNTO DE CONTROL (CHECKPOINT ACTUAL)

**Estado:** **FASE 2.1 COMPLETADA** ✅ | Iniciando **Fase 2.2 (Validators)**.
**Progreso:**
- **Refactorización:** Se han eliminado las primeras ~100 líneas redundantes de `app.js`.
- **Módulos:** El sistema ya utiliza importaciones ES6 para utilidades.
- **Estabilidad:** 37/37 tests siguen pasando tras la fragmentación.

**Próximo Paso Inmediato (Fase 2.2):**
1. Identificar funciones de validación (ej. `checkDuplicateGameEmail`, etc.).
2. Extraer a `utils/validators.js`.
3. Validar con suite de pruebas.

---

**Chet List de Fase 2.1 (Completada):**
1. **Preparación de Infraestructura:**
   - [x] Crear la carpeta `utils`.
   - [x] Crear el archivo `utils/formatters.js`.
2. **Identificación y Extracción (CORTAR de `app.js`):**
   - [x] `formatCOP` (Línea 40).
   - [x] `formatUSD` (Línea 48).
   - [x] `getColombiaTime` (Línea 3366).
   - [x] `calculateMembershipCountdown` (Línea 1809).
   - [x] `formatDaysToMonths` (Línea 1834).
3. **Integración y Limpieza:**
   - [x] Exportar funciones desde `formatters.js`.
   - [x] Importar en `app.js` con extensión `.js`.
   - [x] Eliminar definiciones redundantes en `app.js`.
4. **Prueba de Regresión:**
   - [x] Ejecutar `npm run test` (37/37 OK).
5. **Documentación:**
   - [x] Registrar éxito en bitácora.
