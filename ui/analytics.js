import { AppState } from '../core/store.js';
import { renderClientHistory } from './clients.js';

/**
 * Fase 5.1d: Módulo de Analytics & Gráficas
 */

export let rankingAsesoresChartInstance = null;

export function initAnalytics() {
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

export function renderTopPlataformas() {
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
      // Sin indicios de plataforma —— asignar a PS4 por defecto
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

export function renderRankingAsesores() {
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

// -€-€-€-€ MODULO DE GRÁFICAS (Chart.js) -€-€-€-€
export function updateInventoryBarChart(gamesVal, codesVal, paqVal, memVal) {
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

export function updateMonthlyInvestmentChart(items) {
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

export function updateDashboardCharts() {
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
