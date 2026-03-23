/* ============================================================ */
/* DASHBOARD MODULE - Gestión de KPIs y Métricas               */
/* ============================================================ */
import { AppState } from '../core/store.js';
import { updateDashboardCharts } from './analytics.js';
import { renderClientHistory } from './clients.js';

/**
 * Actualiza todos los KPIs del Dashboard principal
 */
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

  if (kpiIngresos) {
    kpiIngresos.textContent = `$${ingresos.toLocaleString('es-CO')}`;
    kpiIngresos.classList.add('kpi-glow');
  }
  
  const elCostos = document.getElementById('kpiCostos');
  if (elCostos) elCostos.textContent = `$${(costos + gastosExtras).toLocaleString('es-CO')}`;

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

  if (kpiGanancia) {
    kpiGanancia.textContent = `$${neta.toLocaleString('es-CO')}`;
    kpiGanancia.classList.add('kpi-glow');
  }

  const elKpiJuegos = document.getElementById('kpiJuegos');
  if (elKpiJuegos) elKpiJuegos.textContent = AppState.catalog.length;

  renderTop5();
  
  if (typeof updateDashboardCharts === 'function') {
    updateDashboardCharts();
  }
  
  if (typeof renderClientHistory === 'function') {
    renderClientHistory();
  }
}

/**
 * Renderiza el Top 5 de juegos más vendidos
 */
export function renderTop5() {
  const container = document.getElementById('topGamesList');
  if (!container) return;

  const counts = {};
  AppState.sales.forEach(v => {
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
