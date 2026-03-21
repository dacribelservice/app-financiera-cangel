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
export async function apiSync(syncData, useBackup = false) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s Timeout

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('Server error');
    return { success: true };
  } catch (err) {
    if (useBackup) {
      console.warn("⚠️ Sync fallido. Guardando en cola local:", err.name === 'AbortError' ? 'Timeout 5s' : err.message);
      localStorage.setItem('cangel_sync_queue', JSON.stringify(syncData));
    }
    return { success: false, error: err.message };
  }
}

export async function apiProcessSyncQueue() {
  const queue = localStorage.getItem('cangel_sync_queue');
  if (!queue) return;

  try {
    const syncData = JSON.parse(queue);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s Timeout

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (response.ok) {
      localStorage.removeItem('cangel_sync_queue');
      return true;
    }
  } catch (err) {
    console.warn("⏳ Reintento de sincronización fallido (servidor aún offline).");
  }
  return false;
}

/**
 * 3. CARGA DE DATOS INICIALES (SUPABASE)
 */
export async function apiFetchInitialData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const response = await fetch('/api/initial-data', { signal: controller.signal });
  clearTimeout(timeoutId);

  if (!response.ok) throw new Error('Error al cargar datos iniciales');
  return await response.json();
}

/**
 * 4. CLIENTES PAGINADOS (SUPABASE)
 */
export async function apiFetchClientes(page, limit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const response = await fetch(`/api/clientes?page=${page}&limit=${limit}`, {
    signal: controller.signal
  });
  
  clearTimeout(timeoutId);
  if (!response.ok) throw new Error('Error al cargar clientes paginados');
  return await response.json();
}

/**
 * 5. EXTRACCIÓN CON IA (GEMINI)
 */
export async function apiFetchPSDetails(url) {
  const response = await fetch(`/api/ps-details-ai?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error('Error en extracción por IA');
  return await response.json();
}
