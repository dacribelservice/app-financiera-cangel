import { AppState } from '../core/store.js';
import { updateDashboard } from './dashboard.js';
import { renderAnalysisTable } from './analysis.js';
import { renderCatalog } from './catalog.js';
import { updateBalance } from './balance.js';
import { renderInventory } from './inventory.js';
import { renderCuentasPSN, renderVentas } from './sales.js';
import { renderBitacoraEventos } from './bitacora.js';
import { renderGestionUsuarios } from './users.js';
import { initAnalytics } from './analytics.js';

/**
 * Fase 8.1: Módulo de Navegación y Enrutamiento (SPA)
 */

/**
 * Inicializa los event listeners de las pestañas
 */
export function initTabs() {
  const tabs = document.querySelectorAll('.browser-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}

/**
 * Cambia la pestaña activa y dispara los renders necesarios
 * @param {string} tabName - Nombre de la pestaña destino
 */
export function switchTab(tabName) {
  if (!tabName) return;
  AppState.activeTab = tabName;

  // Actualizar Pestañas Superiores (Clases CSS)
  document.querySelectorAll('.browser-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });

  // Mostrar Página (Clases CSS)
  document.querySelectorAll('.page-content').forEach(p => {
    p.classList.remove('active');
  });

  const targetPage = document.getElementById(`page${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  if (targetPage) targetPage.classList.add('active');

  // Triggers de actualización asíncronos por módulo
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

  // Re-inicializar iconos de Lucide tras el renderizado de la nueva página
  if (window.lucide) window.lucide.createIcons();
}
