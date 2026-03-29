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
// --- Navegación ---
import { initTabs, switchTab } from './ui/navigation.js';
import { 
  saveLocal, loadLocal, 
  processSyncQueue, refreshDataFromSupabase,
  forceCloudSync 
} from './core/persistence.js';
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
  selectStatusFilter, toggleStatusFilter, toggleDenomFilter, selectDenomFilter, 
  getPaqueteSlots, getMembresiaSlots,
  isValidDuplicateEmail as ui_isValidDuplicateEmail,
  openModalHistorialVentas, closeModalHistorialVentas, isInventoryLow, handleGameAutocomplete, selectGameSuggestion,
  filterByConsole
} from './ui/inventory.js';
import { 
  renderCatalog, removeFromCatalog, addToCartFromCard, addToCart, toggleCart, renderCart, updateCartBadge,
  openCheckout, closeCheckout, confirmCheckout, filterCatalog
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
  showFactura, closeFactura, copyFactura,
  autocompletarCliente,
  openModalPlantillas, closeModalPlantillas, cargarPlantillaSeleccionada,
  actualizarPanelVariables, guardarPlantilla, insertarVariable,
  renderCuentasPSN, updateCuentaPsnStatus, getGameSlots
} from './ui/sales.js';
import {
  fetchClientesPage, changeClientsPage, renderClientHistory, filterClients,
  switchClientTab, renderListas, renderClientsHistoryTable, updatePaginationUI,
  abrirModalCrearLista, confirmarCrearLista, eliminarListaNombrada, 
  asignarClienteALista, guardarLista, abrirModalSorteo
} from './ui/clients.js';
import {
  doLogin, doLogout, applyPermissions, getFirstAllowedTab, recuperarPassword
} from './ui/auth.js';
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
  logEvent, renderBitacoraEventos, switchBitacoraTab, confirmarLimpiezaDatos,
  fetchClientesPage, changeClientsPage, renderClientHistory, filterClients,
  switchClientTab, renderListas, renderClientsHistoryTable, updatePaginationUI,
  abrirModalCrearLista, confirmarCrearLista, eliminarListaNombrada, 
  asignarClienteALista, guardarLista, abrirModalSorteo
};
import { sanitizeInventoryDuplicates } from './utils/sanitizer.js';
/* ============================================================ */
/* ============================================================ */
/* 7. HELPERS & PERSISTENCIA               */
/* ============================================================ */
/* --- Módulo de Persistencia movido a core/persistence.js --- */
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
  forceCloudSync,
  handleHardReset: function() {
    showDeleteConfirmModal(
      "🔄 ¿Deseas realizar una Sincronización Nube?",
      async () => {
        try {
          console.log("🚀 Iniciando Sincronización Forzada...");
          showToast("Limpiando caché local y descargando de la nube...", "info");
          
          const success = await forceCloudSync();
          
          if (success) {
            showToast("Sincronización completa: Los datos locales se han restaurado.", "success");
            
            // Recarga agresiva para asegurar que todos los módulos reflejen el cambio
            setTimeout(() => {
              location.reload();
            }, 1500);
          } else {
            showToast("Error durante la sincronización forzada.", "error");
          }
        } catch (err) {
          console.error("Critical error in handleHardReset:", err);
          showToast("Fallo crítico en el reset de datos.", "error");
        }
      },
      "Confirmación de Reset Cloud",
      "Esta acción vaciará tu almacenamiento local y descargará la 'Verdad Absoluta' directamente de Supabase. ¿Deseas continuar?"
    );
  },
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
  copyFactura,
  autocompletarCliente,
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
  filterByConsole,
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
  toggleStatusFilter,
  toggleDenomFilter,
  selectDenomFilter,
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
  filterCatalog,
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
  renderClientHistory,  // CRM
  filterClients,
  changeClientsPage,
  fetchClientesPage,
  switchClientTab,
  renderListas,
  abrirModalSorteo,
  abrirModalCrearLista,
  confirmarCrearLista,
  eliminarListaNombrada,
  asignarClienteALista,
  guardarLista,
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
  selectGameSuggestion,
  isValidDuplicateEmail: ui_isValidDuplicateEmail,
  closeModalHistorialVentas,
  // UI Helpers (Modales Globales)
  showPremiumAlert,
  showPremiumPrompt,
  showDeleteConfirmModal,
  closePremiumAlert,
  closePremiumPrompt,
  closeDeleteConfirmModal,
  executeDeleteAction,
  showToast,
  // Auth
  doLogin,
  doLogout,
  recuperarPassword,
  applyPermissions
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

// --- Gestor Global de Errores de Imagen ---
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('error', function(e) {
    if (e.target && e.target.tagName === 'IMG') {
      // CORTAFUEGOS: Solo intentamos una vez y ocultamos para evitar dependencia externa
      if (e.target.onerror === null) return; // Evitar disparos múltiples si ya fue procesado
      e.target.onerror = null;
      e.target.style.display = 'none';
    }
  }, true);
}

export default GlobalBridge;
