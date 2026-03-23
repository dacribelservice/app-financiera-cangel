/* ================================================
   CANGEL GAMES ERP - Gestion Integral (V13.0)
   7 Modulos - Roles - Ecommerce - IA & Hosting
   ================================================ */
import { formatCOP, formatUSD, getColombiaTime, calculateMembershipCountdown, formatDaysToMonths } from './utils/formatters.js';
import { 
  isValidDuplicateEmail as val_isValidDuplicateEmail, 
  hasInventoryAvailability as val_hasInventoryAvailability, 
  isInventoryLow as val_isInventoryLow,
  isValidEmail,
  isValidPhoneCO,
  isValidCedula
} from './utils/validators.js';

// --- Estado Global ---
const USE_LOCAL_STORAGE_BACKUP = false; // Feature Flag: Cambiar a true si hay fallos en Supabase
import { AppState } from './core/store.js';
export { AppState };
import { 
  storageSave, storageLoad, 
  apiSync, apiProcessSyncQueue, 
  apiClearCloudData, 
  apiFetchInitialData, apiFetchClientes, apiFetchPSDetails 
} from './services/api.js';
import { 
  switchInvMode, renderInventory, 
  openModalJuego, editGameInventory, closeModalJuego, saveGameInventory, deleteGameInventory, toggleGameStatus, filterInventoryGames, renderInventoryJuegos,
  openModalCodigo, closeModalCodigo, saveCodigoInventory, renderInventoryCodigos, deleteCodigoInventory, filterInventoryCodes,
  openModalXbox, closeXboxModal, saveXboxInventory, renderInventoryXbox, deleteXboxInventory, filterInventoryXbox,
  openModalPhysical, closePhysicalModal, savePhysicalInventory, renderInventoryPhysical, deletePhysicalInventory, filterInventoryPhysical,
  openModalPaquete, closeModalPaquete, savePaqueteInventory, renderInventoryPaquetes, deletePaquete, togglePaqueteStatus, filterInventoryPaquetes,
  openModalMembresia, closeModalMembresia, saveMembresiaInventory, renderInventoryMembresias, deleteMembresia, toggleMembresiaStatus, filterInventoryMembresias,
  selectStatusFilter, getPaqueteSlots, getMembresiaSlots,
  isValidDuplicateEmail as ui_isValidDuplicateEmail
} from './ui/inventory.js';
import { 
  renderCatalog, removeFromCatalog, addToCartFromCard, addToCart, toggleCart, renderCart, updateCartBadge,
  openCheckout, closeCheckout, confirmCheckout
} from './ui/catalog.js';
import { 
  renderGestionUsuarios, openModalUsuario, closeModalUsuario, saveUsuario, toggleEstadoUsuario, toggleAllPermissions, updateChecklistFromRole,
  open2FAModal, closeModal2FA, open2FANotifModal, close2FANotifModal, use2FACode, update2FABellBadge
} from './ui/users.js';
import {
  updateVentasMetrics, llenarFiltroAsesoresVentas, llenarFiltroMesesVentas, limpiarFiltrosVentas,
  switchVentasMode, handleVentasSearchDebounce, getInventoryItemData, renderVentas,
  eliminarPedidoCompleto, anularFactura, anularPedidoCompleto, verDetallesVenta, closeModalDetallesVenta,
  copiarFactura, copiarFacturaConfirmacion,
  handleVentaGameAutocomplete, selectVentaGameSuggestion,
  handleVentaPaqueteAutocomplete, selectVentaPaqueteSuggestion,
  handleVentaMembresiaAutocomplete, selectVentaMembresiaSuggestion,
  handleVentaCodigoAutocomplete, selectVentaCodigoSuggestion,
  handleVentaXboxAutocomplete, selectVentaXboxSuggestion,
  handleVentaPhysicalAutocomplete, selectVentaPhysicalSuggestion,
  openModalVenta, closeModalVenta,
  addVentaGameRow, removeVentaGameRow,
  addVentaPaqueteRow, removeVentaPaqueteRow,
  addVentaMembresiaRow, removeVentaMembresiaRow,
  addVentaXboxRow, removeVentaXboxRow,
  addVentaPhysicalRow, removeVentaPhysicalRow,
  addVentaCodigoRow, removeVentaCodigoRow,
  stepCodigo, updateCodigoRowMax,
  saveVenta as saveVentaDataForm, deleteVenta,
  showFactura, closeFactura,
  autocompletarCliente,
  openModalPlantillas, closeModalPlantillas, cargarPlantillaSeleccionada,
  actualizarPanelVariables, guardarPlantilla, insertarVariable,
  renderCuentasPSN, updateCuentaPsnStatus, getGameSlots
} from './ui/sales.js';
import {
  fetchClientesPage, changeClientsPage, renderClientHistory, filterClients,
  switchClientTab, renderListas, renderClientsHistoryTable, updatePaginationUI
} from './ui/clients.js';
import {
  initAnalytics, renderTopPlataformas, renderRankingAsesores,
  updateInventoryBarChart, updateMonthlyInvestmentChart, updateDashboardCharts
} from './ui/analytics.js';

import { 
  showDeleteConfirmModal, closeDeleteConfirmModal, executeDeleteAction,
  showPremiumAlert, closePremiumAlert, showPremiumPrompt, closePremiumPrompt, showToast 
} from './ui/modals.js';

export {
  showDeleteConfirmModal, closeDeleteConfirmModal, executeDeleteAction,
  showPremiumAlert, closePremiumAlert, showPremiumPrompt, closePremiumPrompt, showToast
};
import {
  updateBalance, calculateBalances, renderExpenses, addExpense,
  eliminarGasto, prepararEdicionGasto, addIngreso, renderIngresos,
  eliminarIngreso, prepararEdicionIngreso, openIdealStockModal,
  closeIdealStockModal, renderIdealStockAudit, downloadAuditExcel,
  updateIdealStockValue, processPDF
} from './ui/balance.js';
import { updateDashboard, renderTop5 } from './ui/dashboard.js';
import { 
  handleExtractAI, renderGameCard, addToCatalogFromAnalysis, 
  addEmptyRow, renderAnalysisTable, editAnalysisImage, 
  updateAnalysisData, deleteAnalysis, updateGlobalTRM 
} from './ui/analysis.js';
import { 
  logEvent, renderBitacoraEventos, switchBitacoraTab, confirmarLimpiezaDatos 
} from './ui/bitacora.js';

export {
  updateBalance, calculateBalances, renderExpenses, addExpense,
  eliminarGasto, prepararEdicionGasto, addIngreso, renderIngresos,
  eliminarIngreso, prepararEdicionIngreso, openIdealStockModal,
  closeIdealStockModal, renderIdealStockAudit, downloadAuditExcel,
  updateIdealStockValue, processPDF, updateDashboard, renderTop5,
  handleExtractAI, renderGameCard, addToCatalogFromAnalysis, 
  addEmptyRow, renderAnalysisTable, editAnalysisImage, 
  updateAnalysisData, deleteAnalysis, updateGlobalTRM,
  logEvent, renderBitacoraEventos, switchBitacoraTab, confirmarLimpiezaDatos
};
import { sanitizeInventoryDuplicates } from './utils/sanitizer.js';
/* ============================================================ */
/* 1. SISTEMA DE LOGIN Y ROLES AVANZADOS   */
/* ============================================================ */
function doLogin() {
  const email = document.getElementById('loginName').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value;
  const remember = document.getElementById('rememberMe').checked;
  if (!email || !pass) {
    document.getElementById('loginError').textContent = 'Ingresa correo y contraseña.';
    return;
  }
  // Validar credenciales
  const user = AppState.users.find(u => u.email.toLowerCase() === email && u.pass === pass && u.activo !== false);
  if (user) {
    AppState.currentUser = user;
    // Guardar o borrar recordatorio
    if (remember) {
      localStorage.setItem('cangel_remembered', JSON.stringify({ email, pass }));
    } else {
      localStorage.removeItem('cangel_remembered');
    }
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    document.getElementById('userBadgeName').textContent = user.nombre;
    applyPermissions();
    // Determine first allowed tab
    const firstTab = getFirstAllowedTab(user);
    if (firstTab) switchTab(firstTab);
    logEvent('LOGIN', 'Inició sesión en el sistema');
    saveLocal();
  } else {
    document.getElementById('loginError').textContent = 'Correo o contraseña incorrectos, o usuario inactivo.';
  }
}
async function recuperarPassword() {
  const email = document.getElementById('loginName').value.trim().toLowerCase();
  if (email === 'cangel.games.soporte@gmail.com') {
    await showPremiumAlert("Acceso", "Se ha enviado un correo de recuperación a cangel.games.soporte@gmail.com con instrucciones.", "info");
  } else {
    await showPremiumAlert("Acceso", "Dile a un administrador que restablezca tu contraseña en el módulo de Bitácora.", "info");
  }
}
function doLogout() {
  if (AppState.currentUser) {
    logEvent('LOGOUT', 'Cerró sesión en el sistema');
  }
  AppState.currentUser = null;
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
  // Limpiar campos
  document.getElementById('loginName').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').textContent = '';
}
function applyPermissions() {
  const user = AppState.currentUser;
  if (!user) return;
  const hasAccesoTotal = user.permisos && user.permisos.acceso_total === true;
  document.querySelectorAll('.browser-tab').forEach(tab => {
    if (hasAccesoTotal) {
      tab.style.display = 'flex';
      return;
    }
    const tabId = tab.getAttribute('data-tab');
    // Mapeo de data-tab a propiedad de permiso
    const permKey = `p_${tabId}_ver`;
    // Verificamos si tiene el permiso específico p_xxx_ver
    if (user.permisos && user.permisos[permKey] === true) {
      tab.style.display = 'flex';
    } else {
      tab.style.display = 'none';
    }
  });
  // --- Permisos Granulares de Botones de Acción ---
  const actionButtonsMapping = {
    'btnNuevaVenta': 'p_ventas_crear',
    'btnAbrirPlantillas': 'p_ventas_crear',
    'btnIngresarJuego': 'p_inventario_crear',
    'btnNuevoPin': 'p_inventario_crear',
    'btnNuevoPaquete': 'p_inventario_crear',
    'btnNuevaMembresia': 'p_inventario_crear'
  };
  Object.entries(actionButtonsMapping).forEach(([buttonId, permKey]) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      if (hasAccesoTotal || (user.permisos && user.permisos[permKey] === true)) {
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
      }
    }
  });
  // Botón de Limpieza (Solo Super Admin)
  const btnLimpiar = document.getElementById('btnLimpiarDatos');
  if (btnLimpiar) {
    btnLimpiar.style.display = (user.email === 'cangel.games.soporte@gmail.com') ? 'flex' : 'none';
  }
}
function getFirstAllowedTab(user) {
  if (!user || !user.permisos) return 'catalogo';
  if (user.permisos.acceso_total) return 'dashboard';
  const ordenTabs = ['dashboard', 'analisis', 'catalogo', 'inventario', 'ventas', 'analytics', 'balance', 'bitacora'];
  for (let tab of ordenTabs) {
    const permKey = `p_${tab}_ver`;
    if (user.permisos[permKey] === true) return tab;
  }
  return 'catalogo'; // Default fallback
}
/* ============================================================ */
/* 1.1 MOTOR DE BITÃCORA (AUDIT LOG)       */
/* ============================================================ */
/* --- Módulo de Bitácora movido a ui/bitacora.js --- */
function initTabs() {
  const tabs = document.querySelectorAll('.browser-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}
function switchTab(tabName) {
  if (!tabName) return;
  AppState.activeTab = tabName;
  // Actualizar Pestañas Superiores
  document.querySelectorAll('.browser-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  // Mostrar Página
  document.querySelectorAll('.page-content').forEach(p => {
    p.classList.remove('active');
  });
  const targetPage = document.getElementById(`page${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  if (targetPage) targetPage.classList.add('active');
  // Triggers de actualización
  if (tabName === 'dashboard') updateDashboard();
  if (tabName === 'analisis') {
    renderAnalysisTable();
    // Sync TRM input value
    const analysisTRM = document.getElementById('analysisExchangeRate');
    if (analysisTRM) analysisTRM.value = AppState.exchangeRate;
  }
  if (tabName === 'catalogo') renderCatalog();
  if (tabName === 'balance') updateBalance();
  if (tabName === 'inventario') renderInventory();
  if (tabName === 'ventas') {
    if (AppState.ventasMode === 'cuentas') renderCuentasPSN();
    else renderVentas();
  }
  if (tabName === 'bitacora') {
    renderBitacoraEventos();
    renderGestionUsuarios();
  }
  if (tabName === 'analytics') initAnalytics();
  if (window.lucide) window.lucide.createIcons();
}

/* --- Módulo de Análisis e IA movido a ui/analysis.js --- */
/* ============================================================ */
/* 4. MÓDULO CATÃLOGO & ECOMMERCE          */
/* ============================================================ */
/* --- Módulo de Catálogo & E-commerce movido a ui/catalog.js --- */









// Global variable para el debounce del panel de ventas
let searchVentasTimeout = null;
// --- AUTOCOMPLETADO DE CLIENTE POR CÉDULA ---
// --- AUTOCOMPLETADO DE CLIENTE POR CÃ‰DULA ---
// --- MODAL HISTORIAL DE VENTAS POR JUEGO ---
export function openModalHistorialVentas(itemId) {
  // Buscar en todos los inventarios posibles
  let item = AppState.inventoryGames.find(g => String(g.id) === String(itemId));
  let itemName = item ? item.juego : '';
  if (!item) {
    item = AppState.paquetes.find(p => String(p.id) === String(itemId));
    itemName = item ? item.nombre : '';
  }
  if (!item) {
    item = AppState.membresias.find(m => String(m.id) === String(itemId));
    itemName = item ? item.tipo : '';
  }
  if (!item) return;
  const modalTitle = document.getElementById('historialVentasTitle');
  const modalContent = document.getElementById('historialVentasContent');
  const overlay = document.getElementById('historialVentasOverlay');
  modalTitle.innerHTML = `<i class="fa-solid fa-chart-line" style="margin-right:10px; color:var(--accent-purple)"></i> Historial de Ventas: <span style="color:var(--accent-cyan)">${itemName}</span>`;
  // Filtrar ventas de este item (ID de inventario)
  const itemSales = AppState.sales.filter(v => String(v.inventoryId) === String(itemId));
  if (itemSales.length === 0) {
    modalContent.innerHTML = `
      <div style="padding: 60px 20px; text-align: center; color: rgba(255,255,255,0.2);">
        <i class="fa-solid fa-receipt" style="font-size: 3.5rem; margin-bottom: 20px; opacity: 0.1;"></i>
        <p style="font-size: 1.1rem; font-weight: 500;">No hay ventas registradas para este ejemplar.</p>
        <p style="font-size: 0.85rem; margin-top: 5px;">Las ventas aparecerán aquí una vez se registren en el módulo de ventas.</p>
      </div>
    `;
  } else {
    // Ordenar por fecha desc
    itemSales.sort((a, b) => {
      const dateA = new Date(a.fecha + ' ' + (a.hora || '00:00'));
      const dateB = new Date(b.fecha + ' ' + (b.hora || '00:00'));
      return dateB - dateA;
    });
    modalContent.innerHTML = `
      <table class="premium-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: rgba(0,0,0,0.3); border-bottom: 2px solid rgba(255,255,255,0.05);">
            <th style="padding: 15px; text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);">FECHA / HORA</th>
            <th style="padding: 15px; text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);">CLIENTE</th>
            <th style="padding: 15px; text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);">TIPO CUENTA</th>
            <th style="padding: 15px; text-align: right; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);">PRECIO VENTA</th>
            <th style="padding: 15px; text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);">VENDEDOR / NOTA</th>
          </tr>
        </thead>
        <tbody>
          ${itemSales.map(v => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
              <td style="padding: 12px 15px; vertical-align: middle;">
                <div style="font-size: 0.85rem; font-weight: 600; color: #fff;">${v.fecha}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted);">${v.hora || '--:--'}</div>
              </td>
              <td style="padding: 12px 15px; vertical-align: middle;">
                <div style="font-size: 0.9rem; font-weight: 700; color: var(--accent-cyan);">${v.nombre_cliente || 'N/A'}</div>
                <div style="font-size: 0.7rem; color: #aaa;">
                  <i class="fa-solid fa-id-card" style="font-size: 0.65rem;"></i> CC: ${v.cedula || '-'} | 
                  <i class="fa-solid fa-phone" style="font-size: 0.65rem;"></i> ${v.celular || '-'}
                </div>
              </td>
              <td style="padding: 12px 15px; vertical-align: middle;">
                <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; background: rgba(157, 0, 255, 0.1); color: var(--accent-purple); border: 1px solid rgba(157, 0, 255, 0.2);">
                  ${v.tipo_cuenta || 'Digital'}
                </span>
              </td>
              <td style="padding: 12px 15px; vertical-align: middle; text-align: right;">
                <div style="font-size: 0.95rem; font-weight: 800; color: var(--accent-green);">${formatCOP(v.venta || 0)}</div>
                <div style="font-size: 0.65rem; color: #666;">${v.pago || '---'}</div>
              </td>
              <td style="padding: 12px 15px; vertical-align: middle;">
                <div style="font-size: 0.8rem; font-weight: 600; color: #fff;">
                  <i class="fa-solid fa-user-tag" style="font-size: 0.7rem; color: #ffcc00; margin-right: 5px;"></i>${v.vendedor || 'SISTEMA'}
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted); font-style: italic; margin-top: 2px;">
                  ${v.nota ? `"${v.nota}"` : '<span style="opacity: 0.3;">Sin observaciones</span>'}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  overlay.classList.add('show');
}
export function closeModalHistorialVentas() {
  document.getElementById('historialVentasOverlay').classList.remove('show');
}
/* ============================================================ */
/* 6. BALANCE & AUDITORÃA PDF              */
/* ============================================================ */

let _pagoMetodoChartInstance = null;
// renderPagoMetodoChart movida a ui/balance.js
// Función processPDF eliminada (se usa la de ui/balance.js)
// Funciones de gastos movidas a ui/balance.js
/* --- Módulo de Balance movido a ui/balance.js --- */
/* ============================================================ */
/* 7. HELPERS & PERSISTENCIA               */
/* ============================================================ */
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
 * Fase 3.2: Procesador de Cola de Sincronización
 * Reintenta enviar datos pendientes si hubo fallos previos.
 */
async function processSyncQueue() {
  await apiProcessSyncQueue();
}
// NOTA: Esta funcionalidad de limpieza es TEMPORAL para fase de desarrollo/pruebas.
// No se incluirá en la versión final de producción.
/* --- Función de Limpieza movida a ui/bitacora.js --- */
function loadLocal() {
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
      { id: 1, nombre: "GOD OF WAR RAGNARÃ–K", precio_ps4: 39.99, precio_ps5: 69.99, image: "https://image.api.playstation.com/vulcan/ap/rnd/202207/1210/4E9HIn9i9n9l9h9e9b9v9.png" },
      { id: 2, nombre: "ELDEN RING", precio_ps4: 49.99, precio_ps5: 59.99, image: "https://image.api.playstation.com/vulcan/ap/rnd/202110/2000/76c4a6b1007fd87a.png" },
      { id: 3, nombre: "SPIDER-MAN 2", precio_ps4: 59.99, precio_ps5: 69.99, image: "https://image.api.playstation.com/vulcan/ap/rnd/202306/1219/602aa422de63443db4c8375e533b664d.png" }
    ];
    AppState.sales = [];
    AppState.inventoryGames = [];
    AppState.inventoryCodes = [];
    AppState.paquetes = [];
    AppState.membresias = [];
  }
  // --- ASEGURAR SUPER ADMIN (CRISTIAN) ---
  if (!AppState.users) AppState.users = [];
  const superAdminExists = AppState.users.find(u => u.email === 'cangel.games.soporte@gmail.com');
  if (!superAdminExists) {
    AppState.users.push({
      id: 'user-super-admin',
      nombre: 'Cristian (Admin)',
      email: 'cangel.games.soporte@gmail.com',
      pass: 'C@ng3lg@m3s',
      rolBase: 'Administrador Principal',
      permisos: { acceso_total: true },
      activo: true,
      inmutable: true
    });
    // Forzamos guardar si se acaba de crear
    setTimeout(() => { saveLocal(); }, 100);
  }
  if (!AppState.auditLog) AppState.auditLog = [];
  // --- AUTO-FILL REMEMBERED DATA ---
  const remembered = localStorage.getItem('cangel_remembered');
  if (remembered) {
    try {
      const { email, pass } = JSON.parse(remembered);
      document.getElementById('loginName').value = email;
      document.getElementById('loginPass').value = pass;
      document.getElementById('rememberMe').checked = true;
    } catch (e) {
      console.error("Error loading remembered login:", e);
    }
  }
}
/**
 * Fase 4.1: Sincronización Inicial (Stale-While-Revalidate)
 * Actualiza el AppState con datos frescos de Supabase en segundo plano.
 */
async function refreshDataFromSupabase() {
  try {
    const { inventoryGames, settings, totalClients } = await apiFetchInitialData();
    // Actualizar AppState silenciosamente con los datos más recientes
    if (inventoryGames && inventoryGames.length > 0) {
      AppState.inventoryGames = inventoryGames;
    }
    if (settings) {
      if (settings.exchangeRate) AppState.exchangeRate = settings.exchangeRate.value;
      if (settings.plantillas) AppState.plantillas = settings.plantillas;
    }
    // Auditoría Silenciosa (Fase 5.1)
    if (localStorage.getItem('debug_migration') === 'true') {
       const localCount = Object.keys(AppState.clientsListas || {}).length;
       console.log(`%c[AUDIT] Local: ${localCount} | Supabase (Clients): ${totalClients || 0}`, "color: #39d6f9; font-weight: bold;");
    }
    // Refrescar UI si el usuario ya está dentro
    if (AppState.currentUser) {
      if (typeof updateDashboard === 'function') updateDashboard();
      if (AppState.activeTab === 'inventario' && typeof renderCuentasPSN === 'function') renderCuentasPSN();
    }
  } catch (err) {
    console.warn("â³ Falló el refresco asíncrono (usando caché local):", err.message);
  }
}
document.addEventListener('DOMContentLoaded', () => {
  loadLocal();
  // Fase 3.2: Iniciar procesador de cola
  processSyncQueue();
  setInterval(processSyncQueue, 120000); // Reintentar cada 2 minutos
  // Fase 4.1: Refresco de datos en segundo plano (Stale-while-revalidate)
  refreshDataFromSupabase();
  // --- SOFT RESET 04/03/2026 v2 ---
  if (!localStorage.getItem('softReset0304b')) {
    AppState.inventoryGames = [];
    AppState.inventoryCodes = [];
    AppState.sales = [];
    AppState.analysis = [];
    saveLocal();
    localStorage.setItem('softReset0304b', 'true');
  }
  // ----------------------------
  initTabs();
  renderCatalog();
  // Initial inventory render and alerts
  renderInventoryJuegos();
  renderInventoryCodigos();
  isInventoryLow();
  calculateBalances();
  updateDashboard();
});
const btnExtractAI = document.getElementById('btnExtractAI');
if (btnExtractAI) btnExtractAI.addEventListener('click', handleExtractAI);
const btnAddRow = document.getElementById('btnAddRow');
if (btnAddRow) btnAddRow.addEventListener('click', addEmptyRow);
const btnAddToCatalog = document.getElementById('btnAddToCatalog');
if (btnAddToCatalog) btnAddToCatalog.addEventListener('click', addToCatalogFromAnalysis);
/* --- ALERTS MODULE --- */
export function isInventoryLow() {
  const badge = document.getElementById('notifBadge');
  const bell = document.getElementById('notifBell');
  if (!badge) return;
  const result = val_isInventoryLow(AppState.inventoryGames);
  if (result.count > 0) {
    badge.innerText = result.count;
    badge.classList.remove('hidden');
    if (bell) bell.style.color = '#ff4757';
  } else {
    badge.innerText = '';
    badge.classList.add('hidden');
    if (bell) bell.style.color = 'var(--text-muted)';
  }
}
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Copiado al portapapeles");
  }).catch(err => {
    console.error('Error al copiar: ', err);
  });
}
// --- Fin de funciones movidas a ui/modals.js ---
// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
  const dropdown = document.getElementById('denomDropdownContainer');
  if (dropdown && !dropdown.contains(e.target)) {
    dropdown.classList.remove('open');
  }
  const statusDrop = document.getElementById('statusDropdownContainer');
  if (statusDrop && !statusDrop.contains(e.target)) {
    statusDrop.classList.remove('open');
  }
  // Cerrar sugerencias de juegos si hace clic fuera
  const gameSuggestions = document.getElementById('gameSuggestions');
  const gameInput = document.getElementById('invJuegoNombre');
  if (gameSuggestions && !gameSuggestions.contains(e.target) && e.target !== gameInput) {
    gameSuggestions.style.display = 'none';
  }
  const ventaSuggestions = document.getElementById('ventaGameSuggestions');
  const ventaInput = document.getElementById('ventaFormJuegoSearch');
  if (ventaSuggestions && !ventaSuggestions.contains(e.target) && e.target !== ventaInput) {
    ventaSuggestions.style.display = 'none';
  }
});
/* ============================================================ */
/* LÓGICA DE AUTOCOMPLETADO (ANÁLISIS -> INVENTARIO) */
/* ============================================================ */
export function handleGameAutocomplete(input) {
  const container = document.getElementById('gameSuggestions');
  const val = input.value.trim().toLowerCase();
  if (!val) {
    container.style.display = 'none';
    return;
  }
  // Obtener nombres únicos de AppState.analysis
  const uniqueNames = [...new Set(AppState.analysis.map(row => row.nombre))].filter(n => n);
  // Filtrar por lo que el usuario escribe
  const matches = uniqueNames.filter(name => name.toLowerCase().includes(val));
  if (matches.length === 0) {
    container.style.display = 'none';
    return;
  }
  // Renderizar sugerencias con diseño premium
  container.innerHTML = matches.map(name => `
    <div class="autocomplete-suggestion" onclick="selectGameSuggestion('${name.replace(/'/g, "\\'")}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-blue)"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></divp>
      <span>${name}</span>
    </div>
  `).join('');
  container.style.display = 'block';
}
function selectGameSuggestion(name) {
  const input = document.getElementById('invJuegoNombre');
  const container = document.getElementById('gameSuggestions');
  input.value = name;
  container.style.display = 'none';
  // Opcional: enfocar el siguiente campo
  document.getElementById('invJuegoCorreo').focus();
}
// --- Fin de funciones movidas a ui/analytics.js ---
/* ============================================================ */
/* SISTEMA DE LISTAS DE CLIENTES            */
/* ============================================================ */
export function abrirModalSorteo() { abrirModalCrearLista(); }
export function abrirModalCrearLista() {
  // Construir el modal dinámico premium
  let overlay = document.getElementById('crearListaOverlay');
  if (overlay) overlay.remove();
  const listas = AppState.listas || [];
  const listaItems = listas.length === 0
    ? '<p style="color:var(--text-muted);font-size:0.82rem;margin:0;">No hay listas creadas aún.</p>'
    : listas.map(l => `
        <div style="display:flex;align-items:center;justify-content:space-between;
             background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
             border-radius:8px;padding:8px 12px;margin-bottom:6px;">
          <span style="font-weight:600;color:#fff;">${l.nombre}</span>
          <button onclick="eliminarListaNombrada('${l.id}')"
            style="background:rgba(255,71,87,0.15);border:1px solid rgba(255,71,87,0.3);
                   border-radius:6px;color:#ff4757;padding:3px 10px;cursor:pointer;font-size:0.78rem;">
            Eliminar
          </button>
        </div>`).join('');
  overlay = document.createElement('div');
  overlay.id = 'crearListaOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);
    z-index:9999;display:flex;align-items:center;justify-content:center;`;
  overlay.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.12);border-radius:18px;
                padding:2rem;width:420px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:1.5rem;">
        <div style="width:48px;height:48px;border-radius:12px;background:rgba(0,198,255,0.15);
             border:1px solid rgba(0,198,255,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i data-lucide="list-plus" style="width:22px;height:22px;color:var(--accent-cyan);"></i>
        </div>
        <div>
          <h3 style="margin:0 0 4px;color:#fff;font-size:1.1rem;">Gestionar Listas</h3>
          <p style="margin:0;color:var(--text-muted);font-size:0.85rem;">Crea listas para organizar tus clientes por categoría.</p>
        </div>
      </div>
      <div style="margin-bottom:1rem;">
        <div style="max-height:180px;overflow-y:auto;margin-bottom:12px;" id="listasExistentes">
          ${listaItems}
        </div>
        <label style="display:block;font-size:0.88rem;color:var(--text-muted);margin-bottom:6px;">Nombre de la nueva lista:</label>
        <input id="inputNuevaLista" type="text" placeholder="Ej: VIP, Espera, Potenciales..."
          style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);
                 border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:#fff;
                 padding:10px 14px;font-size:0.9rem;outline:none;"
          onfocus="this.style.borderColor='var(--accent-cyan)'"
          onblur="this.style.borderColor='rgba(255,255,255,0.15)'"
          onkeydown="if(event.key==='Enter') confirmarCrearLista()">
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:1.5rem;">
        <button onclick="document.getElementById('crearListaOverlay').remove()"
          style="padding:10px 22px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);
                 background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.88rem;">
          Cancelar
        </button>
        <button onclick="confirmarCrearLista()"
          style="padding:10px 24px;border-radius:10px;border:none;
                 background:var(--accent-cyan);color:#000;font-weight:700;
                 cursor:pointer;font-size:0.88rem;letter-spacing:0.5px;">
          ACEPTAR
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => { const inp = document.getElementById('inputNuevaLista'); if (inp) inp.focus(); }, 100);
}
export function confirmarCrearLista() {
  const inp = document.getElementById('inputNuevaLista');
  if (!inp) return;
  const nombre = inp.value.trim();
  if (!nombre) { inp.style.borderColor = '#ff4757'; inp.focus(); return; }
  if (!AppState.listas) AppState.listas = [];
  const existe = AppState.listas.find(l => l.nombre.toLowerCase() === nombre.toLowerCase());
  if (existe) { showToast('Ya existe una lista con ese nombre', 'warning'); return; }
  AppState.listas.push({ id: Date.now().toString(), nombre });
  saveLocal();
  logEvent('Analytics: Lista Creada', `Nombre: ${nombre}`);
  showToast(`✅ Lista "${nombre}" creada`);
  // Actualizar modal sin cerrarlo para poder crear más
  abrirModalCrearLista();
  // Re-renderizar tabla historial para que aparezca en el dropdown
  if (window._clientsHistoryStaticData) renderClientsHistoryTable(window._clientsHistoryStaticData);
}
export function eliminarListaNombrada(listaId) {
  if (!AppState.listas) return;
  const lista = AppState.listas.find(l => l.id === listaId);
  if (!lista) return;
  AppState.listas = AppState.listas.filter(l => l.id !== listaId);
  // Quitar clientes asignados a esa lista
  if (AppState.clientsListas) {
    Object.keys(AppState.clientsListas).forEach(k => {
      if (AppState.clientsListas[k] === listaId) delete AppState.clientsListas[k];
    });
  }
  saveLocal();
  logEvent('Analytics: Lista Eliminada', `Nombre: ${lista.nombre}`);
  showToast(`Lista "${lista.nombre}" eliminada`, 'info');
  abrirModalCrearLista();
  if (window._clientsHistoryStaticData) renderClientsHistoryTable(window._clientsHistoryStaticData);
}
export function asignarClienteALista(nombreKey, listaId) {
  if (!AppState.clientsListas) AppState.clientsListas = {};
  if (listaId) {
    AppState.clientsListas[nombreKey] = listaId;
  } else {
    delete AppState.clientsListas[nombreKey];
  }
  // Sincronización retroactiva: actualizar ventas existentes del cliente
  if (AppState.sales && AppState.sales.length > 0) {
    AppState.sales.forEach(v => {
      if ((v.nombre_cliente || '').toLowerCase() === nombreKey) {
        v.lista = listaId;
      }
    });
  }
  saveLocal();
}
function guardarLista(nombreKey, valor) {
  if (!AppState.clientsListas) AppState.clientsListas = {};
  AppState.clientsListas[nombreKey] = valor.trim();
  saveLocal();
}
/* ============================================================ */
/* 25. BITÁCORA Y GESTIÓN DE USUARIOS      */
/* ============================================================ */
/* --- Módulo de Bitácora (Render & Tabs) movido a ui/bitacora.js --- */
/* --- Módulo de Gestión de Usuarios y 2FA movido a ui/users.js --- */

/* ============================================================ */
/* 2FA CODES MANAGEMENT SYSTEM             */
/* ============================================================ */

/* --- LÓGICA DE NOTIFICACIONES 2FA (POCOS CÓDIGOS) --- */


// ================================================
// BRIDGE GLOBAL (FASE 1.2 - REFORZADO)
// Exponer funciones críticas al objeto window para 
// mantener compatibilidad con eventos inline del HTML
// ================================================
const GlobalBridge = {
  // Navegación y Sesión
  switchTab,
  doLogin,
  doLogout,
  recuperarPassword,
  updateDashboard,
  renderTop5,
  // Ventas (Modal y Filas)
  openModalVenta,
  closeModalVenta,
  addVentaGameRow,
  addVentaPaqueteRow,
  addVentaMembresiaRow,
  addVentaCodigoRow,
  addVentaXboxRow,
  addVentaPhysicalRow,
  removeVentaGameRow,
  removeVentaPaqueteRow,
  removeVentaMembresiaRow,
  removeVentaCodigoRow,
  removeVentaXboxRow,
  removeVentaPhysicalRow,
  // Ventas (Lógica y Acciones)
  saveVentaDataForm,
  anularPedidoCompleto,
  eliminarPedidoCompleto,
  anularFactura,
  renderVentas,
  limpiarFiltrosVentas,
  deleteVenta,
  closeModalDetallesVenta,
  closeModalHistorialVentas,
  handleVentasSearchDebounce,
  switchVentasMode,
  renderCuentasPSN,
  updateCuentaPsnStatus,
  copiarFactura,
  copiarFacturaConfirmacion,
  verDetallesVenta,
  showFactura,
  closeFactura,
  handleVentaGameAutocomplete,
  selectVentaGameSuggestion,
  handleVentaPaqueteAutocomplete,
  selectVentaPaqueteSuggestion,
  handleVentaMembresiaAutocomplete,
  selectVentaMembresiaSuggestion,
  handleVentaCodigoAutocomplete,
  selectVentaCodigoSuggestion,
  handleVentaXboxAutocomplete,
  selectVentaXboxSuggestion,
  handleVentaPhysicalAutocomplete,
  selectVentaPhysicalSuggestion,
  selectGameSuggestion,
  // Inventario
  openModalJuego,
  closeModalJuego,
  saveGameInventory,
  openModalCodigo,
  closeModalCodigo,
  saveCodigoInventory,
  openModalPaquete,
  closeModalPaquete,
  savePaqueteInventory,
  openModalMembresia,
  closeModalMembresia,
  saveMembresiaInventory,
  renderInventoryJuegos,
  editGameInventory,
  openModalHistorialVentas,
  // renderCuentasPSN declarada anteriormente, eliminamos duplicado aquí
  toggleGameStatus,
  deleteGameInventory,
  deletePaquete,
  deleteMembresia,
  deleteCodigoInventory,
  filterInventoryGames,
  filterInventoryCodes,
  filterInventoryXbox,
  filterInventoryPhysical,
  filterInventoryPaquetes,
  filterInventoryMembresias,
  renderInventoryXbox,
  renderInventoryPhysical,
  renderInventoryCodigos,
  renderInventoryPaquetes,
  renderInventoryMembresias,
  togglePaqueteStatus,
  toggleMembresiaStatus,
  switchInvMode,
  selectStatusFilter,
  openModalXbox,
  closeXboxModal,
  saveXboxInventory,
  deleteXboxInventory,
  openModalPhysical,
  closePhysicalModal,
  savePhysicalInventory,
  deletePhysicalInventory,
  // Catálogo y Carrito
  renderCatalog,
  removeFromCatalog,
  addToCartFromCard,
  addToCart,
  toggleCart,
  renderCart,
  updateCartBadge,
  openCheckout,
  closeCheckout,
  confirmCheckout,
  // Balance y Gastos
  updateBalance,
  addExpense,
  renderExpenses,
  eliminarGasto,
  prepararEdicionGasto,
  addIngreso,
  renderIngresos,
  eliminarIngreso,
  prepararEdicionIngreso,
  // Bitácora
  // Bitácora
  logEvent,
  switchBitacoraTab,
  renderBitacoraEventos,
  confirmarLimpiezaDatos,
  deleteAnalysis,
  handleExtractAI,
  renderGameCard,
  addToCatalogFromAnalysis,
  addEmptyRow,
  renderAnalysisTable,
  editAnalysisImage,
  updateAnalysisData,
  updateGlobalTRM,
  // Analytics y Clientes
  initAnalytics,
  renderTopPlataformas,
  renderRankingAsesores,
  renderClientHistory,
  filterClients,
  changeClientsPage,
  fetchClientesPage,
  switchClientTab,
  renderListas,
  asignarClienteALista,
  guardarLista,
  autocompletarCliente,
  abrirModalSorteo,
  abrirModalCrearLista,
  confirmarCrearLista,
  eliminarListaNombrada,
  // Plantillas
  openModalPlantillas,
  closeModalPlantillas,
  insertarVariable,
  guardarPlantilla,
  cargarPlantillaSeleccionada,
  actualizarPanelVariables,
  // Gestión de Usuarios y Otros
  renderGestionUsuarios,
  openModalUsuario,
  closeModalUsuario,
  saveUsuario,
  toggleEstadoUsuario,
  toggleAllPermissions,
  updateChecklistFromRole,
  open2FAModal,
  closeModal2FA,
  open2FANotifModal,
  close2FANotifModal,
  use2FACode,
  update2FABellBadge,
  showToast,
  updateIdealStockValue,
  calculateBalances,
  openIdealStockModal,
  closeIdealStockModal,
  renderIdealStockAudit,
  downloadAuditExcel,
  processPDF,
  handleGameAutocomplete,
  isValidDuplicateEmail: ui_isValidDuplicateEmail,
  // UI Helpers (Modales Globales)
  showPremiumAlert,
  showPremiumPrompt,
  showDeleteConfirmModal,
  closePremiumAlert,
  closePremiumPrompt,
  closeDeleteConfirmModal,
  executeDeleteAction
};
// Exponer al objeto global window individualmente para acceso directo desde HTML
Object.keys(GlobalBridge).forEach(key => {
  if (typeof GlobalBridge[key] !== 'undefined') {
    window[key] = GlobalBridge[key];
  } else {
    console.warn(`[Bridge Global] Intento de exponer funcin inexistente: ${key}`);
  }
});
// También exponer el objeto 'app' por si se usa esa nomenclatura
window.app = GlobalBridge;
export default GlobalBridge;
