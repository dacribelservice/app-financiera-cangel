/* ============================================================ */
/* AUDIT LOG & BITACORA MODULE - Sistema de Auditoría Cangel      */
/* ============================================================ */
import { AppState } from '../core/store.js';
import { saveLocal } from '../core/persistence.js';
import { showDeleteConfirmModal, showPremiumAlert } from './modals.js';
import { apiClearCloudData } from '../services/api.js';

/**
 * Registra un evento en la bitácora de auditoría
 */
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
  
  if (!AppState.auditLog) AppState.auditLog = [];
  AppState.auditLog.unshift(logEntry);
  
  // Persistencia automática
  saveLocal();
}

/**
 * Cambia entre las pestañas internas de la Bitácora (Visor de Eventos / Gestión de Usuarios)
 */
export function switchBitacoraTab(tabName) {
  const btnVisor = document.getElementById('btnTabVisorEventos');
  const btnGestion = document.getElementById('btnTabGestionUsuarios');
  const visorPanel = document.getElementById('bitacoraVisorEventos');
  const gestionPanel = document.getElementById('bitacoraGestionUsuarios');
  
  if (btnVisor) btnVisor.className = (tabName === 'visorEventos') ? 'btn-primary' : 'btn-secondary';
  if (btnGestion) btnGestion.className = (tabName === 'gestionUsuarios') ? 'btn-primary' : 'btn-secondary';
  if (visorPanel) visorPanel.style.display = (tabName === 'visorEventos') ? 'block' : 'none';
  if (gestionPanel) gestionPanel.style.display = (tabName === 'gestionUsuarios') ? 'block' : 'none';
}

/**
 * Renderiza los eventos en la tabla de bitácora
 */
export function renderBitacoraEventos() {
  const tbody = document.getElementById('bodyBitacoraEventos');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const showAnulaciones = document.getElementById('filterBitacoraAnulaciones')?.checked ?? true;
  
  if (!AppState.auditLog) AppState.auditLog = [];
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

/**
 * Procede con la limpieza total de datos del sistema (Local + Cloud)
 */
export function confirmarLimpiezaDatos() {
  showDeleteConfirmModal(
    "⚠️ ADVERTENCIA CRÍTICA: ¿Estás seguro de que quieres limpiar todos los datos de prueba tanto LOCALES como en la NUBE?\n\nSe borrarán permanentemente ventas e inventario en Supabase y el navegador.",
    async () => {
      console.log('--- Iniciando limpieza profunda (LOCAL + CLOUD) ---');
      try {
        const result = await apiClearCloudData();
        if (result && result.success) {
          console.log('✅ Nube saneada exitosamente. Procediendo con limpieza local...');
        } else {
          throw new Error('El servidor respondió pero no confirmó el éxito.');
        }
        
        // Limpieza de AppState
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
        console.error('❌ Error crítico en Hard Reset:', err.message);
        await showPremiumAlert("Error en Limpieza", "No pudimos limpiar la nube. Por razones de seguridad, no borraremos tus datos locales hasta que la base de datos remota esté saneada.", "error");
      }
    }
  );
}
