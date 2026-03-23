import { AppState } from '../core/store.js';
import { logEvent } from './bitacora.js';
import { switchTab } from '../app.js';
import { saveLocal } from '../core/persistence.js';
import { showPremiumAlert } from './modals.js';

/**
 * Fase 6.2: Módulo de Autenticación y Seguridad (Auth)
 */

/**
 * Procesa el inicio de sesión del usuario
 */
export function doLogin() {
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

/**
 * Lógica de recuperación de contraseña (Simulada)
 */
export async function recuperarPassword() {
  const email = document.getElementById('loginName').value.trim().toLowerCase();
  if (email === 'cangel.games.soporte@gmail.com') {
    await showPremiumAlert("Acceso", "Se ha enviado un correo de recuperación a cangel.games.soporte@gmail.com con instrucciones.", "info");
  } else {
    await showPremiumAlert("Acceso", "Dile a un administrador que restablezca tu contraseña en el módulo de Usuarios/Seguridad.", "info");
  }
}

/**
 * Cierra la sesión activa
 */
export function doLogout() {
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

/**
 * Aplica permisos granulares a la UI basados en el usuario actual
 */
export function applyPermissions() {
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

/**
 * Determina la primera pestaña permitida para el usuario
 */
export function getFirstAllowedTab(user) {
  if (!user || !user.permisos) return 'catalogo';
  if (user.permisos.acceso_total) return 'dashboard';
  
  const ordenTabs = ['dashboard', 'analisis', 'catalogo', 'inventario', 'ventas', 'analytics', 'balance', 'bitacora'];
  for (let tab of ordenTabs) {
    const permKey = `p_${tab}_ver`;
    if (user.permisos[permKey] === true) return tab;
  }
  return 'catalogo'; // Default fallback
}
