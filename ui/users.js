/* ============================================================ */
/* USERS & 2FA MODULE - Gestión Administrativa y Seguridad      */
/* ============================================================ */
import { AppState } from '../core/store.js';
import { saveLocal, logEvent } from '../app.js';
import { renderCuentasPSN } from './sales.js';
import { showToast } from './modals.js';

/**
 * Renderiza la lista de usuarios en el panel de administración
 */
export function renderGestionUsuarios() {
  const tbody = document.getElementById('bodyGestionUsuarios');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  AppState.users.forEach(u => {
    const isSuperAdmin = u.email === 'cangel.games.soporte@gmail.com';
    const estadoClass = u.activo ? 'status-active' : 'status-inactive';
    const estadoText = u.activo ? 'Activo' : 'Inactivo';
    
    const tr = document.createElement('tr');
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

/**
 * Abre el modal para crear o editar un usuario
 */
export function openModalUsuario(email = null) {
  const form = document.getElementById('formUsuario');
  if (form) form.reset();
  
  const title = document.getElementById('modalUsuarioTitle');
  if (email) {
    if (title) title.innerHTML = '<i data-lucide="edit" class="minimalist-icon"></i> Editar Usuario';
    const user = AppState.users.find(u => u.email === email);
    if (user) {
      document.getElementById('usuarioEditEmail').value = user.email;
      const nombreInput = document.getElementById('usNombre');
      const emailInput = document.getElementById('usEmail');
      const passInput = document.getElementById('usPassword');
      const rolSelect = document.getElementById('usRol');
      
      if (nombreInput) nombreInput.value = user.nombre;
      if (emailInput) {
        emailInput.value = user.email;
        emailInput.disabled = true;
      }
      if (passInput) {
        passInput.value = '';
        passInput.placeholder = 'Dejar en blanco para no cambiar';
        passInput.required = false;
      }
      if (rolSelect) rolSelect.value = user.rolBase || 'Asesor Comercial';
      
      const totalCheck = document.getElementById('chkAccesoTotal');
      if (totalCheck) totalCheck.checked = user.permisos.acceso_total || false;
      
      const perms = ['p_dashboard_ver', 'p_analisis_ver', 'p_catalogo_ver',
        'p_ventas_ver', 'p_ventas_crear', 'p_ventas_editar', 'p_ventas_eliminar',
        'p_inventario_ver', 'p_inventario_crear', 'p_inventario_editar', 'p_inventario_eliminar',
        'p_analytics_ver', 'p_balance_ver', 'p_balance_editar', 'p_bitacora_ver'];
        
      perms.forEach(p => {
        const pCheck = document.getElementById(p);
        if (pCheck) pCheck.checked = user.permisos[p] || false;
      });
      toggleAllPermissions();
    }
  } else {
    if (title) title.innerHTML = '<i data-lucide="user-plus" class="minimalist-icon"></i> Nuevo Usuario';
    const emailField = document.getElementById('usuarioEditEmail');
    const usEmail = document.getElementById('usEmail');
    const usPass = document.getElementById('usPassword');
    
    if (emailField) emailField.value = '';
    if (usEmail) usEmail.disabled = false;
    if (usPass) {
      usPass.placeholder = 'Obligatorio para nuevos';
      usPass.required = true;
    }
    updateChecklistFromRole();
  }
  
  const modal = document.getElementById('modalUsuarioOverlay');
  if (modal) modal.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Cierra el modal de usuario
 */
export function closeModalUsuario() {
  const modal = document.getElementById('modalUsuarioOverlay');
  if (modal) modal.style.display = 'none';
}

/**
 * Activa/Desactiva masivamente los permisos si se otorga acceso total
 */
export function toggleAllPermissions() {
  const totalCheck = document.getElementById('chkAccesoTotal');
  if (!totalCheck) return;
  const isTotal = totalCheck.checked;
  const checkboxes = document.querySelectorAll('.perm-chk');
  checkboxes.forEach(chk => {
    chk.disabled = isTotal;
    if (isTotal) chk.checked = true;
  });
}

/**
 * Sugiere permisos base según el rol seleccionado
 */
export function updateChecklistFromRole() {
  const editEmailField = document.getElementById('usuarioEditEmail');
  const isEditing = editEmailField && editEmailField.value !== '';
  if (isEditing) return;
  
  const rolSelect = document.getElementById('usRol');
  if (!rolSelect) return;
  const rol = rolSelect.value;
  
  const form = document.getElementById('formUsuario');
  if (form) form.reset();
  rolSelect.value = rol;
  
  document.querySelectorAll('.perm-chk').forEach(c => c.checked = false);
  const totalCheck = document.getElementById('chkAccesoTotal');
  if (totalCheck) totalCheck.checked = false;
  
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

/**
 * Guarda o actualiza un usuario en el AppState
 */
export function saveUsuario() {
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
  
  const permisos = { acceso_total: accesoTotal };
  const perms = ['p_dashboard_ver', 'p_analisis_ver', 'p_catalogo_ver',
    'p_ventas_ver', 'p_ventas_crear', 'p_ventas_editar', 'p_ventas_eliminar', 'p_ventas_anular',
    'p_inventario_ver', 'p_inventario_crear', 'p_inventario_editar', 'p_inventario_eliminar',
    'p_analytics_ver', 'p_balance_ver', 'p_balance_editar', 'p_bitacora_ver'];
    
  perms.forEach(p => {
    const pCheck = document.getElementById(p);
    permisos[p] = pCheck ? pCheck.checked : false;
  });
  
  if (editEmail) {
    const userIndex = AppState.users.findIndex(u => u.email.toLowerCase() === editEmail.toLowerCase());
    if (userIndex !== -1) {
      if (AppState.users[userIndex].email === 'cangel.games.soporte@gmail.com') return;
      AppState.users[userIndex].nombre = nombre;
      AppState.users[userIndex].rolBase = rolBase;
      AppState.users[userIndex].permisos = permisos;
      if (password !== '') {
        AppState.users[userIndex].pass = password;
      }
      if (typeof logEvent === 'function') logEvent('Edición Usuario', `Rol/Permisos modificados para ${email}`);
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
    if (typeof logEvent === 'function') logEvent('Creación Usuario', `Nuevo usuario registrado: ${email} (${rolBase})`);
  }
  
  if (typeof saveLocal === 'function') saveLocal();
  renderGestionUsuarios();
  closeModalUsuario();
}

/**
 * Cambia el estado (Activado/Desactivado) de un usuario
 */
export function toggleEstadoUsuario(email) {
  if (email === 'cangel.games.soporte@gmail.com') {
    alert("El Super Administrador no puede desactivarse.");
    return;
  }
  const user = AppState.users.find(u => u.email === email);
  if (user) {
    user.activo = !user.activo;
    if (typeof saveLocal === 'function') saveLocal();
    renderGestionUsuarios();
    if (typeof logEvent === 'function') {
      logEvent(user.activo ? 'Reactivación Usuario' : 'Desactivación Usuario', `Usuario ${email} fue ${user.activo ? 'reactivado' : 'desactivado'}`);
    }
  }
}

/* ============================================================ */
/* 2FA CODES MANAGEMENT SYSTEM             */
/* ============================================================ */

/**
 * Abre el modal de 2FA para ver códigos disponibles
 */
export function open2FAModal(itemId, itemType) {
  const modal = document.getElementById('modal2FAOverlay');
  if (!modal) return;
  const item = findInventoryItemById(itemId, itemType);
  if (!item) return;
  modal.dataset.itemId = itemId;
  modal.dataset.itemType = itemType;
  modal.classList.add('show');
  render2FACodesList(item, itemId, itemType);
}

/**
 * Busca un item en el inventario según su ID y tipo
 */
function findInventoryItemById(id, type) {
  if (type === 'game') return AppState.inventoryGames.find(g => String(g.id) === String(id));
  if (type === 'paquete') return AppState.paquetes.find(p => String(p.id) === String(id));
  if (type === 'membresia') return AppState.membresias.find(m => String(m.id) === String(id));
  return null;
}

/**
 * Renderiza la lista de códigos 2FA dentro del modal
 */
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

/**
 * Copia un código al portapapeles y lo elimina de la lista
 */
export async function use2FACode(itemId, itemType, codeIndex) {
  const item = findInventoryItemById(itemId, itemType);
  if (!item) return;
  const codesRaw = item.cod_2_pasos || item.codigo2fa || '';
  const codes = codesRaw.split('\n').map(x => x.trim()).filter(x => x.length > 0);
  if (codeIndex < 0 || codeIndex >= codes.length) return;
  
  const codeToUse = codes[codeIndex];
  try {
    await navigator.clipboard.writeText(codeToUse);
    if (typeof showToast === 'function') showToast('Código copiado al portapapeles', 'success');
  } catch (err) {
    console.error('Error al copiar:', err);
  }
  
  codes.splice(codeIndex, 1);
  const newCodesRaw = codes.join('\n');
  item.codigo2fa = newCodesRaw;
  if (item.cod_2_pasos !== undefined) item.cod_2_pasos = newCodesRaw;
  
  if (typeof logEvent === 'function') logEvent('2FA: Código Utilizado', `Item ID: ${itemId} | Tipo: ${itemType} | Código: ${codeToUse}`);
  if (typeof saveLocal === 'function') saveLocal();
  if (typeof renderCuentasPSN === 'function') renderCuentasPSN();
  
  if (codes.length > 0) {
    render2FACodesList(item, itemId, itemType);
  } else {
    closeModal2FA();
  }
}

/**
 * Cierra el modal de 2FA
 */
export function closeModal2FA() {
  const modal = document.getElementById('modal2FAOverlay');
  if (modal) modal.classList.remove('show');
}

/**
 * Actualiza el indicador de notificaciones de 2FA (cuentas con pocos códigos)
 */
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

/**
 * Cuenta cuántas cuentas tienen 3 o menos códigos restantes
 */
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

/**
 * Abre el panel de cuentas críticas con pocos códigos 2FA
 */
export function open2FANotifModal() {
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
          <div class="badge-2fa ${count === 0 ? 'zero' : 'low'}" style="margin: 0 auto; min-width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; background:${count === 0 ? 'rgba(244,63,94,0.1)' : 'rgba(244,63,94,0.1)'}; color:${count === 0 ? '#f43f5e' : '#f59e0b'}; border:1px solid ${count === 0 ? 'rgba(244,63,94,0.3)' : 'rgba(245,158,11,0.3)'};">
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
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Cierra el modal de notificaciones 2FA
 */
export function close2FANotifModal() {
  const modal = document.getElementById('modal2FANotifOverlay');
  if (modal) modal.classList.remove('show');
}
