import { AppState } from './store.js';
import { 
  storageSave, storageLoad, 
  apiSync, apiProcessSyncQueue, 
  apiFetchInitialData 
} from '../services/api.js';
import { update2FABellBadge } from '../ui/users.js';
import { updateDashboard } from '../ui/dashboard.js';

import { sanitizeInventoryDuplicates } from '../utils/sanitizer.js';

/**
 * Fase 7.1: Módulo de Persistencia y Sistema de Sincronización (Core)
 */

const USE_LOCAL_STORAGE_BACKUP = true; // Habilitado para Shadow Writing y Respaldo de Cola

/**
 * Persiste el estado actual en el almacenamiento local y dispara la sincronización cloud
 */
export function saveLocal() {
  // 1. Persistencia síncrona en localStorage via Service
  storageSave(AppState);

  // 2. Sincronización asíncrona con Supabase (Shadow Writing) via Service
  const uniqueClients = {};
  if (Array.isArray(AppState.sales)) {
    AppState.sales.forEach(v => {
      if (v.cedula && !uniqueClients[v.cedula]) {
        uniqueClients[v.cedula] = {
          cedula: v.cedula,
          nombre: v.nombre_cliente || v.cliente,
          celular: v.celular,
          email: v.correo || v.email,
          ciudad: v.ciudad,
          lista_id: (AppState.clientsListas || {})[(v.nombre_cliente || '').toLowerCase()] || v.lista || null
        };
      }
    });
  }

  const syncData = {
    clients: Object.values(uniqueClients),
    sales: AppState.sales || [],
    inventoryGames: AppState.inventoryGames || [],
    exchangeRate: AppState.exchangeRate || 4200,
    plantillas: AppState.plantillas || {}
  };

  // Disparar sincronización sin bloquear
  apiSync(syncData, USE_LOCAL_STORAGE_BACKUP);
  update2FABellBadge();
}

/**
 * Carga el estado inicial desde el almacenamiento local
 */
export function loadLocal() {
  const data = storageLoad();
  if (data) {
    AppState.users = data.users || [];
    
    // Migración: Asegurar que todos usen .pass en vez de .password
    AppState.users.forEach(u => {
      if (u.password && !u.pass) {
        u.pass = u.password;
        delete u.password;
      }
      // Migración de nuevos permisos granulares
      if (u.permisos && !u.permisos.acceso_total) {
        if (u.permisos.p_dashboard_ver === undefined) u.permisos.p_dashboard_ver = true;
        if (u.permisos.p_analisis_ver === undefined) u.permisos.p_analisis_ver = true;
        if (u.permisos.p_catalogo_ver === undefined) u.permisos.p_catalogo_ver = true;
      }
    });

    AppState.auditLog = data.auditLog || [];
    AppState.catalog = data.catalog || [];
    
    // Fase 4.2: Freno a la carga masiva
    // Solo cargamos las últimas 1000 ventas para mantener agilidad en memoria
    AppState.sales = (data.sales || []).slice(-1000);
    
    // Add _searchIndex to loaded sales
    AppState.sales.forEach(v => {
      if (!v._searchIndex) {
        v._searchIndex = `${(v.cliente || '')} ${(v.nombre_cliente || '')} ${(v.cedula || '')} ${(v.celular || '')}`.toLowerCase();
      }
    });

    AppState.inventoryGames = sanitizeInventoryDuplicates(data.inventoryGames || []);
    storageSave(AppState); // Forzar guardado limpio permanentemente
    
    AppState.inventoryCodes = data.inventoryCodes || [];
    AppState.paquetes = data.paquetes || [];
    AppState.membresias = data.membresias || [];
    AppState.expenses = data.expenses || [];
    AppState.incomeExtra = data.incomeExtra || [];
    AppState.analysis = data.analysis || [];
    AppState.idealStock = data.idealStock || {};
    AppState.clientsListas = data.clientsListas || {};
    AppState.listas = data.listas || [];
    AppState.xboxInventory = data.xboxInventory || [];
    AppState.physicalInventory = data.physicalInventory || [];
    AppState.plantillas = data.plantillas || {};

    // Limpieza automática de datos de prueba antiguos
    const testIds = ["101", "102", "103", "104", "V-675559"];
    AppState.sales = AppState.sales.filter(v => !testIds.includes(String(v.id)));
  } else {
    // Datos iniciales demo premium
    AppState.users = [];
    AppState.auditLog = [];
    AppState.catalog = [
      { id: 1, nombre: "GOD OF WAR RAGNARÖK", precio_ps4: 39.99, precio_ps5: 69.99, image: "https://image.api.playstation.com/vulcan/ap/rnd/202207/1210/4E9HIn9i9n9l9h9e9b9v9.png" },
      { id: 2, nombre: "ELDEN RING", precio_ps4: 49.99, precio_ps5: 59.99, image: "https://image.api.playstation.com/vulcan/ap/rnd/202110/2000/76c4a6b1007fd87a.png" },
      { id: 3, nombre: "SPIDER-MAN 2", precio_ps4: 59.99, precio_ps5: 69.99, image: "https://image.api.playstation.com/vulcan/ap/rnd/202306/1219/602aa422de63443db4c8375e533b664d.png" }
    ];
    AppState.sales = [];
    AppState.inventoryGames = [];
    AppState.inventoryCodes = [];
    AppState.paquetes = [];
    AppState.membresias = [];
  }

  // --- ASEGURAMIENTO DEL SUPER ADMIN (MASTER ACCESS) ---
  if (!AppState.users) AppState.users = [];
  const superAdminExists = AppState.users.find(u => u.email === 'admin@cangel.com');
  if (!superAdminExists) {
    AppState.users.push({
      id: 'super-admin-master',
      nombre: 'Cangel (Master Admin)',
      email: 'admin@cangel.com',
      pass: '123456',
      rolBase: 'Super Administrador',
      permisos: { acceso_total: true },
      activo: true,
      inmutable: true
    });
    console.warn("🛡️ Acceso Maestro Garantizado: admin@cangel.com / 123456");
    setTimeout(() => { saveLocal(); }, 100);
  }

  /**
   * Corrector de imágenes rotas (PlayStation Store Legacy)
   */
  function fixImageUrl(url) {
    if (!url) return "https://via.placeholder.com/300x150?text=Cangel+Games";
    if (url.includes("image.api.playstation.com") && (url.includes("/vulcan/") || url.includes("/rnd/"))) {
      return "https://via.placeholder.com/300x150?text=PS+STORE+GAME";
    }
    return url;
  }

  // Corregir imágenes en el catálogo y auditoria al cargar
  if (AppState.catalog) AppState.catalog.forEach(item => { item.image = fixImageUrl(item.image); });
  if (AppState.analysis) AppState.analysis.forEach(item => { item.image = fixImageUrl(item.image); });

  if (!AppState.auditLog) AppState.auditLog = [];

  // --- AUTO-FILL REMEMBERED DATA ---
  const remembered = localStorage.getItem('cangel_remembered');
  if (remembered) {
    try {
      const { email, pass } = JSON.parse(remembered);
      const loginName = document.getElementById('loginName');
      const loginPass = document.getElementById('loginPass');
      const rememberMe = document.getElementById('rememberMe');
      
      if (loginName) loginName.value = email;
      if (loginPass) loginPass.value = pass;
      if (rememberMe) rememberMe.checked = true;
    } catch (e) {
      console.error("Error loading remembered login:", e);
    }
  }
}

/**
 * Procesa la cola de sincronización pendiente
 */
export async function processSyncQueue() {
  await apiProcessSyncQueue();
}

/**
 * Actualiza el AppState con datos frescos de Supabase en segundo plano
 */
export async function refreshDataFromSupabase() {
  try {
    const data = await apiFetchInitialData();
    const { inventoryGames, settings, recentSales } = data;
    
    // Comparación rápida para evitar renders innecesarios
    const hasInventoryChanges = JSON.stringify(inventoryGames) !== JSON.stringify(AppState.inventoryGames);
    const hasSettingsChanges = JSON.stringify(settings) !== JSON.stringify({ 
      exchangeRate: { value: AppState.exchangeRate }, 
      plantillas: AppState.plantillas 
    });

    if (hasInventoryChanges || hasSettingsChanges) {
      console.log("🔄 Datos frescos detectados en Supabase. Aplicando Revalidación...");
      
      // REEMPLAZO TOTAL (Deduplicación Estricta)
      if (inventoryGames) {
        AppState.inventoryGames = sanitizeInventoryDuplicates(inventoryGames);
      }
      
      // También refrescar ventas recientes (si el servidor las provee)
      if (recentSales && recentSales.length > 0) {
        AppState.sales = recentSales;
      }

      if (settings) {
        if (settings.exchangeRate) AppState.exchangeRate = settings.exchangeRate.value;
        if (settings.plantillas) AppState.plantillas = settings.plantillas;
      }

      // Refrescar UI solo si el usuario ya está autenticado y en la pantalla activa
      if (AppState.currentUser) {
        if (typeof updateDashboard === 'function') updateDashboard();
        
        // Importación dinámica para romper dependencia circular con ui/sales.js
        try {
          const { renderCuentasPSN: dynamicRenderCuentasPSN } = await import('../ui/sales.js');
          if (typeof dynamicRenderCuentasPSN === 'function') dynamicRenderCuentasPSN();
        } catch (e) {
          console.error("Error al cargar dinámicamente renderCuentasPSN:", e);
        }

        // Disparamos Lucide para asegurar que los iconos de los nuevos datos se creen
        if (window.lucide) window.lucide.createIcons();
      }
    }
    
    // Auditoría Silenciosa (Mantenimiento)
    if (localStorage.getItem('debug_migration') === 'true') {
       const localCount = Object.keys(AppState.clientsListas || {}).length;
       console.log(`%c[REFRESH] Local: ${localCount} | Supabase (Clients): ${totalClients || 0}`, "color: #39d6f9;");
    }
  } catch (err) {
    console.warn("⏳ Falló el refresco asíncrono (revalidación):", err.message);
  }
}

/**
 * RECONEXIÓN CRÍTICA: Hard Reset del Caché Local
 * Rompe el "Efecto Espejo" vaciando el localStorage y re-hidratando desde la nube.
 */
export async function forceCloudSync() {
  console.warn("🔄 Iniciando Hard Reset de Sincronización Cloud...");
  
  // 1. Vaciar colecciones clave del localStorage
  const itemsToClear = [
    'inventoryGames', 'inventoryCodes', 'paquetes', 'membresias', 
    'sync_queue', 'cangel_erp_v7', 'sales'
  ];
  itemsToClear.forEach(item => localStorage.removeItem(item));

  // 2. Reiniciar AppState en memoria
  AppState.inventoryGames = [];
  AppState.inventoryCodes = [];
  AppState.paquetes = [];
  AppState.membresias = [];
  AppState.sales = [];
  AppState.sync_queue = [];

  // 3. Re-hidratar desde Supabase (Verdad Absoluta)
  try {
    // Forzamos el fetch inicial
    await refreshDataFromSupabase();
    
    // 4. Guardar el nuevo estado limpio localmente
    saveLocal();
    
    console.log("✅ Hard Reset completado. Los datos locales han sido reemplazados por la nube.");
    
    // 5. Actualizar toda la UI
    if (typeof updateDashboard === 'function') updateDashboard();
    update2FABellBadge();
    
    // Disparar render de inventario si la función existe globalmente
    if (window.renderInventoryJuegos) window.renderInventoryJuegos();
    
    return true;
  } catch (err) {
    console.error("❌ Falló la re-hidratación tras Hard Reset:", err);
    return false;
  }
}
