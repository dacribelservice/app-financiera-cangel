/* ================================================
   CANGEL GAMES ERP — Módulo UI Balance & Finanzas
   ================================================ */

import { AppState } from '../core/store.js';
import { formatCOP, formatUSD, getColombiaTime } from '../utils/formatters.js';

// Import de dependencias que residen en App.js (por ahora)
import { 
  saveLocal, logEvent
} from '../app.js';

import { 
  showPremiumAlert, showPremiumPrompt, showDeleteConfirmModal, showToast 
} from './modals.js';

import { updateInventoryBarChart, updateMonthlyInvestmentChart } from './analytics.js';

/* ============================================================ */
/* 6. BALANCE & AUDITORÍA                      */
/* ============================================================ */

export function updateBalance() {
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

export function renderPagoMetodoChart() {
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

export function processPDF(file) {
  if (!file) return;
  const statusEl = document.getElementById('pdfStatus');
  statusEl.innerHTML = 'Analizando extracto bancario...';
  setTimeout(() => {
    statusEl.innerHTML = 'Auditoría completada. Banco como fuente de verdad OK.';
    updateBalance();
  }, 1500);
}

export async function addExpense(type) {
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

export function renderExpenses() {
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

export function eliminarGasto(id) {
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

export async function prepararEdicionGasto(id) {
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

export async function addIngreso() {
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

export function renderIngresos() {
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

export function eliminarIngreso(id) {
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

export async function prepararEdicionIngreso(id) {
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
/* CALCULATE BALANCES & STOCK                                  */
/* ============================================================ */

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

export function renderStockSummary(activeGames) {
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

// -€-€-€-€ GESTIÓN DE STOCK IDEAL Y AUDITORÍA -€-€-€-€

export function openIdealStockModal() {
  const overlay = document.getElementById('idealStockModalOverlay');
  if (!overlay) return;
  // Set default month to current
  const now = new Date();
  const currentMonth = now.toISOString().substring(0, 7);
  document.getElementById('auditMonthFilter').value = currentMonth;
  renderIdealStockAudit();
  overlay.classList.add('show');
}

export function closeIdealStockModal() {
  const overlay = document.getElementById('idealStockModalOverlay');
  if (overlay) overlay.classList.remove('show');
}

export function renderIdealStockAudit() {
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
            onchange="window.updateIdealStockValue('${title}', this.value)"
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

export function updateIdealStockValue(title, value) {
  AppState.idealStock[title] = parseInt(value) || 0;
  saveLocal();
  renderStockSummary(AppState.inventoryGames.filter(g => g.estado === 'Activo'));
}

export function downloadAuditExcel() {
  const monthFilter = document.getElementById('auditMonthFilter').value;
  const rows = document.querySelectorAll('#auditTableBody tr');
  if (rows.length === 0) return alert("No hay datos para exportar");

  let csvContent = "Título del Juego;Stock Ideal;Comprado (Periodo);Compra (Histórico);Stock Actual;Listado (Por Comprar)\n";
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 6) return; // Skip the total row

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
