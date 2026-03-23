/* ================================================
   CANGEL GAMES ERP — Servicios API y Persistencia
   ================================================ */

/**
 * 1. PERSISTENCIA EN LOCALSTORAGE (Síncrona)
 */
export function storageSave(AppState) {
  if (!AppState) return;
  const dataToSave = {
    users: AppState.users,
    auditLog: AppState.auditLog,
    catalog: AppState.catalog,
    sales: AppState.sales,
    inventory: AppState.inventory,
    inventoryGames: AppState.inventoryGames,
    inventoryCodes: AppState.inventoryCodes,
    paquetes: AppState.paquetes,
    membresias: AppState.membresias,
    expenses: AppState.expenses,
    incomeExtra: AppState.incomeExtra,
    analysis: AppState.analysis,
    idealStock: AppState.idealStock,
    clientsListas: AppState.clientsListas,
    listas: AppState.listas,
    xboxInventory: AppState.xboxInventory,
    physicalInventory: AppState.physicalInventory,
    plantillas: AppState.plantillas
  };
  localStorage.setItem('cangel_erp_v7', JSON.stringify(dataToSave));
}

export function storageLoad() {
  const saved = localStorage.getItem('cangel_erp_v7');
  return saved ? JSON.parse(saved) : null;
}

/**
 * 2. SINCRONIZACIÓN CON SUPABASE (Vía Backend Node.js)
 */
export async function apiSync(syncData, useBackup = true) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s Timeout de protección

    // Shadow Writing: Petición asíncrona hacia el backend local
    const response = await fetch('http://localhost:3000/api/sync', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': 'CANGEL_DEV_KEY_123'
      },
      body: JSON.stringify(syncData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('Error en sincronización cloud');
    return { success: true };
  } catch (err) {
    if (useBackup) {
      console.warn("⚠️ Sincronización fallida. Guardando en cola local (sync_queue):", err.name === 'AbortError' ? 'Timeout 5s' : err.message);
      // Guardamos en la cola para reintento automático
      localStorage.setItem('sync_queue', JSON.stringify(syncData));
    }
    return { success: false, error: err.message };
  }
}

export async function apiProcessSyncQueue() {
  const queue = localStorage.getItem('sync_queue');
  if (!queue) return;

  try {
    const syncData = JSON.parse(queue);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s Reintento

    const response = await fetch('http://localhost:3000/api/sync', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': 'CANGEL_DEV_KEY_123'
      },
      body: JSON.stringify(syncData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (response.ok) {
      localStorage.removeItem('sync_queue');
      console.log("✅ Cola de sincronización (sync_queue) vaciada con éxito.");
      return true;
    }
  } catch (err) {
    console.warn("⏳ Reintento de sincronización fallido (servidor aún offline).");
  }
  return false;
}

/**
 * MICRO-PARCHE: HARD RESET CLOUD
 * Función asíncrona para iniciar el borrado masivo en el servidor.
 */
export async function apiClearCloudData() {
  try {
    const response = await fetch('/api/clear-inventory', { 
      method: 'DELETE',
      headers: { 'x-api-key': 'CANGEL_DEV_KEY_123' }
    });
    if (!response.ok) throw new Error('Error al vaciar la nube');
    return await response.json();
  } catch (err) {
    console.error('Fallo borrar nube:', err);
    throw err;
  }
}

/**
 * 3. CARGA DE DATOS INICIALES (SUPABASE)
 */
export async function apiFetchInitialData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s Timeout

  // Lectura asíncrona (Revalidate) desde el backend local
  const response = await fetch('http://localhost:3000/api/initial-data', { 
    headers: { 'x-api-key': 'CANGEL_DEV_KEY_123' },
    signal: controller.signal 
  });
  
  clearTimeout(timeoutId);
  if (!response.ok) throw new Error('Error al cargar datos frescos de la nube');
  return await response.json();
}

/**
 * 4. CLIENTES PAGINADOS (SUPABASE)
 */
export async function apiFetchClientes(page, limit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const response = await fetch(`http://localhost:3000/api/clientes?page=${page}&limit=${limit}`, {
    headers: { 'x-api-key': 'CANGEL_DEV_KEY_123' },
    signal: controller.signal
  });
  
  clearTimeout(timeoutId);
  if (!response.ok) throw new Error('Error al cargar clientes desde la nube (Paginado)');
  return await response.json();
}

/**
 * 5. EXTRACCIÓN CON IA (GEMINI)
 */
export async function apiFetchPSDetails(url) {
  const response = await fetch(`/api/ps-details-ai?url=${encodeURIComponent(url)}`, {
    headers: { 'x-api-key': 'CANGEL_DEV_KEY_123' }
  });
  if (!response.ok) throw new Error('Error en extracción por IA');
  return await response.json();
}
