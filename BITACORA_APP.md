# 🧠 BITÁCORA DE CONTEXTO: CANGEL GAMES APP
**Última Actualización:** 10/03/2026 (V12.0)

Este documento es el cerebro a largo plazo de la aplicación. Describe la lógica arquitectónica y el estado de los módulos para que cualquier nueva sesión de Antigravity (y el usuario) no pierda el contexto del código.

---

### Bug Fixes
- [x] Fix order of properties in sales save logic to prevent seller/price duplication issues.
- [x] Fix overlap of Facturación and Cuentas PSN tables in Ventas module due to missing `</table>` tag
- [x] Refactor native `confirm()` to custom modal `showDeleteConfirmModal()` for deleting Paquetes and Membresías
- [x] Fix sold PSN accounts not appearing in the "Cuentas PSN" table by updating `renderCuentasPSN` to check for active sales.

### 📝 LOG DE VERSIONES

#### [V12.0] - 10/03/2026
- **Ventas Compartidas (Dual Seller):** Implementada la capacidad de asignar dos asesoras a una misma venta. El sistema divide automáticamente el precio al 50/50 y genera dos registros de venta vinculados por el mismo ID de transacción, sin duplicar la salida de inventario.
- **Listas Dinámicas en Ventas:** El campo manual de "Lista" fue reemplazado por un dropdown que se alimenta en tiempo real de las listas creadas en el módulo de Analytics (`AppState.listas`).
- **Lógica de Códigos PSN Split:** Se extendió el sistema de división de ventas también para los códigos PSN, asegurando que cada código vendido sea acreditado proporcionalmente a ambas vendedoras si es una co-venta.

#### [V11.9] - 10/03/2026
- **Anulación de Facturas:** Implementación de la funcionalidad para anular y reactivar facturas o pedidos completos en el módulo de Ventas. Las facturas anuladas se visualizan en rojo con tachado, se excluyen de todos los cálculos financieros (Dashboard, Balance, Métricas de Ventas) y liberan automáticamente los slots de inventario ocupados.
- **Notificaciones 2FA:** Se agregó una campana de notificación en la tabla de "Cuentas PSN" que alerta sobre cuentas con 3 o menos códigos de verificación de 2 pasos disponibles. Incluye un badge dinámico y un modal detallado para ver las cuentas afectadas.
- **Filtro en Bitácora:** Se añadió un interruptor en el visor de eventos de Bitácora para mostrar u ocultar selectivamente los eventos de anulación y reactivación de facturas, facilitando el enfoque en otras acciones operativas.
- **Permisos:** Nuevo permiso `p_ventas_anular` integrado en el sistema de gestión de usuarios para controlar quién puede realizar anulaciones.

#### [V11.8] - 10/03/2026
- **Estandarización de Puerto:** Se ha validado que la aplicación opera exclusivamente a través del puerto 3000. Se han eliminado residuos de configuraciones anteriores y se ha generado el enlace de acceso oficial: `http://localhost:3000/`.

#### [V11.7] - 09/03/2026
- **Ingresos Adicionales en Balance:** Nueva sección en el módulo de Balance para registrar dinero extra (aportes de socios, capital de inversión, préstamos, etc.). Tabla con diseño verde diferenciado, contador del total acumulado, botones de editar y eliminar, y persistencia en `localStorage`. El nuevo total se suma automáticamente a los Ingresos en las KPIs del Balance y al cálculo de Ganancia Neta y dividendos de socios.

#### [V11.6] - 09/03/2026
- **Contador de Cantidad en Códigos PSN:** Cada fila de código en el modal de ventas ahora tiene un **stepper** (`-` / cantidad / `+`) limitado al stock disponible de esa denominación. El vendedor puede seleccionar 1x50us + 2x10us para vender $70us. Al guardar, crea N registros individuales (uno por código). El sistema valida que haya stock suficiente antes de guardar.

#### [V11.5] - 09/03/2026
- **Códigos PSN en Ventas:** Integración completa del flujo de venta de códigos PSN. El modal de nueva venta ahora incluye un desplegable de denominaciones (`10us`, `25us`, etc.) construido dinámicamente desde el inventario de códigos disponibles. Al guardar la venta, se registra la denominación elegida. Al copiar la remisión, el sistema asigna automáticamente el primer PIN disponible del inventario, lo marca como `OFF/Usado`, y lo incluye en el texto copiado. Si no hay stock, bloquea la copia con una alerta.

#### [V11.4] - 09/03/2026
- **Sincronización de Códigos:** Al marcar un código PIN como "Usado" en el inventario, su estado cambia automáticamente a `OFF`. Esto asegura que los asesores no tengan acceso a códigos ya vendidos. Si se desmarca, vuelve automáticamente a `ON`.

#### [V11.3] - 09/03/2026
- **Mejora UI Inventario:** Implementación de tooltip multilínea en el contador de juegos de la tabla de paquetes. Al pasar el cursor, se despliega la lista completa de títulos incluidos.

#### [V11.2] - 09/03/2026
- **Fix Inventario:** Se corrigieron errores críticos en las funciones `savePaqueteInventory` y `saveMembresiaInventory` que impedían guardar o editar ítems debido a referencias a variables inexistentes en el sistema de logs.

#### [V11.1] - 09/03/2026
- **Limpieza de Datos Huérfanos:** Se actualizó la función `confirmarLimpiezaDatos` para incluir la limpieza de `idealStock`, `catalog`, `clients`, `raffles` y `plantillas`. Esto resuelve el problema de juegos "fantasma" que aparecían en rojo por persistencia de registros de stock ideal. El botón de limpieza se mantiene exclusivamente en el módulo de **Bitácora** para mayor seguridad.
- **Estandarización de Acceso:** Confirmación y verificación de la aplicación para operar exclusivamente a través del puerto 3000 (`http://localhost:3000/`).

#### [V11.0] - 07/03/2026
- **Auditoría Maestra:** Refactorización de `logEvent` para garantizar persistencia inmediata (`saveLocal`) y captura del nombre del usuario en cada evento.
- **Trazabilidad por ID:** Inclusión sistemática de identificadores únicos (IDs) en todas las descripciones de la Bitácora (Ventas, Juegos, Códigos, Paquetes, Membresías y Análisis).
- **Gestión de Gastos:** Implementación de funciones funcionales de Editar y Eliminar para el módulo de Balance (gastos operativos y ocasionales) con rastro de auditoría completo.
- **Mantenimiento:** La función de "Limpieza de Datos" ahora registra quién realizó el borrado masivo. *Nota: Esta funcionalidad es temporal para la fase de pruebas.*
- **UX:** Mejora en el formato de tiempo (24h) y fecha en el Visor de Eventos para facilitar la lectura cronológica.

#### [V10.5] - 07/03/2026
- **Nueva Función:** Se implementó un botón de "Limpiar Datos de Prueba" en el módulo de Bitácora.
- **Seguridad:** El botón solo es visible para el Super Administrador (`cangel.games.soporte@gmail.com`) y requiere confirmación explícita para evitar pérdidas accidentales.
- **Control:** Permite al usuario vaciar manualmente las tablas de Ventas, Inventario, Balance y Eventos de forma definitiva.

#### [V10.4] - 07/03/2026
- **Limpieza de Datos:** Se realizó un vaciado completo de los datos de prueba en los módulos de Ventas, Inventario, Balance y Bitácora de Eventos.
- **Mantenimiento:** La aplicación se ha restablecido a un estado inicial para facilitar nuevas pruebas del usuario sin saturación de datos en el navegador.

#### [V10.3] - 07/03/2026
- **Corrección:** Se corrigió el error de visualización en el Visor de Eventos donde el nombre del usuario aparecía como `undefined`.
- **Sincronización:** Se unificaron los nombres de las propiedades en el objeto de auditoría (`usuarioNombre`).

#### [V10.2] - 07/03/2026
- **Corrección:** Se corrigieron errores de referencia (`ReferenceError`) en las funciones de renderizado de Ventas, Códigos y Paquetes.
- **Estabilidad:** Se restauró el funcionamiento normal del guardado de ventas y la visualización de tablas que se vieron afectados por variables no definidas.

#### [V10.1] - 07/03/2026
- **Seguridad:** Implementación de permisos granulares para el control de la interfaz de usuario.
- **Lógica:** Los botones de "Crear" (Nueva Venta, Comprar Juego, etc.) ahora se ocultan automáticamente si el usuario no tiene el permiso correspondiente en el checklist de Gestión de Usuarios.
- **Tablas:** Los iconos de "Editar" y "Eliminar" en los módulos de Ventas e Inventario ahora son condicionales según los permisos del rol.
- **Técnico:** Se agregaron IDs únicos a los elementos de acción en `index.html` y se actualizó `applyPermissions` en `app.js`.

#### [V10.0] - 07/03/2026
- **Estandarización:** Acceso a la aplicación unificado únicamente a través del puerto 3000 (`http://localhost:3000/`).
- **Limpieza:** Eliminación de configuraciones redundantes de puertos en `server.js` y `app.js`.

## Verificación (Verification Plan)

---

## 1. 🏗️ Ecosistema y Estado Global (`AppState`)
La aplicación funciona con un único estado global (Vanilla Javascript) llamado `AppState` que se persiste continuamente en el `localStorage`.
Contiene las siguientes bases de datos en memoria:
- `analysis` (Estudio de mercado extraído de PS Store)
- `catalog` (Juegos listados en tienda virtual)
- `cart` (Carrito temporal de compras ecommerce)
- `inventoryGames` (Cuentas/Juegos comprados como activo de la empresa)
- `inventoryCodes` (Códigos de PSN comprados)
- `sales` (Ventas concretadas - transacciones finales)
- `expenses` (Gastos operativos extras)
- `globalBalance` (Métricas maestras de auditoría y dividendos)
- `exchangeRate` (TRM General que rige todos los cálculos COP/USD)

---

## 2. 🔌 MAPA DE CONEXIÓN ENTRE MÓDULOS (Flujo de Datos)

El corazón de la aplicación es cómo se interconectan los diferentes módulos. Esta es la ruta exacta por la que viaja la información desde que se investiga un juego hasta que se cuenta la ganancia:

### A. Línea de Venta Directa (Ecommerce)
1. **[Análisis] -> [Catálogo]:** Un botón en la tabla de análisis lee todos los datos extraídos (precios base, descuentos, imágenes) y los **exporta** automáticamente para armar las tarjetas visuales de juegos en la tienda (Catálogo).
2. **[Catálogo] -> [Carrito]:** Los clientes (o vendedores) seleccionan consolas (PS4/PS5) en el catálogo y los agregan a un carrito de compras interactivo (`AppState.cart`).
3. **[Carrito] -> [Ventas]:** Al confirmar el checkout en el carrito, la orden se transforma y se **inyecta automáticamente** en la tabla del Módulo de Ventas (`AppState.sales`) con estado 'Entregado'.

### B. Línea de Abastecimiento Financiero y Stock
1. **[Análisis] -> [Inventario]:** *(Conexión Oculta)*. Cuando compras un juego y lo vas a registrar en tu inventario manual, el sistema *intercepta el nombre del juego*, viaja a la tabla de Análisis y **le roba silenciosamente el ADN de la consola** (`es_ps4: true/false`, `es_ps5: true/false`, `tipo_version: "Cross-Gen/Exclusiva"`). Esta información queda guardada de forma invisible en el registro del juego en el Inventario para futuras validaciones condicionales.
2. **[Inventario] -> [Ventas]:** Cuando se hace una Venta Manual (no por carrito) en la tabla del panel Ventas, existe una celda desplegable. Este desplegable hace una consulta en tiempo real al Inventario para alimentar su lista **solamente** con juegos que tengan estado `ON` (evitando vender algo que no está en stock, inactivo o ya se usó).

### C. Línea Contable "El Gran Embudo"
Absolutamente todos los módulos matemáticos mueren en los Paneles Financieros Globales:
1. **Flujo hacia el [Dashboard Principal] y [Balance General]:**
   * **Ingresos:** Se alimentan leyendo en tiempo real toooodas las transacciones de `AppState.sales`.
   * **Costos:** Se calcula leyendo en tiempo real las compras de `AppState.inventoryGames` + `AppState.inventoryCodes` + `AppState.paquetes` + `AppState.membresias`.
   * **Gastos Adicionales:** Se leen de `AppState.expenses`.
   * **Cálculo Final (Ganancia Neta):** = (`Ingresos` - `Costos` - `Gastos`). Este valor es el que se usa luego para calcular la repartición exacta a los socios (Socio 1 y Socio 2).

### D. Conexión Multi-Dimensional
1. **Auditoría de Stock (Balance):** El módulo de balance "cruza" la información del `Inventario` (lo que tenemos) frente a `Ventas` (lo que hemos vendido históricamente) para generar un **Stock Ideal**. Le dice a la empresa qué juegos tienen demanda real y necesitan re-comprarse comparando las variables de cantidad.

---

## 3. 🛡️ Protocolo de Supervisión
1. La aplicación utiliza "Skills" para control de calidad. Por ejemplo, el `Supervisor` no realiza cambios de código hasta escuchar la palabra **"ejecuta"**.
2. **Armonía Modular:** Con base en el mapa superior, alterar un módulo de origen (por ejemplo, Análisis) inevitablemente afectará a su módulo de destino. Todo cambio lógico debe probar exhaustivamente la cadena de conexiones.
3. **Protocolo de Respaldo:** Cada vez que se cree una copia de seguridad de los archivos principales (`app.js`, `index.html`, `styles.css`, `BITACORA_APP.md`), se debe generar obligatoriamente un archivo comprimido `backup_complete.zip` en la carpeta `/backups/` reemplazando el anterior. Esto asegura una recuperación rápida y portable del sistema.

---

## 4. 📝 Historial de Cambios Recientes

### [2026-03-01] - Simplificación del Módulo de Análisis
- **Eliminación de Columnas**: Se eliminaron las columnas "Venta 2" y "Venta 3" del módulo de análisis según solicitud del usuario.
- **Renombramiento**: La columna "Venta 4" (Columna G) fue renombrada a "**# Ventas**".
- **Ajuste de Lógica**: Se actualizaron las funciones `renderAnalysisTable`, `updateAnalysisData`, `addToCatalogFromAnalysis` y `processExtractionResult` para reflejar la nueva estructura de la tabla y mantener la integridad de los datos.
- **Formato**: Se mantuvo la restricción de números enteros para la nueva columna "# Ventas".
- **Automatización PSN $ (Columna K)**: El valor de la columna K ahora se calcula automáticamente multiplicando el precio **Sale (Columna D)** por la **TRM**.
- **Refuerzo de Reactividad**: Se corrigió un problema donde los cálculos automáticos no se disparaban al extraer nuevos juegos.
- **Sincronización de Costo (F)**: Se implementó una lógica de sincronización forzada en el renderizado. Ahora, si el sistema detecta un precio de compra en el inventario para un juego, no solo lo muestra en la columna E (Compra), sino que recalcula instantáneamente la columna F (Costo) y H (P. Mínimo) asegurando que el precio en pesos siempre sea el resultado real de `E * Divisa`.
- **Interconectividad de Guardado**: Se vinculó la función `saveGameInventory` para que, al registrar una compra en el inventario, se actualice automáticamente la tabla de análisis sin necesidad de reiniciar la app.
- **UI de Extracción IA**: Se agregaron etiquetas visuales (PS4, PS5, Cross-Gen) en la tarjeta de previsualización del juego extraído, permitiendo identificar la plataforma antes de agregar los datos al análisis.

### [2026-03-05] - V7.1: Optimizaciones de IU y Lógica de Precios
- **Módulo Analytics**: Eliminado encabezado redundante y gráfica de demanda para una interfaz más limpia.
- **Módulo Ventas**: Renombrado botón "Registro Manual" a "+ Nueva Venta".
- **Módulo Análisis**: Ajustada lógica de precios PS4/PS5 para permitir retrocompatibilidad. Ahora los juegos de PS4 permiten asignar precio en la columna PS5. Se mantiene bloqueo para juegos PS5-Exclusivos en columna PS4.
- **Roadmap**: Iniciada fase de preparación para escalabilidad y futura integración con Supabase.

### [2026-03-05] - V7.2: Expansión del Inventario — Paquetes y Membresías PS Plus
- **AppState (app.js)**: Añadidos dos nuevos arrays al estado global: `paquetes: []` y `membresias: []`.
- **Módulo Inventario — KPI Grid ampliado**: Inversión Global (suma automática de todo), Inversión Juegos, Inversión Códigos, Inversión Paquetes, Inversión Membresías.
- **Lógica Unificada de Cupos**: Paquetes y Membresías ahora replican la gestión de 6 cupos (PS4 PRI/SEC, PS5 PRI/SEC) de los juegos, permitiendo una venta granular y exacta.

### [06/03/2026] - V8.1: Módulo de Gestión de Cuentas Vendidas (Cuentas PSN)

**Módulo de Ventas — Navegación y Control:**
- **Navegación Interna**: Se añadieron pestañas para alternar entre "Facturación" (ventas diarias) y "Cuentas PSN" (seguimiento técnico de cuentas vendidas).
- **Tabla Cuentas PSN**: Nueva interfaz para monitorear el estado de las cuentas después de la venta.
    - **Campos**: ID, Juego, Correo, Contraseña, Código 2FA, Fecha de Cuenta, Estado Técnico y Acciones.
    - **Estados Técnicos**: Selector con tres opciones:
        - **Sin Novedad**: Estado normal.
        - **Sospechoso**: Resalta toda la fila en **Amarillo** para atención prioritaria.
        - **Fallas Técnicas**: Resalta toda la fila en **Naranja** para intervención técnica inmediata.
    - **Historial de Ventas**: Se replicó el icono del "ojo" de los inventarios para ver el historial de transacciones asociado a cada cuenta directamente desde esta tabla.

**Identidad Visual y Analytics:**
- **Branding PS5**: Se completó la transición del color de la marca PS5 a **Púrpura** en todo el módulo de Analytics, incluyendo encabezados de rankings y etiquetas de "Consola Preferida" en la tabla de clientes.
- **UX Consistente**: La tabla de Cuentas PSN sigue el diseño de cuadrícula (A-H, 1-N) para mantener la estética de "Hoja de Cálculo Premium" de la aplicación.
- **Integración UI Inventario-Ventas**: Se enriqueció la columna "Juego" en Cuentas PSN (módulo de Ventas) inyectando los badges de Región (Banderas USA/TUR) y los contadores en colores de cupos disponibles (PRI/SEC) replicando exactamente la vista rica del Inventario.

### [06/03/2026] - V8.2: Gestión de Códigos e Inventario PS4/PS5

**Módulo de Inventario — Códigos PSN (Pines):**
- **Persistencia Visual**: Los códigos marcados como usados ya **no desaparecen** de la tabla. Permanecen visibles con un tachado y fondo rojo tenue para control histórico.
- **Columna "Disponible" (Checklist)**: Nueva columna con selector para marcar códigos como usados manualmente.
- **Lógica ON/OFF**: Implementación de interruptores de disponibilidad. El checklist de uso se bloquea si el código está en `OFF`.
- **KPI Dashboard**: Se corrigió el contador de "Pines ON". Ahora solo cuenta códigos que estén en estado `ON` y que **no hayan sido marcados como usados**.
- **Autocompletado de Ventas**: La sugerencia de códigos en el formulario de ventas ahora filtra automáticamente para mostrar solo pines disponibles (ON y no usados).

**Módulo de Inventario y Ventas — Retrocompatibilidad:**
- **Asignación Automática PS4/PS5**: Se modificó el sistema para que todos los juegos de versión PS4 generen automáticamente cupos aplicables también a PS5 (2 PRI, 1 SEC), reconociendo la retrocompatibilidad.
- **Sincronización de IU**: La tabla de "Cuentas PSN" en el módulo de ventas ahora hereda toda la riqueza visual del inventario: banderas de país, badges de cupos activos y colores de alerta.

### [07/03/2026] - V8.3: Filtros Avanzados y Navegabilidad en Ventas

**Módulo de Ventas — Filtro Mensual:**
- **Filtro de Meses Anteriores**: Se implementó un selector dinámico en la parte superior derecha (Header) del Panel de Ventas que permite filtrar los registros por mes y año. Se ajustó el tamaño de fuente y padding para asegurar una visualización óptima sin cortes.
- **Población Dinámica**: El selector detecta automáticamente los meses con actividad en el historial de ventas y los lista de forma cronológica descendente.
- **Acción Unificada**: El filtro de mes se coordina con los filtros de asesor, búsqueda por texto y rango de fechas para ofrecer una navegación precisa por el historial financiero.
- **Persistencia**: Se actualizó la función de limpieza de filtros para resetear también el selector de mes.

**Módulo de Analytics & Ventas - Filtros Diarios Premium**: 
  - Se implementó un filtro de fecha por día (`filtroAnalyticsDia`) en el módulo de Analytics con diseño glassmorphic premium.
  - Se implementó el mismo filtro de fecha por día (`filtroVentasDia`) en el módulo de Ventas, ubicado junto al filtro mensual.
  - Actualización de la lógica de filtrado en `renderRankingAsesores` y `renderVentas` para soportar búsqueda por día específico.
  - Integración de iconos Lucide y estilos dinámicos para una experiencia de usuario superior.
- **Lógica de Comparativa**: Al seleccionar un día, el gráfico se actualiza automáticamente para mostrar el ranking de ese día específico; si no hay selección, el gráfico vuelve a su vista predeterminada de "Mes Actual" con comparativa contra el mes pasado en tooltips.
- **UI Integrada**: El selector mantiene el diseño minimalista y premium de la aplicación.

**Optimización de Búsqueda y Módulo de Códigos (V8.4):**
- **Búsqueda Pre-indexada para >20k Registros**: Implementación del campo `_searchIndex` en la carga y registro de ventas. Permite búsqueda ultra-rápida multicriterio combinando Nombre, Cédula y Celular sin cálculos costosos en tiempo de ejecución.
- **Debounce y Límite de Renderizado**: Se incorporó un mecanismo de **Debounce** (`handleVentasSearchDebounce`) y un límite dinámico de renderizado (100 filas inicialmente) en el Panel de Ventas para evitar bloqueos del DOM (freeze) al buscar sobre bases de datos de más de 20.000 clientes. Se agregó un botón integrado de "Cargar 100 más" para manejar volúmenes mayores de forma fluida.
- **Lógica de Códigos PSN Renovada**: La tabla de "Códigos PSN" dentro de Inventario fue rediseñada para no ocultar los códigos tras ser marcados como "Usados". 
  - Se añadió la característica de prender/apagar (**ON/OFF**) el código de forma idéntica a juegos y cuentas.
  - Se agregó una columna interactiva **"Disponible"** que utiliza un Checkbox visual. Al hacer clic, marca el código como usado dejando un rastro permanente (fondo rojo tenue, PIN tachado, y check verde), siempre y cuando el código esté en "ON". Si está en "OFF", se bloquea la marcación.

### [07/03/2026] - V9.1: Gestión Avanzada de Credenciales de Hosting
- **Módulo Inventario**: Se agregaron etiquetas explícitas "Correo PSN" y "Contraseña PSN" a los formularios de ingreso de Juegos, Paquetes y Membresías.
- **Nuevos Campos**: Se implementó el campo "Contraseña hosting" en los tres tipos de inventario, permitiendo separar las credenciales de la cuenta PSN de las del servicio de hosting.
- **Visualización Enriquecida**: Las tablas de inventario y la tabla de "Cuentas PSN" en Ventas ahora muestran tanto el correo como la contraseña de hosting como información secundaria bajo las credenciales principales.
- **Migración y Consistencia**: Las funciones de renderizado ahora manejan de forma retroactiva tanto el campo antiguo `hosting` como el nuevo `correo_hosting` y `password_hosting`, asegurando que no se pierda información de registros previos.
- **UI/UX**: Se ajustaron los modales y las tablas para mantener el diseño premium, asegurando que la nueva información sea accesible pero no sature la vista principal.
- **Control de Caducidad (Membresías)**: Se implementó un sistema de cuenta regresiva automática (30, 90 o 365 días) basado en la fecha de compra. Los días restantes se visualizan con un diseño minimalista en el Inventario y en el buscador de Ventas, incluyendo alertas visuales en rojo cuando quedan 5 días o menos.
- **Barra de Navegación Fija (Fixed)**: Se optimizó el menú principal para que sea 100% persistente mediante `position: fixed`. Se ajustó el scroll global y los márgenes del contenido para asegurar que las pestañas nunca desaparezcan de la vista al bajar por la página.
- **Sincronización y Backup**: Se actualizó la copia de seguridad global del sistema incluyendo los últimos cambios de UI/UX y lógica de inventario.

### [07/03/2026] - V9.5: Rediseño Premium de Acceso y Sistema de Permisos Unificado

**Seguridad y Acceso (Login):**
- **Interfaz Premium**: Rediseño total de la pantalla de inicio de sesión con estética **Glassmorphism**, efectos de resplandor (glow) y micro-animaciones para una experiencia visual de alto nivel.
- **Funcionalidad "Recordarme"**: Implementación de persistencia de credenciales mediante `localStorage`, permitiendo auto-completar el acceso en sesiones futuras.
- **Estandarización de Datos**: Corrección de discrepancia en la propiedad de contraseña (unificado a `.pass`) y conversión automática de correos a minúsculas para evitar errores de autenticación por capitalización.

**Arquitectura de Permisos (Refactorización):**
- **Sistema Unificado p_xxx_ver**: Refactorización técnica profunda de `applyPermissions` y `getFirstAllowedTab`. Ahora el sistema mapea dinámicamente los IDs de navegación con claves de permiso estandarizadas, eliminando fallos de visibilidad para nuevos usuarios.
- **Nuevos permisos granulares**: Se añadieron controles independientes para los módulos:
    - **Dashboard**
    - **Análisis**
    - **Catálogo**
- **Migración Silenciosa**: Se incluyó un bloque de código en la carga inicial (`loadLocal`) que otorga estos nuevos permisos a los usuarios antiguos de forma automática, garantizando que nadie pierda acceso a sus herramientas de trabajo tras la actualización.
- **UI de Gestión**: El modal de usuarios ahora incluye todos los nuevos checkboxes organizados por módulos.

### [07/03/2026] - V9.9: Corrección de Visibilidad en Tablas (Estado Técnico)
- **Extensión de la solución V9.8**: Se identificó que los selectores de "Estado" en la tabla de **Cuentas PSN** también estaban siendo afectados por el padding global de `styles.css`.
- **Clase Unificada de Tabla**: Creación de la clase `.premium-table-select` para manejar selectores dentro de filas de tabla, optimizando el espacio y eliminando el recorte de texto.
- **Limpieza de Código**: Se eliminaron estilos inline del generador dinámico en `app.js` para centralizar el diseño en CSS, mejorando el mantenimiento futuro.

---


## 5. 🚀 Roadmap de Escalabilidad (Post-MVP)
1. **Modularización**: Desacoplar `app.js` en submódulos (`api.js`, `ventas.js`, `analytics.js`).
2. **Refactorización Asíncrona**: Migración a Backend (Supabase/Firebase) con Async/Await.
3. **Paginación y Búsqueda en Servidor**: Solicitar datos fragmentados para soportar volúmenes masivos (20,000+ registros).
4. **Seguridad**: Implementar autenticación robusta y roles de usuario por servidor.
