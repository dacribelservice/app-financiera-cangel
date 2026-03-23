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

export {
  updateBalance, calculateBalances, renderExpenses, addExpense,
  eliminarGasto, prepararEdicionGasto, addIngreso, renderIngresos,
  eliminarIngreso, prepararEdicionIngreso, openIdealStockModal,
  closeIdealStockModal, renderIdealStockAudit, downloadAuditExcel,
  updateIdealStockValue, processPDF
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
export function logEvent(accion, detalles) {
  const user = AppState.currentUser;
  const userName = user ? user.nombre : 'Sistema';
  const now = new Date();
  // Usar formato 24h para facilitar ordenamiento y claridad
  const formattedTime = now.toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const formattedDate = now.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const logEntry = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    fechaHora: `${formattedTime} | ${formattedDate}`,
    usuarioNombre: userName,
    accion: accion,
    detalles: detalles,
    timestamp: now.getTime()
  };
  AppState.auditLog.unshift(logEntry);
  // Persistencia automática
  saveLocal();
}
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
/* ============================================================ */
/* 2. DASHBOARD & KPIS                     */
/* ============================================================ */
export function updateDashboard() {
  const ingresos = AppState.sales
    .filter(v => !v.esta_anulada)
    .reduce((sum, v) => sum + (parseFloat(v.venta) || parseFloat(v.precio) || 0), 0);
  // Todo sumado en COP
  const costosJuegos = AppState.inventoryGames.reduce((sum, g) => sum + (parseFloat(g.costoCop) || 0), 0);
  const costosCodes = AppState.inventoryCodes.reduce((sum, c) => sum + (parseFloat(c.costoCop) || 0), 0);
  const costosPaquetes = AppState.paquetes.reduce((sum, p) => sum + (parseFloat(p.costoCop) || 0), 0);
  const costosMembresias = AppState.membresias.reduce((sum, m) => sum + (parseFloat(m.costoCop) || 0), 0);
  const gastosExtras = AppState.expenses.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
  const costos = costosJuegos + costosCodes + costosPaquetes + costosMembresias;
  const neta = ingresos - (costos + gastosExtras);
  const kpiIngresos = document.getElementById('kpiIngresos');
  const kpiGanancia = document.getElementById('kpiGanancia');
  kpiIngresos.textContent = `$${ingresos.toLocaleString('es-CO')}`;
  kpiIngresos.classList.add('kpi-glow');
  document.getElementById('kpiCostos').textContent = `$${(costos + gastosExtras).toLocaleString('es-CO')}`;
  // Desglose
  const elCostosJuegos = document.getElementById('kpiCostosJuegos');
  if (elCostosJuegos) elCostosJuegos.textContent = `$${costosJuegos.toLocaleString('es-CO')}`;
  const elCostosPaquetes = document.getElementById('kpiCostosPaquetes');
  if (elCostosPaquetes) elCostosPaquetes.textContent = `$${costosPaquetes.toLocaleString('es-CO')}`;
  const elCostosMembresias = document.getElementById('kpiCostosMembresias');
  if (elCostosMembresias) elCostosMembresias.textContent = `$${costosMembresias.toLocaleString('es-CO')}`;
  const elCostosCodigos = document.getElementById('kpiCostosCodigos');
  if (elCostosCodigos) elCostosCodigos.textContent = `$${costosCodes.toLocaleString('es-CO')}`;
  const elGastosExtras = document.getElementById('kpiGastosExtras');
  if (elGastosExtras) elGastosExtras.textContent = `$${gastosExtras.toLocaleString('es-CO')}`;
  kpiGanancia.textContent = `$${neta.toLocaleString('es-CO')}`;
  kpiGanancia.classList.add('kpi-glow');
  document.getElementById('kpiJuegos').textContent = AppState.catalog.length;
  // Actualizar Socios (Removido según solicitud)
  renderTop5();
  updateDashboardCharts();
  if (typeof renderClientHistory === 'function') {
    renderClientHistory();
  }
}
function renderTop5() {
  const container = document.getElementById('topGamesList');
  if (!container) return;
  const counts = {};
  AppState.sales.forEach(v => {
    // Omitir anuladas y registros parciales de co-ventas para no duplicar el contador de productos
    if (v.esta_anulada || v.isPartiallyPaid) return; 
    counts[v.juego] = (counts[v.juego] || 0) + 1;
  });
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (sorted.length === 0) {
    container.innerHTML = '<div class="stat-item"><p style="color:var(--text-muted); font-size:0.8rem">Esperando ventas...</p></div>';
    return;
  }
  const maxVal = sorted[0]?.[1] || 1;
  container.innerHTML = '';
  sorted.forEach(([name, count], i) => {
    const pct = (count / maxVal) * 100;
    const item = document.createElement('div');
    item.className = 'stat-item';
    item.innerHTML = `
      <div class="stat-header">
        <span>${i + 1}. ${name}</span>
        <span>${count} vtas</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${pct}%"></div>
      </div>
    `;
    container.appendChild(item);
  });
}
/* ============================================================ */
/* 3. MÓDULO ANÃLISIS (PS STORE)           */
/* ============================================================ */
async function handleExtractAI() {
  const url = document.getElementById('urlAI').value.trim();
  if (!url) return;
  const status = document.getElementById('extractStatus');
  status.innerHTML = `<span class="status-loading"></span> Extrayendo con IA (Gemini)...`;
  try {
    const data = await apiFetchPSDetails(url);
    console.log('[IA-Extract] Raw Data:', data);
    if (data.error) throw new Error(data.error);
    if (!data.title) throw new Error('No se pudo extraer el título del juego');
    // Normalizar datos de IA para que coincidan con la estructura de la aplicación
    const normalizedData = {
      nombre: data.title || 'Juego Desconocido',
      imagen: data.image_url || '',
      precioBase: parseFloat((data.base_price || "0").replace(/[^\d.]/g, '')),
      precioSale: parseFloat((data.discount_price || data.base_price || "0").replace(/[^\d.]/g, '')),
      ps4: data.ps4 !== undefined ? data.ps4 : true,
      ps5: data.ps5 !== undefined ? data.ps5 : true,
      raw: data
    };
    processExtractionResult(normalizedData, url);
    renderGameCard(data);
    status.innerHTML = `<span style="color:var(--accent-cyan)">âœ¨ Completado (IA)</span>`;
  } catch (e) {
    console.error('[IA-Error]', e);
    status.innerHTML = `<span style="color:var(--accent-red)">âœ— Error: ${e.message}</span>`;
  }
}
function processExtractionResult(data, url) {
  const existingIndex = AppState.analysis.findIndex(a => a.nombre === data.nombre);
  const actualSale = (data.precioSale && data.precioSale > 0) ? data.precioSale : data.precioBase;
  const isNew = existingIndex < 0;
  const oldItem = !isNew ? AppState.analysis[existingIndex] : null;
  // Calculamos la compra: 1. Inventario histórico, 2. Valor previo, 3. Precio Sale actual
  let compVal = actualSale;
  if (!isNew && oldItem.compra > 0) compVal = oldItem.compra;
  // Buscar si hay algo más barato en inventario ahora mismo
  const inventoryMinPrices = {};
  (AppState.inventoryGames || []).forEach(g => {
    const title = (g.juego || '').toUpperCase().trim();
    const price = parseFloat(g.costoUsd);
    if (!isNaN(price) && title) {
      if (!inventoryMinPrices[title] || price < inventoryMinPrices[title]) {
        inventoryMinPrices[title] = price;
      }
    }
  });
  const titleMatch = (data.nombre || '').toUpperCase().trim();
  if (inventoryMinPrices[titleMatch] !== undefined) compVal = inventoryMinPrices[titleMatch];
  const costVal = Math.round(compVal * AppState.exchangeRate);
  const v4Val = !isNew ? oldItem.venta4 : 0;
  const pMinVal = v4Val > 0 ? Math.round(costVal / v4Val) : 0;
  const psnVal = Math.round(actualSale * AppState.exchangeRate);
  const analysisItem = {
    id: !isNew ? oldItem.id : Date.now(),
    url: url,
    image: data.imagen || 'https://via.placeholder.com/150',
    nombre: data.nombre,
    precioBase: data.precioBase || 0,
    sale: actualSale || 0,
    ps4: data.ps4 !== undefined ? data.ps4 : true,
    ps5: data.ps5 !== undefined ? data.ps5 : true,
    compra: compVal,
    costo: costVal,
    venta4: v4Val,
    pMinimo: pMinVal,
    ps4Price: !isNew ? oldItem.ps4Price : 0,
    ps5Price: !isNew ? oldItem.ps5Price : 0,
    psnUsd: psnVal,
    color: !isNew ? oldItem.color : '-'
  };
  if (!isNew) AppState.analysis[existingIndex] = analysisItem;
  else AppState.analysis.unshift(analysisItem);
  renderAnalysisTable();
  saveLocal();
}
function renderGameCard(data, size = 'medium') {
  const container = document.getElementById('extractionCardContainer');
  if (!container) return;
  const isXS = size === 'xs';
  const isSmall = size === 'small';
  const isMedium = size === 'medium';
  // Ahorro
  const savingsHtml = data.discount_percentage
    ? `<span style="color:#10b981; font-size:${isXS ? '0.6rem' : '0.8rem'}; font-weight:800; background:rgba(16,185,129,0.1); padding:2px 6px; border-radius:4px;">
        -${data.discount_percentage.replace(/[^0-9]/g, '')}%
       </span>`
    : '';
  // Versiones
  const limit = isXS ? 0 : (isSmall ? 2 : 4);
  const versionsHtml = data.versions && limit > 0 ? data.versions.slice(0, limit).map(v => `
    <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:rgba(255,255,255,0.4); border-bottom:1px solid rgba(255,255,255,0.03);">
      <span>${v.name.length > (isSmall ? 20 : 40) ? v.name.substring(0, isSmall ? 20 : 40) + '...' : v.name}</span>
      <span style="color:#fff; font-weight:600;">${v.price}</span>
    </div>
  `).join('') : '';
  // Layout Dinámico
  let cardStyle = `background:#0f172a; border:1px solid rgba(255,255,255,0.1); border-radius:12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-family:'Inter',sans-serif; position:relative; overflow:hidden; transition: all 0.2s ease;`;
  if (isXS) {
    cardStyle += `display:flex; align-items:center; gap:10px; padding:8px 12px; max-width:320px;`;
  } else if (isSmall) {
    cardStyle += `display:grid; grid-template-columns:80px 1fr; gap:15px; padding:15px; max-width:400px;`;
  } else {
    cardStyle += `display:flex; flex-direction:column; gap:12px; padding:20px; max-width:480px;`;
  }
  container.innerHTML = `
    <div class="card-premium-ai" style="${cardStyle}">
      <img src="${data.image_url || 'https://via.placeholder.com/80'}" 
           style="width:${isXS ? '35px' : (isSmall ? '80px' : '100%')}; height:${isXS ? '35px' : (isSmall ? '80px' : '150px')}; border-radius:8px; object-fit:cover; flex-shrink:0;">
      <div style="flex:1; min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h2 style="color:#fff; font-size:${isXS ? '0.85rem' : '1.1rem'}; margin:0; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.title || 'Juego'}</h2>
          ${!isMedium ? savingsHtml : ''}
        </div>
        ${isMedium ? `<p style="color:var(--accent-cyan); font-size:0.8rem; margin:2px 0; font-weight:700;">${data.publisher || 'Publisher'}</p>` : ''}
        <!-- Etiquetas de Versión -->
        <div style="display: flex; gap: 6px; margin: 8px 0;">
          ${data.ps4 && data.ps5 ?
      `<span style="background:rgba(0,112,204,0.15); color:#00a3ff; padding:2px 10px; border-radius:6px; font-size:0.65rem; font-weight:900; border:1px solid rgba(0,163,255,0.3); text-transform:uppercase; letter-spacing:0.5px;">PS4 | PS5</span>` :
      data.ps5 ?
        `<span style="background:rgba(255,255,255,0.1); color:#fff; padding:2px 10px; border-radius:6px; font-size:0.65rem; font-weight:900; border:1px solid rgba(255,255,255,0.2); text-transform:uppercase; letter-spacing:0.5px;">PS5 Only</span>` :
        data.ps4 ?
          `<span style="background:rgba(0,112,204,0.1); color:rgba(255,255,255,0.8); padding:2px 10px; border-radius:6px; font-size:0.65rem; font-weight:900; border:1px solid rgba(255,255,255,0.2); text-transform:uppercase; letter-spacing:0.5px;">PS4 Only</span>` : ''
    }
        </div>
        <div style="display:flex; align-items:baseline; gap:8px; margin-top:${isXS ? '0' : '4px'};">
          <span style="color:#fff; font-size:${isXS ? '1rem' : '1.6rem'}; font-weight:900;">${data.discount_price || data.base_price || '---'}</span>
          ${isMedium && data.discount_price && data.base_price !== data.discount_price ? `<span style="color:rgba(255,255,255,0.2); text-decoration:line-through; font-size:1rem;">${data.base_price}</span>` : ''}
          ${isMedium ? savingsHtml : ''}
        </div>
        ${!isXS && versionsHtml ? `<div style="margin-top:5px; border-top:1px solid rgba(255,255,255,0.05);">${versionsHtml}</div>` : ''}
      </div>
    </div>
  `;
  AppState.lastAIExtract = data;
}
async function addToCatalogFromAnalysis() {
  if (AppState.analysis.length === 0) {
    await showPremiumAlert('Catálogo', 'No hay datos para agregar', 'info');
    return;
  }
  const tbody = document.getElementById('tableBody');
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');
    const item = AppState.analysis[index];
    // Extraer valores editables de la tabla (Precio Compra, Venta, etc)
    // Nota: Las celdas son: 0:enlace, 1:img, 2:nombre, 3:base, 4:sale, 5:compra, 6:costo...
    const precioComp = parseFloat(cells[5].textContent.replace('$', '')) || 0;
    const precioVentaPS4 = parseFloat(cells[9].textContent.replace('$', '')) || 0;
    const precioVentaPS5 = parseFloat(cells[10].textContent.replace('$', '')) || 0;
    // Buscar si el juego ya existe en el catálogo para actualizar precios
    const catalogIndex = AppState.catalog.findIndex(c => c.nombre.trim().toLowerCase() === item.nombre.trim().toLowerCase());
    if (catalogIndex >= 0) {
      // Actualizar precios existentes
      AppState.catalog[catalogIndex].precio_ps4 = precioVentaPS4 || item.sale;
      AppState.catalog[catalogIndex].precio_ps5 = precioVentaPS5 || item.sale;
      AppState.catalog[catalogIndex].image = item.image; // Actualizar imagen también
    } else {
      // Añadir nuevo
      AppState.catalog.push({
        id: Date.now() + index,
        nombre: item.nombre,
        precio_ps4: precioVentaPS4 || item.sale,
        precio_ps5: precioVentaPS5 || item.sale,
        image: item.image
      });
    }
  });
  // Comentado para no borrar los datos del análisis, dejarlos ahí para actualización manual
  // AppState.analysis = [];
  renderAnalysisTable();
  renderCatalog();
  saveLocal();
  await showPremiumAlert("Catálogo", "Juegos agregados/actualizados en el catálogo correctamente", "success");
}
function addEmptyRow() {
  AppState.analysis.unshift({
    id: Date.now(),
    image: 'https://via.placeholder.com/150',
    nombre: 'Nuevo Juego',
    precioBase: 0,
    sale: 0,
    ps4: true,
    ps5: true,
    compra: 0,
    costo: 0,
    venta4: 0,
    pMinimo: 0,
    ps4Price: 0,
    ps5Price: 0,
    psnUsd: 0,
    color: '-'
  });
  renderAnalysisTable();
  saveLocal();
}
export function renderAnalysisTable() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const formatterCOP = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  });
  // 1. Calcular precios mínimos del inventario para cruzar datos
  const inventoryMinPrices = {};
  (AppState.inventoryGames || []).forEach(g => {
    const title = (g.juego || '').toUpperCase().trim();
    const price = parseFloat(g.costoUsd);
    if (!isNaN(price) && title) {
      if (!inventoryMinPrices[title] || price < inventoryMinPrices[title]) {
        inventoryMinPrices[title] = price;
      }
    }
  });
  // Definir orden de colores: Sin Color -> Verde -> Amarillo -> Rojo
  const colorOrder = { '-': 0, 'Verde': 1, 'Amarillo': 2, 'Rojo': 3 };
  // Ordenar AppState.analysis antes de renderizar
  AppState.analysis.sort((a, b) => {
    const valA = colorOrder[a.color] || 0;
    const valB = colorOrder[b.color] || 0;
    return valA - valB;
  });
  AppState.analysis.forEach((row, i) => {
    const tr = document.createElement('tr');
    // Asignar clase de color pastel si aplica
    if (row.color === 'Verde') tr.classList.add('row-pastel-verde');
    else if (row.color === 'Amarillo') tr.classList.add('row-pastel-amarillo');
    else if (row.color === 'Rojo') tr.classList.add('row-pastel-rojo');
    // Buscar precio mínimo histórico en inventario para este nombre
    const titleMatch = (row.nombre || '').toUpperCase().trim();
    const historicoInv = inventoryMinPrices[titleMatch];
    // Sincronización PROFUNDA: Siempre asegurar que Costo = Compra * Divisa
    if (historicoInv !== undefined) {
      row.compra = historicoInv;
    }
    // Forzamos el recálculo SIEMPRE para evitar el efecto "congelado"
    row.costo = Math.round((row.compra || 0) * AppState.exchangeRate);
    // Recalcular P. Mínimo también para que sea consistente
    const numVentas = parseFloat(row.venta4) || 0;
    row.pMinimo = numVentas > 0 ? Math.round(row.costo / numVentas) : 0;
    const valorCompraVisual = row.compra || 0;
    tr.innerHTML = `
      <td class="row-number-header">${i + 1}</td>
      <td class="img-cell">
        <div class="analysis-img-container">
          <img src="${row.image}" width="32" height="32" id="img-analysis-${row.id}">
          <button class="btn-edit-img" onclick="editAnalysisImage(${row.id})">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
        </div>
      </td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'nombre', this.innerText)">${row.nombre}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'precioBase', this.innerText)">$${row.precioBase}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'sale', this.innerText)" style="color:var(--accent-green)">$${row.sale}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'compra', this.innerText)" style="color: ${historicoInv !== undefined ? 'var(--accent-cyan)' : 'inherit'} font-weight: ${historicoInv !== undefined ? 'bold' : 'normal'}">$${valorCompraVisual}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'costo', this.innerText)">${formatterCOP.format(row.costo || 0)}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'venta4', this.innerText)">${row.venta4 || 0}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'pMinimo', this.innerText)">${formatterCOP.format(row.pMinimo || 0)}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'ps4Price', this.innerText)" class="${row.ps4 ? '' : 'version-x'}">
        ${row.ps4 ? '<i data-lucide="check-circle" style="color:var(--accent-green); width:14px; height:14px;"></i> ' + formatterCOP.format(row.ps4Price || 0) : '<i data-lucide="x-circle" style="color:var(--accent-red); width:14px; height:14px;"></i>'}
      </td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'ps5Price', this.innerText)" class="${(row.ps5 || row.ps4) ? '' : 'version-x'}">
        ${(row.ps5 || row.ps4) ? '<i data-lucide="check-circle" style="color:var(--accent-green); width:14px; height:14px;"></i> ' + formatterCOP.format(row.ps5Price || 0) : '<i data-lucide="x-circle" style="color:var(--accent-red); width:14px; height:14px;"></i>'}
      </td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'psnUsd', this.innerText)">${formatterCOP.format(row.psnUsd || 0)}</td>
      <td>
        <select class="color-select-premium" onchange="updateAnalysisData(${row.id}, 'color', this.value)">
          <option value="-" ${(!row.color || row.color === '-') ? 'selected' : ''}>-</option>
          <option value="Verde" ${row.color === 'Verde' ? 'selected' : ''}>Verde</option>
          <option value="Amarillo" ${row.color === 'Amarillo' ? 'selected' : ''}>Amarillo</option>
          <option value="Rojo" ${row.color === 'Rojo' ? 'selected' : ''}>Rojo</option>
        </select>
      </td>
      <td><button class="btn-icon-only" onclick="deleteAnalysis(${row.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button></td>
    `;
    tbody.appendChild(tr);
  });
}
async function editAnalysisImage(id) {
  const url = await showPremiumPrompt('Imagen del Juego', 'Pega el enlace de la imagen a continuación:', 'URL de la Imagen:');
  if (url) {
    const item = AppState.analysis.find(a => a.id === id);
    if (item) {
      item.image = url;
      renderAnalysisTable();
      saveLocal();
    }
  }
}
function updateAnalysisData(id, field, val) {
  const item = AppState.analysis.find(a => a.id === id);
  if (item) {
    let cleanVal = val.replace(/[^\d.]/g, '').trim();
    const numericFields = ['precioBase', 'sale', 'compra', 'costo', 'venta4', 'pMinimo', 'ps4Price', 'ps5Price', 'psnUsd'];
    const oldVal = item[field]; // Para auditoría
    if (numericFields.includes(field)) {
      let numVal = parseFloat(cleanVal) || 0;
      if (['venta4'].includes(field)) numVal = Math.round(numVal);
      item[field] = numVal;
      // RECALCULAR DEPENDENCIAS
      if (field === 'compra' || item.costo === 0) {
        item.costo = Math.round(item.compra * AppState.exchangeRate);
      }
      if (field === 'sale' || item.psnUsd === 0) {
        item.psnUsd = Math.round(item.sale * AppState.exchangeRate);
      }
      if (['compra', 'costo', 'venta4'].includes(field) || item.pMinimo === 0) {
        const numVentas = parseFloat(item.venta4) || 0;
        item.pMinimo = numVentas > 0 ? Math.round(item.costo / numVentas) : 0;
      }
    } else {
      item[field] = val;
    }
    if (typeof logEvent === 'function') {
      logEvent('Catálogo: Análisis Modificado', `Juego: ${item.nombre} (ID: ${id}) | Campo: ${field} | Valor: ${val}`);
    }
    renderAnalysisTable();
    saveLocal();
  }
}
function deleteAnalysis(id) {
  showDeleteConfirmModal("¿Estás seguro de que deseas eliminar este análisis?", () => {
    const aToDelete = AppState.analysis.find(a => a.id === id);
    if (aToDelete && typeof logEvent === 'function') {
      logEvent('Catálogo: Análisis Eliminado', `ID: ${id} | Juego: ${aToDelete.nombre}`);
    }
    AppState.analysis = AppState.analysis.filter(a => a.id !== id);
    renderAnalysisTable();
    saveLocal();
    if (typeof showToast === 'function') showToast("Registro de análisis eliminado", "info");
  });
}
// -€-€-€-€-€ Sincronización Global de TRM -€-€-€-€-€
function updateGlobalTRM(val) {
  const trm = parseFloat(val) || 0;
  AppState.exchangeRate = trm;
  // Sync all TRM inputs in the app
  const inputs = ['exchangeRate', 'analysisExchangeRate'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = trm;
  });
  // Recalcular automáticamente todos los costos, precios mínimos y PSN en la tabla de análisis
  AppState.analysis.forEach(item => {
    item.costo = Math.round((item.compra || 0) * trm);
    const numVentas = parseFloat(item.venta4) || 0;
    item.pMinimo = numVentas > 0 ? Math.round(item.costo / numVentas) : 0;
    item.psnUsd = Math.round((item.sale || 0) * trm);
  });
  // Re-render components that depend on TRM
  if (AppState.activeTab === 'dashboard') updateDashboard();
  if (AppState.activeTab === 'analisis') renderAnalysisTable();
}
/* ============================================================ */
/* 4. MÓDULO CATÃLOGO & ECOMMERCE          */
/* ============================================================ */
function renderCatalog() {
  const grid = document.getElementById('catalogGrid');
  grid.innerHTML = '';
  AppState.catalog.forEach(game => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <div class="game-img-container">
        <img src="${game.image}" class="game-img" alt="${game.nombre}">
        ${game.sale < game.precioBase ? '<span class="game-badge">OFERTA</span>' : ''}
      </div>
      <div class="game-info">
        <h3 class="game-title">${game.nombre}</h3>
        <select class="consola-select" id="consola-${game.id}">
          <option value="PS4">PS4</option>
          <option value="PS5">PS5</option>
        </select>
        <div class="game-pricing-row">
          <span>PS4 <strong>$${Math.round(game.precio_ps4)}</strong></span>
          <span class="price-separator">/</span>
          <span>PS5 <strong>$${Math.round(game.precio_ps5)}</strong></span>
        </div>
        <button class="btn-add-cart-premium" onclick="addToCartFromCard(${game.id})">
          Añadir al carrito
        </button>
        ${AppState.currentUser?.role === 'admin' ? `
          <button class="btn-delete-game-abs" onclick="removeFromCatalog(${game.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        ` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}
function removeFromCatalog(id) {
  showDeleteConfirmModal(
    '¿Estás seguro de eliminar este juego del catálogo?',
    () => {
      AppState.catalog = AppState.catalog.filter(g => g.id !== id);
      renderCatalog();
      saveLocal();
      if (typeof showToast === 'function') showToast('Juego eliminado del catálogo', 'info');
    }
  );
}
function addToCartFromCard(id) {
  const console = document.getElementById(`consola-${id}`).value;
  addToCart(id, console);
}
function addToCart(id, console) {
  const game = AppState.catalog.find(g => g.id === id);
  AppState.cart.push({ ...game, cartId: Date.now(), console, price: console === 'PS4' ? game.precio_ps4 : game.precio_ps5 });
  updateCartBadge();
  renderCart();
  // Abrir popup del carrito siempre al agregar
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('show');
}
function toggleCart() {
  document.getElementById('cartDrawer').classList.toggle('open');
  document.getElementById('cartOverlay').classList.toggle('show');
}
function renderCart() {
  const container = document.getElementById('cartItems');
  container.innerHTML = AppState.cart.length === 0 ? '<p>Vacío</p>' : '';
  let total = 0;
  AppState.cart.forEach(item => {
    total += item.price;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `<span>${item.nombre} (${item.console})</span><span>$${item.price}</span>`;
    container.appendChild(div);
  });
  document.getElementById('cartTotal').textContent = `$${total.toFixed(2)}`;
}
function updateCartBadge() {
  document.getElementById('cartBadge').textContent = AppState.cart.length;
}
function openCheckout() {
  if (AppState.cart.length === 0) return;
  const isClient = AppState.currentUser?.role === 'cliente';
  const groupCanal = document.getElementById('groupCanal');
  const groupSorteo = document.getElementById('groupSorteo');
  if (groupCanal) groupCanal.style.display = isClient ? 'none' : 'block';
  if (groupSorteo) groupSorteo.style.display = isClient ? 'none' : 'block';
  document.getElementById('checkoutOverlay').classList.add('show');
}
function closeCheckout() {
  document.getElementById('checkoutOverlay').classList.remove('show');
}
async function confirmCheckout() {
  const cliente = document.getElementById('ckNombre').value;
  if (!cliente) {
    await showPremiumAlert('Error', 'Nombre requerido', 'error');
    return;
  }
  const time = getColombiaTime();
  AppState.cart.forEach(item => {
    const newSale = {
      id: Date.now() + Math.random(),
      fecha: time.date,
      hora: time.time,
      cliente,
      juego: item.nombre,
      consola: item.console,
      precio: item.price,
      pago: document.getElementById('ckPago').value,
      asesor: AppState.currentUser.name,
      canal: (AppState.currentUser?.role === 'cliente') ? 'CLIENTE' : document.getElementById('ckCanal').value,
      estado: 'ENTREGADO',
      _searchIndex: `${(cliente || '')} ${(item.nombre || '')} ${(item.console || '')} ${(AppState.currentUser.name || '')}`.toLowerCase()
    };
    AppState.sales.unshift(newSale);
  });
  AppState.cart = [];
  updateCartBadge();
  closeCheckout();
  toggleCart();
  saveLocal();
  await showPremiumAlert("Venta Exitosa", "¡La compra se ha registrado correctamente!", "success");
}
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
function confirmarLimpiezaDatos() {
  showDeleteConfirmModal(
    "âš ï¸ ADVERTENCIA CRÃTICA: ¿Estás seguro de que quieres limpiar todos los datos de prueba tanto LOCALES como en la NUBE?\n\nSe borrarán permanentemente ventas e inventario en Supabase y el navegador.",
    async () => {
      console.log('--- Iniciando limpieza profunda (LOCAL + CLOUD) ---');
      try {
        const result = await apiClearCloudData();
        if (result && result.success) {
          console.log('âœ… Nube saneada exitosamente. Procediendo con limpieza local...');
        } else {
          throw new Error('El servidor respondió pero no confirmó el éxito.');
        }
        AppState.sales = [];
        AppState.inventory = [];
        AppState.inventoryGames = [];
        AppState.inventoryCodes = [];
        AppState.paquetes = [];
        AppState.membresias = [];
        AppState.xboxInventory = [];
        AppState.physicalInventory = [];
        AppState.incomeExtra = [];
        AppState.expenses = [];
        AppState.auditLog = [];
        AppState.analysis = [];
        AppState.catalog = [];
        AppState.clients = [];
        AppState.raffles = [];
        AppState.idealStock = {};
        AppState.plantillas = {};
        logEvent('LIMPIEZA TOTAL', 'Se ha realizado una limpieza completa de los datos tanto locales como en la nube.');
        saveLocal();
        await showPremiumAlert("Limpieza", "Limpieza total completada. La página se recargará para aplicar los cambios.", "success");
        location.reload();
      } catch (err) {
        console.error('âŒ Error crítico en Hard Reset:', err.message);
        await showPremiumAlert("Error en Limpieza", "No pudimos limpiar la nube. Por razones de seguridad, no borraremos tus datos locales hasta que la base de datos remota esté saneada.", "error");
      }
    }
  );
}
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
function switchBitacoraTab(tabName) {
  document.getElementById('btnTabVisorEventos').className = (tabName === 'visorEventos') ? 'btn-primary' : 'btn-secondary';
  document.getElementById('btnTabGestionUsuarios').className = (tabName === 'gestionUsuarios') ? 'btn-primary' : 'btn-secondary';
  document.getElementById('bitacoraVisorEventos').style.display = (tabName === 'visorEventos') ? 'block' : 'none';
  document.getElementById('bitacoraGestionUsuarios').style.display = (tabName === 'gestionUsuarios') ? 'block' : 'none';
}
function renderBitacoraEventos() {
  const tbody = document.getElementById('bodyBitacoraEventos');
  if (!tbody) return;
  tbody.innerHTML = '';
  const showAnulaciones = document.getElementById('filterBitacoraAnulaciones')?.checked ?? true;
  let logs = [...AppState.auditLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (!showAnulaciones) {
    logs = logs.filter(log => !['Factura Anulada', 'Factura Reactivada', 'Pedido Anulado', 'Pedido Reactivado'].includes(log.accion));
  }
  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">No hay eventos registrados...</td></tr>';
    return;
  }
  logs.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(log.timestamp).toLocaleString('es-CO')}</td>
      <td><strong>${log.usuarioNombre || 'Sistema'}</strong></td>
      <td><span class="status-badge status-active">${log.accion}</span></td>
      <td style="word-break: break-word;">${log.detalles}</td>
    `;
    tbody.appendChild(tr);
  });
}
function renderGestionUsuarios() {
  const tbody = document.getElementById('bodyGestionUsuarios');
  if (!tbody) return;
  tbody.innerHTML = '';
  AppState.users.forEach(u => {
    const isSuperAdmin = u.email === 'cangel.games.soporte@gmail.com';
    const estadoClass = u.activo ? 'status-active' : 'status-inactive';
    const estadoText = u.activo ? 'Activo' : 'Inactivo';
    // Check if total access
    const hasTotal = u.permisos.acceso_total ? '<i data-lucide="shield-alert" class="minimalist-icon" style="color:#ff4757"></i> Total' : 'Restringido';
    const tr = document.createElement('tr');
    // Si es Super Admin (Cristian), no mostramos acciones según requerimiento
    const accionesHtml = isSuperAdmin ? '' : `
      <div style="display: flex; gap: 8px;">
        <button class="action-btn-premium" onclick="openModalUsuario('${u.email}')" title="Editar">
          <i data-lucide="pencil" style="width:16px; height:16px;"></i>
        </button>
        <button class="action-btn-premium" onclick="toggleEstadoUsuario('${u.email}')" title="${u.activo ? 'Desactivar' : 'Reactivar'}">
          <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
        </button>
      </div>
    `;
    tr.innerHTML = `
      <td>${u.email}</td>
      <td>${u.nombre}</td>
      <td>${u.rolBase || 'N/A'}</td>
      <td><span class="status-badge ${estadoClass}">${estadoText}</span></td>
      <td>${accionesHtml}</td>
    `;
    tbody.appendChild(tr);
  });
  if (window.lucide) window.lucide.createIcons();
}
function openModalUsuario(email = null) {
  document.getElementById('formUsuario').reset();
  const title = document.getElementById('modalUsuarioTitle');
  if (email) {
    title.innerHTML = '<i data-lucide="edit" class="minimalist-icon"></i> Editar Usuario';
    const user = AppState.users.find(u => u.email === email);
    if (user) {
      document.getElementById('usuarioEditEmail').value = user.email;
      document.getElementById('usNombre').value = user.nombre;
      document.getElementById('usEmail').value = user.email;
      document.getElementById('usEmail').disabled = true; // No cambiar correo, usar como ID
      document.getElementById('usPassword').value = ''; // Ocultar contraseña por defecto
      document.getElementById('usPassword').placeholder = 'Dejar en blanco para no cambiar';
      document.getElementById('usPassword').required = false;
      document.getElementById('usRol').value = user.rolBase || 'Asesor Comercial';
      // Load permissions
      document.getElementById('chkAccesoTotal').checked = user.permisos.acceso_total || false;
      const perms = ['p_dashboard_ver', 'p_analisis_ver', 'p_catalogo_ver',
        'p_ventas_ver', 'p_ventas_crear', 'p_ventas_editar', 'p_ventas_eliminar',
        'p_inventario_ver', 'p_inventario_crear', 'p_inventario_editar', 'p_inventario_eliminar',
        'p_analytics_ver', 'p_balance_ver', 'p_balance_editar', 'p_bitacora_ver'];
      perms.forEach(p => {
        if (user.permisos[p]) {
          document.getElementById(p).checked = true;
        }
      });
      toggleAllPermissions(); // UI update base on total access
    }
  } else {
    title.innerHTML = '<i data-lucide="user-plus" class="minimalist-icon"></i> Nuevo Usuario';
    document.getElementById('usuarioEditEmail').value = '';
    document.getElementById('usEmail').disabled = false;
    document.getElementById('usPassword').placeholder = 'Obligatorio para nuevos';
    document.getElementById('usPassword').required = true;
    updateChecklistFromRole(); // Suggested defaults
  }
  document.getElementById('modalUsuarioOverlay').style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();
}
function closeModalUsuario() {
  document.getElementById('modalUsuarioOverlay').style.display = 'none';
}
function toggleAllPermissions() {
  const isTotal = document.getElementById('chkAccesoTotal').checked;
  const checkboxes = document.querySelectorAll('.perm-chk');
  checkboxes.forEach(chk => {
    chk.disabled = isTotal;
    if (isTotal) chk.checked = true;
  });
}
function updateChecklistFromRole() {
  const isEditing = document.getElementById('usuarioEditEmail').value !== '';
  if (isEditing) return; // Si estamos editando, respetamos lo que está en la BD
  const rol = document.getElementById('usRol').value;
  document.getElementById('formUsuario').reset();
  document.getElementById('usRol').value = rol; // restore select
  // Uncheck all
  document.querySelectorAll('.perm-chk').forEach(c => c.checked = false);
  document.getElementById('chkAccesoTotal').checked = false;
  if (rol === 'Administrador') {
    ['p_dashboard_ver', 'p_analisis_ver', 'p_catalogo_ver',
      'p_ventas_ver', 'p_ventas_crear', 'p_ventas_editar', 'p_ventas_eliminar', 'p_ventas_anular',
      'p_inventario_ver', 'p_inventario_crear', 'p_inventario_editar', 'p_inventario_eliminar',
      'p_analytics_ver', 'p_balance_ver', 'p_balance_editar', 'p_bitacora_ver'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = true;
      });
  } else if (rol === 'Asesor Comercial') {
    ['p_dashboard_ver', 'p_catalogo_ver', 'p_ventas_ver', 'p_ventas_crear', 'p_inventario_ver'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = true;
    });
  } else if (rol === 'Auditor') {
    ['p_dashboard_ver', 'p_analisis_ver', 'p_catalogo_ver', 'p_ventas_ver', 'p_inventario_ver', 'p_analytics_ver', 'p_balance_ver'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = true;
    });
  }
  toggleAllPermissions();
}
function saveUsuario() {
  const editEmail = document.getElementById('usuarioEditEmail').value;
  const nombre = document.getElementById('usNombre').value.trim();
  const email = document.getElementById('usEmail').value.trim();
  const password = document.getElementById('usPassword').value.trim();
  const rolBase = document.getElementById('usRol').value;
  const accesoTotal = document.getElementById('chkAccesoTotal').checked;
  if (!nombre || !email) {
    alert("Por favor completa los campos principales.");
    return;
  }
  // Generate permisos object
  const permisos = { acceso_total: accesoTotal };
  const perms = ['p_dashboard_ver', 'p_analisis_ver', 'p_catalogo_ver',
    'p_ventas_ver', 'p_ventas_crear', 'p_ventas_editar', 'p_ventas_eliminar', 'p_ventas_anular',
    'p_inventario_ver', 'p_inventario_crear', 'p_inventario_editar', 'p_inventario_eliminar',
    'p_analytics_ver', 'p_balance_ver', 'p_balance_editar', 'p_bitacora_ver'];
  perms.forEach(p => {
    permisos[p] = document.getElementById(p).checked;
  });
  if (editEmail) {
    const userIndex = AppState.users.findIndex(u => u.email.toLowerCase() === editEmail.toLowerCase());
    if (userIndex !== -1) {
      if (AppState.users[userIndex].email === 'cangel.games.soporte@gmail.com') return;
      AppState.users[userIndex].nombre = nombre;
      AppState.users[userIndex].rolBase = rolBase;
      AppState.users[userIndex].permisos = permisos;
      if (password !== '') {
        AppState.users[userIndex].pass = password; // Only update if typed
      }
      logEvent('Edición Usuario', `Rol/Permisos modificados para ${email}`);
    }
  } else {
    if (!password) {
      alert("La contraseña es obligatoria para nuevos usuarios.");
      return;
    }
    const finalEmail = email.toLowerCase();
    if (AppState.users.find(u => u.email.toLowerCase() === finalEmail)) {
      alert("El correo ya está en uso por otro usuario.");
      return;
    }
    AppState.users.push({
      email: finalEmail,
      nombre: nombre,
      pass: password,
      rolBase: rolBase,
      permisos: permisos,
      activo: true
    });
    logEvent('Creación Usuario', `Nuevo usuario registrado: ${email} (${rolBase})`);
  }
  saveLocal();
  renderGestionUsuarios();
  closeModalUsuario();
}
function toggleEstadoUsuario(email) {
  if (email === 'cangel.games.soporte@gmail.com') {
    alert("El Super Administrador no puede desactivarse.");
    return;
  }
  const user = AppState.users.find(u => u.email === email);
  if (user) {
    user.activo = !user.activo;
    saveLocal();
    renderGestionUsuarios();
    logEvent(user.activo ? 'Reactivación Usuario' : 'Desactivación Usuario', `Usuario ${email} fue ${user.activo ? 'reactivado' : 'desactivado'}`);
  }
}
/* ============================================================ */
/* 2FA CODES MANAGEMENT SYSTEM             */
/* ============================================================ */
function open2FAModal(itemId, itemType) {
  const modal = document.getElementById('modal2FAOverlay');
  if (!modal) return;
  const item = findInventoryItemById(itemId, itemType);
  if (!item) return;
  modal.dataset.itemId = itemId;
  modal.dataset.itemType = itemType;
  modal.classList.add('show');
  render2FACodesList(item, itemId, itemType);
}
function findInventoryItemById(id, type) {
  if (type === 'game') return AppState.inventoryGames.find(g => String(g.id) === String(id));
  if (type === 'paquete') return AppState.paquetes.find(p => String(p.id) === String(id));
  if (type === 'membresia') return AppState.membresias.find(m => String(m.id) === String(id));
  return null;
}
function render2FACodesList(item, itemId, itemType) {
  const listado = document.getElementById('listadoCodigos2FA');
  if (!listado) return;
  const codesRaw = item.cod_2_pasos || item.codigo2fa || '';
  const codes = codesRaw.split('\n').map(x => x.trim()).filter(x => x.length > 0);
  if (codes.length === 0) {
    listado.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No hay códigos disponibles.</p>';
    closeModal2FA();
    return;
  }
  listado.innerHTML = '';
  codes.forEach((code, index) => {
    const div = document.createElement('div');
    div.className = 'code-2fa-item';
    div.innerHTML = `
      <div style="display:flex; flex-direction:column;">
        <span class="code-2fa-label">Código de verificación #${index + 1}</span>
        <span class="code-2fa-value">${code}</span>
      </div>
      <button class="btn-utilizar" onclick="use2FACode('${itemId}', '${itemType}', ${index})">Utilizar</button>
    `;
    listado.appendChild(div);
  });
}
async function use2FACode(itemId, itemType, codeIndex) {
  const item = findInventoryItemById(itemId, itemType);
  if (!item) return;
  const codesRaw = item.cod_2_pasos || item.codigo2fa || '';
  const codes = codesRaw.split('\n').map(x => x.trim()).filter(x => x.length > 0);
  if (codeIndex < 0 || codeIndex >= codes.length) return;
  const codeToUse = codes[codeIndex];
  // Copiar al portapapeles
  try {
    await navigator.clipboard.writeText(codeToUse);
    if (typeof showToast === 'function') showToast('Código copiado al portapapeles', 'success');
  } catch (err) {
    console.error('Error al copiar:', err);
  }
  // Eliminar código
  codes.splice(codeIndex, 1);
  const newCodesRaw = codes.join('\n');
  item.codigo2fa = newCodesRaw;
  // Por compatibilidad si existiera la otra
  if (item.cod_2_pasos !== undefined) item.cod_2_pasos = newCodesRaw;
  // Persistir y refrescar
  logEvent('2FA: Código Utilizado', `Item ID: ${itemId} | Tipo: ${itemType} | Código: ${codeToUse}`);
  saveLocal();
  renderCuentasPSN();
  // Actualizar lista en el modal o cerrar si ya no hay
  if (codes.length > 0) {
    render2FACodesList(item, itemId, itemType);
  } else {
    closeModal2FA();
  }
}
function closeModal2FA() {
  const modal = document.getElementById('modal2FAOverlay');
  if (modal) modal.classList.remove('show');
}
/* --- LÓGICA DE NOTIFICACIONES 2FA (POCOS CÓDIGOS) --- */
export function update2FABellBadge() {
  const badge = document.getElementById('badge2FANotif');
  if (!badge) return;
  const low2FACount = countLow2FACuentas();
  if (low2FACount > 0) {
    badge.textContent = low2FACount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}
function countLow2FACuentas() {
  const soldGames = (AppState.inventoryGames || []).filter(g => g.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(g.id) && s.productType === 'game'));
  const soldPaquetes = (AppState.paquetes || []).filter(p => p.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(p.id) && s.productType === 'paquete'));
  const soldMembresias = (AppState.membresias || []).filter(m => m.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(m.id) && s.productType === 'membresia'));
  const allCuentas = [...soldGames, ...soldPaquetes, ...soldMembresias];
  return allCuentas.filter(c => {
    const codesRaw = c.cod_2_pasos || c.codigo2fa || '';
    const count = codesRaw.split('\n').map(x => x.trim()).filter(x => x.length > 0).length;
    return count > 0 && count <= 3;
  }).length;
}
function open2FANotifModal() {
  const modal = document.getElementById('modal2FANotifOverlay');
  const tbody = document.getElementById('body2FANotif');
  if (!modal || !tbody) return;
  const soldGames = (AppState.inventoryGames || []).filter(g => g.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(g.id) && s.productType === 'game')).map(x => ({...x, _itemType: 'game'}));
  const soldPaquetes = (AppState.paquetes || []).filter(p => p.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(p.id) && s.productType === 'paquete')).map(x => ({...x, _itemType: 'paquete'}));
  const soldMembresias = (AppState.membresias || []).filter(m => m.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(m.id) && s.productType === 'membresia')).map(x => ({...x, _itemType: 'membresia'}));
  const allCuentas = [...soldGames, ...soldPaquetes, ...soldMembresias];
  const low2FACuentas = allCuentas.filter(c => {
    const codesRaw = c.cod_2_pasos || c.codigo2fa || '';
    const count = codesRaw.split('\n').map(x => x.trim()).filter(x => x.length > 0).length;
    return count > 0 && count <= 3;
  });
  tbody.innerHTML = '';
  if (low2FACuentas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No hay cuentas con pocos códigos.</td></tr>';
  } else {
    low2FACuentas.forEach(c => {
      const codesRaw = c.cod_2_pasos || c.codigo2fa || '';
      const count = codesRaw.split('\n').map(x => x.trim()).filter(x => x.length > 0).length;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding: 12px 10px;"><span class="id-badge">${c.id}</span></td>
        <td class="fw-bold" style="color:var(--text-light); padding: 12px 10px;">${c.juego || c.nombre || c.tipo || 'N/A'}</td>
        <td style="color:var(--accent-cyan); padding: 12px 10px;">${c.correo || 'N/A'}</td>
        <td style="text-align:center; padding: 12px 10px;">
          <div class="badge-2fa ${count === 0 ? 'zero' : 'low'}" style="margin: 0 auto; min-width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; background:${count === 0 ? 'rgba(244,63,94,0.1)' : 'rgba(245,158,11,0.1)'}; color:${count === 0 ? '#f43f5e' : '#f59e0b'}; border:1px solid ${count === 0 ? 'rgba(244,63,94,0.3)' : 'rgba(245,158,11,0.3)'};">
            ${count}
          </div>
        </td>
        <td style="padding: 12px 10px;">
          <div style="display:flex; gap:5px; justify-content:center;">
            <button class="action-btn-premium" style="width:32px; height:32px; padding:0; border-radius: 8px; background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.2); color: var(--accent-cyan);" onclick="close2FANotifModal(); open2FAModal('${c.id}', '${c._itemType}')" title="Ver/Eliminar códigos">
              <i data-lucide="eye" style="width:16px; height:16px;"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  modal.classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
function close2FANotifModal() {
  const modal = document.getElementById('modal2FANotifOverlay');
  if (modal) modal.classList.remove('show');
}
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
  renderCuentasPSN,
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
  switchBitacoraTab,
  renderBitacoraEventos,
  confirmarLimpiezaDatos,
  // Análisis de Precios (PS Store)
  updateGlobalTRM,
  editAnalysisImage,
  updateAnalysisData,
  deleteAnalysis,
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
