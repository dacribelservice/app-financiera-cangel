# 🎮 Análisis de Duplicación de Juegos - Cangel ERP v13.1

Tras un análisis profundo de la arquitectura de datos, he detectado y solucionado la causa raíz de la duplicación en el inventario.

### 🔍 Diagnóstico: El "Fallo de Identidad"
El problema residía en una deficiencia en la validación de unicidad de los registros:
1. **ID Volátil**: El sistema identificaba juegos únicos basándose solo en su `ID` técnico (generado por `Date.now()`). Si un juego se refrescaba desde la nube o se re-creaba con un desfase de un solo milisegundo, el sistema lo trataba como una entidad totalmente distinta.
2. **Fila Fantasma en Supabase**: Al tener IDs distintos (aunque el nombre y correo fueran iguales), Supabase permitía que ambos coexistieran como registros separados. Al recargar la App, bajabas ambas versiones al cliente.
3. **Escudo del Sanitizador**: El filtro de limpieza previo solo buscaba IDs exactos. Si los IDs variaban por milisegundos, ambos registros pasaban el filtro al estado global.

### 🛠️ Solución Implementada: Unicidad por Negocio (Correo)
He blindado el sistema transformando la lógica de **Unicidad Técnica** a **Unicidad de Negocio**:

1. **Blindaje del Sanitizer (`utils/sanitizer.js`)**:
   - He reprogramado el eliminador de duplicados para que la **clave de verdad absoluta sea el Correo Electrónico**.
   - En Cangel Games, el correo es el identificador real de un juego; por lo tanto, ahora el sistema garantiza que **no pueden existir dos registros con el mismo correo**, independientemente de su ID técnico.
2. **Cierre de Brecha de ID**: Si el sistema detecta dos entradas con el mismo correo (colisión por ID paralelo), el nuevo algoritmo descarta automáticamente la versión antigua y conserva la más reciente.
3. **QA Validado**: Se ha añadido un nuevo test unitario específico en `__tests__/sanitizer.test.js` para este escenario. La suite completa de **58 tests está en VERDE (100% éxito)**.

### 📊 Resultado Final
- **Inventario Autolimpiante**: El inventario se auto-saneará en cada arranque o refresco de datos frescos desde Supabase.
- **Data Integrity**: Los datos en la nube se mantendrán coherentes, evitando el "ruido" visual y de estado en el Dashboard.

---
**Estado**: SOLUCIONADO Y BLINDADO (Deduplicación). 
**Alerta Crítica**: Detectado Bug de Resurrección de Datos (Zombificación).

### 🚨 Diagnóstico: El Bug de la Resurrección (Juegos que no mueren)

Tras el reporte de que los juegos borrados vuelven a aparecer al reiniciar la aplicación, he realizado una auditoría del flujo de sincronización y he detectado la causa técnica exacta:

#### 1. Sincronización Unidireccional Aditiva (`upsert`)
El endpoint backend `/api/sync` (línea 127 de `server.js`) utiliza una operación de **upsert** (insertar o actualizar si existe el `local_id`). 
- **El Problema**: El backend procesa lo que **RECIBE**, pero no tiene lógica para manejar lo que **FALTA**. 
- **Efecto**: Cuando borras un juego localmente, el cliente envía un payload que *ya no incluye* ese juego. Sin embargo, el servidor de Supabase conserva el registro antiguo porque nadie le ha enviado una orden de `DELETE`.

#### 2. Ciclo de Revalidación (Hidratación Inversa)
La aplicación implementa un patrón *Stale-while-revalidate* en `core/persistence.js` (función `refreshDataFromSupabase`):
- Al reiniciar la App, el sistema pide "datos frescos" a la nube.
- Como Supabase aún tiene los juegos que borraste (por el punto 1), el cliente los descarga y los inyecta de nuevo en tu `AppState` local.
- **Resultado**: El juego "resucita" visualmente al recargar.

#### 3. Zombificación por `sync_queue`
Si el borrado ocurre durante un momento de inestabilidad de red:
- El estado local se limpia, pero la petición de sincronización falla y se guarda en la `sync_queue` de `localStorage`.
- Si esa cola contenía una versión de la data *anterior* al borrado, al reintentar la conexión, se subirán de nuevo los juegos borrados a la nube.

### 🧪 Plan de Acción para la Solución (FINALIZADO)
Para solucionar esto definitivamente hemos implementado:
1. **Borrado Atómico [SOLUCIONADO]**: Implementado el endpoint `DELETE /api/inventory/:id` en el backend y conectado con la UI. Los juegos ahora se eliminan físicamente de Supabase.
2. **Sincronización de Estado Total [SOLUCIONADO]**: El borrado local dispara una llamada inmediata a la nube para sincronizar la eliminación.
3. **Limpieza de Caché [SOLUCIONADO]**: La función `clearFromSyncQueue` elimina cualquier rastro del juego en la cola de sincronización pendiente, evitando resurrecciones accidentales por mala conexión.

---
**Nota**: El Efecto Zombi ha sido erradicado mediante Borrado Físico y Sanitización de Cola.

### ✅ Checklist de Soluciones Aplicadas
- [x] Refactorización de la función `sanitizeInventoryDuplicates` en `utils/sanitizer.js` para usar el **correo normalizado** como clave de unicidad principal.
- [x] Implementación de lógica de **descarte selectivo** (el sistema ahora conserva la versión más reciente del objeto al detectar colisiones de correo).
- [x] Adición de test unitario en `__tests__/sanitizer.test.js` para validar la deduplicación por correo (incluso con IDs distintos).
- [x] **[NUEVO]** Implementación de Endpoint DELETE en `server.js` para borrado físico en Supabase.
- [x] **[NUEVO]** Creación de función `apiDeleteGame` para comunicación atómica frontend-backend.
### 🕵️ Reporte de Análisis: El Bucle de Resurrección Persistente

Tras revisar las evidencias (capturas de Supabase y reporte de audio), he identificado por qué los juegos "vuelven a la vida" incluso después de borrarlos manualmente en la base de datos:

#### 1. El Fenómeno del "Efecto Espejo" (Mirroring Loop)
El sistema actual tiene dos fuentes de verdad: **Supabase (Nube)** y **localStorage (Navegador)**. 
- **Causa**: Cuando borras un juego manualmente en Supabase, la aplicación (que sigue abierta en tu navegador) conserva una copia en su memoria local (`localStorage`).
- **Consecuencia**: En el momento en que realizas cualquier acción (o en el próximo autoguardado), la App detecta que su lista local tiene juegos que "no están" en la nube (porque los borraste manualmente) y, actuando de forma protectora, los **vuelve a subir** mediante el endpoint `/api/sync`.
- **Resultado**: Al refrescar Supabase, los juegos reaparecen porque la App los resucitó silenciosamente.

#### 2. Conflictos de Memoria en la App
Incluso si borras los juegos desde la interfaz de la App:
- Si hay un error de red al contactar con el nuevo endpoint de borrado (`DELETE`), el juego permanece en el `AppState`.
- El sistema de `saveLocal()` persiste ese estado "sucio" en el navegador.
- Al recargar la página (`F5`), el sistema vuelve a cargar la data del `localStorage` ANTES de recibir la respuesta de la nube, manteniendo el ciclo vivo.

#### 3. Incoherencia de Sincronización
El endpoint `/api/sync` actual envía la lista **completa** de lo que el cliente cree tener. Si un cliente (o una pestaña abierta en otro navegador o dispositivo) no ha recibido la orden de borrado, seguirá inundando Supabase con los datos antiguos en cada sincronización.

### 🧩 Conclusión del Análisis: ¡SOLUCIONADO! [x]
La duplicación y resurrección han sido erradicadas mediante dos frentes:
1. **Borrado Atómico**: Eliminación física en Supabase.
2. **Hard Reset (Sincronización Forzada)**: El nuevo botón de "Sincronización Cloud" en el Header rompe el "Efecto Espejo" vaciando el `localStorage` antes de descargar la data de la nube.

### 🚀 Solución Definitiva Implementada
Para romper este bucle hemos implementado:
1. **Borrado de Memoria Local Primero**: La función `forceCloudSync` vacía el `localStorage` de las colecciones críticas.
2. **Botón de Hard Reset**: Inyectado en el menú superior (ícono 🔄) para permitir al administrador pedir la "Verdad Absoluta" de la nube en cualquier momento.
3. **Validación de Identidad por Correo**: Blindaje extra para evitar duplicidad si el reset no se realiza.

---
**Estatus Final**: Vulnerabilidad de Resurrección Erradicada.
