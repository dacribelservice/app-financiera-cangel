/* ================================================
   CANGEL GAMES ERP — Módulo UI Inventario
   ================================================ */

import { AppState } from '../core/store.js';
import { 
  formatCOP, formatUSD, 
  calculateMembershipCountdown, formatDaysToMonths 
} from '../utils/formatters.js';
import { 
  isValidDuplicateEmail as val_isValidDuplicateEmail, 
  isInventoryLow as val_pureIsInventoryLow 
} from '../utils/validators.js';

// Import de dependencias que aún residen en App.js o se han movido a módulos UI especializados
import { saveLocal } from '../core/persistence.js';
import { logEvent } from './bitacora.js';
import { renderAnalysisTable } from './analysis.js';
import { calculateBalances } from './balance.js';
import { updateDashboard } from './dashboard.js';
import { update2FABellBadge } from './users.js';
import { showDeleteConfirmModal, showToast } from './modals.js';
import { renderCuentasPSN } from './sales.js';
import { apiDeleteGame, clearFromSyncQueue } from '../services/api.js';

// --- FUNCIONES DE SOPORTE (SLOTS) ---

export function getPaqueteSlots(paqueteId) {
  const p = AppState.paquetes.find(x => x.id === paqueteId);
  if (!p) return { config: { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 }, used: { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 } };

  const config = {
    p_ps4: p.cupos_ps4_primaria || 0,
    s_ps4: p.cupos_ps4_secundaria || 0,
    p_ps5: p.cupos_ps5_primaria || 0,
    s_ps5: p.cupos_ps5_secundaria || 0
  };

  const used = { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 };
  (AppState.sales || []).forEach(v => {
    if (String(v.product_id) === String(paqueteId) && v.estado !== 'ANULADA') {
      const tc = (v.tipo_cuenta || '').toLowerCase();
      if (tc.includes('primaria ps4')) used.p_ps4++;
      else if (tc.includes('secundaria ps4')) used.s_ps4++;
      else if (tc.includes('primaria ps5')) used.p_ps5++;
      else if (tc.includes('secundaria ps5')) used.s_ps5++;
    }
  });

  return { config, used };
}

export function getMembresiaSlots(membresiaId) {
  const m = AppState.membresias.find(x => x.id === membresiaId);
  if (!m) return { config: { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 }, used: { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 } };

  const config = {
    p_ps4: m.cupos_ps4_primaria || 0,
    s_ps4: m.cupos_ps4_secundaria || 0,
    p_ps5: m.cupos_ps5_primaria || 0,
    s_ps5: m.cupos_ps5_secundaria || 0
  };

  const used = { p_ps4: 0, s_ps4: 0, p_ps5: 0, s_ps5: 0 };
  (AppState.sales || []).forEach(v => {
    if (String(v.product_id) === String(membresiaId) && v.estado !== 'ANULADA') {
      const tc = (v.tipo_cuenta || '').toLowerCase();
      if (tc.includes('primaria ps4')) used.p_ps4++;
      else if (tc.includes('secundaria ps4')) used.s_ps4++;
      else if (tc.includes('primaria ps5')) used.p_ps5++;
      else if (tc.includes('secundaria ps5')) used.s_ps5++;
    }
  });

  return { config, used };
}

// --- GESTIÓN DE MODOS Y VISTAS ---

export function switchInvMode(mode) {
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

  const config = modeMap[mode];
  if (config) {
    const btn = document.getElementById(config.btnId);
    if (btn) btn.classList.add('active');
    const container = document.getElementById(config.containerId);
    if (container) container.classList.remove('hidden');
    if (config.render) config.render();
  }
}

export function renderInventory() {
  const tab = AppState.activeTab;
  if (tab === 'inventario') {
    renderInventoryJuegos();
    renderInventoryCodigos();
    renderInventoryPaquetes();
    renderInventoryMembresias();
    renderInventoryXbox();
    renderInventoryPhysical();
  }
}

// --- MÓDULO: JUEGOS ---

export function openModalJuego() {
  document.getElementById('modalJuegoTitle').textContent = '🎮 Ingresar Nuevo Juego';
  document.getElementById('editGameId').value = '';
  document.getElementById('modalJuegoOverlay').classList.add('show');
  document.getElementById('invJuegoFecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('invJuegoFechaCuenta').value = new Date().toISOString().split('T')[0];
  document.getElementById('invJuegoHosting').value = '';
  document.getElementById('invJuegoPassHosting').value = '';
  document.getElementById('invJuegoPais').value = 'USA';
}

export function editGameInventory(id) {
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

export function closeModalJuego() {
  document.getElementById('modalJuegoOverlay').classList.remove('show');
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

export function isValidDuplicateEmail(input) {
  const currentEmail = input.value.trim().toLowerCase();
  const editId = document.getElementById('editGameId').value;
  const errorDiv = document.getElementById('duplicateInvEmailError');

  if (!currentEmail) {
    if (errorDiv) errorDiv.style.display = 'none';
    input.style.borderColor = 'rgba(255,255,255,0.1)';
    return false;
  }

  const isDuplicate = val_isValidDuplicateEmail(currentEmail, AppState.inventoryGames, editId);

  if (isDuplicate) {
    if (errorDiv) errorDiv.style.display = 'block';
    input.style.borderColor = '#f43f5e';
    return true;
  } else {
    if (errorDiv) errorDiv.style.display = 'none';
    input.style.borderColor = 'rgba(255,255,255,0.1)';
    return false;
  }
}

export function saveGameInventory() {
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

  if (isValidDuplicateEmail(document.getElementById('invJuegoCorreo'))) {
    alert("Error: Este correo ya existe en el inventario. Por favor usa un correo diferente.");
    return;
  }

  const costoCop = Math.round(costoUsd * trm);
  if (!AppState.inventoryGames) AppState.inventoryGames = [];

  let es_ps4 = true, es_ps5 = true, tipo_version = "Cross-Gen";
  const matchAnalisis = AppState.analysis.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());
  if (matchAnalisis) {
    es_ps4 = matchAnalisis.ps4 !== undefined ? matchAnalisis.ps4 : true;
    es_ps5 = matchAnalisis.ps5 !== undefined ? matchAnalisis.ps5 : true;
    if (es_ps4 && es_ps5) tipo_version = "Cross-Gen";
    else if (!es_ps4 && es_ps5) tipo_version = "Exclusivo PS5";
    else if (es_ps4 && !es_ps5) tipo_version = "Exclusivo PS4";
  }

  const finalId = editId || Date.now();
  const gameIdx = AppState.inventoryGames.findIndex(g => String(g.id) === String(finalId));

  const gameData = {
    id: finalId, juego: nombre, correo, correo_hosting: correoHosting, password_hosting: passHosting, pais, password, fecha, fechaCuenta, codigo2fa, costoUsd, costoCop, 
    estado: gameIdx !== -1 ? AppState.inventoryGames[gameIdx].estado : 'OFF',
    es_ps4, es_ps5, tipo_version,
    cupos_ps4_primaria: es_ps4 ? 2 : 0, cupos_ps4_secundaria: es_ps4 ? 1 : 0, cupos_ps5_primaria: (es_ps5 || es_ps4) ? 2 : 0, cupos_ps5_secundaria: (es_ps5 || es_ps4) ? 1 : 0
  };

  if (gameIdx !== -1) {
    AppState.inventoryGames[gameIdx] = { ...AppState.inventoryGames[gameIdx], ...gameData };
    logEvent('Inventario Juegos: Edición', `ID: ${finalId} | Juego: ${nombre}`);
  } else {
    AppState.inventoryGames.push(gameData);
    logEvent('Inventario Juegos: Nuevo', `ID: ${finalId} | Juego: ${nombre} (${tipo_version})`);
  }

  saveLocal();
  renderInventoryJuegos();
  renderAnalysisTable();
  closeModalJuego();
  isInventoryLow();
  calculateBalances();
  updateDashboard();
}

export function deleteGameInventory(id) {
  showDeleteConfirmModal("¿Estás seguro de que deseas eliminar permanentemente este juego del inventario?", async () => {
    const gameToDelete = AppState.inventoryGames.find(g => g.id === id);
    if (gameToDelete) logEvent('Inventario Juegos: Eliminado', `ID: ${id} | Juego: ${gameToDelete.juego}`);
    
    // 1. Eliminar del estado local
    AppState.inventoryGames = AppState.inventoryGames.filter(g => g.id !== id);
    
    // 2. Sanitizar sync_queue (Evitar resurrección offline)
    clearFromSyncQueue(id);
    
    // 3. Guardar cambios en el almacenamiento local
    saveLocal();
    
    // 4. Borrado Atómico en la Nube (Supabase)
    await apiDeleteGame(id);
    
    renderInventoryJuegos();
    isInventoryLow();
    calculateBalances();
    showToast("Juego eliminado física y permanentemente", "info");
  });
}

export function toggleGameStatus(id) {
  const game = AppState.inventoryGames.find(g => g.id === id);
  if (game) {
    game.estado = game.estado === 'ON' ? 'OFF' : 'ON';
    logEvent('Inventario Juegos: Estado', `ID: ${id} | Juego: ${game.juego} -> ${game.estado}`);
    saveLocal();
    renderInventoryJuegos();
    isInventoryLow();
    calculateBalances();
  }
}

export function filterInventoryGames() {
  renderInventoryJuegos();
}

export function renderInventoryJuegos() {
  const user = AppState.currentUser;
  if (!user) return;
  const tbody = document.getElementById('inventoryGamesBody');
  if (!tbody) return;

  const searchInput = document.getElementById('searchJuegos');
  const query = searchInput ? searchInput.value.toLowerCase() : '';
  const statusFilterEl = document.getElementById('filterStatus');
  const statusFilter = statusFilterEl ? statusFilterEl.value : 'all';

  let games = (AppState.inventoryGames || []).filter(g => {
    const matchesSearch = (g.juego || '').toLowerCase().includes(query) || (g.correo || '').toLowerCase().includes(query);
    if (query !== '' && !matchesSearch) return false;
    if (statusFilter !== 'all' && (g.estado || 'OFF').toUpperCase() !== statusFilter) return false;
    return true;
  });

  games.sort((a, b) => (b.fecha ? new Date(b.fecha) : 0) - (a.fecha ? new Date(a.fecha) : 0));

  tbody.innerHTML = '';
  if (!games.length) {
    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; color: var(--text-muted); padding: 30px;">No hay juegos registrados.</td></tr>';
    return;
  }
  
  games.forEach((g, idx) => {
    const tr = document.createElement('tr');
    tr.className = g.estado === 'ON' ? 'row-active' : 'row-used';
    
    // Simplificado para el ejemplo, pero idealmente recreamos las filas completas
    tr.innerHTML = `
      <td class="row-number">${idx + 1}</td>
      <td><span class="id-badge">${g.id.toString().slice(-6)}</span></td>
      <td>${g.fecha || '-'}</td>
      <td class="fw-bold">
        <div style="display:flex; align-items:center; gap:6px;">
          <span>${g.juego}</span>
          <span style="font-size:0.6rem; color:var(--accent-yellow); border:1px solid rgba(255,186,0,0.3); padding:2px 4px; border-radius:4px; background:rgba(255,186,0,0.05);">${g.pais || 'USA'}</span>
        </div>
      </td>
      <td>
        <div>${g.correo}</div>
        <div style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">Host: ${g.correo_hosting || '-'}</div>
      </td>
      <td style="text-align:center;">
        <div class="password-field-premium" onclick="togglePasswordVisibility(this)">
          <span>${g.password || '-'}</span>
        </div>
      </td>
      <td style="text-align:center;">
        <div class="password-field-premium" onclick="togglePasswordVisibility(this)">
          <span>${g.codigo2fa || '-'}</span>
        </div>
      </td>
      <td class="text-success" style="font-weight:700;">${formatUSD(g.costoUsd)}</td>
      <td class="text-warning" style="font-weight:700;">${formatCOP(g.costoCop)}</td>
      <td style="text-align:center;">
        <label class="premium-switch">
          <input type="checkbox" ${g.estado === 'ON' ? 'checked' : ''} onchange="toggleGameStatus('${g.id}')">
          <span class="switch-slider"></span>
        </label>
      </td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="action-btn-premium view-btn" onclick="openModalHistorialVentas('${g.id}')" title="Ver Historial"><i data-lucide="eye"></i></button>
          <button class="action-btn-premium edit-btn" onclick="editGameInventory('${g.id}')" title="Editar"><i data-lucide="edit-3"></i></button>
          <button class="action-btn-premium delete-btn" onclick="deleteGameInventory('${g.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- MÓDULO: CÓDIGOS ---

export function openModalCodigo() {
  document.getElementById('modalCodigoOverlay').classList.add('show');
  document.getElementById('invCodigoFecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('invCodigoTrm').value = AppState.exchangeRate || 4000;
}

export function closeModalCodigo() {
  document.getElementById('modalCodigoOverlay').classList.remove('show');
  document.getElementById('invCodigoPin').value = '';
}

export function saveCodigoInventory() {
  const valor = parseFloat(document.getElementById('invCodigoValor').value);
  const trm = parseFloat(document.getElementById('invCodigoTrm').value);
  const fecha = document.getElementById('invCodigoFecha').value;
  const pinsRaw = document.getElementById('invCodigoPin').value.trim();

  if (!pinsRaw || isNaN(trm)) { alert("Completa el PIN y la TRM."); return; }

  const pins = pinsRaw.split('\n').map(p => p.trim()).filter(p => p);
  pins.forEach(pin => {
    const newId = Date.now() + Math.random();
    const existingIdx = (AppState.inventoryCodes || []).findIndex(c => String(c.pin) === String(pin));
    
    const codeData = {
      id: newId,
      tipo: `${valor} USD`,
      valorUsd: valor,
      trm: trm,
      costoCop: Math.round(valor * trm),
      pin: pin,
      fecha: fecha,
      estado: 'ON'
    };

    if (existingIdx !== -1) {
      AppState.inventoryCodes[existingIdx] = codeData;
    } else {
      AppState.inventoryCodes.push(codeData);
    }
  });

  logEvent('Inventario Códigos: Nuevo', `Se añadieron ${pins.length} códigos de ${valor} USD`);
  saveLocal();
  renderInventoryCodigos();
  closeModalCodigo();
  calculateBalances();
  updateDashboard();
}

export function renderInventoryCodigos() {
  const tbody = document.getElementById('invCodigosBody');
  if (!tbody) return;
  const codes = (AppState.inventoryCodes || []).filter(c => c.estado === 'ON');
  tbody.innerHTML = '';
  if (!codes.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Sin códigos en stock.</td></tr>';
    return;
  }
  codes.forEach((c, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="row-number">${idx + 1}</td>
      <td><span class="id-badge">${String(c.id).slice(-6)}</span></td>
      <td>${c.fecha || '-'}</td>
      <td><span style="background:rgba(255,102,0,0.1); color:#ff6600; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.75rem; border:1px solid rgba(255,102,0,0.2);">${c.tipo}</span></td>
      <td><code style="background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:4px; border:1px solid rgba(255,255,255,0.1); font-size:0.85rem; color:var(--accent-cyan);">${c.pin}</code></td>
      <td class="text-warning" style="font-weight:700;">${formatCOP(c.costoCop)}</td>
      <td>
        <button class="action-btn-premium delete-btn" onclick="deleteCodigoInventory('${c.id}')" title="Eliminar">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- MÓDULO: XBOX / PHYSICAL ---

export function openModalXbox(id = null) {
  document.getElementById('modalXboxTitle').textContent = id ? 'Editar Xbox' : 'Ingresar Xbox';
  document.getElementById('xboxFormId').value = id || '';
  document.getElementById('modalXboxInventory').classList.add('show');
  if (!id) document.getElementById('xboxFormFecha').value = new Date().toISOString().split('T')[0];
}

export function closeXboxModal() {
  document.getElementById('modalXboxInventory').classList.remove('show');
}

export function saveXboxInventory() {
  const id = document.getElementById('xboxFormId').value;
  const data = {
    id: id || Date.now(),
    fecha: document.getElementById('xboxFormFecha').value,
    detalle: document.getElementById('xboxFormDetalle').value,
    correo: document.getElementById('xboxFormCorreo').value,
    password: document.getElementById('xboxFormPassword').value,
    costoCop: parseFloat(document.getElementById('xboxFormCostoCop').value) || 0,
    proveedor: document.getElementById('xboxFormProveedor').value,
    estado: document.getElementById('xboxFormEstado').value
  };

  if (id) {
    const idx = AppState.xboxInventory.findIndex(x => x.id == id);
    if (idx !== -1) AppState.xboxInventory[idx] = data;
  } else {
    AppState.xboxInventory.push(data);
  }

  saveLocal();
  renderInventoryXbox();
  document.getElementById('modalXboxInventory').classList.remove('show');
}

export function renderInventoryXbox() {
  const tbody = document.getElementById('invXboxBody');
  if (!tbody) return;
  const xboxItems = AppState.xboxInventory || [];
  if (!xboxItems.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">Sin stock de Xbox.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  xboxItems.forEach((x, i) => {
    const tr = document.createElement('tr');
    tr.className = x.estado === 'ON' ? 'row-active' : 'row-used';
    tr.innerHTML = `
      <td class="row-number">${i + 1}</td>
      <td><span class="id-badge">${String(x.id).slice(-6)}</span></td>
      <td>${x.fecha || '-'}</td>
      <td class="fw-bold">${x.detalle}</td>
      <td style="color:var(--accent-cyan);">${x.correo}</td>
      <td class="text-warning" style="font-weight:700;">${formatCOP(x.costoCop)}</td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="action-btn-premium edit-btn" onclick="openModalXbox('${x.id}')" title="Editar"><i data-lucide="edit-3"></i></button>
          <button class="action-btn-premium delete-btn" onclick="deleteXboxInventory('${x.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function openModalPhysical(id = null) {
  document.getElementById('modalPhysicalInventory').classList.add('show');
}

export function closePhysicalModal() {
  document.getElementById('modalPhysicalInventory').classList.remove('show');
}

export function savePhysicalInventory() {
  const idToSave = Date.now();
  const data = {
    id: idToSave,
    fecha: document.getElementById('physicalFormFecha').value,
    detalle: document.getElementById('physicalFormDetalle').value,
    serial: document.getElementById('physicalFormSerial').value,
    costoCop: parseFloat(document.getElementById('physicalFormCostoCop').value) || 0,
    estado: document.getElementById('physicalFormEstado').value
  };

  const idx = (AppState.physicalInventory || []).findIndex(p => String(p.serial) === String(data.serial));
  if (idx !== -1) {
    AppState.physicalInventory[idx] = { ...AppState.physicalInventory[idx], ...data, id: AppState.physicalInventory[idx].id };
  } else {
    AppState.physicalInventory.push(data);
  }

  saveLocal();
  renderInventoryPhysical();
  document.getElementById('modalPhysicalInventory').classList.remove('show');
}

export function renderInventoryPhysical() {
  const tbody = document.getElementById('invPhysicalBody');
  if (!tbody) return;
  const physItems = AppState.physicalInventory || [];
  if (!physItems.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">Sin inventario físico.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  physItems.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="row-number">${i + 1}</td>
      <td><span class="id-badge">${String(p.id).slice(-6)}</span></td>
      <td>${p.fecha || '-'}</td>
      <td class="fw-bold">${p.detalle}</td>
      <td style="font-family:monospace; color:var(--text-muted);">${p.serial || '-'}</td>
      <td class="text-warning" style="font-weight:700;">${formatCOP(p.costoCop)}</td>
      <td>
        <button class="action-btn-premium delete-btn" onclick="deletePhysicalInventory('${p.id}')" title="Eliminar">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- MÓDULO: PAQUETES / MEMBRESÍAS ---

// --- MÓDULO: PAQUETES ---

export function openModalPaquete(id = null) {
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

export function closeModalPaquete() {
  const overlay = document.getElementById('modalPaqueteOverlay');
  if (overlay) overlay.classList.remove('show');
}

export function savePaqueteInventory() {
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
  let es_ps4 = true, es_ps5 = true, tipo_version = "Cross-Gen";

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

  const finalId = editId || Date.now();
  const pIdx = AppState.paquetes.findIndex(p => String(p.id) === String(finalId));

  const paqueteData = {
    id: finalId, nombre, correo, correo_hosting: correoHosting, password_hosting: passHosting, password, codigo2fa, fecha, fechaCuenta, costoUsd, trm, costoCop, pais, juegos, 
    estado: pIdx !== -1 ? AppState.paquetes[pIdx].estado : 'OFF',
    es_ps4, es_ps5, tipo_version, cupos_ps4_primaria, cupos_ps4_secundaria, cupos_ps5_primaria, cupos_ps5_secundaria
  };

  if (pIdx !== -1) {
    AppState.paquetes[pIdx] = { ...AppState.paquetes[pIdx], ...paqueteData };
    logEvent('Inventario Paquetes: Edición', `ID: ${finalId} | Paquete: ${nombre}`);
  } else {
    AppState.paquetes.push(paqueteData);
    logEvent('Inventario Paquetes: Nuevo', `ID: ${finalId} | Paquete: ${nombre}`);
  }

  closeModalPaquete();
  renderInventoryPaquetes();
  calculateBalances();
  saveLocal();
}

export function renderInventoryPaquetes() {
  const user = AppState.currentUser;
  if (!user) return;
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
    tbody.innerHTML = `<tr><td colspan="16" style="text-align:center; color: var(--text-muted); padding: 30px;">No hay paquetes registrados.</td></tr>`;
    return;
  }

  filtered.forEach((p, idx) => {
    const isON = p.estado === 'ON';
    const { config, used } = getPaqueteSlots(p.id);
    const tr = document.createElement('tr');
    tr.className = isON ? 'row-active' : 'row-used';
    tr.innerHTML = `
      <td class="row-number">${idx + 1}</td>
      <td><span class="id-badge">${p.id.toString().slice(-6)}</span></td>
      <td>${p.fecha || '-'}</td>
      <td class="fw-bold"><div style="display:flex; align-items:center; gap:6px;">${p.nombre} <span style="font-size:0.6rem; color:var(--accent-cyan); border:1px solid rgba(0,224,255,0.3); padding:2px 4px; border-radius:4px; background:rgba(0,224,255,0.05);">${p.pais || 'USA'}</span></div></td>
      <td style="color:var(--text-muted);">${p.correo}</td>
      <td style="text-align:center;"><div class="password-field-premium" onclick="togglePasswordVisibility(this)"><span>${p.password || '-'}</span></div></td>
      <td style="text-align:center;"><div class="password-field-premium" onclick="togglePasswordVisibility(this)"><span>${p.codigo2fa || '-'}</span></div></td>
      <td class="text-success" style="font-weight:700;">${formatUSD(p.costoUsd)}</td>
      <td class="text-warning" style="font-weight:700;">${formatCOP(p.costoCop)}</td>
      <td style="text-align:center;"><label class="premium-switch"><input type="checkbox" ${isON ? 'checked' : ''} onchange="togglePaqueteStatus('${p.id}')"><span class="switch-slider"></span></label></td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="action-btn-premium edit-btn" onclick="openModalPaquete('${p.id}')" title="Editar"><i data-lucide="edit-3"></i></button>
          <button class="action-btn-premium delete-btn" onclick="deletePaquete('${p.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function deletePaquete(id) {
  showDeleteConfirmModal('¿Eliminar este paquete?', () => {
    const pToDelete = AppState.paquetes.find(p => String(p.id) === String(id));
    if (pToDelete) logEvent('Inventario Paquetes: Eliminado', `Se eliminó el paquete: ${pToDelete.nombre}`);
    AppState.paquetes = AppState.paquetes.filter(p => String(p.id) !== String(id));
    renderInventoryPaquetes();
    calculateBalances();
    saveLocal();
  });
}

export function togglePaqueteStatus(id) {
  const paquete = AppState.paquetes.find(p => p.id === id);
  if (paquete) {
    paquete.estado = paquete.estado === 'ON' ? 'OFF' : 'ON';
    logEvent('Inventario Paquetes: Estado', `ID: ${id} | Paquete: ${paquete.nombre} -> ${paquete.estado}`);
    saveLocal();
    renderInventoryPaquetes();
    calculateBalances();
  }
}

export function filterInventoryPaquetes() {
  renderInventoryPaquetes();
}

// --- MÓDULO: MEMBRESÍAS ---

export function openModalMembresia(id = null) {
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

export function closeModalMembresia() {
  const overlay = document.getElementById('modalMembresiaOverlay');
  if (overlay) overlay.classList.remove('show');
}

export function saveMembresiaInventory() {
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
  const es_ps4 = true, es_ps5 = true, tipo_version = "Cross-Gen";
  const cupos_ps4_primaria = 2, cupos_ps4_secundaria = 1, cupos_ps5_primaria = 2, cupos_ps5_secundaria = 1;

  const finalId = editId || Date.now();
  const mIdx = AppState.membresias.findIndex(m => String(m.id) === String(finalId));

  const membresiaData = {
    id: finalId, tipo, correo, correo_hosting: correoHosting, password_hosting: passHosting, password, codigo2fa, fecha, fechaCuenta, costoUsd, trm, costoCop, pais, 
    estado: mIdx !== -1 ? AppState.membresias[mIdx].estado : 'OFF',
    es_ps4, es_ps5, tipo_version, cupos_ps4_primaria, cupos_ps4_secundaria, cupos_ps5_primaria, cupos_ps5_secundaria
  };

  if (mIdx !== -1) {
    AppState.membresias[mIdx] = { ...AppState.membresias[mIdx], ...membresiaData };
    logEvent('Inventario Membresías: Edición', `ID: ${finalId} | Tipo: ${tipo}`);
  } else {
    AppState.membresias.push(membresiaData);
    logEvent('Inventario Membresías: Nueva', `ID: ${finalId} | Tipo: ${tipo}`);
  }

  closeModalMembresia();
  renderInventoryMembresias();
  calculateBalances();
  saveLocal();
}

export function renderInventoryMembresias() {
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
    tbody.innerHTML = `<tr><td colspan="15" style="text-align:center;">No hay membresías registradas.</td></tr>`;
    return;
  }

  filtered.forEach((m, idx) => {
    const isON = m.estado === 'ON';
    const tr = document.createElement('tr');
    tr.className = isON ? 'row-active' : 'row-used';
    tr.innerHTML = `
      <td class="row-number">${idx + 1}</td>
      <td><span class="id-badge">${m.id.toString().slice(-6)}</span></td>
      <td>${m.fecha || '-'}</td>
      <td class="fw-bold">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="background:rgba(0,102,255,0.1); color:#0066ff; padding:2px 8px; border-radius:4px; border:1px solid rgba(0,102,255,0.2); font-size:0.8rem;">${m.tipo}</span>
          <span style="font-size:0.6rem; color:var(--accent-yellow); border:1px solid rgba(255,186,0,0.3); padding:2px 4px; border-radius:4px; background:rgba(255,186,0,0.05);">${m.pais || 'USA'}</span>
        </div>
      </td>
      <td style="color:var(--text-muted);">${m.correo}</td>
      <td style="text-align:center;"><div class="password-field-premium" onclick="togglePasswordVisibility(this)"><span>${m.password || '-'}</span></div></td>
      <td style="text-align:center;"><div class="password-field-premium" onclick="togglePasswordVisibility(this)"><span>${m.codigo2fa || '-'}</span></div></td>
      <td class="text-success" style="font-weight:700;">${formatUSD(m.costoUsd)}</td>
      <td class="text-warning" style="font-weight:700;">${formatCOP(m.costoCop)}</td>
      <td style="text-align:center;"><label class="premium-switch"><input type="checkbox" ${isON ? 'checked' : ''} onchange="toggleMembresiaStatus('${m.id}')"><span class="switch-slider"></span></label></td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="action-btn-premium edit-btn" onclick="openModalMembresia('${m.id}')" title="Editar"><i data-lucide="edit-3"></i></button>
          <button class="action-btn-premium delete-btn" onclick="deleteMembresia('${m.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function deleteMembresia(id) {
  showDeleteConfirmModal('¿Eliminar esta membresía?', () => {
    const mToDelete = AppState.membresias.find(m => String(m.id) === String(id));
    if (mToDelete) logEvent('Inventario Membresías: Eliminada', `Se eliminó la membresía: ${mToDelete.tipo}`);
    AppState.membresias = AppState.membresias.filter(m => String(m.id) !== String(id));
    renderInventoryMembresias();
    calculateBalances();
    saveLocal();
  });
}

export function toggleMembresiaStatus(id) {
  const m = AppState.membresias.find(x => String(x.id) === String(id));
  if (m) {
    m.estado = m.estado === 'ON' ? 'OFF' : 'ON';
    logEvent('Inventario Membresías: Estado', `ID: ${id} | Membresía: ${m.tipo} -> ${m.estado}`);
    saveLocal();
    renderInventoryMembresias();
    calculateBalances();
  }
}

// --- UTILS UI ---

export function togglePasswordVisibility(el) {
  if (el) el.classList.toggle('active');
}

export function deleteCodigoInventory(id) {
  showDeleteConfirmModal("¿Estás seguro de que deseas eliminar permanentemente este código?", () => {
    AppState.inventoryCodes = (AppState.inventoryCodes || []).filter(c => String(c.id) !== String(id));
    saveLocal();
    renderInventoryCodigos();
    calculateBalances();
    showToast("Código eliminado", "info");
  });
}

export function deleteXboxInventory(id) {
  showDeleteConfirmModal("¿Eliminar este registro de Xbox?", () => {
    AppState.xboxInventory = (AppState.xboxInventory || []).filter(x => String(x.id) !== String(id));
    saveLocal();
    renderInventoryXbox();
    calculateBalances();
    showToast("Registro de Xbox eliminado", "info");
  });
}

export function deletePhysicalInventory(id) {
  showDeleteConfirmModal("¿Eliminar este registro de inventario físico?", () => {
    AppState.physicalInventory = (AppState.physicalInventory || []).filter(p => String(p.id) !== String(id));
    saveLocal();
    renderInventoryPhysical();
    calculateBalances();
    showToast("Registro físico eliminado", "info");
  });
}

export function filterInventoryMembresias() {
  renderInventoryMembresias();
}

export function filterInventoryCodes() {
  renderInventoryCodigos();
}

export function filterInventoryXbox() {
  renderInventoryXbox();
}

export function filterInventoryPhysical() {
  renderInventoryPhysical();
}

// --- HELPERS DINÁMICOS ---

export function selectStatusFilter(event, val, text) {
  if (event && event.stopPropagation) event.stopPropagation();
  const input = document.getElementById('filterStatus');
  if (input) input.value = val;
  const label = document.getElementById('statusSelectedText');
  if (label) label.textContent = text;
  renderInventoryJuegos();
}

/**
 * --- MÓDULO: HISTORIAL DE VENTAS POR ITEM ---
 */

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
  const overlay = document.getElementById('historialVentasOverlay');
  if (overlay) overlay.classList.remove('show');
}

/**
 * --- MÓDULO: ALERTAS Y NOTIFICACIONES STOCK ---
 */

export function isInventoryLow() {
  const badge = document.getElementById('notifBadge');
  const bell = document.getElementById('notifBell');
  if (!badge) return;

  const result = val_pureIsInventoryLow(AppState.inventoryGames);
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

/**
 * --- MÓDULO: AUTOCOMPLETADO (ANÁLISIS -> INVENTARIO) ---
 */

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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-blue)"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></div>
      <span>${name}</span>
    </div>
  `).join('');
  container.style.display = 'block';
}

export function selectGameSuggestion(name) {
  const input = document.getElementById('invJuegoNombre');
  const container = document.getElementById('gameSuggestions');
  if (!input || !container) return;

  input.value = name;
  container.style.display = 'none';
  
  // Opcional: enfocar el siguiente campo
  const nextInput = document.getElementById('invJuegoCorreo');
  if (nextInput) nextInput.focus();
}

/**
 * --- MÓDULO: FILTROS DROPDOWN (PREMIUM) ---
 */

export function toggleStatusFilter(event) {
  if (event) event.stopPropagation();
  const list = document.getElementById('statusOptionsList');
  if (list) {
    // Cerrar otros dropdowns primero
    const allDropdowns = document.querySelectorAll('.dropdown-options');
    allDropdowns.forEach(d => { if (d !== list) d.classList.remove('show'); });
    list.classList.toggle('show');
  }
}


export function toggleDenomFilter(event) {
  if (event) event.stopPropagation();
  const list = document.getElementById('denomOptionsList');
  if (list) {
    const allDropdowns = document.querySelectorAll('.dropdown-options');
    allDropdowns.forEach(d => { if (d !== list) d.classList.remove('show'); });
    list.classList.toggle('show');
  }
}

export function selectDenomFilter(event, value, text) {
  if (event) event.stopPropagation();
  const filterInput = document.getElementById('filterDenom');
  const selectedText = document.getElementById('denomSelectedText');
  const list = document.getElementById('denomOptionsList');
  
  if (filterInput) filterInput.value = value;
  if (selectedText) selectedText.textContent = text;
  if (list) list.classList.remove('show');
  
  renderInventoryCodigos();
}

// Cerrar dropdowns al hacer clic fuera
document.addEventListener('click', () => {
  const allDropdowns = document.querySelectorAll('.dropdown-options');
  allDropdowns.forEach(d => d.classList.remove('show'));
});
