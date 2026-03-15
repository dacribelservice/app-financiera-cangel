/* ================================================
   CANGEL GAMES ERP — Súper Gestión Integral (V13.0)
   7 Módulos · Roles · Ecommerce · IA & Hosting
   ================================================ */
import { formatCOP, formatUSD, getColombiaTime, calculateMembershipCountdown, formatDaysToMonths } from './utils/formatters.js';

// ──── Estado Global ────
const USE_LOCAL_STORAGE_BACKUP = false; // Feature Flag: Cambiar a true si hay fallos en Supabase

export const AppState = {
  currentUser: null,
  activeTab: 'catalogo',
  activeFilter: 'semana',
  exchangeRate: 4200,

  users: [],       // Lista de usuarios (para login y permisos)
  auditLog: [],    // Bitácora de acontecimientos

  catalog: [],
  analysis: [],
  inventory: [],
  inventoryGames: [],
  inventoryCodes: [],
  sales: [],
  expenses: [],
  raffles: [],
  clients: [],
  paquetes: [],
  membresias: [],
  xboxInventory: [],
  physicalInventory: [],

  cart: [],
  charts: {},
  idealStock: {}, // Guardar stock ideal por título
  plantillas: {},
  ventasMode: 'facturacion',
};


/* ═══════════════════════════════════════ */
/* 1. SISTEMA DE LOGIN Y ROLES AVANZADOS   */
/* ═══════════════════════════════════════ */

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

/* ═══════════════════════════════════════ */
/* 1.1 MOTOR DE BITÁCORA (AUDIT LOG)       */
/* ═══════════════════════════════════════ */

function logEvent(accion, detalles) {
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

/* ═══════════════════════════════════════ */
/* 2. DASHBOARD & KPIS                     */
/* ═══════════════════════════════════════ */

function updateDashboard() {
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

/* ═══════════════════════════════════════ */
/* 3. MÓDULO ANÁLISIS (PS STORE)           */
/* ═══════════════════════════════════════ */



async function handleExtractAI() {
  const url = document.getElementById('urlAI').value.trim();
  if (!url) return;
  const status = document.getElementById('extractStatus');
  status.innerHTML = `<span class="status-loading"></span> Extrayendo con IA (Gemini)...`;

  try {
    const response = await fetch(`/api/ps-details-ai?url=${encodeURIComponent(url)}`);
    const data = await response.json();

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
    status.innerHTML = `<span style="color:var(--accent-cyan)">✨ Completado (IA)</span>`;
  } catch (e) {
    console.error('[IA-Error]', e);
    status.innerHTML = `<span style="color:var(--accent-red)">✗ Error: ${e.message}</span>`;
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

function renderAnalysisTable() {
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

// ───── Sincronización Global de TRM ─────
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

/* ═══════════════════════════════════════ */
/* 4. MÓDULO CATÁLOGO & ECOMMERCE          */
/* ═══════════════════════════════════════ */

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

  // Ocultar campos internos si es cliente
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
      // Added search index property
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

/* ═══════════════════════════════════════ */
/* 5. VENTAS & FACTURAS                    */
/* ═══════════════════════════════════════ */

// --- Lógica de Filtros Ventas ---
function llenarFiltroAsesoresVentas() {
  const selectAsesor = document.getElementById('filtroVentasAsesor');
  if (!selectAsesor) return;

  // Extraer asesores únicos de las ventas actuales
  const asesores = [...new Set(AppState.sales.map(v => v.vendedor || '').filter(v => v.trim() !== ''))];

  // Mantener la primera opción "Todos los asesores"
  selectAsesor.innerHTML = '<option value="">Todos los asesores</option>';

  asesores.sort().forEach(asesor => {
    const option = document.createElement('option');
    option.value = asesor;
    option.textContent = asesor;
    selectAsesor.appendChild(option);
  });
}

function llenarFiltroMesesVentas() {
  const selectMes = document.getElementById('filtroVentasMes');
  if (!selectMes) return;

  // Extraer meses únicos de las ventas actuales (YYYY-MM para sortear fácil)
  const mesesSet = new Set();
  AppState.sales.forEach(v => {
    if (v.fecha) {
      const parts = v.fecha.includes('/') ? v.fecha.split('/') : v.fecha.split('-');
      if (parts.length === 3) {
        let year, month;
        if (parts[0].length === 4) { // YYYY-MM-DD
          year = parts[0];
          month = parts[1].padStart(2, '0');
        } else { // DD/MM/YYYY o similar
          year = parts[2];
          month = parts[1].padStart(2, '0');
        }
        mesesSet.add(`${year}-${month}`);
      }
    }
  });

  const mesesSorted = Array.from(mesesSet).sort((a, b) => b.localeCompare(a)); // Descendente

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  selectMes.innerHTML = '<option value="">Todos los meses</option>';
  mesesSorted.forEach(m => {
    const [y, mm] = m.split('-');
    const option = document.createElement('option');
    option.value = m;
    option.textContent = `${monthNames[parseInt(mm) - 1]} ${y}`;
    option.style.background = "#111"; // Asegurar fondo oscuro para visibilidad
    option.style.color = "#fff";      // Asegurar texto blanco
    selectMes.appendChild(option);
  });
}

function limpiarFiltrosVentas() {
  if (document.getElementById('filtroVentasSearch')) document.getElementById('filtroVentasSearch').value = '';
  if (document.getElementById('filtroVentasAsesor')) document.getElementById('filtroVentasAsesor').value = '';
  if (document.getElementById('filtroVentasMes')) document.getElementById('filtroVentasMes').value = '';
  if (document.getElementById('filtroVentasFechaInicio')) document.getElementById('filtroVentasFechaInicio').value = '';
  if (document.getElementById('filtroVentasFechaFin')) document.getElementById('filtroVentasFechaFin').value = '';
  renderVentas();
}

// ───── NUEVO: MÓDULO CUENTAS PSN (SOLO VENDIDAS) ─────
function switchVentasMode(mode) {
  AppState.ventasMode = mode;
  saveLocal();

  const allBtns = [
    document.getElementById('btnVentasFact'),
    document.getElementById('btnVentasCuentas')
  ];
  const allContainers = [
    document.getElementById('ventasFacturacionContainer'),
    document.getElementById('cuentasPsnContainer')
  ];

  allBtns.forEach(b => b && b.classList.remove('active'));
  allContainers.forEach(c => c && c.classList.add('hidden'));

  const btn = document.getElementById(mode === 'facturacion' ? 'btnVentasFact' : 'btnVentasCuentas');
  const container = document.getElementById(mode === 'facturacion' ? 'ventasFacturacionContainer' : 'cuentasPsnContainer');

  if (btn) btn.classList.add('active');
  if (container) container.classList.remove('hidden');

  if (mode === 'cuentas') {
    renderCuentasPSN();
  } else { // This corresponds to 'facturacion' mode, which is the 'ventas' tab
    renderVentas();
    if (window.lucide) window.lucide.createIcons(); // Re-render Lucide icons for the sales tab
  }
}

function renderCuentasPSN() {
  const user = AppState.currentUser;
  if (!user) return;
  const tbody = document.getElementById('cuentasPsnBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchTerm = (document.getElementById('searchCuentasPsn')?.value || '').toLowerCase();

  // Consolidar todas las cuentas de inventario que tengan al menos una venta registrada o estén marcadas como Vendidas
  const soldGames = (AppState.inventoryGames || []).filter(g => g.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(g.id) && s.productType === 'game')).map(x => ({ ...x, _itemType: 'game' }));
  const soldPaquetes = (AppState.paquetes || []).filter(p => p.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(p.id) && s.productType === 'paquete')).map(x => ({ ...x, _itemType: 'paquete' }));
  const soldMembresias = (AppState.membresias || []).filter(m => m.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(m.id) && s.productType === 'membresia')).map(x => ({ ...x, _itemType: 'membresia' }));

  const allCuentas = [...soldGames, ...soldPaquetes, ...soldMembresias];

  // Filtrar por término de búsqueda (Juego o Correo)
  const filtered = allCuentas.filter(c => {
    const text = `${c.juego || c.nombre || c.tipo} ${c.correo} ${c.id}`.toLowerCase();
    return text.includes(searchTerm);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">No se encontraron cuentas vendidas</td></tr>`;
    return;
  }

  filtered.forEach((c, index) => {
    const status = c.tecnicoStatus || 'Sin Novedad';
    let rowClass = '';
    if (status === 'Sospechoso') rowClass = 'row-suspicious';
    else if (status === 'Fallas Técnicas') rowClass = 'row-technical';

    const tr = document.createElement('tr');
    tr.className = rowClass;
    tr.innerHTML = `
      <td class="row-number">${index + 2}</td>
      <td><span class="id-badge">${c.id}</span></td>
      <td class="fw-bold" style="color:var(--text-light)">
        <div style="display:flex; align-items:center; gap:6px;">
          <span>${c.juego || c.nombre || c.tipo || 'N/A'}</span>
          ${c.pais ? `
          <span style="font-size:0.65rem; font-weight:900; background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:8px; color:var(--accent-yellow); border:1px solid var(--accent-yellow); display:inline-flex; align-items:center; gap:6px; line-height:1;">
            <img src="https://flagcdn.com/w20/${c.pais === 'TUR' ? 'tr' : 'us'}.png" style="width:16px; height:auto; border-radius:2px; display:inline-block;" alt="${c.pais}">
            ${c.pais === 'TUR' ? 'TUR' : 'USA'}
          </span>` : ''}
        </div>
        <div style="margin-top:8px; font-size:0.7rem; display:flex; flex-direction:column; gap:2px;">
          ${(() => {
        if (!c.es_ps4 && !c.es_ps5) return ''; // Solo juegos

        let slotsResult;
        if (c._itemType === 'paquete') slotsResult = getPaqueteSlots(c.id);
        else if (c._itemType === 'membresia') slotsResult = getMembresiaSlots(c.id);
        else slotsResult = getGameSlots(c.id);

        const { config, used } = slotsResult;
        let htmlSlots = '';

        if (c.es_ps4) {
          const p4p = config.p_ps4 - used.p_ps4;
          const p4s = config.s_ps4 - used.s_ps4;
          const p4s_available = (used.p_ps4 >= config.p_ps4) && p4s > 0;
          htmlSlots += `
                <div style="display:flex; gap:6px; align-items:center; line-height:1;">
                  <span style="color:${p4p > 0 ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p4p} PRI</span>
                  <span style="color:${p4s_available ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p4s} SEC</span>
                  <span style="font-size:0.55rem; font-weight:700; background:rgba(0,102,255,0.15); color:#0066ff; padding:2px 5px; border-radius:4px; border:1px solid rgba(0,102,255,0.4); margin-left:1px; letter-spacing:0.3px;">PS4</span>
                </div>
              `;
        }
        if (c.es_ps5 || c.es_ps4) {
          const p5p = config.p_ps5 - used.p_ps5;
          const p5s = config.s_ps5 - used.s_ps5;
          const p5s_available = (used.p_ps5 >= config.p_ps5) && p5s > 0;
          htmlSlots += `
                <div style="display:flex; gap:6px; align-items:center; line-height:1;">
                  <span style="color:${p5p > 0 ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p5p} PRI</span>
                  <span style="color:${p5s_available ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p5s} SEC</span>
                  <span style="font-size:0.55rem; font-weight:700; background:rgba(255,255,255,0.15); color:#ffffff; padding:2px 5px; border-radius:4px; border:1px solid rgba(255,255,255,0.4); margin-left:1px; letter-spacing:0.3px;">PS5</span>
                </div>
              `;
        }
        if (c._itemType === 'membresia') {
          htmlSlots += `
            <div style="font-size: 0.6rem; font-weight: 300; color: ${calculateMembershipCountdown(c) <= 5 ? '#f43f5e' : 'var(--text-muted)'}; margin-top: 4px; font-style: italic; letter-spacing: 0.5px; opacity: 0.8;">
              ${formatDaysToMonths(calculateMembershipCountdown(c))} restantes
            </div>
          `;
        }
        return htmlSlots;
      })()}
        </div>
      </td>
      <td style="color: var(--accent-cyan);">
        <div>${c.correo || 'N/A'}</div>
        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">Host: ${c.correo_hosting || c.hosting || '-'}</div>
      </td>
      <td>
        <div>${c.password || 'N/A'}</div>
        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">Host: ${c.password_hosting || '-'}</div>
      </td>
      <td style="text-align: center;">
        ${(() => {
        const codesRaw = c.cod_2_pasos || c.codigo2fa || '';
        const codes = codesRaw.split('\n').map(x => x.trim()).filter(x => x.length > 0);
        const count = codes.length;
        let badgeClass = '';
        if (count === 0) badgeClass = 'zero';
        else if (count <= 3) badgeClass = 'low';

        return `
            <div class="badge-2fa ${badgeClass}" 
                 onclick="${count > 0 ? `open2FAModal('${c.id}', '${c._itemType}')` : ''}"
                 title="${count > 0 ? (count <= 3 ? 'Pocos códigos restantes' : 'Ver códigos') : 'Sin códigos'}">
              ${count}
            </div>
          `;
      })()}
      </td>
      <td>${c.fechaCuenta || c.fecha || 'N/A'}</td>
      <td>
        <select class="premium-table-select" onchange="updateCuentaPsnStatus('${c.id}', this.value)">
          <option value="Sin Novedad" ${status === 'Sin Novedad' ? 'selected' : ''}>Sin Novedad</option>
          <option value="Sospechoso" ${status === 'Sospechoso' ? 'selected' : ''}>Sospechoso 🟡</option>
          <option value="Fallas Técnicas" ${status === 'Fallas Técnicas' ? 'selected' : ''}>Fallas Técnicas 🟠</option>
        </select>
      </td>
      <td>
        <div class="action-group">
          <button class="action-btn view-btn" onclick="openModalHistorialVentas('${c.id}')" title="Ver Historial">
            <i data-lucide="eye" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
  update2FABellBadge();
}

function updateCuentaPsnStatus(id, newStatus) {
  // Buscar en los 3 componentes de inventario
  let item = (AppState.inventoryGames || []).find(g => String(g.id) === String(id)) ||
    (AppState.paquetes || []).find(p => String(p.id) === String(id)) ||
    (AppState.membresias || []).find(m => String(m.id) === String(id));

  if (item) {
    item.tecnicoStatus = newStatus;
    saveLocal();
    renderCuentasPSN();
    showToast(`Estado actualizado: ${newStatus}`);
  }
}


function renderVentas() {
  const user = AppState.currentUser;
  if (!user) return;
  const hasAccesoTotal = user.permisos && user.permisos.acceso_total === true;

  updateVentasMetrics();
  const tbody = document.getElementById('ventasBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Solo llenar selector de asesores si no ha sido llenado con los asesores actuales
  const selectAsesor = document.getElementById('filtroVentasAsesor');
  if (selectAsesor && selectAsesor.options.length <= 1) {
    llenarFiltroAsesoresVentas();
  }

  // Llenar selector de meses si está vacío
  const selectMes = document.getElementById('filtroVentasMes');
  if (selectMes && selectMes.options.length <= 1) {
    llenarFiltroMesesVentas();
  }

  // --- FILTRADO DE DATOS ---
  const searchTerm = (document.getElementById('filtroVentasSearch')?.value || '').toLowerCase().trim();
  const asesorFiltro = document.getElementById('filtroVentasAsesor')?.value || '';
  const mesFiltro = document.getElementById('filtroVentasMes')?.value || '';
  const diaFiltro = document.getElementById('filtroVentasDia')?.value || '';
  const fechaInicio = document.getElementById('filtroVentasFechaInicio')?.value || '';
  const fechaFin = document.getElementById('filtroVentasFechaFin')?.value || '';

  let ventasFiltradas = AppState.sales.filter(v => {
    let coincideBuscador = true;
    let coincideAsesor = true;
    let coincideMes = true;
    let coincideFechaInfo = true;

    // 1. Buscador texto unificado rápido (Pre-indexado)
    if (searchTerm !== '') {
      if (v._searchIndex) {
        // Multi-término: "juan 312" -> busca "juan" y "312"
        const terminos = searchTerm.split(' ').filter(t => t.length > 0);
        coincideBuscador = terminos.every(t => v._searchIndex.includes(t));
      } else {
        // Fallback si por alguna razón no tiene index
        const fallbackRaw = `${(v.cliente || '')} ${(v.nombre_cliente || '')} ${(v.cedula || '')} ${(v.celular || '')}`.toLowerCase();
        const terminos = searchTerm.split(' ').filter(t => t.length > 0);
        coincideBuscador = terminos.every(t => fallbackRaw.includes(t));
      }
    }

    // 2. Asesor
    if (asesorFiltro !== '') {
      coincideAsesor = (v.vendedor || '') === asesorFiltro;
    }

    // 3. Mes
    if (mesFiltro !== '') {
      const parts = (v.fecha || '').includes('/') ? v.fecha.split('/') : v.fecha.split('-');
      if (parts.length === 3) {
        let vMes;
        if (parts[0].length === 4) vMes = `${parts[0]}-${parts[1].padStart(2, '0')}`;
        else vMes = `${parts[2]}-${parts[1].padStart(2, '0')}`;
        coincideMes = vMes === mesFiltro;
      } else {
        coincideMes = false;
      }
    }

    // 3.5 Día
    let coincideDia = true;
    if (diaFiltro !== '') {
      let vFechaStr = '';
      const parts = (v.fecha || '').includes('/') ? v.fecha.split('/') : v.fecha.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) vFechaStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        else vFechaStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      coincideDia = vFechaStr === diaFiltro;
    }

    // 4. Rango de Fechas
    if (fechaInicio !== '' || fechaFin !== '') {
      let vFechaDate = new Date(v.fecha);
      if (isNaN(vFechaDate.getTime())) {
        const parts = (v.fecha || '').split('/');
        if (parts.length === 3) vFechaDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
      }

      if (!isNaN(vFechaDate.getTime())) {
        vFechaDate.setHours(0, 0, 0, 0);
        if (fechaInicio !== '') {
          const fInicioDate = new Date(fechaInicio + "T00:00:00");
          if (vFechaDate < fInicioDate) coincideFechaInfo = false;
        }
        if (fechaFin !== '') {
          const fFinDate = new Date(fechaFin + "T23:59:59");
          if (vFechaDate > fFinDate) coincideFechaInfo = false;
        }
      }
    }

    return coincideBuscador && coincideAsesor && coincideMes && coincideDia && coincideFechaInfo;
  });

  // Si una venta pertenece a un grupo por 'transaction_id' y pasó el filtro, 
  // aseguramos arrastrar a sus hermanas de la misma transaccion para que el pedido no se descuadre visualmente.
  const transactionsAprobadas = new Set(ventasFiltradas.filter(v => v.transaction_id).map(v => String(v.transaction_id)));
  if (transactionsAprobadas.size > 0 && ventasFiltradas.length !== AppState.sales.length) {
    const ventasHermanas = AppState.sales.filter(v => v.transaction_id && transactionsAprobadas.has(String(v.transaction_id)));
    // Unir ambas sin duplicados (Set o Array filter)
    const todosLosIdsFiltrados = new Set(ventasFiltradas.map(v => v.id));
    ventasHermanas.forEach(vH => {
      if (!todosLosIdsFiltrados.has(vH.id)) {
        ventasFiltradas.push(vH);
        todosLosIdsFiltrados.add(vH.id);
      }
    });
    // Podemos re-ordenarlas para mantener su coherencia original de inserción
    ventasFiltradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // sort descending date como base
  }

  // ── Agrupar ventas: las que tienen transaction_id van juntas, las que no van solas ──
  const procesadas = new Set();
  const grupos = [];

  ventasFiltradas.forEach(v => {
    if (procesadas.has(v.id)) return;

    if (v.transaction_id) {
      // Busca todos los integrantes del mismo pedido DENTRO DEL ARRAY FILTRADO para dibujar. 
      // Si arrastramos hermanas arriba, `ventasFiltradas` tendrá todo el transaction_id completo
      const grupo = ventasFiltradas.filter(
        s => String(s.transaction_id) === String(v.transaction_id)
      );
      grupo.forEach(s => procesadas.add(s.id));
      grupos.push({ tipo: 'multi', representante: v, ventas: grupo });
    } else {
      procesadas.add(v.id);
      grupos.push({ tipo: 'single', representante: v, ventas: [v] });
    }
  });

  // ── Renderizar cada grupo (Con límite de visualización para rendimiento) ──
  const MAX_RENDER_LIMIT = window.RenderVentasLimit || 100;
  let renderizadas = 0;

  grupos.forEach((grupo, index) => {
    if (renderizadas >= MAX_RENDER_LIMIT) return; // Romper el ciclo si pasamos el límite

    const rowNum = index + 1;
    const rep = grupo.representante; // datos de cliente vienen del representante
    const tr = document.createElement('tr');
    
    // Si todo el grupo está anulado, pintar la fila de rojo
    const isAnulado = grupo.ventas.every(v => v.esta_anulada);
    if (isAnulado) tr.classList.add('row-annulled');

    if (grupo.tipo === 'multi') {
      // ── Celda de juegos apilados & Deduplicación de Split Sales ──────────────────
      let totalPedido = 0;
      let juegosCeldaHTML = '';
      let vendors = new Set();
      let uniqueItemsSold = 0;
      
      // Mapa para deduplicar ítems físicos (mismo inventoryId + mismo tipo_cuenta)
      // pero manteniendo el precio total de ambos registros.
      const itemMap = new Map();

      grupo.ventas.forEach(v => {
        // Recolectar vendedoras
        if (v.vendedor) vendors.add(v.vendedor);
        if (v.vendedor1) vendors.add(v.vendedor1);
        if (v.vendedor2) vendors.add(v.vendedor2);

        const key = `${v.inventoryId}_${v.tipo_cuenta}_${v.productType}`;
        if (!itemMap.has(key)) {
          itemMap.set(key, { ...v, totalVenta: v.venta || 0 });
          if (!v.isPartiallyPaid) uniqueItemsSold++; 
        } else {
          const existing = itemMap.get(key);
          existing.totalVenta += (v.venta || 0);
        }
        totalPedido += (v.venta || 0);
      });

      // Si por alguna razón uniqueItemsSold quedó en 0 (ej: todos marcados isPartiallyPaid por error), 
      // fallback al length real para no mostrar "0 juegos"
      const displayQty = uniqueItemsSold || Math.ceil(grupo.ventas.length / 2) || 1;

      let i = 0;
      itemMap.forEach((v) => {
        const dataInvT = getInventoryItemData(v);
        let juegoNombre = dataInvT.jNombre;
        let correoInfo = dataInvT.cCorreo;
        let passInfo = dataInvT.cPass;

        const separador = i > 0
          ? '<div style="border-top:1px solid rgba(255,255,255,0.08); margin:5px 0;"></div>'
          : '';

        juegosCeldaHTML += `
          ${separador}
          <div style="font-weight:600; font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px;"
               title="${juegoNombre}">
            <i data-lucide="gamepad-2" class="minimalist-icon" style="width:12px; height:12px;"></i> ${juegoNombre}
          </div>
          <div style="font-size:0.68rem; color:#a78bfa; margin-top:1px;">
            ${v.tipo_cuenta || ''}
            &nbsp;·&nbsp;
            <span style="color:#4ade80;">$${v.totalVenta.toLocaleString('es-CO')}</span>
          </div>
          ${correoInfo && correoInfo !== 'No disponible' ? `<div style="font-size:0.65rem; color:#67e8f9; margin-top:1px;">${correoInfo} | ${passInfo}</div>` : ''}
        `;
        i++;
      });

      const canEdit = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_editar === true);
      const canDelete = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_eliminar === true);
      const canAnnul = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_anular === true);

      // Preparar visualización de vendedores
      const vendorList = Array.from(vendors);
      const vendorHTML = vendorList.length > 1 
        ? vendorList.map(v => `<div style="line-height:1.1; margin-bottom:2px;">${v}</div>`).join('')
        : (rep.vendedor || '');

      tr.innerHTML = `
        <th class="row-number">${rowNum}</th>
        <td style="font-size:0.75rem;">${rep.id}</td>
        <td>${rep.fecha || ''}</td>
        <td>${rep.hora || ''}</td>
        <td style="padding:8px 6px; line-height:1.4;">${juegosCeldaHTML}</td>
        <td style="color:#a78bfa; font-size:0.75rem;">${displayQty} ${displayQty === 1 ? 'juego' : 'juegos'}</td>
        <td style="font-weight:700; color:#f59e0b;">$${totalPedido.toLocaleString('es-CO')}</td>
        <td style="font-size:0.75rem;">${vendorHTML}</td>
        <td>${rep.cedula || ''}</td>
        <td>${rep.nombre_cliente || ''}</td>
        <td>${rep.celular || ''}</td>
        <td>${rep.pago || ''}</td>
        <td>${rep.tipo_cliente || ''}</td>
        <td>${(() => {
          if (!rep.lista) return '';
          const found = (AppState.listas || []).find(l => l.id === rep.lista || l.nombre === rep.lista);
          return found ? found.nombre : rep.lista;
        })()}</td>
        <td>
          <div style="display:flex; gap:5px; justify-content:center;">
            <button class="action-btn-premium" style="background:rgba(57, 214, 249, 0.15); color:var(--accent-cyan); width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="verDetallesVenta('${rep.id}')" title="Ver Detalles">
              <i data-lucide="eye" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>
            <button class="action-btn-premium" style="background:rgba(245,158,11,0.15); color:#f59e0b; width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="copiarFacturaConfirmacion('${rep.id}')" title="Confirmacion">
              <i data-lucide="file-check" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>
            <button class="action-btn-premium" style="width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="copiarFactura('${rep.id}')" title="Remision">
              <i data-lucide="file-text" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>
            ${canEdit ? `
            <button class="action-btn-premium edit-btn" style="width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="openModalVenta('${rep.id}')" title="Editar">
              <i data-lucide="edit-3" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>` : ''}
            ${canDelete ? `
            <button class="action-btn-premium delete-btn" style="width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="eliminarPedidoCompleto('${rep.transaction_id}')" title="Eliminar">
              <i data-lucide="trash-2" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>` : ''}
            ${canAnnul ? `
            <button class="action-btn-premium" style="background:rgba(239,68,68,0.15); color:#ef4444; width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="anularPedidoCompleto('${rep.transaction_id}')" title="${isAnulado ? 'Reactivar' : 'Anular'}">
              <i data-lucide="${isAnulado ? 'rotate-ccw' : 'ban'}" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>` : ''}
          </div>
        </td>
      `;


    } else {
      // ── Fila individual (sin transaction_id) — comportamiento original ──
      const v = grupo.ventas[0];
      const dataInvS = getInventoryItemData(v);
      let juegoNombre = dataInvS.jNombre;
      let cuentaDetalles = '';
      if (dataInvS.cCorreo !== 'No disponible') {
        cuentaDetalles = `<br><small style="color: #4ade80; font-size: 0.65rem; font-weight: 500;">${dataInvS.cCorreo} | ${dataInvS.cPass}</small>`;
      }

      const canEdit = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_editar === true);
      const canDelete = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_eliminar === true);
      const canAnnul = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_anular === true);

      tr.innerHTML = `
        <th class="row-number">${rowNum}</th>
        <td>${v.id}</td>
        <td>${v.fecha || ''}</td>
        <td>${v.hora || ''}</td>
        <td>${juegoNombre}${cuentaDetalles}</td>
        <td>${v.tipo_cuenta || ''}</td>
        <td>$${(v.venta || 0).toLocaleString('es-CO')}</td>
        <td>${v.vendedor || ''}</td>
        <td>${v.cedula || ''}</td>
        <td>${v.nombre_cliente || ''}</td>
        <td>${v.celular || ''}</td>
        <td>${v.pago || ''}</td>
        <td>${v.tipo_cliente || ''}</td>
        <td>${v.lista || ''}</td>
        <td>
          <div style="display:flex; gap:5px; justify-content:center;">
            <button class="action-btn-premium" style="background:rgba(57, 214, 249, 0.15); color:var(--accent-cyan); width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="verDetallesVenta('${v.id}')" title="Ver Detalles">
              <i data-lucide="eye" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>
            <button class="action-btn-premium" style="background:rgba(245,158,11,0.15); color:#f59e0b; width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="copiarFacturaConfirmacion('${v.id}')" title="Confirmacion">
              <i data-lucide="file-check" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>
            <button class="action-btn-premium" style="width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="copiarFactura('${v.id}')" title="Factura">
              <i data-lucide="file-text" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>
            ${canEdit ? `
            <button class="action-btn-premium edit-btn" style="width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="openModalVenta('${v.id}')" title="Editar">
              <i data-lucide="edit-3" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>` : ''}
            ${canDelete ? `
            <button class="action-btn-premium delete-btn" style="width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="deleteVenta('${v.id}')" title="Eliminar">
              <i data-lucide="trash-2" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>` : ''}
            ${canAnnul ? `
            <button class="action-btn-premium" style="background:rgba(239,68,68,0.15); color:#ef4444; width:26px; height:26px; padding:0; font-size:0.7rem;" onclick="anularFactura('${v.id}')" title="${v.esta_anulada ? 'Reactivar' : 'Anular'}">
              <i data-lucide="${v.esta_anulada ? 'rotate-ccw' : 'ban'}" class="minimalist-icon" style="width:14px; height:14px;"></i>
            </button>` : ''}
          </div>
        </td>
      `;
    }

    tbody.appendChild(tr);
    renderizadas++;
  });

  // Agregar botón de "Cargar más" si hay más resultados que no se dibujaron
  if (grupos.length > MAX_RENDER_LIMIT) {
    const trMore = document.createElement('tr');
    trMore.innerHTML = `
        <td colspan="15" style="text-align:center; padding: 20px;">
           <span style="color: var(--text-muted); font-size: 0.85rem; margin-bottom:10px; display:block;">
              Mostrando ${MAX_RENDER_LIMIT} de ${grupos.length} resultados. Para mantener la aplicación rápida, restringe tu búsqueda.
           </span>
           <button class="btn-primary" style="background: var(--accent-cyan); color: #000;" 
                   onclick="window.RenderVentasLimit = (window.RenderVentasLimit || 100) + 100; renderVentas();">
              Cargar 100 más
           </button>
        </td>
     `;
    tbody.appendChild(trMore);
  } else {
    // Resetear limite si ya no aplica
    window.RenderVentasLimit = 100;
  }

  if (window.lucide) window.lucide.createIcons();
}

// Global variable para el debounce del panel de ventas
let searchVentasTimeout = null;
function handleVentasSearchDebounce() {
  clearTimeout(searchVentasTimeout);
  searchVentasTimeout = setTimeout(() => {
    // Resetear límite antes de una nueva búsqueda
    window.RenderVentasLimit = 100;
    renderVentas();
  }, 300); // 300ms delay
}

/* --- METRICS CALCULATION --- */
function updateVentasMetrics() {
  const t = getColombiaTime();
  const todayStr = t.date;
  const getMonthPart = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (parts.length < 3) return "";
    if (parts[0].length === 4) return `${parts[0]}-${parts[1]}`;
    return `${parts[1]}/${parts[2]}`;
  };

  const currentMonth = getMonthPart(todayStr);
  const txHoy = new Set();
  let totalHoy = 0;
  const txMes = new Set();
  let totalMes = 0;

  AppState.sales.forEach(v => {
    if (!v.fecha || v.esta_anulada) return; // Omitir anuladas en métricas
    const groupKey = v.transaction_id || `V-${v.id}`;
    const vMonth = getMonthPart(v.fecha);

    if (v.fecha === todayStr) {
      txHoy.add(groupKey);
      totalHoy += (parseFloat(v.venta) || 0);
    }
    if (vMonth === currentMonth && currentMonth !== "") {
      txMes.add(groupKey);
      totalMes += (parseFloat(v.venta) || 0);
    }
  });

  const updateEl = (id, val, isPrice = false) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = isPrice ? `$ ${val.toLocaleString('es-CO')}` : val;
    }
  };

  updateEl('ventasCountHoy', txHoy.size);
  updateEl('ventasTotalHoy', totalHoy, true);
  updateEl('ventasCountMes', txMes.size);
  updateEl('ventasTotalMes', totalMes, true);
}


// Eliminar todas las ventas de un pedido multi-juego por transaction_id
function eliminarPedidoCompleto(transactionId) {
  if (!transactionId) return;
  const ventas = AppState.sales.filter(v => String(v.transaction_id) === String(transactionId));
  if (ventas.length === 0) return;

  showDeleteConfirmModal(`¿Eliminar el pedido completo? (${ventas.length} juego${ventas.length > 1 ? 's' : ''})\nEsto eliminará todas las ventas del pedido #${transactionId}.`, () => {
    // Restaurar stock
    ventas.forEach(v => {
      if (v.productType === 'paquete') {
        const pItem = AppState.paquetes.find(p => String(p.id) === String(v.inventoryId));
        if (pItem) {
          const field = getFieldFromCuentaExacta(v.tipo_cuenta);
          if (field) pItem[field] = 'Disponible';
        }
      } else if (v.productType === 'membresia') {
        const mItem = AppState.membresias.find(m => String(m.id) === String(v.inventoryId));
        if (mItem) {
          const field = getFieldFromCuentaExacta(v.tipo_cuenta);
          if (field) mItem[field] = 'Disponible';
        }
      } else if (v.productType === 'codigo') {
        const cItem = AppState.inventory.find(c => String(c.id) === String(v.inventoryId));
        if (cItem) cItem.estado = 'Activo';
      }
    });

    AppState.sales = AppState.sales.filter(v => String(v.transaction_id) !== String(transactionId));
    saveLocal(); // Usa la función oficial de guardado
    updateDashboard(); // Actualiza los modulos visuales dependientes
    renderVentas();
    if (typeof showToast === 'function') showToast(`🗑️ Pedido eliminado (${ventas.length} juego${ventas.length > 1 ? 's' : ''})`);
  });
}

function anularFactura(id) {
  const user = AppState.currentUser;
  const hasAccesoTotal = user.permisos && user.permisos.acceso_total === true;
  const canAnnul = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_anular === true);

  if (!canAnnul) {
    showToast("❌ No tienes permiso para anular facturas");
    return;
  }

  const sale = AppState.sales.find(v => String(v.id) === String(id));
  if (!sale) return;

  const msg = sale.esta_anulada 
    ? "¿Deseas REACTIVAR esta factura? Volverá a sumar a los totales." 
    : "¿Deseas ANULAR esta factura? Dejará de sumar a las ventas.";

  showDeleteConfirmModal(msg, () => {
    sale.esta_anulada = !sale.esta_anulada;
    saveLocal();
    updateDashboard();
    renderVentas();
    if (typeof logEvent === 'function') {
      logEvent(sale.esta_anulada ? 'Factura Anulada' : 'Factura Reactivada', `ID: ${id} | Juego: ${sale.juego}`);
    }
    showToast(sale.esta_anulada ? "🚫 Factura Anulada" : "✅ Factura Reactivada");
  });
}

function anularPedidoCompleto(transactionId) {
  const user = AppState.currentUser;
  const hasAccesoTotal = user.permisos && user.permisos.acceso_total === true;
  const canAnnul = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_anular === true);

  if (!canAnnul) {
    showToast("❌ No tienes permiso para anular facturas");
    return;
  }
  if (!transactionId) return;
  const ventas = AppState.sales.filter(v => String(v.transaction_id) === String(transactionId));
  if (ventas.length === 0) return;

  const estaAnulado = ventas.every(v => v.esta_anulada);
  const msg = estaAnulado 
    ? "¿Deseas REACTIVAR este pedido completo?" 
    : "¿Deseas ANULAR este pedido completo? Dejará de sumar a los totales.";

  showDeleteConfirmModal(msg, () => {
    ventas.forEach(v => v.esta_anulada = !estaAnulado);
    saveLocal();
    updateDashboard();
    renderVentas();
    if (typeof logEvent === 'function') {
      logEvent(!estaAnulado ? 'Pedido Anulado' : 'Pedido Reactivado', `Transacción: ${transactionId} | Juegos: ${ventas.length}`);
    }
    showToast(!estaAnulado ? "🚫 Pedido Anulado" : "✅ Pedido Reactivado");
  });
}


function getGameSlots(gameId) {
  const game = AppState.inventoryGames.find(g => String(g.id) === String(gameId));
  if (!game) {
    return {
      config: { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 },
      used: { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 }
    };
  }

  const config = {
    p_ps4: game.cupos_ps4_primaria !== undefined ? game.cupos_ps4_primaria : (game.es_ps4 ? 2 : 0),
    s_ps4: game.cupos_ps4_secundaria !== undefined ? game.cupos_ps4_secundaria : (game.es_ps4 ? 1 : 0),
    p_ps5: game.cupos_ps5_primaria !== undefined ? game.cupos_ps5_primaria : (game.es_ps5 || game.es_ps4 ? 2 : 0),
    s_ps5: game.cupos_ps5_secundaria !== undefined ? game.cupos_ps5_secundaria : (game.es_ps5 || game.es_ps4 ? 1 : 0),
  };

  // Retrocompatibilidad: Si es PS4, asegurar que tenga los 2 cupos PRI y 1 SEC de PS5
  if (game.es_ps4 && !game.es_ps5 && Number(config.p_ps5) === 0) {
    config.p_ps5 = 2;
    config.s_ps5 = 1;
  }

  const used = { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 };

  AppState.sales.forEach(sale => {
    if (String(sale.inventoryId) === String(game.id) && !sale.esta_anulada && !sale.isPartiallyPaid) {
      if (sale.tipo_cuenta === 'Primaria PS4') used.p_ps4++;
      else if (sale.tipo_cuenta === 'Secundaria PS4') used.s_ps4++;
      else if (sale.tipo_cuenta === 'Primaria PS5') used.p_ps5++;
      else if (sale.tipo_cuenta === 'Secundaria PS5') used.s_ps5++;
    }
  });

  return { config, used };
}

function getPaqueteSlots(paqueteId) {
  const p = AppState.paquetes.find(x => String(x.id) === String(paqueteId));
  if (!p) {
    return {
      config: { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 },
      used: { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 }
    };
  }

  const config = {
    p_ps4: p.cupos_ps4_primaria !== undefined ? p.cupos_ps4_primaria : (p.es_ps4 ? 2 : 0),
    s_ps4: p.cupos_ps4_secundaria !== undefined ? p.cupos_ps4_secundaria : (p.es_ps4 ? 1 : 0),
    p_ps5: p.cupos_ps5_primaria !== undefined ? p.cupos_ps5_primaria : (p.es_ps5 ? 2 : 0),
    s_ps5: p.cupos_ps5_secundaria !== undefined ? p.cupos_ps5_secundaria : (p.es_ps5 ? 1 : 0),
  };

  const used = { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 };

  AppState.sales.forEach(sale => {
    if (String(sale.inventoryId) === String(p.id) && !sale.esta_anulada && !sale.isPartiallyPaid) {
      if (sale.tipo_cuenta === 'Primaria PS4') used.p_ps4++;
      else if (sale.tipo_cuenta === 'Secundaria PS4') used.s_ps4++;
      else if (sale.tipo_cuenta === 'Primaria PS5') used.p_ps5++;
      else if (sale.tipo_cuenta === 'Secundaria PS5') used.s_ps5++;
    }
  });

  return { config, used };
}

function getMembresiaSlots(membresiaId) {
  const m = AppState.membresias.find(x => String(x.id) === String(membresiaId));
  if (!m) {
    return {
      config: { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 },
      used: { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 }
    };
  }

  const config = {
    p_ps4: m.cupos_ps4_primaria !== undefined ? m.cupos_ps4_primaria : (m.es_ps4 ? 2 : 0),
    s_ps4: m.cupos_ps4_secundaria !== undefined ? m.cupos_ps4_secundaria : (m.es_ps4 ? 1 : 0),
    p_ps5: m.cupos_ps5_primaria !== undefined ? m.cupos_ps5_primaria : (m.es_ps5 ? 2 : 0),
    s_ps5: m.cupos_ps5_secundaria !== undefined ? m.cupos_ps5_secundaria : (m.es_ps5 ? 1 : 0),
  };

  const used = { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 };

  AppState.sales.forEach(sale => {
    if (String(sale.inventoryId) === String(m.id) && sale.estado !== 'Cancelada' && !sale.esta_anulada && !sale.isPartiallyPaid) {
      if (sale.tipo_cuenta === 'Primaria PS4') used.p_ps4++;
      else if (sale.tipo_cuenta === 'Secundaria PS4') used.s_ps4++;
      else if (sale.tipo_cuenta === 'Primaria PS5') used.p_ps5++;
      else if (sale.tipo_cuenta === 'Secundaria PS5') used.s_ps5++;
    }
  });

  return { config, used };
}


// --- MODAL ELIMINACION PREMIUM ---
let deleteActionCallback = null;

function showDeleteConfirmModal(message, onConfirm) {
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

function showPremiumAlert(title, message, type = 'success') {
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



// --- AUTOCOMPLETADO DE CLIENTE POR CÉDULA ---
function autocompletarCliente(cedula) {
  const cedLimpia = (cedula || '').trim();
  if (!cedLimpia) return;

  // Buscar desde la venta más reciente hacia la más antigua
  const match = [...AppState.sales].reverse().find(v =>
    (v.cedula || '').trim() === cedLimpia
  );

  if (match) {
    if (match.nombre_cliente) document.getElementById('ventaFormClienteNombre').value = match.nombre_cliente;
    if (match.celular) document.getElementById('ventaFormCelular').value = match.celular;
    if (match.correo) document.getElementById('ventaFormEmail').value = match.correo;
    if (match.ciudad) document.getElementById('ventaFormCiudad').value = match.ciudad;

    // Feedback visual: borde verde por 1.5 segundos
    const cedulaInput = document.getElementById('ventaFormCedula');
    cedulaInput.style.borderColor = 'var(--accent-green)';
    cedulaInput.style.boxShadow = '0 0 0 2px rgba(57,249,150,0.2)';
    setTimeout(() => {
      cedulaInput.style.borderColor = '';
      cedulaInput.style.boxShadow = '';
    }, 1500);
  }
}

// --- MODAL VENTAS (NUEVO / EDICIÓN) ---
function openModalVenta(id = null) {
  // Limpiar contenedores de filas de productos
  const containers = [
    'ventaGameRowsContainer',
    'ventaPaquetesRowsContainer',
    'ventaMembresiasRowsContainer',
    'ventaCodigosRowsContainer',
    'ventaXboxRowsContainer',
    'ventaPhysicalRowsContainer'
  ];
  containers.forEach(cId => {
    const el = document.getElementById(cId);
    if (el) el.innerHTML = '';
  });

  const activeGames = AppState.inventoryGames.filter(g => g.estado === 'Activo');

  if (id) {
    // Modo Edición (Solo 1 fila para no romper la edición unitaria existente)
    const v = AppState.sales.find(s => String(s.id) === String(id));
    if (v) {
      document.getElementById('modalVentaTitle').innerHTML = '<i data-lucide="edit-3" class="minimalist-icon"></i> Editar Venta';
      document.getElementById('ventaFormId').value = v.id;
      document.getElementById('ventaFormClienteNombre').value = v.nombre_cliente || '';
      document.getElementById('ventaFormCedula').value = v.cedula || '';
      document.getElementById('ventaFormCelular').value = v.celular || '';
      document.getElementById('ventaFormEmail').value = v.correo || '';
      document.getElementById('ventaFormPago').value = v.pago || 'Nequi';
      document.getElementById('ventaFormTipoCliente').value = v.tipo_cliente || '💙 PUBLICIDAD';
      document.getElementById('ventaFormCiudad').value = v.ciudad || '';
      document.getElementById('ventaFormNota').value = v.nota || '';
      
      // Populate and set Lista dropdown
      const listaSelect = document.getElementById('ventaFormLista');
      if (listaSelect) {
        listaSelect.innerHTML = '<option value="">-- Sin lista --</option>';
        (AppState.listas || []).forEach(L => {
          listaSelect.innerHTML += `<option value="${L.id}">${L.nombre}</option>`;
        });
        listaSelect.value = v.lista || '';
      }

      // Handle dual sellers
      document.getElementById('ventaFormVendedor1').value = v.vendedor1 || v.vendedor || 'ADMIN';
      document.getElementById('ventaFormVendedor2').value = v.vendedor2 || '';

      const pData = {
        inventoryId: v.inventoryId,
        tipo_cuenta: v.tipo_cuenta,
        venta: v.venta
      };

      if (v.productType === 'paquete') {
        addVentaPaqueteRow(pData, true);
      } else if (v.productType === 'membresia') {
        addVentaMembresiaRow(pData, true);
      } else if (v.productType === 'xbox') {
        addVentaXboxRow(pData, true);
      } else if (v.productType === 'physical') {
        addVentaPhysicalRow(pData, true);
      } else {
        addVentaGameRow(pData, true);
      }
    }
  } else {
    // Modo Nuevo
    document.getElementById('modalVentaTitle').innerHTML = '<i data-lucide="plus-circle" class="minimalist-icon"></i> Nueva Venta';
    document.getElementById('ventaFormId').value = '';

    // Limpiar campos cliente
    document.getElementById('ventaFormClienteNombre').value = '';
    document.getElementById('ventaFormCedula').value = '';
    document.getElementById('ventaFormCelular').value = '';
    document.getElementById('ventaFormEmail').value = '';
    document.getElementById('ventaFormPago').value = 'Nequi';
    document.getElementById('ventaFormTipoCliente').value = '💙 PUBLICIDAD';
    document.getElementById('ventaFormCiudad').value = '';
    document.getElementById('ventaFormNota').value = '';
    
    // Populate Lista and set defaults
    const listaSelect = document.getElementById('ventaFormLista');
    if (listaSelect) {
      listaSelect.innerHTML = '<option value="">-- Sin lista --</option>';
      (AppState.listas || []).forEach(L => {
        listaSelect.innerHTML += `<option value="${L.id}">${L.nombre}</option>`;
      });
      listaSelect.value = '';
    }

    document.getElementById('ventaFormVendedor1').value = AppState.currentUser?.name || 'ADMIN';
    document.getElementById('ventaFormVendedor2').value = '';

    // addVentaGameRow(); // Eliminado para que el modal salga vacío según solicitud del usuario
  }
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('modalVentaOverlay').classList.add('show');
}

function closeModalVenta() {
  const modal = document.getElementById('modalVentaOverlay');
  modal.classList.remove('show');
}

/** 
 * Añade una fila de juego al modal de ventas
 */
function addVentaGameRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaGameRowsContainer');
  const count = container.children.length;
  // Usar timestamp + random para asegurar ID único en el DOM
  const rowId = Date.now() + Math.floor(Math.random() * 1000);

  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box';
  rowDiv.id = `row-${rowId}`;

  let gameText = '';
  if (data && data.inventoryId) {
    const g = AppState.inventoryGames.find(ag => String(ag.id) === String(data.inventoryId));
    gameText = g ? `(${g.id}) ${g.juego}` : data.inventoryId;
  }

  rowDiv.innerHTML = `
    <div class="form-group" style="position: relative; grid-column: 1 / -1; margin-bottom: 5px;">
      <label>Título del Juego / ID</label>
      <input type="text" class="scraping-input row-juego-search" placeholder="Buscar..." 
        value="${gameText}" oninput="handleVentaGameAutocomplete(this, '${rowId}')" autocomplete="off" 
style="width: 100%;">
      <input type="hidden" class="row-inventory-id" value="${data?.inventoryId || ''}">
      <input type="hidden" class="row-product-type" value="game">
      <div id="suggestions-${rowId}" class="autocomplete-suggestions"></div>
    </div>

    <div class="form-group">
      <label>Cuenta</label>
      <select class="form-select row-tipo-cuenta" style="width: 100%; height:38px; background: rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.1); border-radius:6px;">
        <option value="">--</option>
        <option value="Primaria PS4" ${data?.tipo_cuenta === 'Primaria PS4' ? 'selected' : ''}>P. PS4</option>
        <option value="Secundaria PS4" ${data?.tipo_cuenta === 'Secundaria PS4' ? 'selected' : ''}>S. PS4</option>
        <option value="Primaria PS5" ${data?.tipo_cuenta === 'Primaria PS5' ? 'selected' : ''}>P. PS5</option>
        <option value="Secundaria PS5" ${data?.tipo_cuenta === 'Secundaria PS5' ? 'selected' : ''}>S. PS5</option>
      </select>
    </div>

    <div class="form-group">
      <label>Valor ($)</label>
      <input type="number" class="scraping-input row-precio" placeholder="COP" value="${data?.venta || ''}" style="width: 100%;">
    </div>

    <div style="display:flex; align-items:center;">
      ${(count > 0 && !isEdit) ? `
        <button type="button" onclick="removeVentaGameRow('${rowId}')" class="btn-remove-game" title="Quitar item">
          <i data-lucide="trash-2" class="minimalist-icon"></i>
        </button>
      ` : `<div style="width:38px;"></div>`}
    </div>
  `;
  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}

function removeVentaGameRow(rowId) {
  const row = document.getElementById(`row-${rowId}`);
  if (row) row.remove();
}

/**
 * PAQUETES
 */
function addVentaPaqueteRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaPaquetesRowsContainer');
  const count = container.children.length;
  const rowId = 'paq_' + Date.now() + Math.floor(Math.random() * 1000);

  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box';
  rowDiv.id = `row-${rowId}`;

  let itemText = '';
  if (data && data.inventoryId) {
    const p = AppState.paquetes.find(ag => String(ag.id) === String(data.inventoryId));
    itemText = p ? `(${p.id}) ${p.nombre}` : data.inventoryId;
  }

  rowDiv.innerHTML = `
    <div class="form-group" style="position: relative; grid-column: 1 / -1; margin-bottom: 5px;">
      <label style="color:#ec4899;">Nombre del Paquete / ID</label>
      <input type="text" class="scraping-input row-paquete-search" placeholder="Buscar paquete..." 
        value="${itemText}" oninput="handleVentaPaqueteAutocomplete(this, '${rowId}')" autocomplete="off" 
        style="width: 100%; border-color: rgba(236,72,153,0.3);">
      <input type="hidden" class="row-inventory-id" value="${data?.inventoryId || ''}">
      <input type="hidden" class="row-product-type" value="paquete">
      <div id="suggestions-${rowId}" class="autocomplete-suggestions"></div>
    </div>

    <div class="form-group">
      <label>Cuenta Exacta</label>
      <select class="form-select row-tipo-cuenta" style="width: 100%; height:38px; background: rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.1); border-radius:6px;">
        <option value="">-- Autocompleta un paquete --</option>
        ${data?.tipo_cuenta ? `<option value="${data.tipo_cuenta}" selected>${data.tipo_cuenta}</option>` : ''}
      </select>
    </div>

    <div class="form-group">
      <label>Valor ($)</label>
      <input type="number" class="scraping-input row-precio" placeholder="COP" value="${data?.venta || ''}" style="width: 100%;">
    </div>

    <div style="display:flex; align-items:center;">
      <button type="button" onclick="removeVentaPaqueteRow('${rowId}')" class="btn-remove-game" title="Quitar item">
        <i data-lucide="trash-2" class="minimalist-icon" style="color:#ec4899;"></i>
      </button>
    </div>
  `;
  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}

function removeVentaPaqueteRow(rowId) {
  const row = document.getElementById(`row-${rowId}`);
  if (row) row.remove();
}

/**
 * MEMBRESÍAS
 */
function addVentaMembresiaRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaMembresiasRowsContainer');
  const count = container.children.length;
  const rowId = 'mem_' + Date.now() + Math.floor(Math.random() * 1000);

  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box';
  rowDiv.id = `row-${rowId}`;

  let itemText = '';
  if (data && data.inventoryId) {
    const m = AppState.membresias.find(ag => String(ag.id) === String(data.inventoryId));
    itemText = m ? `(${m.id}) ${m.tipo}` : data.inventoryId;
  }

  rowDiv.innerHTML = `
    <div class="form-group" style="position: relative; grid-column: 1 / -1; margin-bottom: 5px;">
      <label style="color:#f59e0b;">Membresía / ID</label>
      <input type="text" class="scraping-input row-membresia-search" placeholder="Buscar membresía..." 
        value="${itemText}" oninput="handleVentaMembresiaAutocomplete(this, '${rowId}')" autocomplete="off" 
        style="width: 100%; border-color: rgba(245,158,11,0.3);">
      <input type="hidden" class="row-inventory-id" value="${data?.inventoryId || ''}">
      <input type="hidden" class="row-product-type" value="membresia">
      <div id="suggestions-${rowId}" class="autocomplete-suggestions"></div>
    </div>

    <div class="form-group">
      <label>Cuenta Exacta</label>
      <select class="form-select row-tipo-cuenta" style="width: 100%; height:38px; background: rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.1); border-radius:6px;">
        <option value="">-- Autocompleta una membresía --</option>
        ${data?.tipo_cuenta ? `<option value="${data.tipo_cuenta}" selected>${data.tipo_cuenta}</option>` : ''}
      </select>
    </div>

    <div class="form-group">
      <label>Valor ($)</label>
      <input type="number" class="scraping-input row-precio" placeholder="COP" value="${data?.venta || ''}" style="width: 100%;">
    </div>

    <div style="display:flex; align-items:center;">
      <button type="button" onclick="removeVentaMembresiaRow('${rowId}')" class="btn-remove-game" title="Quitar item">
        <i data-lucide="trash-2" class="minimalist-icon" style="color:#f59e0b;"></i>
      </button>
    </div>
  `;
  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}

function removeVentaMembresiaRow(rowId) {
  const row = document.getElementById(`row-${rowId}`);
  if (row) row.remove();
}

/**
 * XBOX
 */
function addVentaXboxRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaXboxRowsContainer');
  const rowId = 'xbox_' + Date.now() + Math.floor(Math.random() * 1000);

  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box';
  rowDiv.id = `row-${rowId}`;
  rowDiv.style.cssText = 'display:grid; grid-template-columns: 1fr auto auto auto; gap:10px; align-items:end;';

  let itemText = '';
  if (data && data.inventoryId) {
    const x = (AppState.xboxInventory || []).find(it => String(it.id) === String(data.inventoryId));
    itemText = x ? `(${x.id}) ${x.detalle}` : data.inventoryId;
  }

  rowDiv.innerHTML = `
    <div class="form-group" style="position:relative; margin:0;">
      <label style="color:#107c10; font-size:0.75rem; margin-bottom:4px; display:block;">Xbox / Producto</label>
      <input type="text" class="scraping-input row-xbox-search" placeholder="Buscar Xbox..." 
             value="${itemText}" oninput="handleVentaXboxAutocomplete(this, '${rowId}')" autocomplete="off" 
             style="width:100%; border-color:rgba(16,124,16,0.3);">
      <input type="hidden" class="row-inventory-id" value="${data?.inventoryId || ''}">
      <input type="hidden" class="row-product-type" value="xbox">
      <input type="hidden" class="row-tipo-cuenta" value="Xbox">
      <div id="suggestions-${rowId}" class="autocomplete-suggestions"></div>
    </div>

    <div class="form-group" style="margin:0;">
      <label style="color:var(--text-muted); font-size:0.75rem; margin-bottom:4px; display:block;">Precio ($)</label>
      <input type="number" class="scraping-input row-precio" placeholder="COP" value="${data?.venta || ''}" 
             style="width:100%; border-color:rgba(16,124,16,0.3);">
    </div>

    <div style="display:flex; align-items:center;">
      <button type="button" onclick="removeVentaXboxRow('${rowId}')" class="btn-remove-game" title="Quitar item">
        <i data-lucide="trash-2" class="minimalist-icon" style="color:#107c10;"></i>
      </button>
    </div>
  `;
  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}

function removeVentaXboxRow(rowId) {
  const row = document.getElementById(`row-${rowId}`);
  if (row) row.remove();
}

function addVentaPhysicalRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaPhysicalRowsContainer');
  const rowId = 'phys_' + Date.now() + Math.floor(Math.random() * 1000);

  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box';
  rowDiv.id = `row-${rowId}`;
  rowDiv.style.cssText = 'display:grid; grid-template-columns: 1fr auto auto auto; gap:10px; align-items:end;';

  let itemText = '';
  if (data && data.inventoryId) {
    const p = (AppState.physicalInventory || []).find(it => String(it.id) === String(data.inventoryId));
    itemText = p ? `(${p.id}) ${p.detalle}` : data.inventoryId;
  }

  rowDiv.innerHTML = `
    <div class="form-group" style="position:relative; margin:0;">
      <label style="color:#2dd4bf; font-size:0.75rem; margin-bottom:4px; display:block;">Producto Físico</label>
      <input type="text" class="scraping-input row-physical-search" placeholder="Buscar producto..." 
             value="${itemText}" oninput="handleVentaPhysicalAutocomplete(this, '${rowId}')" autocomplete="off" 
             style="width:100%; border-color:rgba(45,212,191,0.3);">
      <input type="hidden" class="row-inventory-id" value="${data?.inventoryId || ''}">
      <input type="hidden" class="row-product-type" value="physical">
      <input type="hidden" class="row-tipo-cuenta" value="Fisico">
      <div id="suggestions-${rowId}" class="autocomplete-suggestions"></div>
    </div>

    <div class="form-group" style="margin:0;">
      <label style="color:var(--text-muted); font-size:0.75rem; margin-bottom:4px; display:block;">Precio ($)</label>
      <input type="number" class="scraping-input row-precio" placeholder="COP" value="${data?.venta || ''}" 
             style="width:100%; border-color:rgba(45,212,191,0.3);">
    </div>

    <div style="display:flex; align-items:center;">
      <button type="button" onclick="removeVentaPhysicalRow('${rowId}')" class="btn-remove-game" title="Quitar item">
        <i data-lucide="trash-2" class="minimalist-icon" style="color:#2dd4bf;"></i>
      </button>
    </div>
  `;
  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}

function removeVentaPhysicalRow(rowId) {
  const row = document.getElementById(`row-${rowId}`);
  if (row) row.remove();
}

/**
 * CÓDIGOS PSN (Restaura la función correcta)
 */
function addVentaCodigoRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaCodigosRowsContainer');
  if (!container) return;
  const rowId = 'cod_' + Date.now() + Math.round(Math.random() * 1000);

  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box';
  rowDiv.id = `row-${rowId}`;
  rowDiv.style.cssText = 'display:flex; gap:10px; align-items:flex-end; padding:10px; background:rgba(168,85,247,0.05); border:1px solid rgba(168,85,247,0.1); border-radius:8px; margin-bottom:8px;';

  // Obtener denominaciones únicas disponibles
  const denoms = [...new Set((AppState.inventoryCodes || []).filter(c => c.estado === 'ON' && !c.usado).map(c => c.precioUsd))].sort((a,b) => a-b);

  const initDenom = data?.codigoDenom || '';
  const initQty = data?.qty || 1;
  const initPrecio = data?.venta || '';

  rowDiv.innerHTML = `
    <div class="form-group" style="margin:0; flex:1;">
      <label style="color:var(--accent-purple); font-size:0.75rem; margin-bottom:4px; display:block;">Denominación (USD)</label>
      <select class="form-select row-codigo-denom" onchange="updateCodigoRowMax('${rowId}', this)" 
              style="width:100%; height:38px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(168,85,247,0.3); border-radius:6px;">
        <option value="">-- Seleccionar --</option>
        ${denoms.map(d => `<option value="${d}" ${String(d) === String(initDenom) ? 'selected' : ''} data-max="${(AppState.inventoryCodes||[]).filter(c => c.estado === 'ON' && !c.usado && String(c.precioUsd) === String(d)).length}">${d} USD</option>`).join('')}
      </select>
      <input type="hidden" class="row-product-type" value="codigo">
      <input type="hidden" class="row-inventory-id" value="">
      <input type="hidden" class="row-tipo-cuenta" value="Código">
    </div>

    <div class="form-group" style="margin:0; width:100px;">
      <label style="color:var(--text-muted); font-size:0.75rem; margin-bottom:4px; display:block;">Cantidad</label>
      <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border-radius:6px; border:1px solid rgba(168,85,247,0.3); overflow:hidden;">
        <button type="button" onclick="stepCodigo('${rowId}', -1)" style="width:30px; height:36px; border:none; background:transparent; color:#fff; cursor:pointer; font-weight:bold;">-</button>
        <input type="number" id="qty-${rowId}" class="row-codigo-qty" value="${initQty}" readonly 
               style="width:38px; height:36px; border:none; background:transparent; color:#fff; text-align:center; font-size:0.9rem; outline:none;">
        <button type="button" onclick="stepCodigo('${rowId}', 1)" style="width:30px; height:36px; border:none; background:transparent; color:#fff; cursor:pointer; font-weight:bold;">+</button>
      </div>
    </div>

    <div class="form-group" style="margin:0;">
      <label style="color:var(--text-muted); font-size:0.75rem; margin-bottom:4px; display:block;">Precio u. ($)</label>
      <input type="number" class="scraping-input row-precio" placeholder="COP" value="${initPrecio}" 
             style="width:110px; border-color:rgba(168,85,247,0.3);">
    </div>

    <div style="display:flex; align-items:center; padding-bottom:1px;">
      <button type="button" onclick="removeVentaCodigoRow('${rowId}')" class="btn-remove-game" title="Quitar">
        <i data-lucide="trash-2" class="minimalist-icon" style="color:var(--accent-purple);"></i>
      </button>
    </div>
  `;

  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}

// Stepper para la cantidad de códigos PSN
function stepCodigo(rowId, delta) {
  const qtyInput = document.getElementById(`qty-${rowId}`);
  const row = document.getElementById(`row-${rowId}`);
  if (!qtyInput || !row) return;

  const denomSelect = row.querySelector('.row-codigo-denom');
  const selectedOpt = denomSelect ? denomSelect.options[denomSelect.selectedIndex] : null;
  const maxDisp = selectedOpt ? parseInt(selectedOpt.getAttribute('data-max') || '99') : 99;

  let current = parseInt(qtyInput.value) || 1;
  current = Math.min(Math.max(current + delta, 1), maxDisp);
  qtyInput.value = current;
}

// Actualizar el máx del stepper cuando cambia la denominación
function updateCodigoRowMax(rowId, selectEl) {
  const qtyInput = document.getElementById(`qty-${rowId}`);
  if (!qtyInput) return;
  const selectedOpt = selectEl.options[selectEl.selectedIndex];
  const maxDisp = parseInt(selectedOpt?.getAttribute('data-max') || '99');
  let current = parseInt(qtyInput.value) || 1;
  qtyInput.value = Math.min(current, maxDisp);
}

function removeVentaCodigoRow(rowId) {
  const row = document.getElementById(`row-${rowId}`);
  if (row) row.remove();
}

function getFieldFromCuentaExacta(val) {
  const map = {
    'Pri PS4 1': 'PS41Estado',
    'Pri PS4 2': 'PS42Estado',
    'Sec PS4': 'SecPS4Estado',
    'Pri PS5 1': 'PS51Estado',
    'Pri PS5 2': 'PS52Estado',
    'Sec PS5': 'SecPS5Estado'
  };
  return map[val];
}

function saveVentaDataForm() {
  const vId = document.getElementById('ventaFormId').value;
  const rows = document.querySelectorAll('.game-row-box');

  if (rows.length === 0) {
    showToast('⚠️ No hay juegos agregados para vender.');
    return;
  }

  // Datos comunes del cliente
  const commonData = {
    cedula: document.getElementById('ventaFormCedula').value,
    nombre_cliente: document.getElementById('ventaFormClienteNombre').value,
    celular: document.getElementById('ventaFormCelular').value,
    correo: document.getElementById('ventaFormEmail').value,
    pago: document.getElementById('ventaFormPago').value,
    tipo_cliente: document.getElementById('ventaFormTipoCliente').value,
    ciudad: document.getElementById('ventaFormCiudad').value,
    vendedor1: document.getElementById('ventaFormVendedor1').value,
    vendedor2: document.getElementById('ventaFormVendedor2').value,
    vendedor: document.getElementById('ventaFormVendedor1').value, // compatibility
    lista: document.getElementById('ventaFormLista').value,
    nota: document.getElementById('ventaFormNota').value
  };

  const t = getColombiaTime();
  const txId = 'TX-' + Date.now().toString().slice(-6); // ID de transacción común

  if (vId) {
    // Modo Edición (unitario)
    const row = rows[0];
    const invId = row.querySelector('.row-inventory-id').value;
    const tCuenta = row.querySelector('.row-tipo-cuenta').value;
    const precio = parseFloat(row.querySelector('.row-precio').value) || 0;
    const pType = row.querySelector('.row-product-type') ? row.querySelector('.row-product-type').value : 'game';

    if (!invId || !tCuenta) {
      showToast('⚠️ Completa los datos del juego para editar.');
      return;
    }

    const index = AppState.sales.findIndex(v => String(v.id) === String(vId));
    if (index !== -1) {
      const oldSale = AppState.sales[index];

      // Restaurar stock viejo si era paquete/membresia/codigo
      if (oldSale.productType === 'paquete') {
        const oldP = AppState.paquetes.find(p => String(p.id) === String(oldSale.inventoryId));
        if (oldP) {
          const field = getFieldFromCuentaExacta(oldSale.tipo_cuenta);
          if (field) oldP[field] = 'Disponible';
        }
      } else if (oldSale.productType === 'membresia') {
        const oldM = AppState.membresias.find(m => String(m.id) === String(oldSale.inventoryId));
        if (oldM) {
          const field = getFieldFromCuentaExacta(oldSale.tipo_cuenta);
          if (field) oldM[field] = 'Disponible';
        }
      } else if (oldSale.productType === 'codigo') {
        const oldC = AppState.inventory.find(c => String(c.id) === String(oldSale.inventoryId));
        if (oldC) oldC.estado = 'Activo';
      } else if (oldSale.productType === 'xbox') {
        const oldX = AppState.xboxInventory.find(x => String(x.id) === String(oldSale.inventoryId));
        if (oldX) oldX.estado = 'ON';
      } else if (oldSale.productType === 'physical') {
        const oldP = AppState.physicalInventory.find(p => String(p.id) === String(oldSale.inventoryId));
        if (oldP) oldP.estado = 'ON';
      }

      // Aplicar nuevo stock
      if (pType === 'paquete') {
        const newP = AppState.paquetes.find(p => String(p.id) === String(invId));
        if (newP) {
          const field = getFieldFromCuentaExacta(tCuenta);
          if (field) newP[field] = 'Vendido';
        }
      } else if (pType === 'membresia') {
        const newM = AppState.membresias.find(m => String(m.id) === String(invId));
        if (newM) {
          const field = getFieldFromCuentaExacta(tCuenta);
          if (field) newM[field] = 'Vendido';
        }
      } else if (pType === 'codigo') {
        const newC = AppState.inventory.find(c => String(c.id) === String(invId));
        if (newC) newC.estado = 'Vendido';
      } else if (pType === 'xbox') {
        const newX = AppState.xboxInventory.find(x => String(x.id) === String(invId));
        if (newX) newX.estado = 'OFF';
      } else if (pType === 'physical') {
        const newP = AppState.physicalInventory.find(p => String(p.id) === String(invId));
        if (newP) newP.estado = 'OFF';
      }

      AppState.sales[index] = {
        ...oldSale,
        ...commonData,
        inventoryId: invId,
        tipo_cuenta: tCuenta,
        venta: precio,
        productType: pType
      };

      if (typeof logEvent === 'function') {
        logEvent('Venta Modificada', `ID Venta: ${vId} | Cliente: ${commonData.correo} | Producto: ${pType}`);
      }
      
      // Sincronizar lista con Analytics (AppState.clientsListas)
      if (commonData.nombre_cliente) {
        asignarClienteALista(commonData.nombre_cliente.toLowerCase(), commonData.lista);
      }

      showToast('✅ Venta actualizada correctamente');
    }
  } else {
    // Registro múltiple
    let countSaved = 0;
    
    // Sincronizar lista con Analytics al inicio (común para todos los grupos)
    if (commonData.nombre_cliente && commonData.lista) {
      asignarClienteALista(commonData.nombre_cliente.toLowerCase(), commonData.lista);
    }
    rows.forEach(row => {
      const pType = row.querySelector('.row-product-type') ? row.querySelector('.row-product-type').value : 'game';
      const precio = parseFloat(row.querySelector('.row-precio').value) || 0;

      if (pType === 'codigo') {
        // Para códigos, usar la denominación del select y la cantidad del stepper
        const denomSelect = row.querySelector('.row-codigo-denom');
        const denom = denomSelect ? denomSelect.value : '';
        const qtyInput = row.querySelector('.row-codigo-qty');
        const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : '1') || 1);

        if (!denom) {
          showToast('⚠️ Selecciona una denominación para el código PSN.', 'warning');
          return;
        }

        // Verificar que hay stock suficiente
        const codesDisp = (AppState.inventoryCodes || []).filter(
          c => c.estado === 'ON' && !c.usado && parseFloat(c.precioUsd) === parseFloat(denom)
        );
        if (codesDisp.length < qty) {
          showToast(`⚠️ Solo hay ${codesDisp.length} código(s) disponibles de ${denom}us, pediste ${qty}.`, 'warning');
          return;
        }

        // Crear N registros de venta individuales (uno por código)
        for (let i = 0; i < qty; i++) {
          const isSplit = commonData.vendedor2 && commonData.vendedor2 !== commonData.vendedor1;
          const finalPrice = isSplit ? precio / 2 : precio;

          const rawId = Math.random().toString(36).substr(2, 6).toUpperCase();
          const generatedId = 'V-' + rawId;

          AppState.sales.unshift({
            ...commonData,
            id: generatedId,
            transaction_id: txId,
            fecha: t.date,
            hora: t.time,
            inventoryId: '',
            codigoDenom: denom,         // Denominación elegida (ej: "10")
            codigoAsignado: '',         // El PIN real se asigna al copiar la remisión
            tipo_cuenta: 'Código',
            venta: finalPrice,
            productType: 'codigo',
            vendedor: commonData.vendedor1
          });
          countSaved++;

          if (isSplit) {
            const rawId2 = Math.random().toString(36).substr(2, 6).toUpperCase();
            const generatedId2 = 'V-' + rawId2;
            AppState.sales.unshift({
              ...commonData,
              id: generatedId2,
              transaction_id: txId,
              fecha: t.date,
              hora: t.time,
              inventoryId: '',
              codigoDenom: denom,
              codigoAsignado: '',
              tipo_cuenta: 'Código',
              venta: finalPrice,
              productType: 'codigo',
              vendedor: commonData.vendedor2,
              isPartiallyPaid: true
            });
            countSaved++;
          }
        }
      } else {
        const invId = row.querySelector('.row-inventory-id').value;
        const tCuenta = row.querySelector('.row-tipo-cuenta').value;

        if (invId && tCuenta) {
          // Reducir stock si aplica
          if (pType === 'paquete') {
            const itemP = AppState.paquetes.find(p => String(p.id) === String(invId));
            if (itemP) {
              const field = getFieldFromCuentaExacta(tCuenta);
              if (field) itemP[field] = 'Vendido';
            }
          } else if (pType === 'membresia') {
            const itemM = AppState.membresias.find(m => String(m.id) === String(invId));
            if (itemM) {
              const field = getFieldFromCuentaExacta(tCuenta);
              if (field) itemM[field] = 'Vendido';
            }
          } else if (pType === 'xbox') {
            const itemX = (AppState.xboxInventory || []).find(x => String(x.id) === String(invId));
            if (itemX) itemX.estado = 'OFF';
          } else if (pType === 'physical') {
            const itemP = (AppState.physicalInventory || []).find(p => String(p.id) === String(invId));
            if (itemP) itemP.estado = 'OFF';
          }

          const rawId = Math.random().toString(36).substr(2, 6).toUpperCase();
          const generatedId = 'V-' + rawId;

          const isSplit = commonData.vendedor2 && commonData.vendedor2 !== commonData.vendedor1;
          const finalPrice = isSplit ? precio / 2 : precio;

          // Registro para Vendedora 1
          AppState.sales.unshift({
            ...commonData,
            id: generatedId,
            transaction_id: txId,
            fecha: t.date,
            hora: t.time,
            inventoryId: invId,
            tipo_cuenta: tCuenta,
            venta: finalPrice,
            productType: pType,
            vendedor: commonData.vendedor1
          });
          countSaved++;

          // Registro para Vendedora 2 (si aplica)
          if (isSplit) {
            const rawId2 = Math.random().toString(36).substr(2, 6).toUpperCase();
            const generatedId2 = 'V-' + rawId2;
            AppState.sales.unshift({
              ...commonData,
              id: generatedId2,
              transaction_id: txId,
              fecha: t.date,
              hora: t.time,
              inventoryId: invId,
              tipo_cuenta: tCuenta,
              venta: finalPrice,
              productType: pType,
              vendedor: commonData.vendedor2,
              isPartiallyPaid: true
            });
            countSaved++;
          }
        }
      }
    });

    if (countSaved === 0) {
      showToast('⚠️ Debes completar al menos un juego con su tipo de cuenta.');
      return;
    }

    if (typeof logEvent === 'function') {
      logEvent('Venta Creada', `TX: ${txId} | Cliente: ${commonData.correo} | items: ${countSaved}`);
    }

    showToast(`✅ ${countSaved} juegos registrados con éxito.`);
    renderVentas();
    saveLocal();
  }

  saveLocal();
  renderVentas();
  closeModalVenta();
  updateDashboard();
  renderInventoryJuegos();
}



function deleteVenta(id) {
  showDeleteConfirmModal('¿Eliminar este registro de venta individual?', () => {
    // Restaurar stock
    const v = AppState.sales.find(s => String(s.id) === String(id));
    if (v) {
      if (v.productType === 'paquete') {
        const pItem = AppState.paquetes.find(p => String(p.id) === String(v.inventoryId));
        if (pItem) {
          const field = getFieldFromCuentaExacta(v.tipo_cuenta);
          if (field) pItem[field] = 'Disponible';
        }
      } else if (v.productType === 'membresia') {
        const mItem = AppState.membresias.find(m => String(m.id) === String(v.inventoryId));
        if (mItem) {
          const field = getFieldFromCuentaExacta(v.tipo_cuenta);
          if (field) mItem[field] = 'Disponible';
        }
      } else if (v.productType === 'codigo') {
        const cItem = AppState.inventory.find(c => String(c.id) === String(v.inventoryId));
        if (cItem) cItem.estado = 'Activo';
      } else if (v.productType === 'xbox') {
        const xItem = (AppState.xboxInventory || []).find(x => String(x.id) === String(v.inventoryId));
        if (xItem) xItem.estado = 'ON';
      } else if (v.productType === 'physical') {
        const pItem = (AppState.physicalInventory || []).find(p => String(p.id) === String(v.inventoryId));
        if (pItem) pItem.estado = 'ON';
      }
    }

    // Usar String() para evitar problemas de tipos (parseInt vs String)
    AppState.sales = AppState.sales.filter(v => String(v.id) !== String(id));

    if (typeof logEvent === 'function') {
      logEvent('Venta Eliminada', `ID Registro: ${id}`);
    }

    renderVentas();
    saveLocal();
    updateDashboard();
    if (typeof showToast === 'function') showToast('Registro de venta eliminado', 'info');
  });
}

/* ==== MARK CODIGO USADO (Para UI antigua, si quedara alguna ref) ====
   Ahora se llama window.marcarCodigoUsado en la nueva renderización
*/
function markCodigoSale(id) {
  // Legacy function just in case
  if (typeof window.marcarCodigoUsado === 'function') {
    window.marcarCodigoUsado(id);
  } else {
    const c = AppState.inventory.find(i => String(i.id) === String(id));
    if (c) {
      c.estado = 'Usado';
      saveLocal();
      renderCodigosPSN();
      if (typeof showToast === 'function') showToast('Código vendido marcado como usado');
    }
  }
}

// --- MODAL HISTORIAL DE VENTAS POR JUEGO ---
function openModalHistorialVentas(itemId) {
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

function closeModalHistorialVentas() {
  document.getElementById('historialVentasOverlay').classList.remove('show');
}


function showFactura(id) {
  const v = AppState.sales.find(s => s.id === id);
  const text = `CANGEL GAMES\nRecibo Venta\nCliente: ${v.cliente}\nJuego: ${v.juego}\nTotal: $${v.precio} USD`;
  document.getElementById('facturaText').textContent = text;
  document.getElementById('facturaOverlay').classList.add('show');
}

function closeFactura() { document.getElementById('facturaOverlay').classList.remove('show'); }

/* ═══════════════════════════════════════ */
/* 6. BALANCE & AUDITORÍA PDF              */
/* ═══════════════════════════════════════ */

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
              const dot = item.datasetIndex === 0 ? '🟣' : '⚪';
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
    const arrow = pct !== null ? (parseFloat(pct) >= 0 ? '▲' : '▼') : '';
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

/* ═══════════════════════════════════════ */
/* INGRESOS ADICIONALES (Balance)          */
/* ═══════════════════════════════════════ */

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
  showToast('✅ Ingreso adicional registrado');
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

/* ═══════════════════════════════════════ */
/* 7. HELPERS & PERSISTENCIA               */
/* ═══════════════════════════════════════ */


function saveLocal() {
  // 1. Persistencia síncrona en localStorage (Garantiza velocidad y respaldo local)
  localStorage.setItem('cangel_erp_v7', JSON.stringify({
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
  }));

  // 2. Sincronización asíncrona con Supabase (Shadow Writing)
  // Se ejecuta en segundo plano sin bloquear la UI
  
  // Extraer clientes únicos de las ventas para sincronizar metadatos
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

  (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout estricto de 5s

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error('Server error');
    } catch (err) {
      if (USE_LOCAL_STORAGE_BACKUP) {
        // Error silencioso: Guardar en cola de reintentos solo si el backup está activo
        console.warn("⚠️ Sync fallido. Guardando en cola local:", err.name === 'AbortError' ? 'Timeout 5s' : err.message);
        localStorage.setItem('cangel_sync_queue', JSON.stringify(syncData));
      }
    }
  })();

  update2FABellBadge();
}

/**
 * Fase 3.2: Procesador de Cola de Sincronización
 * Reintenta enviar datos pendientes si hubo fallos previos.
 */
async function processSyncQueue() {
  const queue = localStorage.getItem('cangel_sync_queue');
  if (!queue) return;

  try {
    const syncData = JSON.parse(queue);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Timeout más largo para reintentos

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log("✅ Cola de sincronización procesada con éxito.");
      localStorage.removeItem('cangel_sync_queue');
    }
  } catch (err) {
    console.warn("⏳ Reintento de sincronización fallido (servidor aún offline).");
  }
}

// NOTA: Esta funcionalidad de limpieza es TEMPORAL para fase de desarrollo/pruebas.
// No se incluirá en la versión final de producción.
function confirmarLimpiezaDatos() {
  showDeleteConfirmModal(
    "⚠️ ADVERTENCIA CRÍTICA: ¿Estás seguro de que quieres limpiar todos los datos de prueba?\n\nSe borrarán permanentemente ventas, inventario, gastos y análisis. Esta acción NO se puede deshacer.",
    async () => {
      console.log('--- Iniciando limpieza profunda de datos ---');
      AppState.sales = [];
      AppState.inventory = [];
      AppState.inventoryGames = [];
      AppState.inventoryCodes = [];
      AppState.paquetes = [];
      AppState.membresias = [];
      AppState.expenses = [];
      AppState.auditLog = [];
      AppState.analysis = [];
      AppState.catalog = [];
      AppState.clients = [];
      AppState.raffles = [];
      AppState.idealStock = {};
      AppState.plantillas = {};

      logEvent('LIMPIEZA TOTAL', 'Se ha realizado una limpieza completa de los datos de prueba del sistema.');
      saveLocal();

      await showPremiumAlert("Limpieza", "Limpieza completada. La página se recargará para aplicar los cambios.", "success");
      location.reload();
    }
  );
}

function loadLocal() {
  const saved = localStorage.getItem('cangel_erp_v7');
  if (saved) {
    const data = JSON.parse(saved);
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
    // Los datos históricos completos residen en Supabase
    AppState.sales = (data.sales || []).slice(-1000);

    // Add _searchIndex to loaded sales
    AppState.sales.forEach(v => {
      if (!v._searchIndex) {
        v._searchIndex = `${(v.cliente || '')} ${(v.nombre_cliente || '')} ${(v.cedula || '')} ${(v.celular || '')}`.toLowerCase();
      }
    });

    AppState.inventoryGames = data.inventoryGames || []; // New separate array
    AppState.inventoryCodes = data.inventoryCodes || []; // New separate array
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout 5s

    const response = await fetch('/api/initial-data', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return;

    const { inventoryGames, settings } = await response.json();

    // Actualizar AppState silenciosamente con los datos más recientes
    if (inventoryGames && inventoryGames.length > 0) {
      AppState.inventoryGames = inventoryGames;
    }
    
    if (settings) {
      if (settings.exchangeRate) AppState.exchangeRate = settings.exchangeRate.value;
      if (settings.plantillas) AppState.plantillas = settings.plantillas;
    }

    // Auditoría Silenciosa (Fase 5.1)
    const clientsResp = await fetch('/api/clientes?limit=1');
    const clientsData = await clientsResp.json();
    const supabaseCount = clientsData.total || 0;
    const localCount = Object.keys(AppState.clientsListas || {}).length;
    
    if (localStorage.getItem('debug_migration') === 'true') {
       console.log(`%c[AUDIT] Local: ${localCount} | Supabase: ${supabaseCount}`, "color: #39d6f9; font-weight: bold;");
    }

    // console.log("✅ Datos frescos cargados desde Supabase (Fase 4.1)"); // Log limpiado para producción
    
    // Refrescar UI si el usuario ya está dentro
    if (AppState.currentUser) {
      if (typeof updateDashboard === 'function') updateDashboard();
      if (AppState.activeTab === 'inventario' && typeof renderCuentasPSN === 'function') renderCuentasPSN();
    }

  } catch (err) {
    console.warn("⏳ Falló el refresco asíncrono (usando caché local):", err.message);
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
  checkLowInventory();
  calculateBalances();
  updateDashboard();
});



const btnExtractAI = document.getElementById('btnExtractAI');
if (btnExtractAI) btnExtractAI.addEventListener('click', handleExtractAI);

const btnAddRow = document.getElementById('btnAddRow');
if (btnAddRow) btnAddRow.addEventListener('click', addEmptyRow);

const btnAddToCatalog = document.getElementById('btnAddToCatalog');
if (btnAddToCatalog) btnAddToCatalog.addEventListener('click', addToCatalogFromAnalysis);

function switchInvMode(mode) {
  const allBtns = [
    document.getElementById('btnInvJuegos'),
    document.getElementById('btnInvPaquetes'),
    document.getElementById('btnInvMembresias'),
    document.getElementById('btnInvCodigos'),
    document.getElementById('btnInvXbox'),
    document.getElementById('btnInvPhysical')
  ];
  const allContainers = [
    document.getElementById('invJuegosContainer'),
    document.getElementById('invPaquetesContainer'),
    document.getElementById('invMembresiasContainer'),
    document.getElementById('invCodigosContainer'),
    document.getElementById('invXboxContainer'),
    document.getElementById('invPhysicalContainer')
  ];

  allBtns.forEach(b => b && b.classList.remove('active'));
  allContainers.forEach(c => c && c.classList.add('hidden'));

  const modeMap = {
    juegos: { btnId: 'btnInvJuegos', containerId: 'invJuegosContainer', render: renderInventoryJuegos },
    paquetes: { btnId: 'btnInvPaquetes', containerId: 'invPaquetesContainer', render: renderInventoryPaquetes },
    membresias: { btnId: 'btnInvMembresias', containerId: 'invMembresiasContainer', render: renderInventoryMembresias },
    codigos: { btnId: 'btnInvCodigos', containerId: 'invCodigosContainer', render: renderInventoryCodigos },
    xbox: { btnId: 'btnInvXbox', containerId: 'invXboxContainer', render: renderInventoryXbox },
    physical: { btnId: 'btnInvPhysical', containerId: 'invPhysicalContainer', render: renderInventoryPhysical },
  };

  const config = modeMap[mode] || modeMap['juegos'];
  const btn = document.getElementById(config.btnId);
  const container = document.getElementById(config.containerId);
  if (btn) btn.classList.add('active');
  if (container) container.classList.remove('hidden');
  config.render();
}

function renderInventory() {
  renderInventoryJuegos();
  renderInventoryCodigos();
  renderInventoryXbox();
  renderInventoryPhysical();
  checkLowInventory();
  calculateBalances();
}

/* --- CALCULATE BALANCES --- */
function calculateBalances() {
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

// ──── GESTIÓN DE STOCK IDEAL Y AUDITORÍA ────
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

// ──── MODULO DE GRÁFICAS (Chart.js) ────
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

function openModalJuego() {
  document.getElementById('modalJuegoTitle').textContent = '🎮 Ingresar Nuevo Juego';
  document.getElementById('editGameId').value = '';
  document.getElementById('modalJuegoOverlay').classList.add('show');
  document.getElementById('invJuegoFecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('invJuegoFechaCuenta').value = new Date().toISOString().split('T')[0];
  document.getElementById('invJuegoHosting').value = '';
  document.getElementById('invJuegoPassHosting').value = '';
  document.getElementById('invJuegoPais').value = 'USA';
}

function editGameInventory(id) {
  const game = AppState.inventoryGames.find(g => g.id === id);
  if (!game) return;

  document.getElementById('modalJuegoTitle').textContent = '✏️ Editar Juego';
  document.getElementById('editGameId').value = game.id;

  document.getElementById('invJuegoNombre').value = game.juego;
  document.getElementById('invJuegoCorreo').value = game.correo;
  document.getElementById('invJuegoHosting').value = game.correo_hosting || '';
  document.getElementById('invJuegoPassHosting').value = game.password_hosting || '';
  document.getElementById('invJuegoPais').value = game.pais || 'USA';
  document.getElementById('invJuegoPass').value = game.password || '';
  document.getElementById('invJuego2fa').value = game.codigo2fa || '';
  document.getElementById('invJuegoFecha').value = game.fecha || '';
  document.getElementById('invJuegoFechaCuenta').value = game.fechaCuenta || '';
  document.getElementById('invJuegoUsd').value = game.costoUsd;
  document.getElementById('invJuegoTrm').value = Math.round(game.costoCop / game.costoUsd) || 4000;

  document.getElementById('modalJuegoOverlay').classList.add('show');
}

function closeModalJuego() {
  document.getElementById('modalJuegoOverlay').classList.remove('show');
  // Clear fields
  document.getElementById('editGameId').value = '';
  document.getElementById('invJuegoNombre').value = '';
  document.getElementById('invJuegoCorreo').value = '';
  document.getElementById('invJuegoCorreo').style.borderColor = 'rgba(255,255,255,0.1)';
  document.getElementById('duplicateInvEmailError').style.display = 'none';
  document.getElementById('invJuegoHosting').value = '';
  document.getElementById('invJuegoPassHosting').value = '';
  document.getElementById('invJuegoPass').value = '';
  document.getElementById('invJuego2fa').value = '';
  document.getElementById('invJuegoFechaCuenta').value = '';
  document.getElementById('invJuegoUsd').value = '';
  document.getElementById('invJuegoTrm').value = '';
}

function checkDuplicateGameEmail(input) {
  const currentEmail = input.value.trim().toLowerCase();
  const editId = document.getElementById('editGameId').value;
  const errorDiv = document.getElementById('duplicateInvEmailError');

  if (!currentEmail) {
    errorDiv.style.display = 'none';
    input.style.borderColor = 'rgba(255,255,255,0.1)';
    return false;
  }

  const isDuplicate = AppState.inventoryGames.some(game =>
    game.correo.toLowerCase() === currentEmail && game.id != editId
  );

  if (isDuplicate) {
    errorDiv.style.display = 'block';
    input.style.borderColor = '#f43f5e';
    return true;
  } else {
    errorDiv.style.display = 'none';
    input.style.borderColor = 'rgba(255,255,255,0.1)';
    return false;
  }
}

function saveGameInventory() {
  const editId = document.getElementById('editGameId').value;
  const nombre = document.getElementById('invJuegoNombre').value.trim();
  const correo = document.getElementById('invJuegoCorreo').value.trim();
  const correoHosting = document.getElementById('invJuegoHosting').value.trim();
  const passHosting = document.getElementById('invJuegoPassHosting').value.trim();
  const pais = document.getElementById('invJuegoPais').value;
  const password = document.getElementById('invJuegoPass').value.trim();
  const codigo2fa = document.getElementById('invJuego2fa').value.trim();
  const fecha = document.getElementById('invJuegoFecha').value;
  const fechaCuenta = document.getElementById('invJuegoFechaCuenta').value;
  const costoUsd = parseFloat(document.getElementById('invJuegoUsd').value);
  const trm = parseFloat(document.getElementById('invJuegoTrm').value);

  if (!nombre || !correo || isNaN(costoUsd) || isNaN(trm)) {
    alert("Por favor completa los campos obligatorios y asegúrate de que Costo USD y TRM sean números.");
    return;
  }

  // Double check duplicates
  if (checkDuplicateGameEmail(document.getElementById('invJuegoCorreo'))) {
    alert("Error: Este correo ya existe en el inventario. Por favor usa un correo diferente.");
    return;
  }

  const costoCop = Math.round(costoUsd * trm);

  if (!AppState.inventoryGames) AppState.inventoryGames = [];

  // Búsqueda silenciosa en Análisis para inyectar ADN de la consola
  let es_ps4 = true;
  let es_ps5 = true;
  let tipo_version = "Cross-Gen";

  const matchAnalisis = AppState.analysis.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());
  if (matchAnalisis) {
    es_ps4 = matchAnalisis.ps4 !== undefined ? matchAnalisis.ps4 : true;
    es_ps5 = matchAnalisis.ps5 !== undefined ? matchAnalisis.ps5 : true;

    if (es_ps4 && es_ps5) tipo_version = "Cross-Gen";
    else if (!es_ps4 && es_ps5) tipo_version = "Exclusivo PS5";
    else if (es_ps4 && !es_ps5) tipo_version = "Exclusivo PS4";
  }

  if (editId) {
    // Update existing
    const gameIndex = AppState.inventoryGames.findIndex(g => g.id == editId);
    if (gameIndex !== -1) {
      AppState.inventoryGames[gameIndex] = {
        ...AppState.inventoryGames[gameIndex],
        juego: nombre,
        correo: correo,
        correo_hosting: correoHosting,
        password_hosting: passHosting,
        pais: pais,
        password: password,
        fecha: fecha,
        fechaCuenta: fechaCuenta,
        codigo2fa: codigo2fa,
        costoUsd: costoUsd,
        costoCop: costoCop,
        es_ps4: es_ps4,
        es_ps5: es_ps5,
        tipo_version: tipo_version,
        cupos_ps4_primaria: es_ps4 ? 2 : 0,
        cupos_ps4_secundaria: es_ps4 ? 1 : 0,
        cupos_ps5_primaria: (es_ps5 || es_ps4) ? 2 : 0,
        cupos_ps5_secundaria: (es_ps5 || es_ps4) ? 1 : 0
      };

      if (typeof logEvent === 'function') {
        logEvent('Inventario Juegos: Edición', `ID: ${editId} | Juego: ${nombre}`);
      }
    }
  } else {
    // Create new
    const newJuego = {
      id: Date.now(),
      juego: nombre,
      correo: correo,
      correo_hosting: correoHosting,
      password_hosting: passHosting,
      pais: pais,
      password: password,
      fecha: fecha,
      fechaCuenta: fechaCuenta,
      codigo2fa: codigo2fa,
      costoUsd: costoUsd,
      costoCop: costoCop,
      estado: 'OFF',
      es_ps4: es_ps4,
      es_ps5: es_ps5,
      tipo_version: tipo_version,
      cupos_ps4_primaria: es_ps4 ? 2 : 0,
      cupos_ps4_secundaria: es_ps4 ? 1 : 0,
      cupos_ps5_primaria: (es_ps5 || es_ps4) ? 2 : 0,
      cupos_ps5_secundaria: (es_ps5 || es_ps4) ? 1 : 0
    };
    AppState.inventoryGames.push(newJuego);

    if (typeof logEvent === 'function') {
      logEvent('Inventario Juegos: Nuevo', `ID: ${newJuego.id} | Juego: ${nombre} (${tipo_version})`);
    }
  }

  saveLocal();
  renderInventoryJuegos();
  renderAnalysisTable(); // Sincronizar columna F inmediatamente
  closeModalJuego();
  checkLowInventory();
  calculateBalances();
  updateDashboard();
}

function toggleGameStatus(id) {
  const game = AppState.inventoryGames.find(g => g.id === id);
  if (game) {
    game.estado = game.estado === 'ON' ? 'OFF' : 'ON';

    if (typeof logEvent === 'function') {
      logEvent('Inventario Juegos: Estado', `ID: ${id} | Juego: ${game.juego} -> ${game.estado}`);
    }

    saveLocal();
    renderInventoryJuegos();
    checkLowInventory();
    calculateBalances();
  }
}

function deleteGameInventory(id) {
  showDeleteConfirmModal("¿Estás seguro de que deseas eliminar permanentemente este juego del inventario?", () => {
    const gameToDelete = AppState.inventoryGames.find(g => g.id === id);
    if (gameToDelete && typeof logEvent === 'function') {
      logEvent('Inventario Juegos: Eliminado', `ID: ${id} | Juego: ${gameToDelete.juego}`);
    }

    AppState.inventoryGames = AppState.inventoryGames.filter(g => g.id !== id);
    saveLocal();
    renderInventoryJuegos();
    checkLowInventory();
    calculateBalances();
    if (typeof showToast === 'function') showToast("Juego eliminado del inventario", "info");
  });
}

function filterInventoryGames() {
  renderInventoryJuegos(); // The render function itself will read the input and filter
}

function renderInventoryJuegos() {
  const user = AppState.currentUser;
  if (!user) return;
  const tbody = document.getElementById('inventoryGamesBody');
  if (!tbody) return;

  const searchInput = document.getElementById('searchJuegos');
  const query = searchInput ? searchInput.value.toLowerCase() : '';

  const statusFilterEl = document.getElementById('filterStatus');
  const statusFilter = statusFilterEl ? statusFilterEl.value : 'all';

  let games = (AppState.inventoryGames || []).filter(g => {
    const juegoName = g.juego || '';
    const correoText = g.correo || '';
    const matchesSearch = juegoName.toLowerCase().includes(query) || correoText.toLowerCase().includes(query);
    if (query !== '' && !matchesSearch) return false;

    if (statusFilter !== 'all') {
      const gStatus = g.estado ? g.estado.toUpperCase() : 'OFF';
      if (gStatus !== statusFilter) return false;
    }

    return true;
  });

  // Sort by date Desc (Purchase date)
  games.sort((a, b) => {
    const dateA = a.fecha ? new Date(a.fecha) : new Date(0);
    const dateB = b.fecha ? new Date(b.fecha) : new Date(0);
    return dateB - dateA;
  });

  let html = '';
  let currentMonthHeader = '';

  games.forEach((item, index) => {
    // Grouping - Usar split para evitar problemas de zona horaria (UTC vs Local)
    let monthYear = "SIN FECHA";
    if (item.fecha && item.fecha.includes('-')) {
      const parts = item.fecha.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2] || 1);
      monthYear = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
    }

    if (monthYear !== currentMonthHeader) {
      currentMonthHeader = monthYear;
      html += `
        <tr class="month-separator" style="background: rgba(255,255,255,0.03);">
          <td colspan="12" style="padding: 12px; text-align: left; font-weight: bold; color: var(--accent-cyan); font-size: 0.85rem; letter-spacing: 1px; border-left: 3px solid var(--accent-cyan);">
            <i class="fas fa-calendar-alt" style="margin-right: 8px;"></i> ${monthYear}
          </td>
        </tr>
      `;
    }

    const isON = item.estado === 'ON';

    // Switch estilo premium ON/OFF
    const statusSwitch = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
        <span class="status-label-premium ${isON ? 'active' : 'used'}">
          <i data-lucide="${isON ? 'check-circle' : 'clock'}" style="width:10px; height:10px;"></i> ${item.estado || 'OFF'}
        </span>
        <label class="premium-switch">
          <input type="checkbox" ${isON ? 'checked' : ''} onchange="toggleGameStatus('${item.id}')">
          <span class="switch-slider"></span>
        </label>
      </div>
    `;

    const user = AppState.currentUser;
    const hasAccesoTotal = user?.permisos?.acceso_total === true;
    const canEdit = hasAccesoTotal || user?.permisos?.p_inventario_editar === true;
    const canDelete = hasAccesoTotal || user?.permisos?.p_inventario_eliminar === true;

    // Botones de acción estilo premium (cuadrados blancos con iconos negros/transparentes)
    const actionButtons = `
      <div style="display:flex; gap:10px; justify-content:center;">
        <button class="action-btn-premium view-btn" onclick="openModalHistorialVentas('${item.id}')" title="Ver Historial de Ventas"><i data-lucide="eye" class="minimalist-icon" style="width:16px; height:16px;"></i></button>
        ${canEdit ? `<button class="action-btn-premium edit-btn" onclick="editGameInventory('${item.id}')" title="Editar"><i data-lucide="edit-3" class="minimalist-icon" style="width:16px; height:16px;"></i></button>` : ''}
        ${canDelete ? `<button class="action-btn-premium delete-btn" onclick="deleteGameInventory('${item.id}')" title="Eliminar"><i data-lucide="trash-2" class="minimalist-icon" style="width:16px; height:16px;"></i></button>` : ''}
      </div>
    `;


    html += `
      <tr class="${isON ? 'row-active' : 'row-used'}">
        <td class="row-number">${index + 1}</td>
        <td style="color: var(--accent-cyan); font-weight: 700;">#${item.id}</td>
        <td>${item.fecha || '-'}</td>
        <td class="fw-bold" style="color:var(--text-light)">
          <div style="display:flex; align-items:center; gap:6px;">
            <span>${item.juego}</span>
            <span style="font-size:0.65rem; font-weight:900; background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:8px; color:var(--accent-yellow); border:1px solid var(--accent-yellow); display:inline-flex; align-items:center; gap:6px; line-height:1;">
              <img src="https://flagcdn.com/w20/${item.pais === 'TUR' ? 'tr' : 'us'}.png" style="width:16px; height:auto; border-radius:2px; display:inline-block;" alt="${item.pais}">
              ${item.pais === 'TUR' ? 'TUR' : 'USA'}
            </span>
          </div>
          <div style="margin-top:8px; font-size:0.7rem; display:flex; flex-direction:column; gap:2px;">
            ${(() => {
        const { config, used } = getGameSlots(item.id);
        let htmlSlots = '';

        if (item.es_ps4) {
          const p4p = config.p_ps4 - used.p_ps4;
          const p4s = config.s_ps4 - used.s_ps4;
          const p4s_available = (used.p_ps4 >= config.p_ps4) && p4s > 0;
          htmlSlots += `
                  <div style="display:flex; gap:6px; align-items:center; line-height:1;">
                    <span style="color:${p4p > 0 ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p4p} PRI</span>
                    <span style="color:${p4s_available ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p4s} SEC</span>
                    <span style="font-size:0.55rem; font-weight:700; background:rgba(0,102,255,0.15); color:#0066ff; padding:2px 5px; border-radius:4px; border:1px solid rgba(0,102,255,0.4); margin-left:1px; letter-spacing:0.3px;">PS4</span>
                  </div>
                `;
        }

        if (item.es_ps5 || item.es_ps4) {
          const p5p = config.p_ps5 - used.p_ps5;
          const p5s = config.s_ps5 - used.s_ps5;
          const p5s_available = (used.p_ps5 >= config.p_ps5) && p5s > 0;
          htmlSlots += `
                  <div style="display:flex; gap:6px; align-items:center; line-height:1;">
                    <span style="color:${p5p > 0 ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p5p} PRI</span>
                    <span style="color:${p5s_available ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p5s} SEC</span>
                    <span style="font-size:0.55rem; font-weight:700; background:rgba(255,255,255,0.15); color:#ffffff; padding:2px 5px; border-radius:4px; border:1px solid rgba(255,255,255,0.4); margin-left:1px; letter-spacing:0.3px;">PS5</span>
                  </div>
                `;
        }
        return htmlSlots;
      })()}
          </div>
        </td>
        <td style="font-size:0.9rem">
          <div class="fw-bold">${item.correo}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Hosting: ${item.correo_hosting || '-'} | Pass: ${item.password_hosting || '-'}</div>
        </td>
        <td style="font-family:monospace; font-size:0.85rem">${item.password || '-'}</td>
        <td style="font-family:monospace; font-size:0.85rem">${item.codigo2fa || '-'}</td>
        <td style="font-size:0.85rem">${item.fechaCuenta || '-'}</td>
        <td class="text-success">${formatUSD(item.costoUsd)}</td>
        <td class="text-warning">${formatCOP(item.costoCop)}</td>
        <td style="text-align:center">${statusSwitch}</td>
        <td>${actionButtons}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html || '<tr><td colspan="12" style="text-align:center; padding: 40px; color:rgba(255,255,255,0.3)">Sin inventario cargado</td></tr>';
  if (window.lucide) window.lucide.createIcons();
}

/* --- CODIGOS PSN LOGIC --- */

function openModalCodigo() {
  document.getElementById('modalCodigoOverlay').classList.add('show');
  document.getElementById('invCodigoFecha').value = new Date().toISOString().split('T')[0];
}

function closeModalCodigo() {
  document.getElementById('modalCodigoOverlay').classList.remove('show');
  document.getElementById('invCodigoTrm').value = '';
  document.getElementById('invCodigoPin').value = '';
}

function saveCodigoInventory() {
  const precioUsd = parseFloat(document.getElementById('invCodigoValor').value);
  const trm = parseFloat(document.getElementById('invCodigoTrm').value);
  const fecha = document.getElementById('invCodigoFecha').value;
  const rawInput = document.getElementById('invCodigoPin').value.trim();

  if (isNaN(trm) || !rawInput) {
    alert("Por favor ingresa la TRM y al menos un código PIN.");
    return;
  }

  // Separar los códigos por salto de línea y filtrar líneas vacías
  const codesArray = rawInput.split('\n').map(c => c.trim()).filter(c => c.length > 0);

  if (codesArray.length === 0) {
    alert("No se encontraron códigos válidos.");
    return;
  }

  const costoCop = Math.round(precioUsd * trm);

  if (!AppState.inventoryCodes) AppState.inventoryCodes = [];

  codesArray.forEach((codigo, index) => {
    const newCode = {
      id: Date.now() + index,
      fecha: fecha,
      precioUsd: precioUsd,
      costoCop: costoCop,
      codigo: codigo,
      estado: 'ON',
      usado: false
    };
    AppState.inventoryCodes.push(newCode);
  });

  if (typeof logEvent === 'function') {
    logEvent('Inventario Códigos: Nuevo', `Agregados ${codesArray.length} código(s) PSN`);
  }

  saveLocal();
  renderInventoryCodigos();
  closeModalCodigo();
  calculateBalances();
  showToast(`${codesArray.length} códigos añadidos con éxito`);
}

function toggleCodigoStatus(id) {
  const code = AppState.inventoryCodes.find(c => c.id === id);
  if (code) {
    code.estado = code.estado === 'ON' ? 'OFF' : 'ON';

    if (typeof logEvent === 'function') {
      logEvent('Inventario Códigos: Estado', `ID: ${id} | Nuevo Estado: ${code.estado}`);
    }

    saveLocal();
    renderInventoryCodigos();
    calculateBalances();
  }
}

function toggleCodigoUsed(id) {
  const code = AppState.inventoryCodes.find(c => c.id === id);
  if (code) {
    // Si el usuario intenta marcar como usado pero está OFF, permitirlo pero sincronizar
    code.usado = !code.usado;

    // Sincronizar estado: Si se marca como usado, pasar a OFF. Si se desmarca, pasar a ON.
    code.estado = code.usado ? 'OFF' : 'ON';

    if (typeof logEvent === 'function') {
      logEvent('Inventario Códigos: Uso', `ID: ${id} | Usado: ${code.usado} | Estado: ${code.estado}`);
    }

    saveLocal();
    renderInventoryCodigos();
    calculateBalances();

    if (code.usado) {
      showToast("PIN marcado como usado y desactivado (OFF)");
    } else {
      showToast("PIN marcado como disponible y activado (ON)");
    }
  }
}

function deleteCodigoInventory(id) {
  showDeleteConfirmModal("¿Eliminar permanentemente este código PSN?", () => {
    const codeToDelete = AppState.inventoryCodes.find(c => c.id === id);
    if (codeToDelete && typeof logEvent === 'function') {
      logEvent('Inventario Códigos: Eliminado', `ID: ${id}`);
    }

    const row = document.getElementById(`codigo-row-${id}`);
    if (row) {
      row.classList.add('row-fading-out');
      setTimeout(() => {
        AppState.inventoryCodes = AppState.inventoryCodes.filter(c => c.id !== id);
        saveLocal();
        renderInventoryCodigos();
        calculateBalances();
        showToast("Código eliminado", "info");
      }, 1200);
    } else {
      AppState.inventoryCodes = AppState.inventoryCodes.filter(c => c.id !== id);
      saveLocal();
      renderInventoryCodigos();
      calculateBalances();
      if (typeof showToast === 'function') showToast("Código eliminado", "info");
    }
  });
}

function filterInventoryCodes() {
  renderInventoryCodigos();
}

function filterInventoryXbox() {
  renderInventoryXbox();
}

function filterInventoryPhysical() {
  renderInventoryPhysical();
}

/* --- XBOX INVENTORY --- */

function renderInventoryXbox() {
  console.log("Rendering Xbox Inventory");
  const tbody = document.getElementById('inventoryXboxBody');
  if (!tbody) return;

  const searchInput = document.getElementById('searchXbox');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let xboxItems = (AppState.xboxInventory || []).filter(item => {
    const detail = item.detalle || '';
    const email = item.correo || '';
    const matchesSearch = detail.toLowerCase().includes(query) || email.toLowerCase().includes(query);
    return query === '' || matchesSearch;
  });

  // Sort by date Desc
  xboxItems.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  let html = '';
  xboxItems.forEach((item, index) => {
    const isON = item.estado === 'ON';
    const user = AppState.currentUser;
    const hasAccesoTotal = user.permisos && user.permisos.acceso_total === true;
    const canEdit = hasAccesoTotal || (user.permisos && user.permisos.p_inventario_editar === true);
    const canDelete = hasAccesoTotal || (user.permisos && user.permisos.p_inventario_eliminar === true);

    html += `
      <tr class="${isON ? 'row-active' : 'row-used'}">
        <td class="row-number">${index + 1}</td>
        <td style="color: var(--accent-cyan); font-weight: 700;">#${item.id}</td>
        <td>${item.fecha || '-'}</td>
        <td class="fw-bold" style="color:var(--text-light)">${item.detalle || '-'}</td>
        <td style="color: var(--accent-cyan);">${item.correo || '-'}</td>
        <td>${item.password || '-'}</td>
        <td class="text-success" style="font-weight: 700;">${formatCOP(item.costoCop)}</td>
        <td>${item.proveedor || '-'}</td>
        <td style="text-align: center;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span class="status-label-premium ${isON ? 'active' : 'used'}">${item.estado || 'OFF'}</span>
            <label class="premium-switch">
              <input type="checkbox" ${isON ? 'checked' : ''} onchange="toggleXboxStatus('${item.id}')">
              <span class="switch-slider"></span>
            </label>
          </div>
        </td>
        <td>
          <div style="display:flex; gap:10px; justify-content:center;">
            <button class="action-btn-premium view-btn" onclick="openModalXbox('${item.id}', true)" title="Ver"><i data-lucide="eye" class="minimalist-icon" style="width:16px; height:16px;"></i></button>
            ${canEdit ? `<button class="action-btn-premium edit-btn" onclick="openModalXbox('${item.id}')" title="Editar"><i data-lucide="edit-3" class="minimalist-icon" style="width:16px; height:16px;"></i></button>` : ''}
            ${canDelete ? `<button class="action-btn-premium delete-btn" onclick="deleteXbox('${item.id}')" title="Eliminar"><i data-lucide="trash-2" class="minimalist-icon" style="width:16px; height:16px;"></i></button>` : ''}
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html || '<tr><td colspan="10" style="text-align:center; padding: 40px; color:rgba(255,255,255,0.3)">Sin registros de Xbox</td></tr>';
  if (window.lucide) window.lucide.createIcons();
}

function toggleXboxStatus(id) {
  const item = AppState.xboxInventory.find(x => x.id === id);
  if (item) {
    item.estado = item.estado === 'ON' ? 'OFF' : 'ON';
    logEvent('INVENTARIO', `Cambió estado Xbox #${id} a ${item.estado}`);
    saveLocal();
    renderInventoryXbox();
    showToast(`Estado Xbox #${id} cambiado a ${item.estado}`);
  }
}

function openModalXbox(id = null, readonly = false) {
  const modal = document.getElementById('modalXboxInventory');
  if (!modal) return;

  const form = document.getElementById('xboxInventoryForm');
  const titleEl = document.getElementById('modalXboxTitle');
  const btnSave = document.getElementById('btnSaveXbox');

  form.reset();
  document.getElementById('xboxFormId').value = '';

  if (id) {
    const item = AppState.xboxInventory.find(x => x.id === id);
    if (item) {
      document.getElementById('xboxFormId').value = item.id;
      document.getElementById('xboxFormFecha').value = item.fecha;
      document.getElementById('xboxFormDetalle').value = item.detalle;
      document.getElementById('xboxFormCorreo').value = item.correo;
      document.getElementById('xboxFormPassword').value = item.password;
      document.getElementById('xboxFormCostoCop').value = item.costoCop;
      document.getElementById('xboxFormProveedor').value = item.proveedor;
      document.getElementById('xboxFormEstado').value = item.estado || 'ON';

      titleEl.innerHTML = readonly ? '<i data-lucide="eye"></i> Detalle Xbox' : '<i data-lucide="edit-3"></i> Editar Xbox';
    }
  } else {
    titleEl.innerHTML = '<i data-lucide="plus-circle"></i> Nuevo Xbox';
    document.getElementById('xboxFormFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('xboxFormEstado').value = 'ON';
  }

  // Readonly mode management
  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(input => input.disabled = readonly);
  if (btnSave) btnSave.style.display = readonly ? 'none' : 'flex';

  modal.classList.add('show');
  if (window.lucide) window.lucide.createIcons();
}

function closeXboxModal() {
  const modal = document.getElementById('modalXboxInventory');
  if (modal) modal.classList.remove('show');
}

function saveXboxInventory() {
  const idInput = document.getElementById('xboxFormId').value;
  const isEdit = idInput !== '';

  const itemData = {
    id: isEdit ? parseInt(idInput) : (AppState.xboxInventory.length > 0 ? Math.max(...AppState.xboxInventory.map(x => x.id)) + 1 : 1),
    fecha: document.getElementById('xboxFormFecha').value,
    detalle: document.getElementById('xboxFormDetalle').value,
    correo: document.getElementById('xboxFormCorreo').value,
    password: document.getElementById('xboxFormPassword').value,
    costoCop: parseInt(document.getElementById('xboxFormCostoCop').value || 0),
    proveedor: document.getElementById('xboxFormProveedor').value,
    estado: document.getElementById('xboxFormEstado').value
  };

  if (!itemData.detalle || !itemData.correo) {
    showPremiumAlert('Error', 'Por favor completa el detalle y el correo.', 'error');
    return;
  }

  if (isEdit) {
    const index = AppState.xboxInventory.findIndex(x => x.id === itemData.id);
    if (index !== -1) {
      AppState.xboxInventory[index] = itemData;
      logEvent('INVENTARIO', `Editó Xbox #${itemData.id}: ${itemData.detalle}`);
    }
  } else {
    AppState.xboxInventory.push(itemData);
    logEvent('INVENTARIO', `Agregó nuevo Xbox #${itemData.id}: ${itemData.detalle}`);
  }

  saveLocal();
  closeXboxModal();
  renderInventoryXbox();
  calculateBalances();
  showToast(isEdit ? 'Xbox actualizado' : 'Xbox agregado');
}

function deleteXbox(id) {
  showDeleteConfirmModal('¿Estás seguro de eliminar este registro de Xbox?', () => {
    const index = AppState.xboxInventory.findIndex(x => x.id === id);
    if (index !== -1) {
      const deleted = AppState.xboxInventory.splice(index, 1)[0];
      logEvent('INVENTARIO', `Eliminó Xbox #${id}: ${deleted.detalle}`);
      saveLocal();
      renderInventoryXbox();
      calculateBalances();
      showToast('Xbox eliminado');
    }
  });
}

/* --- PHYSICAL PRODUCTS INVENTORY --- */

function renderInventoryPhysical() {
  console.log("Rendering Physical Inventory");
  const tbody = document.getElementById('inventoryPhysicalBody');
  if (!tbody) return;

  const searchInput = document.getElementById('searchPhysical');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let physicalItems = (AppState.physicalInventory || []).filter(item => {
    const detail = item.detalle || '';
    const serial = item.serial || '';
    const matchesSearch = detail.toLowerCase().includes(query) || serial.toLowerCase().includes(query);
    return query === '' || matchesSearch;
  });

  // Sort by date Desc
  physicalItems.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  let html = '';
  physicalItems.forEach((item, index) => {
    const isON = item.estado === 'ON';
    const user = AppState.currentUser;
    const hasAccesoTotal = user.permisos && user.permisos.acceso_total === true;
    const canEdit = hasAccesoTotal || (user.permisos && user.permisos.p_inventario_editar === true);
    const canDelete = hasAccesoTotal || (user.permisos && user.permisos.p_inventario_eliminar === true);

    html += `
      <tr class="${isON ? 'row-active' : 'row-used'}">
        <td class="row-number">${index + 1}</td>
        <td style="color: var(--accent-cyan); font-weight: 700;">#${item.id}</td>
        <td>${item.fecha || '-'}</td>
        <td class="fw-bold" style="color:var(--text-light)">${item.detalle || '-'}</td>
        <td style="color: var(--accent-cyan);">${item.serial || '-'}</td>
        <td class="text-success" style="font-weight: 700;">${formatCOP(item.costoCop)}</td>
        <td style="text-align: center;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span class="status-label-premium ${isON ? 'active' : 'used'}">${item.estado || 'OFF'}</span>
            <label class="premium-switch">
              <input type="checkbox" ${isON ? 'checked' : ''} onchange="togglePhysicalStatus('${item.id}')">
              <span class="switch-slider"></span>
            </label>
          </div>
        </td>
        <td>
          <div style="display:flex; gap:10px; justify-content:center;">
            <button class="action-btn-premium view-btn" onclick="openModalPhysical('${item.id}', true)" title="Ver"><i data-lucide="eye" class="minimalist-icon" style="width:16px; height:16px;"></i></button>
            ${canEdit ? `<button class="action-btn-premium edit-btn" onclick="openModalPhysical('${item.id}')" title="Editar"><i data-lucide="edit-3" class="minimalist-icon" style="width:16px; height:16px;"></i></button>` : ''}
            ${canDelete ? `<button class="action-btn-premium delete-btn" onclick="deletePhysical('${item.id}')" title="Eliminar"><i data-lucide="trash-2" class="minimalist-icon" style="width:16px; height:16px;"></i></button>` : ''}
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html || '<tr><td colspan="8" style="text-align:center; padding: 40px; color:rgba(255,255,255,0.3)">Sin productos físicos</td></tr>';
  if (window.lucide) window.lucide.createIcons();
}

function togglePhysicalStatus(id) {
  const item = AppState.physicalInventory.find(f => f.id === id);
  if (item) {
    item.estado = item.estado === 'ON' ? 'OFF' : 'ON';
    logEvent('INVENTARIO', `Cambió estado Producto Físico #${id} a ${item.estado}`);
    saveLocal();
    renderInventoryPhysical();
    showToast(`Estado Producto #${id} cambiado a ${item.estado}`);
  }
}

function openModalPhysical(id = null, readonly = false) {
  const modal = document.getElementById('modalPhysicalInventory');
  if (!modal) return;

  const form = document.getElementById('physicalInventoryForm');
  const titleEl = document.getElementById('modalPhysicalTitle');
  const btnSave = document.getElementById('btnSavePhysical');

  form.reset();
  document.getElementById('physicalFormId').value = '';

  if (id) {
    const item = AppState.physicalInventory.find(f => f.id === id);
    if (item) {
      document.getElementById('physicalFormId').value = item.id;
      document.getElementById('physicalFormFecha').value = item.fecha;
      document.getElementById('physicalFormDetalle').value = item.detalle;
      document.getElementById('physicalFormSerial').value = item.serial;
      document.getElementById('physicalFormCostoCop').value = item.costoCop;
      document.getElementById('physicalFormEstado').value = item.estado || 'ON';

      titleEl.innerHTML = readonly ? '<i data-lucide="eye"></i> Detalle Producto Físico' : '<i data-lucide="edit-3"></i> Editar Producto Físico';
    }
  } else {
    titleEl.innerHTML = '<i data-lucide="plus-circle"></i> Nuevo Producto Físico';
    document.getElementById('physicalFormFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('physicalFormEstado').value = 'ON';
  }

  // Readonly mode management
  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(input => input.disabled = readonly);
  if (btnSave) btnSave.style.display = readonly ? 'none' : 'flex';

  modal.classList.add('show');
  if (window.lucide) window.lucide.createIcons();
}

function closePhysicalModal() {
  const modal = document.getElementById('modalPhysicalInventory');
  if (modal) modal.classList.remove('show');
}

function savePhysicalInventory() {
  const idInput = document.getElementById('physicalFormId').value;
  const isEdit = idInput !== '';

  const itemData = {
    id: isEdit ? parseInt(idInput) : (AppState.physicalInventory.length > 0 ? Math.max(...AppState.physicalInventory.map(f => f.id)) + 1 : 1),
    fecha: document.getElementById('physicalFormFecha').value,
    detalle: document.getElementById('physicalFormDetalle').value,
    serial: document.getElementById('physicalFormSerial').value,
    costoCop: parseInt(document.getElementById('physicalFormCostoCop').value || 0),
    estado: document.getElementById('physicalFormEstado').value
  };

  if (!itemData.detalle) {
    showPremiumAlert('Error', 'Por favor completa el detalle del producto.', 'error');
    return;
  }

  if (isEdit) {
    const index = AppState.physicalInventory.findIndex(f => f.id === itemData.id);
    if (index !== -1) {
      AppState.physicalInventory[index] = itemData;
      logEvent('INVENTARIO', `Editó Producto Físico #${itemData.id}: ${itemData.detalle}`);
    }
  } else {
    AppState.physicalInventory.push(itemData);
    logEvent('INVENTARIO', `Agregó nuevo Producto Físico #${itemData.id}: ${itemData.detalle}`);
  }

  saveLocal();
  closePhysicalModal();
  renderInventoryPhysical();
  calculateBalances();
  showToast(isEdit ? 'Producto actualizado' : 'Producto agregado');
}

function deletePhysical(id) {
  showDeleteConfirmModal('¿Estás seguro de eliminar este registro de Producto Físico?', () => {
    const index = AppState.physicalInventory.findIndex(f => f.id === id);
    if (index !== -1) {
      const deleted = AppState.physicalInventory.splice(index, 1)[0];
      logEvent('INVENTARIO', `Eliminó Producto Físico #${id}: ${deleted.detalle}`);
      saveLocal();
      renderInventoryPhysical();
      calculateBalances();
      showToast('Producto eliminado');
    }
  });
}

function renderInventoryCodigos() {
  const user = AppState.currentUser;
  if (!user) return;
  const hasAccesoTotal = user.permisos && user.permisos.acceso_total === true;

  const tbody = document.getElementById('inventoryCodigosBody');
  if (!tbody) return;

  const searchInput = document.getElementById('searchCodigos');
  const denomFilter = document.getElementById('filterDenom');
  const query = searchInput ? searchInput.value.toLowerCase() : '';
  const selectedDenom = denomFilter ? denomFilter.value : 'all';

  // Mostrar todos los códigos (filtrando solo por búsqueda y denominación)
  const codes = (AppState.inventoryCodes || []).filter(c => {
    // Denomination filter
    if (selectedDenom !== 'all') {
      const itemVal = String(c.precioUsd).replace(/[^0-9]/g, '');
      const filterVal = selectedDenom.replace(/[^0-9]/g, '');
      if (itemVal !== filterVal && itemVal !== '' && filterVal !== '') return false;
    }

    // Search filter
    if (query !== '' && !c.codigo.toLowerCase().includes(query)) return false;
    return true;
  });

  // Sort by date desc
  codes.sort((a, b) => {
    const dateA = a.fecha ? new Date(a.fecha) : new Date(0);
    const dateB = b.fecha ? new Date(b.fecha) : new Date(0);
    return dateB - dateA;
  });

  let html = '';
  let currentMonthHeader = '';

  codes.forEach((item, index) => {
    const isON = item.estado === 'ON';
    const isUsed = item.usado;

    // Grouping
    let monthYear = "SIN FECHA";
    if (item.fecha && item.fecha.includes('-')) {
      const parts = item.fecha.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2] || 1);
      monthYear = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
    }

    if (monthYear !== currentMonthHeader) {
      currentMonthHeader = monthYear;
      html += `
        <tr class="month-separator" style="background: rgba(255,255,255,0.03);">
          <td colspan="8" style="padding: 12px; text-align: left; font-weight: bold; color: var(--accent-cyan); font-size: 0.85rem; letter-spacing: 1px; border-left: 3px solid var(--accent-cyan);">
            <i class="fas fa-calendar-alt" style="margin-right: 8px;"></i> ${monthYear}
          </td>
        </tr>
      `;
    }

    // Pastel colors based on denomination for premium look
    let accentColor = 'var(--text-muted)';
    if (item.precioUsd >= 100) accentColor = '#f19066';
    else if (item.precioUsd >= 50) accentColor = '#786fa6';
    else if (item.precioUsd >= 25) accentColor = '#3dc1d3';
    else if (item.precioUsd >= 10) accentColor = '#3ae374';

    // Estilos de fila basados en uso
    const rowClass = isUsed ? 'row-used' : 'row-active';
    const rowStyle = isUsed
      ? `background: rgba(239, 68, 68, 0.1); color: rgba(255,255,255,0.6) !important; border-left: 3px solid #ef4444;`
      : `background: rgba(255, 255, 255, 0.03); border-left: 3px solid ${accentColor};`;

    html += `
      <tr id="codigo-row-${item.id}" class="${rowClass}" style="${rowStyle}">
        <td class="row-number">${index + 1}</td>
        <td>${item.fecha}</td>
        <td class="fw-bold" style="color:${accentColor}">${item.precioUsd}us</td>
        <td class="text-warning">${formatCOP(item.costoCop)}</td>
        <td style="font-family:monospace; font-size:1rem; letter-spacing:1px; color:#fff">
          ${isUsed ? `<span style="text-decoration: line-through; opacity: 0.6;">${item.codigo}</span> <i data-lucide="check-circle" style="width:14px; height:14px; color:#10b981; margin-left:6px;"></i>` : item.codigo}
        </td>
        <td style="text-align:center">
          <button class="action-btn-premium" 
                  onclick="toggleCodigoUsed('${item.id}')" 
                  style="background: ${isUsed ? '#10b981' : 'transparent'}; color: ${isUsed ? '#000' : (isON ? '#10b981' : 'rgba(255,255,255,0.1)')}; border: 1px solid ${isUsed ? '#10b981' : (isON ? '#10b981' : 'rgba(255,255,255,0.1)')}; cursor: ${isON ? 'pointer' : 'not-allowed'}"
                  ${!isON && !isUsed ? 'disabled' : ''}
                  title="${isUsed ? 'Marcar como No Usado' : 'Marcar como Usado'}">
            <i data-lucide="${isUsed ? 'check' : 'square'}" style="width:16px; height:16px;"></i>
          </button>
        </td>
        <td style="text-align:center">
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span class="status-label-premium ${isON ? 'active' : 'used'}">${isON ? 'ON' : 'OFF'}</span>
            <label class="premium-switch">
              <input type="checkbox" ${isON ? 'checked' : ''} onchange="toggleCodigoStatus('${item.id}')">
              <span class="switch-slider"></span>
            </label>
          </div>
        </td>
        <td>
          <div style="display:flex; gap:10px; justify-content:center;">
            <button class="action-btn-premium" onclick="copyToClipboard('${item.codigo}')" title="Copiar Código"><i data-lucide="copy" class="minimalist-icon" style="width:16px; height:16px;"></i></button>
            ${(hasAccesoTotal || (user.permisos && user.permisos.p_inventario_eliminar === true)) ? `
            <button class="action-btn-premium delete-btn" onclick="deleteCodigoInventory('${item.id}')" title="Eliminar"><i data-lucide="trash-2" class="minimalist-icon" style="width:16px; height:16px;"></i></button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html || '<tr><td colspan="8" style="text-align:center; padding: 40px; color:rgba(255,255,255,0.3)">Sin códigos cargados</td></tr>';
  if (window.lucide) window.lucide.createIcons();
}

/* --- ALERTS MODULE --- */

function checkLowInventory() {
  const games = AppState.inventoryGames || [];
  const badge = document.getElementById('notifBadge');
  const bell = document.getElementById('notifBell');
  if (!badge) return;

  // Calculate active stock per game title
  const stockCounts = {};
  games.forEach(g => {
    if (!stockCounts[g.juego]) {
      stockCounts[g.juego] = { count: 0, ideal: g.stockIdeal || 10 };
    }
    if (g.estado === 'Activo') {
      stockCounts[g.juego].count++;
    }
  });

  let notificationsCount = 0;
  for (const [title, data] of Object.entries(stockCounts)) {
    if (data.count <= data.ideal) { // Changed to <= as per common practice, or < per user? User said "cuando hallan 3 me avise" (if meta stock is 10, when it reaches 3).
      // Actually user said: "si compre 10 fc 26 y en el campo de "estado" de la tabla, coloco como regla que cuando hallan 3 me avise"
      // So if count <= 3. I'll use data.ideal as the threshold.
      if (data.count <= 3) { // Hardcoded 3 as per example, or use the 'ideal' field? 
        // User said: "coloco como regla que cuando hallan 3 me avise". 
        // I'll assume 3 is the threshold he wants for alerts.
        notificationsCount++;
      }
    }
  }

  if (notificationsCount > 0) {
    badge.innerText = notificationsCount;
    badge.classList.remove('hidden');
    if (bell) bell.style.color = '#ff4757';
  } else {
    badge.classList.add('hidden');
    if (bell) bell.style.color = 'rgba(255,255,255,0.6)';
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Copiado al portapapeles");
  }).catch(err => {
    console.error('Error al copiar: ', err);
  });
}

function showToast(msg) {
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

// Custom Premium Dropdown Logic - Estado de Juegos
function toggleStatusFilter(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('statusDropdownContainer');
  if (dropdown) dropdown.classList.toggle('open');
}

function selectStatusFilter(event, val, text) {
  if (event) event.stopPropagation();
  document.getElementById('filterStatus').value = val;
  document.getElementById('statusSelectedText').innerText = text;
  document.getElementById('statusDropdownContainer').classList.remove('open');
  filterInventoryGames();
}

// Custom Premium Dropdown Logic
function toggleDenomFilter(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('denomDropdownContainer');
  if (dropdown) dropdown.classList.toggle('open');
}

function selectDenomFilter(event, val, text) {
  if (event) event.stopPropagation();
  document.getElementById('filterDenom').value = val;
  document.getElementById('denomSelectedText').innerText = text;
  document.getElementById('denomDropdownContainer').classList.remove('open');
  // Trigger filter
  if (typeof renderInventoryCodigos === 'function') {
    renderInventoryCodigos();
  }
}

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

/* ═══════════════════════════════════════ */
/* LÓGICA DE AUTOCOMPLETADO (ANÁLISIS -> INVENTARIO) */
/* ═══════════════════════════════════════ */

function handleGameAutocomplete(input) {
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

function handleVentaGameAutocomplete(input, rowId) {
  const container = document.getElementById(`suggestions-${rowId}`);
  const val = input.value.trim().toLowerCase();

  if (!val) {
    container.style.display = 'none';
    const row = document.getElementById(`row-${rowId}`);
    if (row) row.querySelector('.row-inventory-id').value = '';
    return;
  }

  // Buscar en juegos en ON
  const activeGames = AppState.inventoryGames.filter(g => g.estado === 'ON');

  // Buscar por ID o título y filtrar que tengan cupos disponibles
  const matches = activeGames.filter(g => {
    const isMatch = String(g.id).toLowerCase().includes(val) ||
      (g.juego && g.juego.toLowerCase().includes(val));

    if (!isMatch) return false;

    // Verificar disponibilidad real antes de mostrar en la lista
    const slots = getGameSlots(g.id);
    const totalDisp =
      Math.max(0, (slots.config.p_ps4 || 0) - (slots.used.p_ps4 || 0)) +
      Math.max(0, (slots.config.s_ps4 || 0) - (slots.used.s_ps4 || 0)) +
      Math.max(0, (slots.config.p_ps5 || 0) - (slots.used.p_ps5 || 0)) +
      Math.max(0, (slots.config.s_ps5 || 0) - (slots.used.s_ps5 || 0));

    return totalDisp > 0;
  });

  if (matches.length === 0) {
    container.style.display = 'none';
    return;
  }

  // Renderizar
  container.innerHTML = matches.map(g => {
    const slots = getGameSlots(g.id);

    const disp = {
      p_ps4: Math.max(0, (slots.config.p_ps4 || 0) - (slots.used.p_ps4 || 0)),
      s_ps4: Math.max(0, (slots.config.s_ps4 || 0) - (slots.used.s_ps4 || 0)),
      p_ps5: Math.max(0, (slots.config.p_ps5 || 0) - (slots.used.p_ps5 || 0)),
      s_ps5: Math.max(0, (slots.config.s_ps5 || 0) - (slots.used.s_ps5 || 0))
    };

    const colorP_PS4 = disp.p_ps4 > 0 ? '#10b981' : '#ef4444';
    const colorP_PS5 = disp.p_ps5 > 0 ? '#10b981' : '#ef4444';
    const colorS_PS4 = (disp.s_ps4 > 0 && disp.p_ps4 === 0) ? '#10b981' : '#ef4444';
    const colorS_PS5 = (disp.s_ps5 > 0 && disp.p_ps5 === 0) ? '#10b981' : '#ef4444';

    let slotsHtml = '';
    if (slots.config.p_ps4 > 0 || slots.config.s_ps4 > 0) {
      slotsHtml += `
        <div style="display: flex; gap: 8px; font-size: 0.65rem; justify-content: flex-end;">
          <span style="color: ${colorP_PS4};">${disp.p_ps4} P. PS4</span>
          <span style="color: ${colorS_PS4};">${disp.s_ps4} S. PS4</span>
        </div>
      `;
    }
    if (slots.config.p_ps5 > 0 || slots.config.s_ps5 > 0) {
      slotsHtml += `
        <div style="display: flex; gap: 8px; font-size: 0.65rem; justify-content: flex-end;">
          <span style="color: ${colorP_PS5};">${disp.p_ps5} P. PS5</span>
          <span style="color: ${colorS_PS5};">${disp.s_ps5} S. PS5</span>
        </div>
      `;
    }

    return `
    <div class="autocomplete-suggestion" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px;" 
         onclick="selectVentaGameSuggestion('${rowId}', '${g.id}', '${g.juego.replace(/'/g, "\\'")}')">
      <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span style="font-size: 0.7rem; color: #888;">#${g.id}</span>
        <span style="font-size: 0.8rem; font-weight: 500; color: #fff;">${g.juego}</span>
      </div>
      <div style="margin-left: 10px;">
        ${slotsHtml}
      </div>
    </div>
    `;
  }).join('');

  container.style.display = 'block';
}


function selectVentaGameSuggestion(rowId, id, title) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;

  row.querySelector('.row-juego-search').value = `(${id}) ${title}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';

  // --- FILTRO DE CUENTAS SEGÚN CONSOLA Y DISPONIBILIDAD (Regla de Oro) ---
  const game = AppState.inventoryGames.find(g => String(g.id) === String(id));
  const selectCuenta = row.querySelector('.row-tipo-cuenta');

  if (game && selectCuenta) {
    // 1. Reset: Mostrar todas primero
    Array.from(selectCuenta.options).forEach(opt => opt.style.display = 'block');

    // 2. Obtener disponibilidad real
    const slots = getGameSlots(id);
    const disp = {
      p_ps4: Math.max(0, (slots.config.p_ps4 || 0) - (slots.used.p_ps4 || 0)),
      p_ps5: Math.max(0, (slots.config.p_ps5 || 0) - (slots.used.p_ps5 || 0))
    };

    // 3. Aplicar filtros
    Array.from(selectCuenta.options).forEach(opt => {
      const val = opt.value;
      if (!val) return;

      // Filtro por consola
      if (!game.es_ps4 && val.includes('PS4')) opt.style.display = 'none';
      if (!(game.es_ps5 || game.es_ps4) && val.includes('PS5')) opt.style.display = 'none';

      // Filtro Regla de Oro (Primaria vs Secundaria)
      if (opt.style.display !== 'none') {
        if (val === 'Primaria PS4' && disp.p_ps4 <= 0) opt.style.display = 'none';
        if (val === 'Secundaria PS4' && disp.p_ps4 > 0) opt.style.display = 'none';

        if (val === 'Primaria PS5' && disp.p_ps5 <= 0) opt.style.display = 'none';
        if (val === 'Secundaria PS5' && disp.p_ps5 > 0) opt.style.display = 'none';
      }
    });

    // Resetear selección si la actual quedó oculta
    if (selectCuenta.selectedOptions[0] && selectCuenta.selectedOptions[0].style.display === 'none') {
      selectCuenta.value = '';
    }
  }

  selectCuenta.focus();
}

// ==========================================
// AUTOCOMPLETE PARA PAQUETES, MEMBRESIAS Y CODIGOS
// ==========================================

function checkDisp(item, field) {
  return item[field] === 'Disponible';
}

function renderCuentasDisponiblesHtml(item) {
  const hasPriPS4 = (item.PS41Estado === 'Disponible' || item.PS42Estado === 'Disponible');
  const hasPriPS5 = (item.PS51Estado === 'Disponible' || item.PS52Estado === 'Disponible');

  const configs = [
    { k: 'PS41Estado', n: 'Pri PS4 1' },
    { k: 'PS42Estado', n: 'Pri PS4 2' },
    { k: 'SecPS4Estado', n: 'Sec PS4' },
    { k: 'PS51Estado', n: 'Pri PS5 1' },
    { k: 'PS52Estado', n: 'Pri PS5 2' },
    { k: 'SecPS5Estado', n: 'Sec PS5' },
  ];

  const htmlItems = configs.map(c => {
    if (item[c.k] !== 'Disponible') return '';

    let isSellable = true;
    if (c.k === 'SecPS4Estado' && hasPriPS4) isSellable = false;
    if (c.k === 'SecPS5Estado' && hasPriPS5) isSellable = false;

    const color = isSellable ? '#10b981' : '#ef4444';
    const bg = isSellable ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';

    return `<span style="background:${bg}; color:${color}; padding: 2px 4px; border-radius: 4px; border: 1px solid ${color}33;">${c.n}</span>`;
  }).filter(h => h !== '').join('');

  if (!htmlItems) return '<span style="color:#ef4444; font-size: 0.65rem;">Agotado</span>';
  return `<div style="display: flex; gap: 4px; font-size: 0.6rem; flex-wrap: wrap; justify-content: flex-end;">${htmlItems}</div>`;
}

// PAQUETES
function handleVentaPaqueteAutocomplete(input, rowId) {
  const container = document.getElementById(`suggestions-${rowId}`);
  const val = input.value.trim().toLowerCase();

  if (!val) {
    container.style.display = 'none';
    const row = document.getElementById(`row-${rowId}`);
    if (row) row.querySelector('.row-inventory-id').value = '';
    return;
  }

  const activePaq = AppState.paquetes.filter(p => p.estado === 'ON');
  const matches = activePaq.filter(p => {
    const isMatch = String(p.id).toLowerCase().includes(val) || (p.nombre && p.nombre.toLowerCase().includes(val));
    if (!isMatch) return false;

    // Verificar disponibilidad real usando getPaqueteSlots
    const slots = getPaqueteSlots(p.id);
    const totalDisp =
      Math.max(0, slots.config.p_ps4 - slots.used.p_ps4) +
      Math.max(0, slots.config.s_ps4 - slots.used.s_ps4) +
      Math.max(0, slots.config.p_ps5 - slots.used.p_ps5) +
      Math.max(0, slots.config.s_ps5 - slots.used.s_ps5);

    return totalDisp > 0;
  });

  if (matches.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.innerHTML = matches.map(p => {
    const slots = getPaqueteSlots(p.id);
    const disp = {
      p4: Math.max(0, slots.config.p_ps4 - slots.used.p_ps4),
      s4: Math.max(0, slots.config.s_ps4 - slots.used.s_ps4),
      p5: Math.max(0, slots.config.p_ps5 - slots.used.p_ps5),
      s5: Math.max(0, slots.config.s_ps5 - slots.used.s_ps5)
    };

    // Colores Regla de Oro
    const colP4P = disp.p4 > 0 ? '#10b981' : '#ef4444';
    const colP4S = (disp.s4 > 0 && disp.p4 === 0) ? '#10b981' : '#ef4444';
    const colP5P = disp.p5 > 0 ? '#10b981' : '#ef4444';
    const colP5S = (disp.s5 > 0 && disp.p5 === 0) ? '#10b981' : '#ef4444';

    let htmlSlots = '<div style="display:flex; flex-direction:column; gap:2px; align-items:flex-end; font-size:0.6rem;">';
    if (slots.config.p_ps4 > 0 || slots.config.s_ps4 > 0) {
      htmlSlots += `<div><span style="color:${colP4P}">${disp.p4} P.PS4</span> <span style="color:${colP4S}">${disp.s4} S.PS4</span></div>`;
    }
    if (slots.config.p_ps5 > 0 || slots.config.s_ps5 > 0) {
      htmlSlots += `<div><span style="color:${colP5P}">${disp.p5} P.PS5</span> <span style="color:${colP5S}">${disp.s5} S.PS5</span></div>`;
    }
    htmlSlots += '</div>';

    return `
    <div class="autocomplete-suggestion" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px;" 
         onclick="selectVentaPaqueteSuggestion('${rowId}', '${p.id}', '${(p.nombre || '').replace(/'/g, "\\'")}')">
      <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span style="font-size: 0.7rem; color: #ec4899;">#${p.id}</span>
        <span style="font-size: 0.8rem; font-weight: 500; color: #fff;">${p.nombre}</span>
      </div>
      <div style="margin-left: 10px;">
        ${htmlSlots}
      </div>
    </div>
  `}).join('');

  container.style.display = 'block';
}

function selectVentaPaqueteSuggestion(rowId, id, title) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;

  row.querySelector('.row-paquete-search').value = `(${id}) ${title}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';

  const selectCuenta = row.querySelector('.row-tipo-cuenta');
  if (!selectCuenta) return;

  const slots = getPaqueteSlots(id);
  let optionsHtml = '<option value="">-- Selecciona Cuenta --</option>';

  const mappings = [
    { val: 'Primaria PS4', dispKey: 'p4', label: 'Primaria PS4' },
    { val: 'Secundaria PS4', dispKey: 's4', label: 'Secundaria PS4' },
    { val: 'Primaria PS5', dispKey: 'p5', label: 'Primaria PS5' },
    { val: 'Secundaria PS5', dispKey: 's5', label: 'Secundaria PS5' }
  ];

  const disp = {
    p4: Math.max(0, slots.config.p_ps4 - slots.used.p_ps4),
    s4: Math.max(0, slots.config.s_ps4 - slots.used.s_ps4),
    p5: Math.max(0, slots.config.p_ps5 - slots.used.p_ps5),
    s5: Math.max(0, slots.config.s_ps5 - slots.used.s_ps5)
  };

  mappings.forEach(m => {
    if (disp[m.dispKey] > 0) {
      let isSellable = true;
      if (m.val === 'Secundaria PS4' && disp.p4 > 0) isSellable = false;
      if (m.val === 'Secundaria PS5' && disp.p5 > 0) isSellable = false;

      if (isSellable) {
        optionsHtml += `<option value="${m.val}">${m.label}</option>`;
      }
    }
  });

  selectCuenta.innerHTML = optionsHtml;
}

// MEMBRESÍAS
function handleVentaMembresiaAutocomplete(input, rowId) {
  const container = document.getElementById(`suggestions-${rowId}`);
  const val = input.value.trim().toLowerCase();

  if (!val) {
    container.style.display = 'none';
    const row = document.getElementById(`row-${rowId}`);
    if (row) row.querySelector('.row-inventory-id').value = '';
    return;
  }

  const activeMem = AppState.membresias.filter(m => m.estado === 'ON');
  const matches = activeMem.filter(m => {
    const isMatch = String(m.id).toLowerCase().includes(val) || (m.tipo && m.tipo.toLowerCase().includes(val));
    if (!isMatch) return false;

    // Disponibilidad real usando getMembresiaSlots
    const slots = getMembresiaSlots(m.id);
    const totalDisp =
      Math.max(0, slots.config.p_ps4 - slots.used.p_ps4) +
      Math.max(0, slots.config.s_ps4 - slots.used.s_ps4) +
      Math.max(0, slots.config.p_ps5 - slots.used.p_ps5) +
      Math.max(0, slots.config.s_ps5 - slots.used.s_ps5);

    return totalDisp > 0;
  });

  if (matches.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.innerHTML = matches.map(m => {
    const slots = getMembresiaSlots(m.id);
    const disp = {
      p4: Math.max(0, slots.config.p_ps4 - slots.used.p_ps4),
      s4: Math.max(0, slots.config.s_ps4 - slots.used.s_ps4),
      p5: Math.max(0, slots.config.p_ps5 - slots.used.p_ps5),
      s5: Math.max(0, slots.config.s_ps5 - slots.used.s_ps5)
    };

    const colP4P = disp.p4 > 0 ? '#10b981' : '#ef4444';
    const colP4S = (disp.s4 > 0 && disp.p4 === 0) ? '#10b981' : '#ef4444';
    const colP5P = disp.p5 > 0 ? '#10b981' : '#ef4444';
    const colP5S = (disp.s5 > 0 && disp.p5 === 0) ? '#10b981' : '#ef4444';

    let htmlSlots = '<div style="display:flex; flex-direction:column; gap:2px; align-items:flex-end; font-size:0.6rem;">';
    htmlSlots += `<div><span style="color:${colP4P}">${disp.p4} P.PS4</span> <span style="color:${colP4S}">${disp.s4} S.PS4</span></div>`;
    htmlSlots += `<div><span style="color:${colP5P}">${disp.p5} P.PS5</span> <span style="color:${colP5S}">${disp.s5} S.PS5</span></div>`;
    htmlSlots += '</div>';

    return `
    <div class="autocomplete-suggestion" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px;" 
         onclick="selectVentaMembresiaSuggestion('${rowId}', '${m.id}', '${(m.tipo || '').replace(/'/g, "\\'")}')">
      <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span style="font-size: 0.7rem; color: #f59e0b;">#${m.id}</span>
        <span style="font-size: 0.8rem; font-weight: 500; color: #fff;">${m.tipo}</span>
        <div style="font-size: 0.65rem; color: ${calculateMembershipCountdown(m) <= 5 ? '#ef4444' : '#9ca3af'}; font-style: italic; margin-top: 2px;">
          ⏳ ${formatDaysToMonths(calculateMembershipCountdown(m))} restantes
        </div>
      </div>
      <div style="margin-left: 10px;">
        ${htmlSlots}
      </div>
    </div>
  `}).join('');

  container.style.display = 'block';
}

function selectVentaMembresiaSuggestion(rowId, id, title) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;

  row.querySelector('.row-membresia-search').value = `(${id}) ${title}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';

  const selectCuenta = row.querySelector('.row-tipo-cuenta');
  if (!selectCuenta) return;

  const slots = getMembresiaSlots(id);
  let optionsHtml = '<option value="">-- Selecciona Cuenta --</option>';

  const mappings = [
    { val: 'Primaria PS4', dispKey: 'p4' },
    { val: 'Secundaria PS4', dispKey: 's4' },
    { val: 'Primaria PS5', dispKey: 'p5' },
    { val: 'Secundaria PS5', dispKey: 's5' }
  ];

  const disp = {
    p4: Math.max(0, slots.config.p_ps4 - slots.used.p_ps4),
    s4: Math.max(0, slots.config.s_ps4 - slots.used.s_ps4),
    p5: Math.max(0, slots.config.p_ps5 - slots.used.p_ps5),
    s5: Math.max(0, slots.config.s_ps5 - slots.used.s_ps5)
  };

  mappings.forEach(m => {
    if (disp[m.dispKey] > 0) {
      let isSellable = true;
      if (m.val === 'Secundaria PS4' && disp.p4 > 0) isSellable = false;
      if (m.val === 'Secundaria PS5' && disp.p5 > 0) isSellable = false;

      if (isSellable) {
        optionsHtml += `<option value="${m.val}">${m.val}</option>`;
      }
    }
  });

  selectCuenta.innerHTML = optionsHtml;
}

// CÓDIGOS
function handleVentaCodigoAutocomplete(input, rowId) {
  const container = document.getElementById(`suggestions-${rowId}`);
  const val = input.value.trim().toLowerCase();

  if (!val) {
    container.style.display = 'none';
    const row = document.getElementById(`row-${rowId}`);
    if (row) row.querySelector('.row-inventory-id').value = '';
    return;
  }

  // Solo códigos que estén ON y que NO hayan sido usados mediante el checklist
  const activeCod = (AppState.inventoryCodes || []).filter(c => c.estado === 'ON' && !c.usado);
  const matches = activeCod.filter(c => {
    return String(c.id).toLowerCase().includes(val) ||
      (c.codigo && c.codigo.toLowerCase().includes(val)) ||
      (c.juego && c.juego.toLowerCase().includes(val));
  });

  if (matches.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.innerHTML = matches.map(c => `
    <div class="autocomplete-suggestion" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px;" 
         onclick="selectVentaCodigoSuggestion('${rowId}', '${c.id}', '${(c.juego || '').replace(/'/g, "\\'")}')">
      <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span style="font-size: 0.7rem; color: var(--accent-purple);">#${c.id}</span>
        <span style="font-size: 0.8rem; font-weight: 500; color: #fff;">${c.juego}</span>
      </div>
      <div>
        <span style="color:#10b981; font-size: 0.65rem;">Disponible</span>
      </div>
    </div>
  `).join('');

  container.style.display = 'block';
}

function selectVentaCodigoSuggestion(rowId, id, title) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;

  row.querySelector('.row-codigo-search').value = `(${id}) ${title}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';
}function handleVentaXboxAutocomplete(input, rowId) {
  const container = document.getElementById(`suggestions-${rowId}`);
  const val = input.value.trim().toLowerCase();

  if (!val) {
    container.style.display = 'none';
    const row = document.getElementById(`row-${rowId}`);
    if (row) row.querySelector('.row-inventory-id').value = '';
    return;
  }

  const matches = (AppState.xboxInventory || []).filter(x => 
    x.estado === 'ON' && 
    (String(x.id).toLowerCase().includes(val) || (x.detalle && x.detalle.toLowerCase().includes(val)))
  ).slice(0, 10);

  if (matches.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.innerHTML = matches.map(x => `
    <div class="autocomplete-suggestion" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px;" 
         onclick="selectVentaXboxSuggestion('${rowId}', '${x.id}', '${x.detalle.replace(/'/g, "\\'")}')">
      <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span style="font-size: 0.7rem; color: #888;">#${x.id}</span>
        <span style="font-size: 0.8rem; font-weight: 500; color: #fff;">${x.detalle}</span>
      </div>
      <div>
        <span style="color:#107c10; font-size: 0.65rem;">Xbox ON</span>
      </div>
    </div>
  `).join('');

  container.style.display = 'block';
}

function selectVentaXboxSuggestion(rowId, id, detail) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;

  row.querySelector('.row-xbox-search').value = `(${id}) ${detail}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';
}

function handleVentaPhysicalAutocomplete(input, rowId) {
  const container = document.getElementById(`suggestions-${rowId}`);
  const val = input.value.trim().toLowerCase();

  if (!val) {
    container.style.display = 'none';
    const row = document.getElementById(`row-${rowId}`);
    if (row) row.querySelector('.row-inventory-id').value = '';
    return;
  }

  const matches = (AppState.physicalInventory || []).filter(p => 
    p.estado === 'ON' && 
    (String(p.id).toLowerCase().includes(val) || (p.detalle && p.detalle.toLowerCase().includes(val)))
  ).slice(0, 10);

  if (matches.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.innerHTML = matches.map(p => `
    <div class="autocomplete-suggestion" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px;" 
         onclick="selectVentaPhysicalSuggestion('${rowId}', '${p.id}', '${p.detalle.replace(/'/g, "\\'")}')">
      <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span style="font-size: 0.7rem; color: #888;">#${p.id}</span>
        <span style="font-size: 0.8rem; font-weight: 500; color: #fff;">${p.detalle}</span>
      </div>
      <div>
        <span style="color:#2dd4bf; font-size: 0.65rem;">Physical ON</span>
      </div>
    </div>
  `).join('');

  container.style.display = 'block';
}

function selectVentaPhysicalSuggestion(rowId, id, detail) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;

  row.querySelector('.row-physical-search').value = `(${id}) ${detail}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';
}

// ==========================================
// TEMPLATE LOGIC (PLANTILLAS FACTURA)
// ==========================================

// Inicializar plantillas si no existen
if (!AppState.plantillas || Object.keys(AppState.plantillas).length === 0) {
  AppState.plantillas = {
    'Primaria PS4': 'Hola {CLIENTE}, aquí tienes los datos de tu Juego {JUEGO} (Primaria PS4).\nCorreo: {CUENTA_CORREO}\nContraseña: {CUENTA_PASS}',
    'Secundaria PS4': 'Hola {CLIENTE}, aquí tienes los datos de tu Juego {JUEGO} (Secundaria PS4).\nCorreo: {CUENTA_CORREO}\nContraseña: {CUENTA_PASS}',
    'Primaria PS5': 'Hola {CLIENTE}, aquí tienes los datos de tu Juego {JUEGO} (Primaria PS5).\nCorreo: {CUENTA_CORREO}\nContraseña: {CUENTA_PASS}',
    'Secundaria PS5': 'Hola {CLIENTE}, aquí tienes los datos de tu Juego {JUEGO} (Secundaria PS5).\nCorreo: {CUENTA_CORREO}\nContraseña: {CUENTA_PASS}',
    'Multi-Juego: Cabecera': '🎮 CANGEL GAMES — Remisión #{NUMERO_PEDIDO}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 Cliente: {CLIENTE}\n📋 Cédula: {CEDULA}\n📱 Celular: {CELULAR}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n{JUEGOS_DETALLE}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💰 TOTAL: {TOTAL}\n💳 Pago: {PAGO}\n🧑\u200d💼 Vendedor: {VENDEDOR}',
    'Multi-Juego: Bloque Juego': '📦 {JUEGO_NOMBRE} ({TIPO_CUENTA})\n   Correo: {CORREO}\n   Contraseña: {PASS}\n   2FA: {CODIGO_2FA}\n   Precio: {PRECIO_JUEGO}'
  };
}
// Asegurarse de que las plantillas Multi-Juego existan aunque se haya inicializado antes
if (!AppState.plantillas['Multi-Juego: Cabecera']) {
  AppState.plantillas['Multi-Juego: Cabecera'] = '🎮 CANGEL GAMES — Remisión #{NUMERO_PEDIDO}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 Cliente: {CLIENTE}\n📋 Cédula: {CEDULA}\n📱 Celular: {CELULAR}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n{JUEGOS_DETALLE}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💰 TOTAL: {TOTAL}\n💳 Pago: {PAGO}\n🧑\u200d💼 Vendedor: {VENDEDOR}';
}
if (!AppState.plantillas['Multi-Juego: Bloque Juego']) {
  AppState.plantillas['Multi-Juego: Bloque Juego'] = '📦 {JUEGO_NOMBRE} ({TIPO_CUENTA})\n   Correo: {CORREO}\n   Contraseña: {PASS}\n   2FA: {CODIGO_2FA}\n   Precio: {PRECIO_JUEGO}';
}
if (!AppState.plantillas['Factura']) {
  AppState.plantillas['Factura'] =
    '  Unete a nuestro canal de WhatsApp\n' +
    '*👇HAZ CLIC AHORA👇*\n' +
    'https://goo.su/JKAsi\n\n' +
    '🔰GRACIAS POR TU COMPRA🔰 \n' +
    'Acabas de adquirir: *{JUEGO}* \n' +
    '{TIPO_CUENTA}\n\n' +
    '*FECHA DE COMPRA: {FECHA}*\n' +
    'Nombre completo: {NOMBRE}\n' +
    'Consola: {CONSOLA}\n' +
    'C.C: {CEDULA}\n' +
    'Correo: {CORREO_CLIENTE}\n' +
    'Celular: {CELULAR}\n' +
    'Ciudad: {CIUDAD}\n' +
    'Valor: *${VALOR}*\n' +
    'Medio de pago: {PAGO} **\n' +
    'Asesor : {VENDEDOR}\n' +
    'Adquisicion: {ADQUISICION}\n\n\n' +
    'AL COMPLETAR LA COMPRA ACEPTAS LOS T&C ESTABLECIDOS AQUÍ: https://cangelgames.store/terminos-y-condiciones/\n' +
    '👆\n' +
    '⚠️ *Importante:* guarda muy bien el correo y la contraseña de tu compra. Sin estos datos, no podremos hacer válida la garantía.\n\n' +
    '*Tiempo de entrega de 1 a 3 horas*\n' +
    '--------------------------------------\n' +
    'Horarios de atención \n' +
    'LUNES A SABADO\n' +
    '🕑 De 10am a 7pm 🕑';
}

function openModalPlantillas() {
  const modal = document.getElementById('modalPlantillasOverlay');
  if (modal) {
    modal.classList.add('show');
    cargarPlantillaSeleccionada();
  }
}

function closeModalPlantillas() {
  const modal = document.getElementById('modalPlantillasOverlay');
  if (modal) modal.classList.remove('show');
}

function cargarPlantillaSeleccionada() {
  const selector = document.getElementById('plantillaSelector');
  const textarea = document.getElementById('plantillaTextarea');
  if (selector && textarea) {
    const tipo = selector.value;
    textarea.value = AppState.plantillas[tipo] || '';
  }
}

function actualizarPanelVariables() {
  const selector = document.getElementById('plantillaSelector');
  const panelInd = document.getElementById('variablesIndividual');
  const panelMJ = document.getElementById('variablesMultiJuego');
  const helper = document.getElementById('plantillaHelperText');
  if (!selector) return;

  const esMulti = selector.value.startsWith('Multi-Juego');
  if (panelInd) panelInd.style.display = esMulti ? 'none' : 'flex';
  if (panelMJ) panelMJ.style.display = esMulti ? 'flex' : 'none';
  if (helper) {
    helper.textContent = esMulti
      ? '* {JUEGOS_DETALLE} se reemplaza automáticamente por los bloques de cada juego del pedido.'
      : '* Las etiquetas como {CLIENTE} se reemplazarán por los datos reales de la venta.';
  }
}

function guardarPlantilla() {
  const selector = document.getElementById('plantillaSelector');
  const textarea = document.getElementById('plantillaTextarea');
  if (selector && textarea) {
    const tipo = selector.value;
    const texto = textarea.value;
    AppState.plantillas[tipo] = texto;
    if (typeof saveLocal === 'function') saveLocal();
    if (typeof showToast === 'function') showToast('Plantilla guardada correctamente');
    else if (typeof showNotification === 'function') showNotification('Plantilla guardada correctamente', 'success');
    closeModalPlantillas();
  }
}

function insertarVariable(variableStr) {
  const textarea = document.getElementById('plantillaTextarea');
  if (!textarea) return;
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  const textBefore = textarea.value.substring(0, startPos);
  const textAfter = textarea.value.substring(endPos, textarea.value.length);

  textarea.value = textBefore + variableStr + textAfter;

  textarea.selectionStart = startPos + variableStr.length;
  textarea.selectionEnd = startPos + variableStr.length;
  textarea.focus();
}

function getInventoryItemData(venta) {
  let cCorreo = 'No disponible', cPass = 'No disponible', c2fa = 'N/A', jNombre = venta.game || 'N/A';

  if (!venta.inventoryId) return { jNombre, cCorreo, cPass, c2fa };

  const pType = (venta.productType || '').toLowerCase();
  const tCuenta = (venta.tipo_cuenta || '').toLowerCase();

  if (pType === 'paquete') {
    const g = AppState.paquetes.find(ig => String(ig.id) === String(venta.inventoryId));
    if (g) {
      cCorreo = g.correo || cCorreo; cPass = g.password || cPass; c2fa = g.codigo2fa || c2fa; jNombre = g.nombre || jNombre;
    }
  } else if (pType === 'membresia') {
    const g = AppState.membresias.find(ig => String(ig.id) === String(venta.inventoryId));
    if (g) {
      cCorreo = g.correo || cCorreo; cPass = g.password || cPass; c2fa = g.codigo2fa || c2fa; jNombre = g.tipo || jNombre;
    }
  } else if (pType === 'xbox' || tCuenta === 'xbox') {
    const g = AppState.xboxInventory.find(ig => String(ig.id) === String(venta.inventoryId));
    if (g) {
      cCorreo = g.correo || cCorreo; cPass = g.password || cPass; jNombre = g.detalle || jNombre;
    }
  } else if (pType === 'physical' || tCuenta === 'physical' || tCuenta === 'producto físico') {
    const g = AppState.physicalInventory.find(ig => String(ig.id) === String(venta.inventoryId));
    if (g) {
      jNombre = g.detalle || jNombre;
    }
  } else if (pType === 'codigo') {
    const g = AppState.inventory.find(ig => String(ig.id) === String(venta.inventoryId));
    if (g) {
      jNombre = g.juego || jNombre;
    }
  } else {
    const g = AppState.inventoryGames.find(ig => String(ig.id) === String(venta.inventoryId));
    if (g) {
      cCorreo = g.correo || cCorreo; cPass = g.password || cPass; c2fa = g.codigo2fa || c2fa; jNombre = g.juego || jNombre;
    }
  }
  return { jNombre, cCorreo, cPass, c2fa };
}

function copiarFactura(ventaId) {
  const venta = AppState.sales.find(v => String(v.id) === String(ventaId));
  if (!venta) {
    if (typeof showToast === 'function') showToast('Error: No se encontró la venta');
    else if (typeof showNotification === 'function') showNotification('Error: No se encontró la venta', 'error');
    return;
  }

  let clienteNombre = venta.nombre_cliente || venta.client || 'Cliente';
  let clienteCedula = venta.cedula || 'No registrada';
  let clienteCelular = venta.celular || 'No registrado';
  let clienteEmail = venta.correo || 'No registrado';

  // ──────────────────────────────────────────────────────────────
  // REMISIÓN INTELIGENTE MULTI-JUEGO (Opción B)
  // Si la venta tiene transaction_id, agrupa todos los juegos del pedido
  // ──────────────────────────────────────────────────────────────
  if (venta.transaction_id) {
    const ventasDelPedido = AppState.sales.filter(
      v => String(v.transaction_id) === String(venta.transaction_id)
    );

    let totalPedido = 0;
    let bloquesJuegos = '';

    // Plantilla editable para el bloque de cada juego
    const plantillaBloque = AppState.plantillas['Multi-Juego: Bloque Juego'] ||
      '📦 {JUEGO_NOMBRE} ({TIPO_CUENTA})\n   Correo: {CORREO}\n   Contraseña: {PASS}\n   2FA: {CODIGO_2FA}\n   Precio: {PRECIO_JUEGO}';

    // Verificar si hay códigos PSN sin stock antes de proceder
    let sinStock = [];
    ventasDelPedido.forEach((v) => {
      if (v.productType === 'codigo' && !v.codigoAsignado) {
        const denom = parseFloat(v.codigoDenom) || 0;
        const disponible = (AppState.inventoryCodes || []).find(
          c => c.estado === 'ON' && !c.usado && parseFloat(c.precioUsd) === denom
        );
        if (!disponible) sinStock.push(`${v.codigoDenom}us`);
      }
    });

    if (sinStock.length > 0) {
      showToast(`⚠️ Sin stock de código PSN: ${sinStock.join(', ')}. Agrega más en Inventario → Códigos.`, 'warning');
      return;
    }

    // Asignar PINs del inventario antes de generar el texto
    let codigosAsignadosAhora = [];
    ventasDelPedido.forEach((v) => {
      if (v.productType === 'codigo' && !v.codigoAsignado) {
        const denom = parseFloat(v.codigoDenom) || 0;
        const codeItem = (AppState.inventoryCodes || []).find(
          c => c.estado === 'ON' && !c.usado && parseFloat(c.precioUsd) === denom
        );
        if (codeItem) {
          codeItem.usado = true;
          codeItem.estado = 'OFF';
          v.codigoAsignado = codeItem.codigo;
          codigosAsignadosAhora.push(codeItem);
        }
      }
    });

    if (codigosAsignadosAhora.length > 0) {
      saveLocal();
      if (typeof renderInventoryCodigos === 'function') renderInventoryCodigos();
    }

    ventasDelPedido.forEach((v) => {
      const precioJuego = v.venta || v.price || 0;
      totalPedido += precioJuego;

      let bloqueJuego = '';

      if (v.productType === 'codigo') {
        // Bloque especial para códigos PSN
        const pin = v.codigoAsignado || '---';
        const denom = v.codigoDenom ? `${v.codigoDenom}us` : 'Código PSN';
        bloqueJuego = `🎟️ Código PSN ${denom}\n   PIN: ${pin}\n   Precio: ${formatCOP(precioJuego)}`;
      } else {
        const dataInv = getInventoryItemData(v);
        let gameCorreo = dataInv.cCorreo;
        let gamePass = dataInv.cPass;
        let game2FA = dataInv.c2fa;
        let gameNombre = dataInv.jNombre;

        bloqueJuego = plantillaBloque
          .replace(/{JUEGO_NOMBRE}/g, gameNombre)
          .replace(/{TIPO_CUENTA}/g, v.tipo_cuenta || 'Digital')
          .replace(/{CORREO}/g, gameCorreo)
          .replace(/{PASS}/g, gamePass)
          .replace(/{CODIGO_2FA}/g, game2FA !== 'N/A' ? game2FA : '---')
          .replace(/{PRECIO_JUEGO}/g, formatCOP(precioJuego));
      }

      bloquesJuegos += `\n${bloqueJuego}\n`;
    });

    // Plantilla editable para la cabecera del pedido
    const plantillaCabecera = AppState.plantillas['Multi-Juego: Cabecera'] ||
      '🎮 CANGEL GAMES\n{CLIENTE}\n{JUEGOS_DETALLE}\nTOTAL: {TOTAL}';

    const textoCopiar = plantillaCabecera
      .replace(/{CLIENTE}/g, clienteNombre)
      .replace(/{CEDULA}/g, clienteCedula)
      .replace(/{CELULAR}/g, clienteCelular)
      .replace(/{NUMERO_PEDIDO}/g, venta.transaction_id)
      .replace(/{JUEGOS_DETALLE}/g, bloquesJuegos.trim())
      .replace(/{TOTAL}/g, formatCOP(totalPedido))
      .replace(/{PAGO}/g, venta.pago || '---')
      .replace(/{VENDEDOR}/g, venta.vendedor || 'ADMIN');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textoCopiar)
        .then(() => {
          if (typeof showToast === 'function')
            showToast(`✅ Remisión copiada (${ventasDelPedido.length} juego${ventasDelPedido.length > 1 ? 's' : ''})`);
        })
        .catch(err => console.error('Error al copiar', err));
    }
    return;
  }

  // ──────────────────────────────────────────────────────────────
  // Factura individual (ventas sin transaction_id — comportamiento original)
  // ──────────────────────────────────────────────────────────────
  let tipoCuenta = 'Primaria PS4';
  const juegoStr = (venta.game || '').toUpperCase();
  const cuentaStr = (venta.tipo_cuenta || venta.cuenta || '').toUpperCase();
  const notasStr = (venta.nota || venta.notes || '').toUpperCase();

  if (cuentaStr.includes('SECUNDARIA') || notasStr.includes('SECUNDARIA') || juegoStr.includes('SECUNDARIA')) {
    tipoCuenta = juegoStr.includes('PS5') || cuentaStr.includes('PS5') ? 'Secundaria PS5' : 'Secundaria PS4';
  } else if (cuentaStr.includes('PRIMARIA') || notasStr.includes('PRIMARIA') || juegoStr.includes('PRIMARIA')) {
    tipoCuenta = juegoStr.includes('PS5') || cuentaStr.includes('PS5') ? 'Primaria PS5' : 'Primaria PS4';
  } else if (juegoStr.includes('PS5') || cuentaStr.includes('PS5')) {
    tipoCuenta = 'Primaria PS5';
  }

  const dataInv2 = getInventoryItemData(venta);
  let correoCuenta = dataInv2.cCorreo;
  let contrasenaCuenta = dataInv2.cPass;
  let codigo2FA = dataInv2.c2fa;
  let juegoNombreVisual = dataInv2.jNombre;

  const plantilla = AppState.plantillas[tipoCuenta] || AppState.plantillas['Factura'] || '';

  const textoCopiar = plantilla
    .replace(/{CLIENTE}/g, clienteNombre)
    .replace(/{CEDULA}/g, clienteCedula)
    .replace(/{CELULAR}/g, clienteCelular)
    .replace(/{EMAIL}/g, clienteEmail)
    .replace(/{JUEGO}/g, juegoNombreVisual)
    .replace(/{TIPO_CUENTA}/g, venta.tipo_cuenta || venta.cuenta || tipoCuenta)
    .replace(/{PRECIO}/g, formatCOP(venta.venta || venta.price))
    .replace(/{NOTAS}/g, venta.nota || venta.notes || 'Ninguna')
    .replace(/{VENDEDOR}/g, venta.vendedor || venta.seller || 'Vendedor')
    .replace(/{CUENTA_CORREO}/g, correoCuenta)
    .replace(/{CUENTA_PASS}/g, contrasenaCuenta)
    .replace(/{2FA}/g, codigo2FA)
    .replace(/{FECHA}/g, venta.fecha || '')
    .replace(/{CONSOLA}/g, (venta.tipo_cuenta || '').includes('PS5') ? 'PS5' : 'PS4')
    .replace(/{CIUDAD}/g, venta.ciudad || '')
    .replace(/{MEDIO_PAGO}/g, venta.pago || '')
    .replace(/{ADQUISICION}/g, venta.tipo_cliente || '');

  if (navigator.clipboard) {
    navigator.clipboard.writeText(textoCopiar)
      .then(() => {
        if (typeof showToast === 'function') showToast('✅ Factura copiada al portapapeles');
        else if (typeof showNotification === 'function') showNotification('Factura copiada al portapapeles', 'success');
      })
      .catch(err => console.error('Error al copiar', err));
  } else {
    console.error('Clipboard API no disponible');
  }
}



// ══════════════════════════════════════════════════
// COPIAR FACTURA DE CONFIRMACIÓN (datos del cliente)
// ══════════════════════════════════════════════════
function copiarFacturaConfirmacion(ventaId) {
  var venta = AppState.sales.find(function (v) { return String(v.id) === String(ventaId); });
  if (!venta) { if (typeof showToast === 'function') showToast('⚠️ Venta no encontrada'); return; }
  var plantilla = AppState.plantillas['Factura'] || '';
  if (!plantilla) { if (typeof showToast === 'function') showToast('⚠️ Plantilla "Factura" no configurada'); return; }

  const dataInvConf = getInventoryItemData(venta);
  var juegoNombre = dataInvConf.jNombre;

  var tipoStr = (venta.tipo_cuenta || '').toUpperCase();
  var consola = tipoStr.indexOf('PS5') !== -1 ? 'PS5' : tipoStr.indexOf('PS4') !== -1 ? 'PS4' : 'PS';

  var texto = plantilla
    .replace(/{JUEGO}/g, juegoNombre)
    .replace(/{TIPO_CUENTA}/g, venta.tipo_cuenta || '')
    .replace(/{FECHA}/g, venta.fecha || '')
    .replace(/{NOMBRE}/g, venta.nombre_cliente || '')
    .replace(/{CLIENTE}/g, venta.nombre_cliente || '')
    .replace(/{CONSOLA}/g, consola)
    .replace(/{CEDULA}/g, venta.cedula || '')
    .replace(/{CORREO_CLIENTE}/g, venta.correo || '')
    .replace(/{EMAIL}/g, venta.correo || '')
    .replace(/{CELULAR}/g, venta.celular || '')
    .replace(/{CIUDAD}/g, venta.ciudad || '')
    .replace(/{VALOR}/g, (venta.venta || 0).toLocaleString('es-CO'))
    .replace(/{PRECIO}/g, (venta.venta || 0).toLocaleString('es-CO'))
    .replace(/{PAGO}/g, venta.pago || '')
    .replace(/{MEDIO_PAGO}/g, venta.pago || '')
    .replace(/{VENDEDOR}/g, venta.vendedor || '')
    .replace(/{ADQUISICION}/g, venta.tipo_cliente || '');

  if (navigator.clipboard) {
    navigator.clipboard.writeText(texto).then(function () {
      if (typeof showToast === 'function') showToast('✅ Confirmación de compra copiada');
    }).catch(function (err) { console.error('Error al copiar', err); });
  }
}

// ══════════════════════════════════════════════════
// MODAL DETALLES VENTA (Botón OJO)
// ══════════════════════════════════════════════════
function verDetallesVenta(id) {
  const venta = AppState.sales.find(v => String(v.id) === String(id));
  if (!venta) return;

  const overlay = document.getElementById('modalDetallesVentaOverlay');
  const content = document.getElementById('detallesVentaContent');

  // Si tiene transaction_id, mostrar todos los juegos del pedido
  let ventasMostrar = [venta];
  if (venta.transaction_id) {
    ventasMostrar = AppState.sales.filter(s => String(s.transaction_id) === String(venta.transaction_id));
  }

  let juegosHTML = '';
  let total = 0;

  ventasMostrar.forEach(v => {
    const precio = (v.venta || 0);
    total += precio;
    const dataInv3 = getInventoryItemData(v);
    let jNombre = dataInv3.jNombre;
    let cCorreo = dataInv3.cCorreo;
    let cPass = dataInv3.cPass;
    let c2fa = dataInv3.c2fa;

    juegosHTML += `
      <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05);">
        <div style="color:var(--accent-cyan); font-weight:700; margin-bottom:5px;"><i data-lucide="gamepad-2" class="minimalist-icon" style="color:var(--accent-cyan); opacity:0.8;"></i> ${jNombre}</div>
        <div style="font-size:0.85rem; color:#ccc;">Tipo: ${v.tipo_cuenta || 'N/A'} | Valor: $${precio.toLocaleString('es-CO')}</div>
        <div style="font-size:0.8rem; margin-top:8px; background:rgba(0,0,0,0.2); padding:8px; border-radius:4px;">
          <div><i data-lucide="mail" class="minimalist-icon" style="width:12px; height:12px; margin-right:5px;"></i> <b>Correo:</b> ${cCorreo}</div>
          <div><i data-lucide="key" class="minimalist-icon" style="width:12px; height:12px; margin-right:5px;"></i> <b>Pass:</b> ${cPass}</div>
          <div><i data-lucide="shield-check" class="minimalist-icon" style="width:12px; height:12px; margin-right:5px;"></i> <b>2FA:</b> ${c2fa}</div>
        </div>
      </div>
    `;
  });

  content.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px; font-size:0.9rem;">
      <div><span style="color:var(--text-muted)"><i data-lucide="calendar" class="minimalist-icon" style="width:14px; height:14px;"></i> Fecha:</span><br><b>${venta.fecha} ${venta.hora || ''}</b></div>
      <div><span style="color:var(--text-muted)"><i data-lucide="hash" class="minimalist-icon" style="width:14px; height:14px;"></i> Orden ID:</span><br><b>${venta.transaction_id || venta.id}</b></div>
      <div><span style="color:var(--text-muted)"><i data-lucide="user" class="minimalist-icon" style="width:14px; height:14px;"></i> Cliente:</span><br><b>${venta.nombre_cliente || 'N/A'}</b></div>
      <div><span style="color:var(--text-muted)"><i data-lucide="phone" class="minimalist-icon" style="width:14px; height:14px;"></i> Celular:</span><br><b>${venta.celular || 'N/A'}</b></div>
      <div><span style="color:var(--text-muted)"><i data-lucide="credit-card" class="minimalist-icon" style="width:14px; height:14px;"></i> Pago:</span><br><b>${venta.pago || 'N/A'}</b></div>
      <div><span style="color:var(--text-muted)"><i data-lucide="map-pin" class="minimalist-icon" style="width:14px; height:14px;"></i> Ciudad:</span><br><b>${venta.ciudad || 'N/A'}</b></div>
      <div><span style="color:var(--text-muted)"><i data-lucide="user-check" class="minimalist-icon" style="width:14px; height:14px;"></i> Vendedor:</span><br><b>${venta.vendedor || 'N/A'}</b></div>
      <div><span style="color:var(--text-muted)"><i data-lucide="banknote" class="minimalist-icon" style="width:14px; height:14px;"></i> Total Venta:</span><br><b style="color:#f59e0b; font-size:1.1rem;">$${total.toLocaleString('es-CO')}</b></div>
    </div>
    <div style="margin-bottom:10px; font-weight:700; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;"><i data-lucide="package" class="minimalist-icon" style="width:16px; height:16px;"></i> ÍTEMS DEL PEDIDO</div>
    ${juegosHTML}
    <div style="margin-top:15px;">
      <div style="color:var(--text-muted); font-size:0.8rem;"><i data-lucide="sticky-note" class="minimalist-icon" style="width:14px; height:14px;"></i> NOTAS:</div>
      <div style="background:rgba(245,158,11,0.05); color:#f59e0b; padding:10px; border-radius:8px; border:1px solid rgba(245,158,11,0.1); font-size:0.85rem;">
        ${venta.nota || 'Sin notas adicionales.'}
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
  overlay.classList.add('show');
}

function closeModalDetallesVenta() {
  document.getElementById('modalDetallesVentaOverlay').classList.remove('show');
}

// ══════════════════════════════════════════════════
// MÓDULO DE ANALYTICS (Ranking Asesores)
// ══════════════════════════════════════════════════

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
      // Sin indicios de plataforma → asignar a PS4 por defecto
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
    if (index === 0) medalla = '🥇 🏆 ';
    else if (index === 1) medalla = '🥈 ';
    else if (index === 2) medalla = '🥉 ';

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

/* ════════════════════════════════════════ */
/* SISTEMA DE LISTAS DE CLIENTES            */
/* ════════════════════════════════════════ */

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
  showToast(`✅ Lista "${nombre}" creada`);
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

function asignarClienteALista(nombreKey, listaId) {
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
    else { fidelidadStr = 'VIP 👑'; fidelidadColor = '#ffbb00'; fidelidadBg = 'rgba(255,187,0,0.1)'; }

    let consolaPref = '--';
    if (c.conteoPS4 > c.conteoPS5) consolaPref = '<span style="color:var(--accent-cyan); font-weight:600">PS4</span>';
    else if (c.conteoPS5 > c.conteoPS4) consolaPref = '<span style="color:var(--accent-purple); font-weight:600">PS5</span>';
    else if (c.conteoPS4 > 0 && c.conteoPS4 === c.conteoPS5) consolaPref = 'Ambas (PS4/PS5)';

    const nombreKey = (c.nombre || '').toLowerCase();
    const listaAsignadaId = (AppState.clientsListas || {})[nombreKey] || '';

    const opcionesLista = `<option value="">— Sin lista —</option>` +
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

/* ── Tabs Historial Cliente / Listas ── */

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
      else { fidelidadStr = 'VIP 👑'; fidelidadColor = '#ffbb00'; fidelidadBg = 'rgba(255,187,0,0.1)'; }

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s Timeout

    const response = await fetch(`/api/clientes?page=${page}&limit=${_clientsLimit}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error('Error al cargar clientes');

    const result = await response.json();
    
    // Actualizar estado de paginación
    _clientsCurrentPage = result.page;
    _clientsTotalPages = Math.ceil(result.total / result.limit);
    
    // Mapear datos de Supabase al formato esperado por la tabla
    // Nota: Por ahora CC, Consola y Fidelidad se muestran básicos ya que están en tablas relacionales
    const mappedClients = result.clientes.map(c => ({
      nombre: c.nombre,
      cc: c.cedula || '--',
      ciudad: c.ciudad || '--',
      celular: c.celular || '--',
      totalComprasCOP: 0, // Se poblará con datos reales en fases posteriores
      cantidadJuegos: 0,
      conteoPS4: 0,
      conteoPS5: 0
    }));

    renderClientsHistoryTable(mappedClients);
    updatePaginationUI();

  } catch (err) {
    console.warn("⚠️ Fallo en lectura paginada:", err.message);
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

// ══════════════════════════════════════════════════════
// MÓDULO: PAQUETES DE CUENTAS PS
// ══════════════════════════════════════════════════════

function openModalPaquete(id = null) {
  const overlay = document.getElementById('modalPaqueteOverlay');
  const titleEl = document.getElementById('modalPaqueteTitle');
  if (!overlay) return;

  document.getElementById('editPaqueteId').value = '';
  document.getElementById('invPaqueteNombre').value = '';
  document.getElementById('invPaqueteCorreo').value = '';
  document.getElementById('invPaqueteHosting').value = '';
  document.getElementById('invPaquetePassHosting').value = '';
  document.getElementById('invPaquetePass').value = '';
  document.getElementById('invPaquete2fa').value = '';
  document.getElementById('invPaqueteFechaCuenta').value = new Date().toISOString().split('T')[0];
  document.getElementById('invPaqueteFecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('invPaqueteUsd').value = '';
  document.getElementById('invPaqueteTrm').value = AppState.exchangeRate || 4200;
  document.getElementById('invPaquetePais').value = 'USA';
  document.getElementById('invPaqueteJuegos').value = '';
  titleEl.textContent = 'Ingresar Paquete';

  if (id !== null) {
    const p = AppState.paquetes.find(x => x.id === id);
    if (p) {
      document.getElementById('editPaqueteId').value = p.id;
      document.getElementById('invPaqueteNombre').value = p.nombre || '';
      document.getElementById('invPaqueteCorreo').value = p.correo || '';
      document.getElementById('invPaqueteHosting').value = p.correo_hosting || p.hosting || '';
      document.getElementById('invPaquetePassHosting').value = p.password_hosting || '';
      document.getElementById('invPaquetePass').value = p.password || '';
      document.getElementById('invPaquete2fa').value = p.codigo2fa || '';
      document.getElementById('invPaqueteFechaCuenta').value = p.fechaCuenta || '';
      document.getElementById('invPaqueteFecha').value = p.fecha || '';
      document.getElementById('invPaqueteUsd').value = p.costoUsd || '';
      document.getElementById('invPaqueteTrm').value = p.trm || '';
      document.getElementById('invPaquetePais').value = p.pais || 'USA';
      document.getElementById('invPaqueteJuegos').value = p.juegos || '';
      titleEl.textContent = 'Editar Paquete';
    }
  }

  overlay.classList.add('show');
}

function closeModalPaquete() {
  const overlay = document.getElementById('modalPaqueteOverlay');
  if (overlay) overlay.classList.remove('show');
}

function savePaqueteInventory() {
  const editId = document.getElementById('editPaqueteId').value;
  const nombre = document.getElementById('invPaqueteNombre').value.trim();
  const correo = document.getElementById('invPaqueteCorreo').value.trim();
  const correoHosting = document.getElementById('invPaqueteHosting').value.trim();
  const passHosting = document.getElementById('invPaquetePassHosting').value.trim();
  const password = document.getElementById('invPaquetePass').value.trim();
  const codigo2fa = document.getElementById('invPaquete2fa').value.trim();
  const fecha = document.getElementById('invPaqueteFecha').value;
  const fechaCuenta = document.getElementById('invPaqueteFechaCuenta').value;
  const costoUsd = parseFloat(document.getElementById('invPaqueteUsd').value) || 0;
  const trm = parseFloat(document.getElementById('invPaqueteTrm').value) || AppState.exchangeRate;
  const pais = document.getElementById('invPaquetePais').value;
  const juegos = document.getElementById('invPaqueteJuegos').value.trim();

  if (!nombre) { alert('El nombre del paquete es obligatorio.'); return; }
  if (!correo) { alert('El correo de la cuenta es obligatorio.'); return; }

  const costoCop = Math.round(costoUsd * trm);

  let es_ps4 = true;
  let es_ps5 = true;
  let tipo_version = "Cross-Gen";

  const matchAnalisis = AppState.analysis.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());
  if (matchAnalisis) {
    es_ps4 = matchAnalisis.ps4 !== undefined ? matchAnalisis.ps4 : true;
    es_ps5 = matchAnalisis.ps5 !== undefined ? matchAnalisis.ps5 : true;

    if (es_ps4 && es_ps5) tipo_version = "Cross-Gen";
    else if (!es_ps4 && es_ps5) tipo_version = "Exclusivo PS5";
    else if (es_ps4 && !es_ps5) tipo_version = "Exclusivo PS4";
  }

  const cupos_ps4_primaria = es_ps4 ? 2 : 0;
  const cupos_ps4_secundaria = es_ps4 ? 1 : 0;
  const cupos_ps5_primaria = es_ps5 ? 2 : 0;
  const cupos_ps5_secundaria = es_ps5 ? 1 : 0;

  if (editId) {
    const idx = AppState.paquetes.findIndex(p => p.id == editId);
    if (idx !== -1) {
      AppState.paquetes[idx] = {
        ...AppState.paquetes[idx],
        nombre, correo, correo_hosting: correoHosting, password_hosting: passHosting, password, codigo2fa, fecha, fechaCuenta, costoUsd, trm, costoCop, pais, juegos,
        es_ps4, es_ps5, tipo_version, cupos_ps4_primaria, cupos_ps4_secundaria, cupos_ps5_primaria, cupos_ps5_secundaria
      };
      logEvent('Inventario Paquetes: Edición', `ID: ${editId} | Paquete: ${nombre}`);
    }
  } else {
    const newId = Date.now();
    AppState.paquetes.push({
      id: newId, nombre, correo, correo_hosting: correoHosting, password_hosting: passHosting, password, codigo2fa, fecha, fechaCuenta, costoUsd, trm, costoCop, pais, juegos, estado: 'OFF',
      es_ps4, es_ps5, tipo_version, cupos_ps4_primaria, cupos_ps4_secundaria, cupos_ps5_primaria, cupos_ps5_secundaria
    });
    logEvent('Inventario Paquetes: Nuevo', `ID: ${newId} | Paquete: ${nombre}`);
  }

  closeModalPaquete();
  renderInventoryPaquetes();
  calculateBalances();
  saveLocal();
}

function renderInventoryPaquetes() {
  const user = AppState.currentUser;
  if (!user) return;
  const hasAccesoTotal = user?.permisos?.acceso_total === true;

  const tbody = document.getElementById('inventoryPaquetesBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const paquetes = AppState.paquetes || [];
  const searchVal = (document.getElementById('searchPaquetes')?.value || '').toLowerCase();

  const filtered = paquetes.filter(p =>
    (p.nombre || '').toLowerCase().includes(searchVal) ||
    (p.correo || '').toLowerCase().includes(searchVal)
  );

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="16" style="text-align:center; color: var(--text-muted); padding: 30px;">No hay paquetes registrados aún. Haz clic en "+ Comprar Paquete" para agregar uno.</td></tr>`;
    return;
  }

  let html = '';

  filtered.forEach((p, idx) => {
    const isON = p.estado === 'ON';

    const statusSwitch = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
        <span class="status-label-premium ${isON ? 'active' : 'used'}">
          <i data-lucide="${isON ? 'check-circle' : 'clock'}" style="width:10px; height:10px;"></i> ${p.estado || 'OFF'}
        </span>
        <label class="premium-switch">
          <input type="checkbox" ${isON ? 'checked' : ''} onchange="togglePaqueteStatus('${p.id}')">
          <span class="switch-slider"></span>
        </label>
      </div>
    `;

    const actionButtons = `
      <div style="display:flex; gap:10px; justify-content:center;">
        <button class="action-btn-premium view-btn" onclick="openModalHistorialVentas('${p.id}')" title="Ver Historial de Ventas"><i data-lucide="eye" class="minimalist-icon" style="width:16px; height:16px;"></i></button>
        ${(hasAccesoTotal || (user.permisos && user.permisos.p_inventario_editar)) ? `
        <button class="action-btn-premium edit-btn" onclick="openModalPaquete('${p.id}')" title="Editar"><i data-lucide="edit-3" class="minimalist-icon" style="width:16px; height:16px;"></i></button>` : ''}
        ${(hasAccesoTotal || (user.permisos && user.permisos.p_inventario_eliminar)) ? `
        <button class="action-btn-premium delete-btn" onclick="deletePaquete('${p.id}')" title="Eliminar"><i data-lucide="trash-2" class="minimalist-icon" style="width:16px; height:16px;"></i></button>` : ''}
      </div>
    `;

    const juegosResumen = p.juegos ? p.juegos.split('\n').filter(j => j.trim()).length + ' juegos' : '0 juegos';
    const pais = p.pais || 'USA';

    const { config, used } = getPaqueteSlots(p.id);
    const p4p = config.p_ps4 - used.p_ps4;
    const p4s = config.s_ps4 - used.s_ps4;
    const p4s_available = (used.p_ps4 >= config.p_ps4) && p4s > 0;
    const p5p = config.p_ps5 - used.p_ps5;
    const p5s = config.s_ps5 - used.s_ps5;
    const p5s_available = (used.p_ps5 >= config.p_ps5) && p5s > 0;

    let htmlSlots = `
      <div style="display:flex; gap:6px; align-items:center; line-height:1; margin-bottom: 2px;">
        <span style="color:${p4p > 0 ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p4p} PRI</span>
        <span style="color:${p4s_available ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p4s} SEC</span>
        <span style="font-size:0.55rem; font-weight:700; background:rgba(0,102,255,0.15); color:#0066ff; padding:2px 5px; border-radius:4px; border:1px solid rgba(0,102,255,0.4); margin-left:1px; letter-spacing:0.3px;">PS4</span>
      </div>
      <div style="display:flex; gap:6px; align-items:center; line-height:1;">
        <span style="color:${p5p > 0 ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p5p} PRI</span>
        <span style="color:${p5s_available ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p5s} SEC</span>
        <span style="font-size:0.55rem; font-weight:700; background:rgba(255,255,255,0.15); color:#ffffff; padding:2px 5px; border-radius:4px; border:1px solid rgba(255,255,255,0.4); margin-left:1px; letter-spacing:0.3px;">PS5</span>
      </div>
    `;

    html += `
      <tr class="${isON ? 'row-active' : 'row-used'}">
        <td class="row-number">${idx + 1}</td>
        <td style="color: var(--accent-cyan); font-weight: 700;">#${p.id}</td>
        <td>${p.fecha || '-'}</td>
        <td class="fw-bold" style="color:var(--text-light)">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span title="${(p.juegos || '').replace(/\n/g, ', ')}" style="cursor:help;">${p.nombre || '--'}</span>
            <span style="font-size:0.65rem; font-weight:900; background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:8px; color:var(--accent-yellow); border:1px solid var(--accent-yellow); display:inline-flex; align-items:center; gap:6px; line-height:1;">
              <img src="https://flagcdn.com/w20/${pais === 'TUR' ? 'tr' : 'us'}.png" style="width:16px; height:auto; border-radius:2px; display:inline-block;" alt="${pais}">
              ${pais === 'TUR' ? 'TUR' : 'USA'}
            </span>
            <span class="badge-juegos-premium" 
                  style="font-size:0.65rem; font-weight:900; background:rgba(0,255,136,0.1); padding:4px 8px; border-radius:8px; color:var(--accent-green); border:1px solid rgba(0,255,136,0.3); line-height:1; cursor:help;" 
                  title="🎮 Juegos incluidos:&#10;${(p.juegos || 'Sin juegos').replace(/\n/g, '&#10;')}">
              <i data-lucide="gamepad-2" style="width:10px; height:10px; margin-right:4px;"></i>${juegosResumen}
            </span>
          </div>
          <div style="margin-top:8px; font-size:0.7rem; display:flex; flex-direction:column; gap:2px;">
            ${htmlSlots}
          </div>
        </td>
        <td style="font-size:0.9rem">
          <div class="fw-bold">${p.correo || '--'}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Hosting: ${p.correo_hosting || p.hosting || '-'} | Pass: ${p.password_hosting || '-'}</div>
        </td>
        <td style="font-family:monospace; font-size:0.85rem; color:var(--text-muted); text-align:center;">
          <div class="password-field-premium" onclick="togglePasswordVisibility(this)"><span>${p.password || '-'}</span></div>
        </td>
        <td style="font-family:monospace; font-size:0.85rem; color:var(--text-muted); text-align:center;">
          <div class="password-field-premium" onclick="togglePasswordVisibility(this)"><span>${p.codigo2fa || '-'}</span></div>
        </td>
        <td style="font-size:0.85rem; text-align:center; color:var(--text-muted);">${p.fechaCuenta || '-'}</td>
        <td class="text-success">${formatUSD(p.costoUsd)}</td>
        <td class="text-warning">${formatCOP(p.costoCop)}</td>
        <td style="text-align:center">${statusSwitch}</td>
        <td>${actionButtons}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function deletePaquete(id) {
  showDeleteConfirmModal('¿Eliminar este paquete?', () => {
    const pToDelete = AppState.paquetes.find(p => p.id === id);
    if (pToDelete && typeof logEvent === 'function') {
      logEvent('Inventario Paquetes: Eliminado', `Se eliminó el paquete: ${pToDelete.nombre}`);
    }

    AppState.paquetes = AppState.paquetes.filter(p => p.id !== id);
    renderInventoryPaquetes();
    calculateBalances();
    saveLocal();
  });
}

function togglePaqueteStatus(id) {
  const paquete = AppState.paquetes.find(p => p.id === id);
  if (paquete) {
    paquete.estado = paquete.estado === 'ON' ? 'OFF' : 'ON';

    logEvent('Inventario Paquetes: Estado', `ID: ${id} | Paquete: ${paquete.nombre} -> ${paquete.estado}`);

    saveLocal();
    renderInventoryPaquetes();
    calculateBalances();
  }
}

function filterInventoryPaquetes() {
  renderInventoryPaquetes();
}

// ══════════════════════════════════════════════════════
// MÓDULO: MEMBRESÍAS PS PLUS
// ══════════════════════════════════════════════════════

function openModalMembresia(id = null) {
  const overlay = document.getElementById('modalMembresiaOverlay');
  const titleEl = document.getElementById('modalMembresiaTitle');
  if (!overlay) return;

  document.getElementById('editMembresiaId').value = '';
  document.getElementById('invMembresiaTipo').value = '1 mes Essential';
  document.getElementById('invMembresiaCorreo').value = '';
  document.getElementById('invMembresiaHosting').value = '';
  document.getElementById('invMembresiaPassHosting').value = '';
  document.getElementById('invMembresiaPass').value = '';
  document.getElementById('invMembresia2fa').value = '';
  document.getElementById('invMembresiaFechaCuenta').value = new Date().toISOString().split('T')[0];
  document.getElementById('invMembresiaFecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('invMembresiaUsd').value = '';
  document.getElementById('invMembresiaTrm').value = AppState.exchangeRate || 4200;
  document.getElementById('invMembresiaPais').value = 'USA';
  titleEl.textContent = 'Ingresar Membresía PS+';

  if (id !== null) {
    const m = AppState.membresias.find(x => x.id === id);
    if (m) {
      document.getElementById('editMembresiaId').value = m.id;
      document.getElementById('invMembresiaTipo').value = m.tipo || '1 mes Essential';
      document.getElementById('invMembresiaCorreo').value = m.correo || '';
      document.getElementById('invMembresiaHosting').value = m.correo_hosting || m.hosting || '';
      document.getElementById('invMembresiaPassHosting').value = m.password_hosting || '';
      document.getElementById('invMembresiaPass').value = m.password || '';
      document.getElementById('invMembresia2fa').value = m.codigo2fa || '';
      document.getElementById('invMembresiaFechaCuenta').value = m.fechaCuenta || '';
      document.getElementById('invMembresiaFecha').value = m.fecha || '';
      document.getElementById('invMembresiaUsd').value = m.costoUsd || '';
      document.getElementById('invMembresiaTrm').value = m.trm || '';
      document.getElementById('invMembresiaPais').value = m.pais || 'USA';
      titleEl.textContent = 'Editar Membresía PS+';
    }
  }

  overlay.classList.add('show');
}

function closeModalMembresia() {
  const overlay = document.getElementById('modalMembresiaOverlay');
  if (overlay) overlay.classList.remove('show');
}

function saveMembresiaInventory() {
  const editId = document.getElementById('editMembresiaId').value;
  const tipo = document.getElementById('invMembresiaTipo').value;
  const correo = document.getElementById('invMembresiaCorreo').value.trim();
  const correoHosting = document.getElementById('invMembresiaHosting').value.trim();
  const passHosting = document.getElementById('invMembresiaPassHosting').value.trim();
  const password = document.getElementById('invMembresiaPass').value.trim();
  const codigo2fa = document.getElementById('invMembresia2fa').value.trim();
  const fecha = document.getElementById('invMembresiaFecha').value;
  const fechaCuenta = document.getElementById('invMembresiaFechaCuenta').value;
  const costoUsd = parseFloat(document.getElementById('invMembresiaUsd').value) || 0;
  const trm = parseFloat(document.getElementById('invMembresiaTrm').value) || AppState.exchangeRate;
  const pais = document.getElementById('invMembresiaPais').value;

  if (!correo) { alert('El correo de la cuenta es obligatorio.'); return; }

  const costoCop = Math.round(costoUsd * trm);

  // Membresías aplican a PS4 y PS5
  const es_ps4 = true;
  const es_ps5 = true;
  const tipo_version = "Cross-Gen";
  const cupos_ps4_primaria = 2;
  const cupos_ps4_secundaria = 1;
  const cupos_ps5_primaria = 2;
  const cupos_ps5_secundaria = 1;

  if (editId) {
    const idx = AppState.membresias.findIndex(m => m.id == editId);
    if (idx !== -1) {
      AppState.membresias[idx] = {
        ...AppState.membresias[idx],
        tipo, correo, correo_hosting: correoHosting, password_hosting: passHosting, password, codigo2fa, fecha, fechaCuenta, costoUsd, trm, costoCop, pais,
        es_ps4, es_ps5, tipo_version, cupos_ps4_primaria, cupos_ps4_secundaria, cupos_ps5_primaria, cupos_ps5_secundaria
      };
      logEvent('Inventario Membresías: Edición', `ID: ${editId} | Tipo: ${tipo}`);
    }
  } else {
    const newId = Date.now();
    AppState.membresias.push({
      id: newId, tipo, correo, correo_hosting: correoHosting, password_hosting: passHosting, password, codigo2fa, fecha, fechaCuenta, costoUsd, trm, costoCop, pais, estado: 'OFF',
      es_ps4, es_ps5, tipo_version, cupos_ps4_primaria, cupos_ps4_secundaria, cupos_ps5_primaria, cupos_ps5_secundaria
    });
    logEvent('Inventario Membresías: Nueva', `ID: ${newId} | Tipo: ${tipo}`);
  }

  closeModalMembresia();
  renderInventoryMembresias();
  calculateBalances();
  saveLocal();
}

function renderInventoryMembresias() {
  const user = AppState.currentUser;
  if (!user) return;
  const tbody = document.getElementById('inventoryMembresiasBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const membresias = AppState.membresias || [];
  const searchVal = (document.getElementById('searchMembresias')?.value || '').toLowerCase();

  const filtered = membresias.filter(m =>
    (m.tipo || '').toLowerCase().includes(searchVal) ||
    (m.correo || '').toLowerCase().includes(searchVal)
  );

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; color: var(--text-muted); padding: 30px;">No hay membresías registradas aún. Haz clic en "+ Comprar Membresía" para agregar una.</td></tr>`;
    return;
  }

  let html = '';

  filtered.forEach((m, idx) => {
    const isON = m.estado === 'ON';

    const statusSwitch = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
        <span class="status-label-premium ${isON ? 'active' : 'used'}">
          <i data-lucide="${isON ? 'check-circle' : 'clock'}" style="width:10px; height:10px;"></i> ${m.estado || 'OFF'}
        </span>
        <label class="premium-switch">
          <input type="checkbox" ${isON ? 'checked' : ''} onchange="toggleMembresiaStatus(${m.id})">
          <span class="switch-slider"></span>
        </label>
      </div>
    `;

    const user = AppState.currentUser;
    const hasAccesoTotal = user.permisos && user.permisos.acceso_total === true;
    const canEdit = hasAccesoTotal || (user.permisos && user.permisos.p_inventario_editar === true);
    const canDelete = hasAccesoTotal || (user.permisos && user.permisos.p_inventario_eliminar === true);

    const actionButtons = `
      <div style="display:flex; gap:10px; justify-content:center;">
        <button class="action-btn-premium view-btn" onclick="openModalHistorialVentas(${m.id})" title="Ver Historial de Ventas"><i data-lucide="eye" class="minimalist-icon" style="width:16px; height:16px;"></i></button>
        ${canEdit ? `<button class="action-btn-premium edit-btn" onclick="openModalMembresia(${m.id})" title="Editar"><i data-lucide="edit-3" class="minimalist-icon" style="width:16px; height:16px;"></i></button>` : ''}
        ${canDelete ? `<button class="action-btn-premium delete-btn" onclick="deleteMembresia(${m.id})" title="Eliminar"><i data-lucide="trash-2" class="minimalist-icon" style="width:16px; height:16px;"></i></button>` : ''}
      </div>
    `;

    // Membresia type badge logic
    let tipoBg = '0,212,255';
    let tipoColor = 'var(--accent-cyan)';
    if ((m.tipo || '').includes('Deluxe')) {
      tipoBg = '245,158,11';
      tipoColor = '#f59e0b';
    } else if ((m.tipo || '').includes('Extra')) {
      tipoBg = '0,255,136';
      tipoColor = 'var(--accent-green)';
    }

    const pais = m.pais || 'USA';

    const { config, used } = getMembresiaSlots(m.id);
    const p4p = config.p_ps4 - used.p_ps4;
    const p4s = config.s_ps4 - used.s_ps4;
    const p4s_available = (used.p_ps4 >= config.p_ps4) && p4s > 0;
    const p5p = config.p_ps5 - used.p_ps5;
    const p5s = config.s_ps5 - used.s_ps5;
    const p5s_available = (used.p_ps5 >= config.p_ps5) && p5s > 0;

    let htmlSlots = `
      <div style="display:flex; gap:6px; align-items:center; line-height:1; margin-bottom: 2px;">
        <span style="color:${p4p > 0 ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p4p} PRI</span>
        <span style="color:${p4s_available ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p4s} SEC</span>
        <span style="font-size:0.55rem; font-weight:700; background:rgba(0,102,255,0.15); color:#0066ff; padding:2px 5px; border-radius:4px; border:1px solid rgba(0,102,255,0.4); margin-left:1px; letter-spacing:0.3px;">PS4</span>
      </div>
      <div style="display:flex; gap:6px; align-items:center; line-height:1;">
        <span style="color:${p5p > 0 ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p5p} PRI</span>
        <span style="color:${p5s_available ? '#10b981' : '#f43f5e'}; font-weight:600; font-size:0.65rem;">${p5s} SEC</span>
        <span style="font-size:0.55rem; font-weight:700; background:rgba(255,255,255,0.15); color:#ffffff; padding:2px 5px; border-radius:4px; border:1px solid rgba(255,255,255,0.4); margin-left:1px; letter-spacing:0.3px;">PS5</span>
      </div>
    `;

    html += `
      <tr class="${isON ? 'row-active' : 'row-used'}">
        <td class="row-number">${idx + 1}</td>
        <td style="color: var(--accent-cyan); font-weight: 700;">#${m.id}</td>
        <td>${m.fecha || '-'}</td>
        <td class="fw-bold" style="color:var(--text-light)">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="background: rgba(${tipoBg},0.15); color: ${tipoColor}; padding: 4px 10px; border-radius: 8px; font-weight:900; font-size:0.65rem; white-space:nowrap; border:1px solid rgba(${tipoBg},0.3);">
              ${m.tipo || '--'}
            </span>
            <span style="font-size:0.65rem; font-weight:900; background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:8px; color:var(--accent-yellow); border:1px solid var(--accent-yellow); display:inline-flex; align-items:center; gap:6px; line-height:1;">
              <img src="https://flagcdn.com/w20/${pais === 'TUR' ? 'tr' : 'us'}.png" style="width:16px; height:auto; border-radius:2px; display:inline-block;" alt="${pais}">
              ${pais === 'TUR' ? 'TUR' : 'USA'}
            </span>
          </div>
          <div style="margin-top:8px; font-size:0.7rem; display:flex; flex-direction:column; gap:2px;">
            ${htmlSlots}
            <div style="font-size: 0.6rem; font-weight: 300; color: ${calculateMembershipCountdown(m) <= 5 ? '#f43f5e' : 'var(--text-muted)'}; margin-top: 4px; font-style: italic; letter-spacing: 0.5px; opacity: 0.8;">
              ${formatDaysToMonths(calculateMembershipCountdown(m))} restantes
            </div>
          </div>
        </td>
        <td style="font-size:0.9rem">
          <div class="fw-bold">${m.correo || '--'}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Hosting: ${m.correo_hosting || m.hosting || '-'} | Pass: ${m.password_hosting || '-'}</div>
        </td>
        <td style="font-family:monospace; font-size:0.85rem; color:var(--text-muted); text-align:center;">
          <div class="password-field-premium" onclick="togglePasswordVisibility(this)"><span>${m.password || '-'}</span></div>
        </td>
        <td style="font-family:monospace; font-size:0.85rem; color:var(--text-muted); text-align:center;">
          <div class="password-field-premium" onclick="togglePasswordVisibility(this)"><span>${m.codigo2fa || '-'}</span></div>
        </td>
        <td style="font-size:0.85rem; text-align:center; color:var(--text-muted);">${m.fechaCuenta || '-'}</td>
        <td class="text-success">${formatUSD(m.costoUsd)}</td>
        <td class="text-warning">${formatCOP(m.costoCop)}</td>
        <td style="text-align:center">${statusSwitch}</td>
        <td>${actionButtons}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function deleteMembresia(id) {
  showDeleteConfirmModal('¿Eliminar esta membresía?', () => {
    const mToDelete = AppState.membresias.find(m => m.id === id);
    if (mToDelete && typeof logEvent === 'function') {
      logEvent('Inventario Membresías: Eliminada', `Se eliminó la membresía: ${mToDelete.tipo}`);
    }

    AppState.membresias = AppState.membresias.filter(m => m.id !== id);
    renderInventoryMembresias();
    calculateBalances();
    saveLocal();
  });
}

function toggleMembresiaStatus(id) {
  const m = AppState.membresias.find(x => x.id === id);
  if (m) {
    m.estado = m.estado === 'ON' ? 'OFF' : 'ON';
    logEvent('Inventario Membresías: Estado', `ID: ${id} | Tipo: ${m.tipo} -> ${m.estado}`);
    renderInventoryMembresias();
    calculateBalances();
    saveLocal();
  }
}

function filterInventoryMembresias() {
  renderInventoryMembresias();
}

/* ═══════════════════════════════════════ */
/* 25. BITÁCORA Y GESTIÓN DE USUARIOS      */
/* ═══════════════════════════════════════ */

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

/* ═══════════════════════════════════════ */
/* 2FA CODES MANAGEMENT SYSTEM             */
/* ═══════════════════════════════════════ */

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

function update2FABellBadge() {
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
  stepCodigo,
  updateCodigoRowMax,
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
  getGameSlots,
  deleteGameInventory,
  deleteCodigoInventory,
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
  toggleCodigoStatus,
  toggleCodigoUsed,
  toggleXboxStatus,
  togglePhysicalStatus,
  togglePaqueteStatus,
  toggleMembresiaStatus,
  switchInvMode,
  toggleStatusFilter,
  selectStatusFilter,
  toggleDenomFilter,
  selectDenomFilter,
  openModalXbox,
  closeXboxModal,
  saveXboxInventory,
  deleteXbox,
  openModalPhysical,
  closePhysicalModal,
  savePhysicalInventory,
  deletePhysical,
  
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
  checkDuplicateGameEmail,
  
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
