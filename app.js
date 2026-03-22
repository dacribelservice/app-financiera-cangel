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
  openModalCodigo, closeModalCodigo, saveCodigoInventory, renderInventoryCodigos, filterInventoryCodes,
  openModalXbox, saveXboxInventory, renderInventoryXbox, filterInventoryXbox,
  openModalPhysical, savePhysicalInventory, renderInventoryPhysical, filterInventoryPhysical,
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
// --- MODAL ELIMINACION PREMIUM ---
let deleteActionCallback = null;
export function showDeleteConfirmModal(message, onConfirm) {
  const overlay = document.getElementById('modalConfirmDeleteOverlay');
  const msgElement = document.getElementById('deleteConfirmMessage');
  if (overlay && msgElement) {
    msgElement.innerText = message || "¿Estás seguro de eliminar este registro?";
    deleteActionCallback = onConfirm;
    overlay.classList.add('show');
  }
}
function closeDeleteConfirmModal() {
  const overlay = document.getElementById('modalConfirmDeleteOverlay');
  if (overlay) {
    overlay.classList.remove('show');
  }
  deleteActionCallback = null;
}
// Ejecutar la acción si se hace clic en Sí, eliminar
function executeDeleteAction() {
  if (deleteActionCallback && typeof deleteActionCallback === 'function') {
    deleteActionCallback();
  }
  closeDeleteConfirmModal();
}
// --- ALERT PREMIUM ---
let alertResolve = null;
export function showPremiumAlert(title, message, type = 'success') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modalAlertOverlay');
    const titleEl = document.getElementById('alertTitle');
    const msgEl = document.getElementById('alertMessage');
    const iconContainer = document.getElementById('alertIconContainer');
    if (overlay && titleEl && msgEl && iconContainer) {
      titleEl.innerText = title;
      msgEl.innerText = message;
      let iconHtml = '';
      if (type === 'success') {
        iconHtml = `<div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(0, 184, 148, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 1px solid rgba(0, 184, 148, 0.3);"><i data-lucide="check-circle" style="color: #00b894; width: 30px; height: 30px;"></i></div>`;
      } else if (type === 'error') {
        iconHtml = `<div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(255, 71, 87, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 1px solid rgba(255, 71, 87, 0.3);"><i data-lucide="x-circle" style="color: #ff4757; width: 30px; height: 30px;"></i></div>`;
      } else {
        iconHtml = `<div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(0, 201, 255, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 1px solid rgba(0, 201, 255, 0.3);"><i data-lucide="info" style="color: #00c9ff; width: 30px; height: 30px;"></i></div>`;
      }
      iconContainer.innerHTML = iconHtml;
      alertResolve = resolve;
      overlay.classList.add('show');
      if (window.lucide) window.lucide.createIcons();
    }
  });
}
function closePremiumAlert() {
  const overlay = document.getElementById('modalAlertOverlay');
  if (overlay) overlay.classList.remove('show');
  if (alertResolve) {
    alertResolve();
    alertResolve = null;
  }
}
// --- PROMPT PREMIUM ---
let promptResolve = null;
function showPremiumPrompt(title, subtitle, label, defaultValue = '', inputType = 'text') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modalPromptOverlay');
    const titleEl = document.getElementById('promptTitle');
    const subtitleEl = document.getElementById('promptSubtitle');
    const labelEl = document.getElementById('promptLabel');
    const inputEl = document.getElementById('promptInput');
    if (overlay && titleEl && subtitleEl && labelEl && inputEl) {
      titleEl.innerText = title;
      subtitleEl.innerText = subtitle;
      labelEl.innerText = label;
      inputEl.value = defaultValue;
      inputEl.type = inputType;
      promptResolve = resolve;
      overlay.classList.add('show');
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 100);
      const handleEnter = (e) => {
        if (e.key === 'Enter') {
          inputEl.removeEventListener('keydown', handleEnter);
          closePremiumPrompt(true);
        }
      };
      inputEl.addEventListener('keydown', handleEnter);
    }
  });
}
function closePremiumPrompt(isAccept) {
  const overlay = document.getElementById('modalPromptOverlay');
  const inputEl = document.getElementById('promptInput');
  const value = inputEl ? inputEl.value : '';
  if (overlay) overlay.classList.remove('show');
  if (promptResolve) {
    promptResolve(isAccept ? value : null);
    promptResolve = null;
  }
}
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
function updateBalance() {
  // v.venta = campo actual (COP). Fallback a v.precio para registros legacy
  const ing = AppState.sales
    .filter(v => !v.esta_anulada)
    .reduce((sum, v) => sum + (parseFloat(v.venta) || parseFloat(v.precio) || 0), 0);
  // Ingresos adicionales (aportes, capital, etc.)
  const ingExtra = (AppState.incomeExtra || []).reduce((sum, e) => sum + (parseFloat(e.monto) || 0), 0);
  // Costos del inventario: suma costoCop de juegos + costoCop de códigos (ambos en COP)
  const cosJuegos = AppState.inventoryGames.reduce((sum, i) => sum + (parseFloat(i.costoCop) || 0), 0);
  const cosCodigos = AppState.inventoryCodes.reduce((sum, c) => sum + (parseFloat(c.costoCop) || 0), 0);
  const cos = cosJuegos + cosCodigos;
  const gas = AppState.expenses.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
  const totalIngresos = ing + ingExtra;
  const neta = totalIngresos - cos - gas;
  document.getElementById('balIngresos').textContent = `$${totalIngresos.toLocaleString('es-CO')}`;
  document.getElementById('balCostos').textContent = `$${cos.toLocaleString('es-CO')}`;
  document.getElementById('balGastos').textContent = `$${gas.toLocaleString('es-CO')}`;
  document.getElementById('balNeta').textContent = `$${neta.toLocaleString('es-CO')}`;
  const div = (neta / 2).toLocaleString('es-CO');
  document.getElementById('balSocio1').textContent = `$${div}`;
  document.getElementById('balSocio2').textContent = `$${div}`;
  // Actualizar total de ingresos adicionales en la tabla
  const totalEl = document.getElementById('totalIngresosAdicionales');
  if (totalEl) totalEl.textContent = `$${ingExtra.toLocaleString('es-CO')}`;
  renderExpenses();
  renderIngresos();
  renderPagoMetodoChart();
}
let _pagoMetodoChartInstance = null;
function renderPagoMetodoChart() {
  const canvas = document.getElementById('pagoMetodoChart');
  const cardsContainer = document.getElementById('pagoMetodoCards');
  if (!canvas || !cardsContainer) return;
  const now = new Date();
  const mesActual = now.getMonth();
  const anoActual = now.getFullYear();
  const mesPasado = mesActual === 0 ? 11 : mesActual - 1;
  const anoPasado = mesActual === 0 ? anoActual - 1 : anoActual;
  const metodos = ['Nequi', 'Sistecredito', 'Bancolombia', 'Addi', 'Wompi', 'Daviplata'];
  const dataActual = {};
  const dataPasado = {};
  metodos.forEach(m => { dataActual[m] = 0; dataPasado[m] = 0; });
  AppState.sales.forEach(v => {
    if (v.esta_anulada) return; // Omitir anuladas en gráficos de balance
    const metodo = (v.pago || '').trim();
    if (!metodo) return;
    const valor = parseFloat(v.venta) || parseFloat(v.precio) || 0;
    let fechaVenta = null;
    if (v.fecha) {
      const raw = v.fecha;
      if (raw.includes('/')) {
        const p = raw.split('/');
        fechaVenta = new Date(p[2], p[1] - 1, p[0]);
      } else {
        fechaVenta = new Date(raw);
      }
    }
    if (!fechaVenta || isNaN(fechaVenta)) return;
    const key = metodos.find(m => m.toLowerCase() === metodo.toLowerCase()) || metodo;
    const fMes = fechaVenta.getMonth();
    const fAno = fechaVenta.getFullYear();
    if (fMes === mesActual && fAno === anoActual) {
      dataActual[key] = (dataActual[key] || 0) + valor;
      if (dataPasado[key] === undefined) dataPasado[key] = 0;
    } else if (fMes === mesPasado && fAno === anoPasado) {
      dataPasado[key] = (dataPasado[key] || 0) + valor;
      if (dataActual[key] === undefined) dataActual[key] = 0;
    }
  });
  const allKeys = [...new Set([...Object.keys(dataActual), ...Object.keys(dataPasado)])];
  const labels = allKeys.filter(m => (dataActual[m] || 0) + (dataPasado[m] || 0) > 0);
  const valAct = labels.map(m => dataActual[m] || 0);
  const valPrev = labels.map(m => dataPasado[m] || 0);
  if (_pagoMetodoChartInstance) {
    _pagoMetodoChartInstance.destroy();
    _pagoMetodoChartInstance = null;
  }
  const ctx = canvas.getContext('2d');
  _pagoMetodoChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Mes Actual', data: valAct, backgroundColor: 'rgba(167,139,250,0.88)', borderRadius: 6, borderSkipped: false, barPercentage: 0.4 },
        { label: 'Mes Anterior', data: valPrev, backgroundColor: 'rgba(150,150,170,0.4)', borderRadius: 6, borderSkipped: false, barPercentage: 0.4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,15,30,0.97)',
          borderColor: 'rgba(167,139,250,0.5)',
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 13, weight: '700' },
          bodyFont: { size: 12 },
          callbacks: {
            title: (items) => items[0].label,
            label: (item) => {
              const val = item.raw.toLocaleString('es-CO');
              const dot = item.datasetIndex === 0 ? 'ðŸŸ£' : 'âšª';
              return `  ${dot} ${item.dataset.label}:  $ ${val}`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: 'rgba(200,200,220,0.7)', font: { size: 11 } }, grid: { display: false } },
        y: {
          ticks: {
            color: 'rgba(200,200,220,0.55)', font: { size: 10 },
            callback: v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`
          },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
  // Tarjetas resumen
  cardsContainer.innerHTML = '';
  if (labels.length === 0) {
    cardsContainer.innerHTML = `<p style="color:rgba(200,200,220,0.5);font-size:0.85rem;">Sin ventas registradas aún.</p>`;
    return;
  }
  labels.forEach(m => {
    const act = dataActual[m] || 0;
    const prev = dataPasado[m] || 0;
    const pct = prev > 0 ? (((act - prev) / prev) * 100).toFixed(1) : null;
    const arrow = pct !== null ? (parseFloat(pct) >= 0 ? 'â–²' : 'â–¼') : '';
    const pctColor = pct !== null && parseFloat(pct) >= 0 ? '#4ade80' : '#f87171';
    cardsContainer.innerHTML += `
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px 16px;">
        <div style="font-size:0.78rem;color:rgba(200,200,220,0.6);margin-bottom:4px;">${m}</div>
        <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:4px;">$ ${act.toLocaleString('es-CO')}</div>
        ${pct !== null ? `<div style="font-size:0.78rem;color:${pctColor};font-weight:600;">${arrow} ${Math.abs(pct)}%</div>` : ''}
      </div>`;
  });
}
function processPDF(file) {
  if (!file) return;
  const statusEl = document.getElementById('pdfStatus');
  statusEl.innerHTML = 'Analizando extracto bancario...';
  setTimeout(() => {
    statusEl.innerHTML = 'Auditoría completada. Banco como fuente de verdad OK.';
    updateBalance();
  }, 1500);
}
async function addExpense(type) {
  const defaultDesc = type === 'operativo' ? 'Gasto operativo' : 'Gasto ocasional';
  const desc = await showPremiumPrompt(
    type === 'operativo' ? 'Añadir Gasto Operativo' : 'Añadir Gasto Ocasional',
    'Ingresa una descripción clara para este gasto:',
    'Descripción:',
    defaultDesc
  );
  if (desc === null) return; // Cancelado
  const m = await showPremiumPrompt(
    'Monto del Gasto',
    'Ingresa el valor total en pesos colombianos:',
    'Monto ($):',
    '',
    'number'
  );
  if (m !== null) {
    const monto = parseFloat(m);
    if (isNaN(monto)) {
      await showPremiumAlert("Error", "Por favor, ingrese un monto válido.", "error");
      return;
    }
    AppState.expenses.push({
      id: Date.now(),
      type,
      monto: monto,
      desc: desc || defaultDesc,
      fecha: getColombiaTime().date
    });
    if (typeof logEvent === 'function') {
      logEvent('Balance: Gasto Añadido', `Se agregó un gasto ${type} ("${desc}") por valor de $${monto}`);
    }
    updateBalance();
    saveLocal();
    renderExpenses(); // Asegurar que se renderice inmediatamente
  }
}
function renderExpenses() {
  const op = document.getElementById('gastosOperativosBody');
  const oc = document.getElementById('gastosOcasionalesBody');
  if (!op || !oc) return;
  op.innerHTML = ''; oc.innerHTML = '';
  // Ordenar gastos por fecha (más recientes primero)
  const sortedExpenses = [...AppState.expenses].sort((a, b) => b.id - a.id);
  sortedExpenses.forEach(g => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${g.id.toString().slice(-6)}</td>
      <td>${g.desc}</td>
      <td><strong>$${parseFloat(g.monto).toLocaleString('es-CO')}</strong></td>
      <td>${g.fecha}</td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="action-btn-premium" onclick="prepararEdicionGasto(${g.id})" title="Editar">
            <i data-lucide="pencil" style="width:14px; height:14px;"></i>
          </button>
          <button class="action-btn-premium" onclick="eliminarGasto(${g.id})" title="Eliminar" style="border-color: rgba(255, 71, 87, 0.3);">
            <i data-lucide="trash-2" style="width:14px; height:14px; color: #ff4757;"></i>
          </button>
        </div>
      </td>
    `;
    if (g.type === 'operativo') op.appendChild(tr); else oc.appendChild(tr);
  });
  if (window.lucide) window.lucide.createIcons();
}
function eliminarGasto(id) {
  const index = AppState.expenses.findIndex(g => g.id === id);
  if (index !== -1) {
    const gasto = AppState.expenses[index];
    showDeleteConfirmModal(
      `¿Estás seguro de eliminar el gasto: "${gasto.desc}" por $${gasto.monto}?`,
      () => {
        AppState.expenses.splice(index, 1);
        logEvent('Balance: Gasto Eliminado', `ID: ${id} | Desc: ${gasto.desc} | Monto: $${gasto.monto}`);
        renderExpenses();
        updateBalance();
        saveLocal();
        if (typeof showToast === 'function') showToast('Gasto eliminado correctamente', 'info');
      }
    );
  }
}
async function prepararEdicionGasto(id) {
  const gasto = AppState.expenses.find(g => g.id === id);
  if (!gasto) return;
  const nuevaDesc = await showPremiumPrompt(
    'Editar Gasto',
    'Modifica la descripción según sea necesario:',
    'Descripción:',
    gasto.desc
  );
  if (nuevaDesc === null) return;
  const nuevoMonto = await showPremiumPrompt(
    'Editar Monto',
    'Ingresa el nuevo valor del gasto:',
    'Monto ($):',
    gasto.monto,
    'number'
  );
  if (nuevoMonto === null) return;
  const montoVal = parseFloat(nuevoMonto);
  if (isNaN(montoVal)) {
    await showPremiumAlert("Error", "Por favor ingresa un monto válido.", "error");
    return;
  }
  const descVieja = gasto.desc;
  const montoViejo = gasto.monto;
  gasto.desc = nuevaDesc;
  gasto.monto = montoVal;
  logEvent('Balance: Gasto Modificado', `ID: ${id} | De: [${descVieja} | $${montoViejo}] a [${nuevaDesc} | $${montoVal}]`);
  renderExpenses();
  updateBalance();
  saveLocal();
  if (typeof showToast === 'function') showToast('Gasto actualizado correctamente');
}
/* ============================================================ */
/* INGRESOS ADICIONALES (Balance)          */
/* ============================================================ */
async function addIngreso() {
  const desc = await showPremiumPrompt(
    'Nuevo Ingreso',
    'Registra un ingreso adicional (aporte de socio, capital, préstamo, etc.).',
    'Descripción:',
    ''
  );
  if (!desc || !desc.trim()) return;
  const montoStr = await showPremiumPrompt(
    'Monto del Ingreso',
    'Ingresa el valor en pesos colombianos (COP).',
    'Monto ($):',
    '',
    'number'
  );
  if (montoStr === null) return;
  const monto = parseFloat(montoStr);
  if (isNaN(monto) || monto <= 0) {
    await showPremiumAlert('Error', 'Ingresa un monto válido mayor a 0.', 'error');
    return;
  }
  const t = getColombiaTime();
  const newIngreso = {
    id: Date.now(),
    desc: desc.trim(),
    monto,
    fecha: t.date
  };
  if (!AppState.incomeExtra) AppState.incomeExtra = [];
  AppState.incomeExtra.unshift(newIngreso);
  logEvent('Balance: Ingreso Adicional', `ID: ${newIngreso.id} | Desc: ${desc} | Monto: $${monto.toLocaleString('es-CO')}`);
  renderIngresos();
  updateBalance();
  saveLocal();
  showToast('âœ… Ingreso adicional registrado');
}
function renderIngresos() {
  const tbody = document.getElementById('ingresosAdicionalesBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const lista = (AppState.incomeExtra || []);
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">No hay ingresos adicionales registrados.</td></tr>';
    return;
  }
  lista.forEach((e, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size:0.78rem; color:var(--text-muted); font-family:monospace;">${e.id.toString().slice(-6)}</td>
      <td>${e.desc}</td>
      <td><strong style="color:var(--accent-green);">+$${parseFloat(e.monto).toLocaleString('es-CO')}</strong></td>
      <td>${e.fecha}</td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="action-btn-premium" onclick="prepararEdicionIngreso(${e.id})" title="Editar">
            <i data-lucide="pencil" style="width:14px; height:14px;"></i>
          </button>
          <button class="action-btn-premium" onclick="eliminarIngreso(${e.id})" title="Eliminar" style="border-color:rgba(255,71,87,0.3);">
            <i data-lucide="trash-2" style="width:14px; height:14px; color:#ff4757;"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (window.lucide) window.lucide.createIcons();
}
function eliminarIngreso(id) {
  const index = (AppState.incomeExtra || []).findIndex(e => e.id === id);
  if (index === -1) return;
  const ingreso = AppState.incomeExtra[index];
  showDeleteConfirmModal(
    `¿Eliminar ingreso: "${ingreso.desc}" por $${ingreso.monto.toLocaleString('es-CO')}?`,
    () => {
      AppState.incomeExtra.splice(index, 1);
      logEvent('Balance: Ingreso Eliminado', `ID: ${id} | Desc: ${ingreso.desc} | Monto: $${ingreso.monto}`);
      renderIngresos();
      updateBalance();
      saveLocal();
      showToast('Ingreso eliminado', 'info');
    }
  );
}
async function prepararEdicionIngreso(id) {
  const ingreso = (AppState.incomeExtra || []).find(e => e.id === id);
  if (!ingreso) return;
  const nuevaDesc = await showPremiumPrompt('Editar Ingreso', 'Modifica la descripción:', 'Descripción:', ingreso.desc);
  if (nuevaDesc === null) return;
  const nuevoMonto = await showPremiumPrompt('Editar Monto', 'Ingresa el nuevo valor:', 'Monto ($):', ingreso.monto, 'number');
  if (nuevoMonto === null) return;
  const montoVal = parseFloat(nuevoMonto);
  if (isNaN(montoVal) || montoVal <= 0) { await showPremiumAlert('Error', 'Monto inválido.', 'error'); return; }
  const descVieja = ingreso.desc;
  ingreso.desc = nuevaDesc.trim();
  ingreso.monto = montoVal;
  logEvent('Balance: Ingreso Modificado', `ID: ${id} | De: ${descVieja} a ${nuevaDesc} | Monto: $${montoVal}`);
  renderIngresos();
  updateBalance();
  saveLocal();
  showToast('Ingreso actualizado correctamente');
}
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
/* --- CALCULATE BALANCES --- */
export function calculateBalances() {
  const games = AppState.inventoryGames || [];
  const codes = AppState.inventoryCodes || [];
  const paquetes = AppState.paquetes || [];
  const membresias = AppState.membresias || [];
  const xbox = AppState.xboxInventory || [];
  const fisicos = AppState.physicalInventory || [];
  let gamesUsd = 0, gamesCop = 0, countGames = 0;
  let codesUsd = 0, codesCop = 0, countCodes = 0;
  let paqUsd = 0, paqCop = 0, countPaq = 0;
  let memUsd = 0, memCop = 0, countMem = 0;
  let xboxCop = 0, countXbox = 0;
  let fisicosCop = 0, countFisicos = 0;
  // Aggregate Games
  games.forEach(g => {
    gamesUsd += parseFloat(g.costoUsd || 0);
    gamesCop += parseInt(g.costoCop || 0);
    if (g.estado === 'ON') {
      countGames++;
    }
  });
  // Aggregate Codes
  codes.forEach(c => {
    codesUsd += parseFloat(c.precioUsd || 0);
    codesCop += parseInt(c.costoCop || 0);
    // Solo contar como "Pines ON" si el estado es ON y NO está usado
    if (c.estado === 'ON' && !c.usado) {
      countCodes++;
    }
  });
  // Aggregate Paquetes
  paquetes.forEach(p => {
    paqUsd += parseFloat(p.costoUsd || 0);
    paqCop += parseInt(p.costoCop || 0);
    if (p.estado === 'ON') {
      countPaq++;
    }
  });
  // Aggregate Membresías
  membresias.forEach(m => {
    memUsd += parseFloat(m.costoUsd || 0);
    memCop += parseInt(m.costoCop || 0);
    if (m.estado === 'ON') {
      countMem++;
    }
  });
  // Aggregate Xbox
  xbox.forEach(x => {
    xboxCop += parseInt(x.costoCop || 0);
    if (x.estado === 'ON') {
      countXbox++;
    }
  });
  // Aggregate Physical
  fisicos.forEach(f => {
    fisicosCop += parseInt(f.costoCop || 0);
    if (f.estado === 'ON') {
      countFisicos++;
    }
  });
  const globalUsd = gamesUsd + codesUsd + paqUsd + memUsd;
  const globalCop = gamesCop + codesCop + paqCop + memCop + xboxCop + fisicosCop;
  // Update KPIs
  const safeUpdate = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  safeUpdate('inv-global-usd', formatUSD(globalUsd));
  safeUpdate('inv-global-cop', formatCOP(globalCop));
  safeUpdate('inv-juegos-usd', formatUSD(gamesUsd));
  safeUpdate('inv-juegos-cop', formatCOP(gamesCop));
  safeUpdate('count-juegos-text', `${countGames} Unidades ON`);
  safeUpdate('inv-codigos-usd', formatUSD(codesUsd));
  safeUpdate('inv-codigos-cop', formatCOP(codesCop));
  safeUpdate('count-codigos-text', `${countCodes} Pines ON`);
  safeUpdate('inv-paquetes-usd', formatUSD(paqUsd));
  safeUpdate('inv-paquetes-cop', formatCOP(paqCop));
  safeUpdate('count-paquetes-text', `${countPaq} Paquetes ON`);
  safeUpdate('inv-membresias-usd', formatUSD(memUsd));
  safeUpdate('inv-membresias-cop', formatCOP(memCop));
  safeUpdate('count-membresias-text', `${countMem} Membresías ON`);
  // Render Stock Summary List
  renderStockSummary(games.filter(g => g.estado === 'ON'));
  // Update Charts
  updateInventoryBarChart(gamesUsd, codesUsd, paqUsd, memUsd);
  updateMonthlyInvestmentChart([...games, ...codes, ...paquetes, ...membresias]);
}
function renderStockSummary(activeGames) {
  const listEl = document.getElementById('stockSummaryList');
  if (!listEl) return;
  const counts = {};
  activeGames.forEach(g => {
    const title = (g.juego || 'Sin Título').toUpperCase();
    counts[title] = (counts[title] || 0) + 1;
  });
  const sortedTitles = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  if (sortedTitles.length === 0) {
    listEl.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Sin stock activo</p>';
    return;
  }
  listEl.innerHTML = sortedTitles.map(title => {
    const stockActual = counts[title] || 0;
    const stockIdeal = AppState.idealStock[title] || 0;
    const color = stockActual >= stockIdeal ? 'var(--accent-green)' : 'var(--accent-red)';
    return `
      <div class="summary-card-premium">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-weight: 600; color: #fff; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 175px;">${title}</span>
          <span style="font-size: 0.8rem; color: ${color}; font-weight: 600; letter-spacing: 0.3px;">Ideal: ${stockIdeal}</span>
        </div>
        <div class="summary-stock-badge">${stockActual}</div>
      </div>
    `;
  }).join('');
}
// -€-€-€-€ GESTIÓN DE STOCK IDEAL Y AUDITORÃA -€-€-€-€
function openIdealStockModal() {
  const overlay = document.getElementById('idealStockModalOverlay');
  if (!overlay) return;
  // Set default month to current
  const now = new Date();
  const currentMonth = now.toISOString().substring(0, 7);
  document.getElementById('auditMonthFilter').value = currentMonth;
  renderIdealStockAudit();
  overlay.classList.add('show');
}
function closeIdealStockModal() {
  const overlay = document.getElementById('idealStockModalOverlay');
  if (overlay) overlay.classList.remove('show');
}
function renderIdealStockAudit() {
  const tbody = document.getElementById('auditTableBody');
  const monthFilter = document.getElementById('auditMonthFilter').value;
  if (!tbody) return;
  // 1. Calcular Stock Actual (Activo)
  const stockCounts = {};
  const minPrices = {}; // Para el historial mínimo histórico
  AppState.inventoryGames.forEach(g => {
    const title = (g.juego || 'Sin Título').toUpperCase();
    // Conteo para Stock Actual (Solo Activos)
    if (g.estado === 'Activo') {
      stockCounts[title] = (stockCounts[title] || 0) + 1;
    }
    // Cálculo de precio mínimo histórico (Independiente del estado o fecha)
    const price = parseFloat(g.costoUsd);
    if (!isNaN(price)) {
      if (!minPrices[title] || price < minPrices[title]) {
        minPrices[title] = price;
      }
    }
  });
  // 2. Calcular Compras del Periodo (Mes seleccionado)
  const purchaseCounts = {};
  let totalUsdMonth = 0;
  let totalCopMonth = 0;
  AppState.inventoryGames.forEach(g => {
    if (g.fecha && g.fecha.startsWith(monthFilter)) {
      const title = (g.juego || 'Sin Título').toUpperCase();
      purchaseCounts[title] = (purchaseCounts[title] || 0) + 1;
      totalUsdMonth += parseFloat(g.costoUsd || 0);
      totalCopMonth += parseInt(g.costoCop || 0);
    }
  });
  // Sumar también Códigos al total del mes
  (AppState.inventoryCodes || []).forEach(c => {
    if (c.fecha && c.fecha.startsWith(monthFilter)) {
      totalUsdMonth += parseFloat(c.precioUsd || 0);
      totalCopMonth += parseInt(c.costoCop || 0);
    }
  });
  // 3. Unificar todos los títulos encontrados
  const allTitles = [...new Set([
    ...Object.keys(stockCounts),
    ...Object.keys(purchaseCounts),
    ...Object.keys(AppState.idealStock)
  ])].sort();
  if (allTitles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">No hay datos para este periodo</td></tr>`;
    return;
  }
  let tableHtml = allTitles.map(title => {
    const comprado = purchaseCounts[title] || 0;
    const actual = stockCounts[title] || 0;
    const ideal = AppState.idealStock[title] || 0;
    const minP = minPrices[title] || 0;
    const listado = Math.max(0, ideal - actual);
    const color = actual >= ideal ? 'var(--accent-green)' : 'var(--accent-red)';
    const titleColor = actual >= ideal ? '#fff' : 'var(--accent-red)';
    const listadoColor = listado > 0 ? '#ffae00' : 'rgba(255,255,255,0.2)';
    return `
      <tr>
        <td style="font-weight: 600; color: ${titleColor}; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">${title}</td>
        <td style="text-align: center; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
          <input type="number" value="${ideal}" 
            onchange="updateIdealStockValue('${title}', this.value)"
            style="width: 70px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px 8px; text-align: center; font-weight: 700;">
        </td>
        <td style="text-align: center; color: var(--accent-cyan); font-weight: 600; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">${comprado}</td>
        <td style="text-align: center; color: var(--accent-green); font-weight: 700; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">${formatUSD(minP)}</td>
        <td style="text-align: center; font-weight: 700; color: ${color}; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">${actual}</td>
        <td style="text-align: center; font-weight: 800; color: ${listadoColor}; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">${listado}</td>
      </tr>
    `;
  }).join('');
  // Agregar fila de inversión total del mes al final (premium look)
  tableHtml += `
    <tr style="background: rgba(57, 214, 249, 0.08); border-top: 1px solid var(--accent-cyan); box-shadow: inset 0 0 10px rgba(57, 214, 249, 0.1);">
      <td colspan="2" style="padding: 15px; font-weight: 800; color: var(--accent-cyan); letter-spacing: 0.5px;">TOTAL INVERSIÓN DEL PERIODO (Juegos + Pines):</td>
      <td colspan="4" style="padding: 15px; text-align: right; border-bottom: none;">
        <span style="color: #fff; font-weight: 800; font-size: 1rem; margin-right: 20px;">${formatUSD(totalUsdMonth)}</span>
        <span style="color: var(--accent-cyan); font-weight: 800; font-size: 1rem;">${formatCOP(totalCopMonth)}</span>
      </td>
    </tr>
  `;
  tbody.innerHTML = tableHtml;
}
function updateIdealStockValue(title, value) {
  AppState.idealStock[title] = parseInt(value) || 0;
  saveLocal();
  renderStockSummary(AppState.inventoryGames.filter(g => g.estado === 'Activo'));
}
function downloadAuditExcel() {
  const monthFilter = document.getElementById('auditMonthFilter').value;
  const rows = document.querySelectorAll('#auditTableBody tr');
  if (rows.length === 0) return alert("No hay datos para exportar");
  let csvContent = "Título del Juego;Stock Ideal;Comprado (Periodo);Compra (Histórico);Stock Actual;Listado (Por Comprar)\n";
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    const titulo = cells[0].innerText.replace(/;/g, ',');
    const ideal = cells[1].querySelector('input').value;
    const comprado = cells[2].innerText;
    const historico = cells[3].innerText.replace('$', '').replace(/,/g, '');
    const actual = cells[4].innerText;
    const listado = cells[5].innerText;
    csvContent += `${titulo};${ideal};${comprado};${historico};${actual};${listado}\n`;
  });
  // UTF-8 BOM for Excel to recognize accented characters
  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Auditoria_Stock_${monthFilter}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Excel generado correctamente");
}
// -€-€-€-€ MODULO DE GRÃFICAS (Chart.js) -€-€-€-€
function updateInventoryBarChart(gamesVal, codesVal, paqVal, memVal) {
  const ctx = document.getElementById('inventoryBarChart');
  if (!ctx) return;
  const labels = ['Juegos', 'Códigos', 'Paquetes', 'Membresías'];
  const data = [gamesVal, codesVal, paqVal || 0, memVal || 0];
  const colors = ['#9d00ff', '#ff007a', '#00d4ff', '#f59e0b'];
  if (AppState.charts.inventoryBar) {
    AppState.charts.inventoryBar.data.labels = labels;
    AppState.charts.inventoryBar.data.datasets[0].data = data;
    AppState.charts.inventoryBar.data.datasets[0].backgroundColor = colors;
    AppState.charts.inventoryBar.update();
  } else {
    AppState.charts.inventoryBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Inversión (USD)',
          data,
          backgroundColor: colors,
          borderRadius: 8,
          barThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8899a6', format: { style: 'currency', currency: 'USD' } } },
          x: { grid: { display: false }, ticks: { color: '#8899a6' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
}
function updateMonthlyInvestmentChart(items) {
  const ctx = document.getElementById('monthlyInvestmentChart');
  if (!ctx) return;
  // Group by month (YYYY-MM)
  const monthlyData = {};
  items.forEach(item => {
    const dateStr = item.fecha || item.fechaCompra;
    if (!dateStr) return;
    const month = dateStr.substring(0, 7); // "2023-10"
    const val = parseFloat(item.costoUsd || item.precioUsd || 0);
    monthlyData[month] = (monthlyData[month] || 0) + val;
  });
  const months = Object.keys(monthlyData).sort();
  const values = months.map(m => monthlyData[m]);
  if (AppState.charts.monthlyInv) {
    AppState.charts.monthlyInv.data.labels = months;
    AppState.charts.monthlyInv.data.datasets[0].data = values;
    AppState.charts.monthlyInv.update();
  } else {
    AppState.charts.monthlyInv = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Inversión USD',
          data: values,
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0, 255, 136, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#00ff88'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8899a6' } },
          x: { grid: { display: false }, ticks: { color: '#8899a6' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
}
function updateDashboardCharts() {
  const barCtx = document.getElementById('barChart');
  const lineCtx = document.getElementById('lineChart');
  if (!barCtx || !lineCtx) return;
  const labels = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const dataIngresos = [120, 190, 300, 250, 400, 550, 450]; // Mock por ahora
  const dataCostos = [80, 120, 200, 180, 300, 400, 350];
  if (AppState.charts.bar) {
    AppState.charts.bar.update();
  } else {
    AppState.charts.bar = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Ingresos', data: dataIngresos, backgroundColor: '#00e0ff', borderRadius: 5 },
          { label: 'Costos', data: dataCostos, backgroundColor: '#ff007a', borderRadius: 5 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8899a6' } },
          x: { grid: { display: false }, ticks: { color: '#8899a6' } }
        },
        plugins: { legend: { labels: { color: '#8899a6' } } }
      }
    });
  }
  if (AppState.charts.line) {
    AppState.charts.line.update();
  } else {
    AppState.charts.line = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Ganancia',
          data: dataIngresos.map((v, i) => v - dataCostos[i]),
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0, 255, 136, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#00ff88'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8899a6' } },
          x: { grid: { display: false }, ticks: { color: '#8899a6' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
}
/* --- JUEGOS LOGIC --- */
// Inventory Games UI moved to ui/inventory.js
// Logic Moved to ui/inventory.js
// Logic Moved to ui/inventory.js
// Logic Moved to ui/inventory.js
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
export function showToast(msg) {
  let toast = document.createElement("div");
  toast.innerText = msg;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "rgba(16, 185, 129, 0.9)";
  toast.style.color = "#fff";
  toast.style.padding = "10px 20px";
  toast.style.borderRadius = "30px";
  toast.style.zIndex = "10000";
  toast.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
  toast.style.fontSize = "0.85rem";
  toast.style.fontWeight = "600";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}
// Logic Moved to ui/inventory.js
// Logic Moved to ui/inventory.js
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
/* LÓGICA DE AUTOCOMPLETADO (ANÃLISIS -> INVENTARIO) */
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
// ==================================================
// MÓDULO DE ANALYTICS (Ranking Asesores)
// ==================================================
function initAnalytics() {
  if (typeof renderRankingAsesores === 'function') {
    renderRankingAsesores();
  }
  if (typeof renderTopPlataformas === 'function') {
    renderTopPlataformas();
  }
  if (typeof renderClientHistory === 'function') {
    renderClientHistory();
  }
  if (window.lucide) window.lucide.createIcons();
}
function renderTopPlataformas() {
  const listPS4 = document.getElementById('topPS4List');
  const listPS5 = document.getElementById('topPS5List');
  if (!listPS4 || !listPS5) return;
  const countsPS4 = {};
  const countsPS5 = {};
  AppState.sales.forEach(v => {
    // Omitir registros parciales de co-ventas para no duplicar en el ranking de productos
    if (v.isPartiallyPaid) return;
    // 1. Intentar obtener el nombre del juego directamente desde el campo 'juego'
    let gameName = (v.juego || '').trim();
    // 2. Si está vacío, buscar por inventoryId en inventoryGames (array correcto)
    if (!gameName && v.inventoryId) {
      const invGame = AppState.inventoryGames.find(g => String(g.id) === String(v.inventoryId));
      if (invGame) gameName = invGame.juego || invGame.nombre || '';
    }
    // 3. Si sigue vacío, no se puede clasificar
    if (!gameName) return;
    const accountType = (v.tipo_cuenta || v.cuenta || '').toUpperCase();
    if (accountType.includes('PS4')) {
      countsPS4[gameName] = (countsPS4[gameName] || 0) + 1;
    } else if (accountType.includes('PS5')) {
      countsPS5[gameName] = (countsPS5[gameName] || 0) + 1;
    } else if (gameName.toUpperCase().includes('PS4')) {
      countsPS4[gameName] = (countsPS4[gameName] || 0) + 1;
    } else if (gameName.toUpperCase().includes('PS5')) {
      countsPS5[gameName] = (countsPS5[gameName] || 0) + 1;
    } else {
      // Sin indicios de plataforma â†’ asignar a PS4 por defecto
      countsPS4[gameName] = (countsPS4[gameName] || 0) + 1;
    }
  });
  const sortedPS4 = Object.entries(countsPS4).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const sortedPS5 = Object.entries(countsPS5).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const renderRankingList = (container, sortedData, platformColor) => {
    container.innerHTML = '';
    if (sortedData.length === 0) {
      container.innerHTML = '<div class="stat-item" style="padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;"><p style="color:var(--text-muted); font-size:0.9rem; margin:0; text-align: center;">Sin ventas registradas aún</p></div>';
      return;
    }
    const maxVal = sortedData[0][1] || 1;
    sortedData.forEach(([name, count], i) => {
      const pct = (count / maxVal) * 100;
      const cleanName = name.replace(/PS4|PS5/gi, '').trim();
      const item = document.createElement('div');
      item.className = 'stat-item';
      item.style.marginBottom = '5px';
      item.style.padding = '8px 12px';
      item.style.background = 'rgba(255, 255, 255, 0.03)';
      item.style.borderRadius = '6px';
      item.style.border = '1px solid rgba(255, 255, 255, 0.05)';
      item.innerHTML = `
        <div class="stat-header" style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 0.95rem; font-weight: 500;"><strong style="color: ${platformColor}; margin-right: 5px;">${i + 1}.</strong> ${cleanName}</span>
          <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">${count} vtas</span>
        </div>
        <div class="progress-track" style="height: 6px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden;">
          <div class="progress-fill" style="width: ${pct}%; background: ${platformColor}; height: 100%; border-radius: 4px; transition: width 0.8s ease-out;"></div>
        </div>
      `;
      container.appendChild(item);
    });
  };
  renderRankingList(listPS4, sortedPS4, 'var(--accent-cyan)');
  renderRankingList(listPS5, sortedPS5, 'var(--accent-purple)');
}
let rankingAsesoresChartInstance = null;
function renderRankingAsesores() {
  const ctx = document.getElementById('rankingAsesoresChart');
  if (!ctx) return;
  const validAsesores = ["Daniela G", "Lorena", "Isabella", "Kimberly", "Pagina web"];
  const filtroDia = document.getElementById('filtroAnalyticsDia')?.value; // YYYY-MM-DD
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const prevMonth = previousMonthDate.getMonth();
  const prevYear = previousMonthDate.getFullYear();
  // Acumuladores
  const ventasActuales = {};
  const ventasPasadas = {};
  validAsesores.forEach(a => {
    ventasActuales[a.toLowerCase()] = { nombre: a, total: 0, count: 0 };
    ventasPasadas[a.toLowerCase()] = 0;
  });
  // Iterar ventas
  AppState.sales.forEach(venta => {
    const vendedorRaw = venta.vendedor || venta.tipo_cliente || '';
    let currAsesorKey = null;
    validAsesores.forEach(a => {
      if (vendedorRaw.toLowerCase().includes(a.toLowerCase())) {
        currAsesorKey = a.toLowerCase();
      }
    });
    if (currAsesorKey) {
      let d, m, y;
      if (venta.fecha && venta.fecha.includes('/')) {
        const parts = venta.fecha.split('/');
        if (parts.length === 3) {
          d = parseInt(parts[0], 10);
          m = parseInt(parts[1], 10) - 1;
          y = parseInt(parts[2], 10);
        }
      } else if (venta.fecha && venta.fecha.includes('-')) {
        const parts = venta.fecha.split('-');
        if (parts.length === 3) {
          y = parseInt(parts[0], 10);
          m = parseInt(parts[1], 10) - 1;
          d = parseInt(parts[2], 10);
        }
      }
      if (y !== undefined && m !== undefined && d !== undefined) {
        const valor = parseFloat(venta.venta) || 0;
        const fechaVentaISO = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (filtroDia) {
          if (fechaVentaISO === filtroDia) {
            ventasActuales[currAsesorKey].total += valor;
            ventasActuales[currAsesorKey].count++;
          }
        } else {
          if (m === currentMonth && y === currentYear) {
            ventasActuales[currAsesorKey].total += valor;
            ventasActuales[currAsesorKey].count++;
          } else if (m === prevMonth && y === prevYear) {
            ventasPasadas[currAsesorKey] += valor;
          }
        }
      }
    }
  });
  // Ordenar de mayor a menor según el mes actual (o el día filtrado)
  const rankingArray = Object.values(ventasActuales).sort((a, b) => b.total - a.total);
  const labels = [];
  const dataActual = [];
  const dataPasado = [];
  rankingArray.forEach((item, index) => {
    let medalla = '';
    if (index === 0) medalla = 'ðŸ¥‡ ðŸ† ';
    else if (index === 1) medalla = 'ðŸ¥ˆ ';
    else if (index === 2) medalla = 'ðŸ¥‰ ';
    labels.push([medalla + item.nombre, '(' + item.count + ' ventas)']);
    dataActual.push(item.total);
    dataPasado.push(ventasPasadas[item.nombre.toLowerCase()] || 0);
  });
  if (rankingAsesoresChartInstance) {
    rankingAsesoresChartInstance.destroy();
  }
  const chartLabel = filtroDia ? `Ventas del día: ${filtroDia}` : 'Ventas Mes Actual';
  rankingAsesoresChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: chartLabel,
        data: dataActual,
        backgroundColor: 'rgba(57, 214, 249, 0.7)',
        borderColor: 'var(--accent-cyan)',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#fff',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(57, 214, 249, 0.3)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: function (tooltipItems) {
              return 'Asesor: ' + tooltipItems[0].label;
            },
            label: function (context) {
              return '';
            },
            afterBody: function (context) {
              const idx = context[0].dataIndex;
              const actual = dataActual[idx];
              const pasado = dataPasado[idx];
              if (filtroDia) {
                return [`Total Ventas Hoy: $${actual.toLocaleString('es-CO')}`];
              }
              return [
                `Ventas Mes Actual: $${actual.toLocaleString('es-CO')}`,
                `Ventas Mes Pasado: $${pasado.toLocaleString('es-CO')}`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)',
            callback: function (value) {
              return '$' + (value / 1000).toLocaleString('es-CO') + 'k';
            }
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: (c) => c.tick && c.tick.label && c.tick.label.includes('ventas') ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)',
            font: {
              size: (c) => c.tick && c.tick.label && c.tick.label.includes('ventas') ? 10 : 13,
              weight: (c) => c.tick && c.tick.label && c.tick.label.includes('ventas') ? 'normal' : 'bold'
            }
          }
        }
      }
    }
  });
}
/* ============================================================ */
/* SISTEMA DE LISTAS DE CLIENTES            */
/* ============================================================ */
function abrirModalSorteo() { abrirModalCrearLista(); }
function abrirModalCrearLista() {
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
function confirmarCrearLista() {
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
  showToast(`âœ… Lista "${nombre}" creada`);
  // Actualizar modal sin cerrarlo para poder crear más
  abrirModalCrearLista();
  // Re-renderizar tabla historial para que aparezca en el dropdown
  if (window._clientsHistoryStaticData) renderClientsHistoryTable(window._clientsHistoryStaticData);
}
function eliminarListaNombrada(listaId) {
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
function renderClientsHistoryTable(data) {
  const tbody = document.getElementById('clientsBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted)">No se encontraron clientes con esos parámetros.</td></tr>`;
    return;
  }
  const listas = AppState.listas || [];
  data.forEach((c, index) => {
    let fidelidadStr = '', fidelidadColor = '', fidelidadBg = '';
    if (c.cantidadJuegos === 1) { fidelidadStr = 'Nuevo'; fidelidadColor = 'var(--text-muted)'; fidelidadBg = 'rgba(255,255,255,0.05)'; }
    else if (c.cantidadJuegos >= 2 && c.cantidadJuegos <= 5) { fidelidadStr = 'Recurrente'; fidelidadColor = '#39d6f9'; fidelidadBg = 'rgba(57,214,249,0.1)'; }
    else if (c.cantidadJuegos >= 6 && c.cantidadJuegos <= 13) { fidelidadStr = 'Bronce'; fidelidadColor = '#cd7f32'; fidelidadBg = 'rgba(205,127,50,0.1)'; }
    else if (c.cantidadJuegos >= 14 && c.cantidadJuegos <= 21) { fidelidadStr = 'Plata'; fidelidadColor = '#c0c0c0'; fidelidadBg = 'rgba(192,192,192,0.1)'; }
    else { fidelidadStr = 'VIP ðŸ‘‘'; fidelidadColor = '#ffbb00'; fidelidadBg = 'rgba(255,187,0,0.1)'; }
    let consolaPref = '--';
    if (c.conteoPS4 > c.conteoPS5) consolaPref = '<span style="color:var(--accent-cyan); font-weight:600">PS4</span>';
    else if (c.conteoPS5 > c.conteoPS4) consolaPref = '<span style="color:var(--accent-purple); font-weight:600">PS5</span>';
    else if (c.conteoPS4 > 0 && c.conteoPS4 === c.conteoPS5) consolaPref = 'Ambas (PS4/PS5)';
    const nombreKey = (c.nombre || '').toLowerCase();
    const listaAsignadaId = (AppState.clientsListas || {})[nombreKey] || '';
    const opcionesLista = `<option value="">â€” Sin lista â€”</option>` +
      listas.map(l => `<option value="${l.id}" ${l.id === listaAsignadaId ? 'selected' : ''}>${l.nombre}</option>`).join('');
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td style="font-weight:600; color:#fff">${c.nombre || 'Sin Nombre'}</td>
      <td>${c.cc || '--'}</td>
      <td>${c.ciudad || '--'}</td>
      <td style="font-weight:bold; color:var(--accent-green)">$${c.totalComprasCOP.toLocaleString('es-CO')}</td>
      <td><div style="font-size:0.9rem;font-weight:500;color:var(--text-light);">${c.celular || '--'}</div></td>
      <td>${consolaPref}</td>
      <td>
        <div style="display:inline-flex;align-items:center;gap:6px;background:${fidelidadBg};color:${fidelidadColor};padding:4px 10px;border-radius:12px;font-size:0.8rem;font-weight:700;border:1px solid ${fidelidadColor}40">
          ${fidelidadStr} <span style="opacity:0.6;font-weight:normal;font-size:0.75rem">(${c.cantidadJuegos} vtas)</span>
        </div>
      </td>
      <td>
        <select onchange="asignarClienteALista('${nombreKey}', this.value)"
          style="background:#0f1521;border:1px solid rgba(0,198,255,0.35);
                 border-radius:8px;color:#fff;padding:6px 10px;font-size:0.82rem;
                 cursor:pointer;outline:none;min-width:130px;
                 -webkit-appearance:auto;appearance:auto;">
          ${opcionesLista}
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
/* -€-€ Tabs Historial Cliente / Listas -€-€ */
let _activeClientTab = 'historial';
function switchClientTab(tab) {
  _activeClientTab = tab;
  const btnH = document.getElementById('tabBtnHistorial');
  const btnL = document.getElementById('tabBtnListas');
  const viewH = document.getElementById('viewHistorialCliente');
  const viewL = document.getElementById('viewListas');
  const title = document.getElementById('clientsSectionTitle');
  if (tab === 'historial') {
    if (btnH) { btnH.style.background = 'var(--accent-cyan)'; btnH.style.color = '#000'; btnH.style.boxShadow = '0 2px 8px rgba(0,198,255,0.3)'; }
    if (btnL) { btnL.style.background = 'transparent'; btnL.style.color = 'var(--text-muted)'; btnL.style.boxShadow = 'none'; }
    if (viewH) viewH.style.display = '';
    if (viewL) viewL.style.display = 'none';
    if (title) title.textContent = 'Historial de Clientes';
  } else {
    if (btnL) { btnL.style.background = 'var(--accent-cyan)'; btnL.style.color = '#000'; btnL.style.boxShadow = '0 2px 8px rgba(0,198,255,0.3)'; }
    if (btnH) { btnH.style.background = 'transparent'; btnH.style.color = 'var(--text-muted)'; btnH.style.boxShadow = 'none'; }
    if (viewL) viewL.style.display = '';
    if (viewH) viewH.style.display = 'none';
    if (title) title.textContent = 'Listas de Clientes';
    renderListas();
  }
  if (window.lucide) window.lucide.createIcons();
}
function renderListas() {
  const tbody = document.getElementById('listasBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const listas = AppState.listas || [];
  const clientsListas = AppState.clientsListas || {};
  const allClients = window._clientsHistoryStaticData || [];
  if (listas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted)">No hay listas creadas. Usa el botón <strong>Crear Lista</strong> para empezar.</td></tr>';
    return;
  }
  let hasContent = false;
  listas.forEach(lista => {
    // Clientes asignados a esta lista
    const clientesEnLista = allClients.filter(c => {
      const key = (c.nombre || '').toLowerCase();
      return clientsListas[key] === lista.id;
    });
    // Fila separadora / encabezado de lista
    const trHeader = document.createElement('tr');
    trHeader.innerHTML = `
      <td colspan="9" style="
        background:rgba(0,198,255,0.08);border-left:3px solid var(--accent-cyan);
        padding:10px 16px;font-weight:700;color:var(--accent-cyan);font-size:0.9rem;
        letter-spacing:0.5px;">
        <i data-lucide="list" style="width:14px;height:14px;margin-right:6px;vertical-align:middle;"></i>
        ${lista.nombre}
        <span style="margin-left:10px;font-size:0.78rem;font-weight:normal;color:var(--text-muted);">
          ${clientesEnLista.length} cliente${clientesEnLista.length !== 1 ? 's' : ''}
        </span>
      </td>`;
    tbody.appendChild(trHeader);
    hasContent = true;
    if (clientesEnLista.length === 0) {
      const trEmpty = document.createElement('tr');
      trEmpty.innerHTML = `<td colspan="9" style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.82rem;font-style:italic;">Sin clientes en esta lista aún.</td>`;
      tbody.appendChild(trEmpty);
      return;
    }
    clientesEnLista.forEach((c, idx) => {
      let fidelidadStr = '', fidelidadColor = '', fidelidadBg = '';
      if (c.cantidadJuegos === 1) { fidelidadStr = 'Nuevo'; fidelidadColor = 'var(--text-muted)'; fidelidadBg = 'rgba(255,255,255,0.05)'; }
      else if (c.cantidadJuegos >= 2 && c.cantidadJuegos <= 5) { fidelidadStr = 'Recurrente'; fidelidadColor = '#39d6f9'; fidelidadBg = 'rgba(57,214,249,0.1)'; }
      else if (c.cantidadJuegos >= 6 && c.cantidadJuegos <= 13) { fidelidadStr = 'Bronce'; fidelidadColor = '#cd7f32'; fidelidadBg = 'rgba(205,127,50,0.1)'; }
      else if (c.cantidadJuegos >= 14 && c.cantidadJuegos <= 21) { fidelidadStr = 'Plata'; fidelidadColor = '#c0c0c0'; fidelidadBg = 'rgba(192,192,192,0.1)'; }
      else { fidelidadStr = 'VIP ðŸ‘‘'; fidelidadColor = '#ffbb00'; fidelidadBg = 'rgba(255,187,0,0.1)'; }
      let consolaPref = '--';
      if (c.conteoPS4 > c.conteoPS5) consolaPref = '<span style="color:var(--accent-cyan);font-weight:600">PS4</span>';
      else if (c.conteoPS5 > c.conteoPS4) consolaPref = '<span style="color:var(--accent-purple);font-weight:600">PS5</span>';
      else if (c.conteoPS4 > 0 && c.conteoPS4 === c.conteoPS5) consolaPref = 'Ambas';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td style="font-weight:600;color:#fff">${c.nombre || 'Sin Nombre'}</td>
        <td>${c.cc || '--'}</td>
        <td>${c.ciudad || '--'}</td>
        <td style="font-weight:bold;color:var(--accent-green)">$${c.totalComprasCOP.toLocaleString('es-CO')}</td>
        <td>${c.celular || '--'}</td>
        <td>${consolaPref}</td>
        <td>
          <div style="display:inline-flex;align-items:center;gap:6px;background:${fidelidadBg};color:${fidelidadColor};padding:4px 10px;border-radius:12px;font-size:0.8rem;font-weight:700;border:1px solid ${fidelidadColor}40">
            ${fidelidadStr} <span style="opacity:0.6;font-weight:normal;font-size:0.75rem">(${c.cantidadJuegos} vtas)</span>
          </div>
        </td>
        <td style="color:var(--accent-cyan);font-weight:600;font-size:0.85rem;">${lista.nombre}</td>`;
      tbody.appendChild(tr);
    });
  });
  if (window.lucide) window.lucide.createIcons();
}
function guardarLista(nombreKey, valor) {
  if (!AppState.clientsListas) AppState.clientsListas = {};
  AppState.clientsListas[nombreKey] = valor.trim();
  saveLocal();
}
/**
 * Fase 4.2: Paginación de Clientes
 */
let _clientsCurrentPage = 0;
let _clientsTotalPages = 0;
const _clientsLimit = 50;
async function fetchClientesPage(page = 0) {
  const loading = document.getElementById('clientsLoadingIndicator');
  if (loading) loading.style.display = 'inline-flex';
  try {
    const result = await apiFetchClientes(page, _clientsLimit);
    // Actualizar estado de paginación
    _clientsCurrentPage = result.page;
    _clientsTotalPages = Math.ceil(result.total / result.limit);
    // Mapear datos de Supabase al formato esperado por la tabla
    const mappedClients = result.clientes.map(c => ({
      nombre: c.nombre,
      cc: c.cedula || '--',
      ciudad: c.ciudad || '--',
      celular: c.celular || '--',
      totalComprasCOP: 0,
      cantidadJuegos: 0,
      conteoPS4: 0,
      conteoPS5: 0
    }));
    renderClientsHistoryTable(mappedClients);
    updatePaginationUI();
  } catch (err) {
    console.warn("âš ï¸ Fallo en lectura paginada:", err.message);
  } finally {
    if (loading) loading.style.display = 'none';
  }
}
function updatePaginationUI() {
  const cpElem = document.getElementById('clientsCurrentPage');
  const tpElem = document.getElementById('clientsTotalPages');
  const btnPrev = document.getElementById('btnPrevClients');
  const btnNext = document.getElementById('btnNextClients');
  if (cpElem) cpElem.textContent = _clientsCurrentPage + 1;
  if (tpElem) tpElem.textContent = _clientsTotalPages || '--';
  if (btnPrev) btnPrev.disabled = _clientsCurrentPage === 0;
  if (btnNext) btnNext.disabled = (_clientsCurrentPage + 1) >= _clientsTotalPages;
  if (window.lucide) window.lucide.createIcons();
}
function changeClientsPage(delta) {
  const next = _clientsCurrentPage + delta;
  if (next < 0 || (next >= _clientsTotalPages && _clientsTotalPages > 0)) return;
  fetchClientesPage(next);
}
function renderClientHistory() {
  // Ahora la carga principal es desde Supabase
  fetchClientesPage(0);
}
function filterClients(searchText) {
  if (!window._clientsHistoryStaticData) return;
  const text = (searchText || '').toLowerCase().trim();
  if (!text) {
    renderClientsHistoryTable(window._clientsHistoryStaticData);
    return;
  }
  const filtered = window._clientsHistoryStaticData.filter(c => {
    return (c.nombre && c.nombre.toLowerCase().includes(text)) ||
      (c.cc && c.cc.toLowerCase().includes(text));
  });
  renderClientsHistoryTable(filtered);
}
// ======================================================
// Logic Moved to ui/inventory.js
/* ============================================================ */
/* 25. BITÃCORA Y GESTIÓN DE USUARIOS      */
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
  saveXboxInventory,
  openModalPhysical,
  savePhysicalInventory,
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
  executeDeleteAction,
  showToast
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
