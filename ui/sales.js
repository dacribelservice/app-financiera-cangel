import { AppState } from '../core/store.js';
import { formatCOP, formatUSD, getColombiaTime, calculateMembershipCountdown, formatDaysToMonths } from '../utils/formatters.js';
import { hasInventoryAvailability as val_hasInventoryAvailability } from '../utils/validators.js';
import {
  getPaqueteSlots, getMembresiaSlots, renderInventoryJuegos
} from './inventory.js';
import {
  logEvent, saveLocal, updateDashboard,
  asignarClienteALista
} from '../app.js';
import {
  showDeleteConfirmModal, showToast, showPremiumAlert, showPremiumPrompt
} from './modals.js';

// --- GESTIÓN DE VENTAS ---

export function updateVentasMetrics() {
    const user = AppState.currentUser;
    if (!user) return;

    const countVentasTotal = AppState.sales.filter(v => !v.esta_anulada).length;
    const countVentasHoy = AppState.sales.filter(v => {
        if (v.esta_anulada) return false;
        const hoy = new Date().toISOString().split('T')[0];
        const fechaV = (v.fecha || '').includes('/') ? v.fecha.split('/').reverse().join('-') : v.fecha;
        return fechaV === hoy;
    }).length;

    const elTotal = document.getElementById('countVentasTotal');
    const elHoy = document.getElementById('countVentasHoy');
    if (elTotal) elTotal.innerText = countVentasTotal;
    if (elHoy) elHoy.innerText = countVentasHoy;
}

export function llenarFiltroAsesoresVentas() {
  const select = document.getElementById('filtroVentasAsesor');
  if (!select) return;
  const asesores = [...new Set(AppState.sales.map(v => v.vendedor).filter(v => v))];
  select.innerHTML = '<option value="">Todos los Asesores</option>';
  asesores.sort().forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    select.appendChild(opt);
  });
}

export function llenarFiltroMesesVentas() {
  const select = document.getElementById('filtroVentasMes');
  if (!select) return;
  const meses = [...new Set(AppState.sales.map(v => {
    const parts = (v.fecha || '').includes('/') ? v.fecha.split('/') : v.fecha.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}`;
      else return `${parts[2]}-${parts[1].padStart(2, '0')}`;
    }
    return null;
  }).filter(m => m))];

  select.innerHTML = '<option value="">Todos los Meses</option>';
  meses.sort().reverse().forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    const [year, month] = m.split('-');
    const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    opt.textContent = `${nombresMeses[parseInt(month) - 1]} ${year}`;
    select.appendChild(opt);
  });
}

export function limpiarFiltrosVentas() {
  const ids = ['filtroVentasSearch', 'filtroVentasAsesor', 'filtroVentasMes', 'filtroVentasDia', 'filtroVentasFechaInicio', 'filtroVentasFechaFin'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderVentas();
}

export function switchVentasMode(mode) {
  AppState.ventasMode = mode;
  const btnHoy = document.getElementById('btnVentasHoy');
  const btnTotal = document.getElementById('btnVentasTotal');
  if (btnHoy && btnTotal) {
    btnHoy.classList.toggle('active', mode === 'today');
    btnTotal.classList.toggle('active', mode === 'total');
  }
  renderVentas();
}

let salesSearchTimeout;
export function handleVentasSearchDebounce() {
  clearTimeout(salesSearchTimeout);
  salesSearchTimeout = setTimeout(() => {
    renderVentas();
  }, 300);
}

export function getInventoryItemData(venta) {
  let jNombre = venta.juego || '-';
  let cCorreo = venta.correo || 'No disponible';
  let cPass = venta.password || '';

  if (venta.productType === 'paquete') {
    const parent = AppState.paquetes.find(p => String(p.id) === String(venta.inventoryId));
    if (parent) {
      jNombre = parent.nombre;
      cCorreo = parent.correo;
      cPass = parent.password;
    }
  } else if (venta.productType === 'membresia') {
    const parent = AppState.membresias.find(m => String(m.id) === String(venta.inventoryId));
    if (parent) {
      jNombre = parent.tipo;
      cCorreo = parent.correo;
      cPass = parent.password;
    }
  } else if (venta.productType === 'xbox') {
    const parent = AppState.xboxInventory.find(x => String(x.id) === String(venta.inventoryId));
    if (parent) {
      jNombre = parent.detalle;
      cCorreo = parent.correo;
      cPass = parent.password;
    }
  } else if (venta.productType === 'fisico') {
    const parent = AppState.physicalInventory.find(p => String(p.id) === String(venta.inventoryId));
    if (parent) {
      jNombre = parent.detalle;
      cCorreo = parent.serial || 'Sin serial';
      cPass = '';
    }
  } else if (venta.productType === 'codigo') {
    const parent = AppState.inventoryCodes.find(c => String(c.id) === String(venta.inventoryId));
    if (parent) {
      jNombre = parent.tipo;
      cCorreo = parent.pin;
      cPass = '';
    }
  } else {
    const parent = AppState.inventoryGames.find(g => String(g.id) === String(venta.inventoryId));
    if (parent) {
      jNombre = parent.juego;
      cCorreo = parent.correo;
      cPass = parent.password;
    }
  }
  return { jNombre, cCorreo, cPass };
}

export function renderVentas() {
  const user = AppState.currentUser;
  if (!user) return;
  const hasAccesoTotal = user.permisos && user.permisos.acceso_total === true;

  updateVentasMetrics();
  const tbody = document.getElementById('ventasBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const selectAsesor = document.getElementById('filtroVentasAsesor');
  if (selectAsesor && selectAsesor.options.length <= 1) {
    llenarFiltroAsesoresVentas();
  }

  const selectMes = document.getElementById('filtroVentasMes');
  if (selectMes && selectMes.options.length <= 1) {
    llenarFiltroMesesVentas();
  }

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

    if (searchTerm !== '') {
      if (v._searchIndex) {
        const terminos = searchTerm.split(' ').filter(t => t.length > 0);
        coincideBuscador = terminos.every(t => v._searchIndex.includes(t));
      } else {
        const fallbackRaw = `${(v.cliente || '')} ${(v.nombre_cliente || '')} ${(v.cedula || '')} ${(v.celular || '')}`.toLowerCase();
        const terminos = searchTerm.split(' ').filter(t => t.length > 0);
        coincideBuscador = terminos.every(t => fallbackRaw.includes(t));
      }
    }

    if (asesorFiltro !== '') {
      coincideAsesor = (v.vendedor || '') === asesorFiltro;
    }

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

  const transactionsAprobadas = new Set(ventasFiltradas.filter(v => v.transaction_id).map(v => String(v.transaction_id)));
  if (transactionsAprobadas.size > 0 && ventasFiltradas.length !== AppState.sales.length) {
    const ventasHermanas = AppState.sales.filter(v => v.transaction_id && transactionsAprobadas.has(String(v.transaction_id)));
    const todosLosIdsFiltrados = new Set(ventasFiltradas.map(v => v.id));
    ventasHermanas.forEach(vH => {
      if (!todosLosIdsFiltrados.has(vH.id)) {
        ventasFiltradas.push(vH);
        todosLosIdsFiltrados.add(vH.id);
      }
    });
    ventasFiltradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  const procesadas = new Set();
  const grupos = [];

  ventasFiltradas.forEach(v => {
    if (procesadas.has(v.id)) return;
    if (v.transaction_id) {
      const grupo = ventasFiltradas.filter(s => String(s.transaction_id) === String(v.transaction_id));
      grupo.forEach(s => procesadas.add(s.id));
      grupos.push({ tipo: 'multi', representante: v, ventas: grupo });
    } else {
      procesadas.add(v.id);
      grupos.push({ tipo: 'single', representante: v, ventas: [v] });
    }
  });

  const MAX_RENDER_LIMIT = window.RenderVentasLimit || 100;
  let renderizadas = 0;

  grupos.forEach((grupo, index) => {
    if (renderizadas >= MAX_RENDER_LIMIT) return;

    const rowNum = index + 1;
    const rep = grupo.representante;
    const tr = document.createElement('tr');
    const isAnulado = grupo.ventas.every(v => v.esta_anulada);
    if (isAnulado) tr.classList.add('row-annulled');

    if (grupo.tipo === 'multi') {
      let totalPedido = 0;
      let juegosCeldaHTML = '';
      let vendors = new Set();
      let uniqueItemsSold = 0;
      const itemMap = new Map();

      grupo.ventas.forEach(v => {
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

      const displayQty = uniqueItemsSold || Math.ceil(grupo.ventas.length / 2) || 1;
      let i = 0;
      itemMap.forEach((v) => {
        const dataInvT = getInventoryItemData(v);
        let juegoNombre = dataInvT.jNombre;
        let correoInfo = dataInvT.cCorreo;
        let passInfo = dataInvT.cPass;
        const separador = i > 0 ? '<div style="border-top:1px solid rgba(255,255,255,0.08); margin:5px 0;"></div>' : '';

        juegosCeldaHTML += `
          ${separador}
          <div style="font-weight:600; font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px;" title="${juegoNombre}">
            <i data-lucide="gamepad-2" class="minimalist-icon" style="width:12px; height:12px;"></i> ${juegoNombre}
          </div>
          <div style="font-size:0.68rem; color:#a78bfa; margin-top:1px;">
            ${v.tipo_cuenta || ''} &nbsp;·&nbsp; <span style="color:#4ade80;">$${v.totalVenta.toLocaleString('es-CO')}</span>
          </div>
          ${correoInfo && correoInfo !== 'No disponible' ? `<div style="font-size:0.65rem; color:#67e8f9; margin-top:1px;">${correoInfo} | ${passInfo}</div>` : ''}
        `;
        i++;
      });

      const canEdit = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_editar === true);
      const canDelete = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_eliminar === true);
      const canAnnul = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_anular === true);

      const vendorList = Array.from(vendors);
      const vendorHTML = vendorList.length > 1 ? vendorList.map(v => `<div style="line-height:1.1; margin-bottom:2px;">${v}</div>`).join('') : (rep.vendedor || '');

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

  if (grupos.length > MAX_RENDER_LIMIT) {
    const trMore = document.createElement('tr');
    trMore.innerHTML = `
        <td colspan="15" style="text-align:center; padding: 20px;">
           <span style="color: var(--text-muted); font-size: 0.85rem; margin-bottom:10px; display:block;"> Mostrando ${MAX_RENDER_LIMIT} de ${grupos.length} resultados. </span>
           <button class="btn-primary" style="background: var(--accent-cyan); color: #000;" onclick="window.RenderVentasLimit = (window.RenderVentasLimit || 100) + 100; renderVentas();"> Cargar 100 más </button>
        </td>`;
    tbody.appendChild(trMore);
  } else {
    window.RenderVentasLimit = 100;
  }
  if (window.lucide) window.lucide.createIcons();
}



export function eliminarPedidoCompleto(transactionId) {
  if (!transactionId) return;
  const ventas = AppState.sales.filter(v => String(v.transaction_id) === String(transactionId));
  if (ventas.length === 0) return;

  showDeleteConfirmModal(`¿Eliminar el pedido completo? (${ventas.length} juego${ventas.length > 1 ? 's' : ''})\nEsto eliminará todas las ventas del pedido #${transactionId}.`, () => {
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
        const cItem = AppState.inventoryCodes.find(c => String(c.id) === String(v.inventoryId));
        if (cItem) cItem.estado = 'ON';
      }
    });

    AppState.sales = AppState.sales.filter(v => String(v.transaction_id) !== String(transactionId));
    saveLocal();
    updateDashboard();
    renderVentas();
    showToast(`ðŸ—‘ï¸ Pedido eliminado (${ventas.length} juego${ventas.length > 1 ? 's' : ''})`);
  });
}

export function anularFactura(id) {
  const user = AppState.currentUser;
  const hasAccesoTotal = user.permisos && user.permisos.acceso_total === true;
  const canAnnul = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_anular === true);

  if (!canAnnul) {
    showToast("âŒ No tienes permiso para anular facturas");
    return;
  }

  const sale = AppState.sales.find(v => String(v.id) === String(id));
  if (!sale) return;

  const msg = sale.esta_anulada ? "¿Deseas REACTIVAR esta factura?" : "¿Deseas ANULAR esta factura?";
  showDeleteConfirmModal(msg, () => {
    sale.esta_anulada = !sale.esta_anulada;
    saveLocal();
    updateDashboard();
    renderVentas();
    logEvent(sale.esta_anulada ? 'Factura Anulada' : 'Factura Reactivada', `ID: ${id} | Juego: ${sale.juego}`);
    showToast(sale.esta_anulada ? "ðŸš« Factura Anulada" : "âœ… Factura Reactivada");
  });
}

export function anularPedidoCompleto(transactionId) {
  const user = AppState.currentUser;
  const hasAccesoTotal = user.permisos && user.permisos.acceso_total === true;
  const canAnnul = hasAccesoTotal || (user.permisos && user.permisos.p_ventas_anular === true);

  if (!canAnnul) {
    showToast("âŒ No tienes permiso para anular facturas");
    return;
  }
  if (!transactionId) return;
  const ventas = AppState.sales.filter(v => String(v.transaction_id) === String(transactionId));
  if (ventas.length === 0) return;

  const estaAnulado = ventas.every(v => v.esta_anulada);
  const msg = estaAnulado ? "¿Deseas REACTIVAR este pedido completo?" : "¿Deseas ANULAR este pedido completo?";

  showDeleteConfirmModal(msg, () => {
    const nuevoEstado = !estaAnulado;
    ventas.forEach(v => { v.esta_anulada = nuevoEstado; });
    saveLocal();
    updateDashboard();
    renderVentas();
    logEvent(nuevoEstado ? 'Pedido Anulado' : 'Pedido Reactivado', `TX: ${transactionId}`);
    showToast(nuevoEstado ? "ðŸš« Pedido Anulado" : "âœ… Pedido Reactivado");
  });
}

export function verDetallesVenta(id) {
  const v = AppState.sales.find(x => String(x.id) === String(id));
  if (!v) return;
  const modal = document.getElementById('modalDetalleVenta');
  const content = document.getElementById('detalleVentaContent');
  if (!modal || !content) return;

  const dataInv = getInventoryItemData(v);
  content.innerHTML = `
      <div style="background:rgba(255,255,255,0.03); border-radius:12px; padding:15px; border:1px solid rgba(255,255,255,0.05);">
        <p><strong>ID Venta:</strong> ${v.id}</p>
        <p><strong>Fecha/Hora:</strong> ${v.fecha} ${v.hora || ''}</p>
        <p><strong>Vendedor:</strong> ${v.vendedor}</p>
        <p><strong>Cliente:</strong> ${v.nombre_cliente} (${v.cedula})</p>
        <p><strong>Celular:</strong> ${v.celular}</p>
        <p><strong>Estado:</strong> ${v.esta_anulada ? '<span style="color:#ef4444;">ANULADA</span>' : '<span style="color:#4ade80;">ACTIVA</span>'}</p>
        <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:15px 0;">
        <p><strong>Producto:</strong> ${dataInv.jNombre}</p>
        <p><strong>Tipo Cuenta:</strong> ${v.tipo_cuenta || 'N/A'}</p>
        <p><strong>Cuenta:</strong> ${dataInv.cCorreo}</p>
        <p><strong>Password:</strong> ${dataInv.cPass}</p>
        <p><strong>Precio Venta:</strong> $${(v.venta || 0).toLocaleString('es-CO')}</p>
      </div>
  `;
  modal.classList.add('show');
}

export function closeModalDetallesVenta() {
  const modal = document.getElementById('modalDetalleVenta');
  if (modal) modal.classList.remove('show');
}

export function copiarFactura(ventaId) {
  const v = AppState.sales.find(v => String(v.id) === String(ventaId));
  if (!v) { showToast('Error: No se encontró la venta'); return; }
  const dataInv = getInventoryItemData(v);
  const texto = `ðŸ“œ *REMISION DE VENTA* ðŸ“œ\nID: ${v.id}\nFecha: ${v.fecha}\nJuego: ${dataInv.jNombre}\nTipo: ${v.tipo_cuenta}\nCorreo: ${dataInv.cCorreo}\nPass: ${dataInv.cPass}\nPrecio: $${(v.venta || 0).toLocaleString('es-CO')}\n¡Gracias por tu compra! ðŸŽ®`;
  navigator.clipboard.writeText(texto).then(() => showToast('Factura copiada al portapapeles'));
}

export function copiarFacturaConfirmacion(ventaId) {
  const v = AppState.sales.find(v => String(v.id) === String(ventaId));
  if (!v) { showToast('Venta no encontrada'); return; }
  const dataInv = getInventoryItemData(v);
  const texto = `âœ… *CONFIRMACIÓN DE PAGO* âœ…\nID: ${v.id}\nJuego: ${dataInv.jNombre}\nTipo: ${v.tipo_cuenta}\nPrecio: $${(v.venta || 0).toLocaleString('es-CO')}\nEstado: Recibido\n¡Disfruta tu juego! ðŸš€`;
  navigator.clipboard.writeText(texto).then(() => showToast('Confirmación copiada al portapapeles'));
}

export function handleVentaGameAutocomplete(input, rowId) {
  const container = document.getElementById(`suggestions-${rowId}`);
  const val = input.value.trim().toLowerCase();

  if (!val) {
    container.style.display = 'none';
    const row = document.getElementById(`row-${rowId}`);
    if (row) row.querySelector('.row-inventory-id').value = '';
    return;
  }

  const activeGames = AppState.inventoryGames.filter(g => g.estado === 'ON');
  const matches = activeGames.filter(g => {
    const isMatch = String(g.id).toLowerCase().includes(val) ||
      (g.juego && g.juego.toLowerCase().includes(val));

    if (!isMatch) return false;
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
      slotsHtml += `<div style="display:flex; gap:8px; font-size:0.65rem; justify-content:flex-end;"><span style="color:${colorP_PS4};">${disp.p_ps4} P.PS4</span><span style="color:${colorS_PS4};">${disp.s_ps4} S.PS4</span></div>`;
    }
    if (slots.config.p_ps5 > 0 || slots.config.s_ps5 > 0) {
      slotsHtml += `<div style="display:flex; gap:8px; font-size:0.65rem; justify-content:flex-end;"><span style="color:${colorP_PS5};">${disp.p_ps5} P.PS5</span><span style="color:${colorS_PS5};">${disp.s_ps5} S.PS5</span></div>`;
    }

    return `<div class="autocomplete-suggestion" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px;" onclick="selectVentaGameSuggestion('${rowId}', '${g.id}', '${g.juego.replace(/'/g, "\\'")}')">
      <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><span style="font-size:0.7rem; color:#888;">#${g.id}</span> <span style="font-size:0.8rem; font-weight:500; color:#fff;">${g.juego}</span></div>
      <div style="margin-left:10px;">${slotsHtml}</div>
    </div>`;
  }).join('');
  container.style.display = 'block';
}

export function selectVentaGameSuggestion(rowId, id, title) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;
  row.querySelector('.row-juego-search').value = `(${id}) ${title}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';

  const game = AppState.inventoryGames.find(g => String(g.id) === String(id));
  const selectCuenta = row.querySelector('.row-tipo-cuenta');
  if (game && selectCuenta) {
    Array.from(selectCuenta.options).forEach(opt => opt.style.display = 'block');
    const slots = getGameSlots(id);
    const disp = {
      p_ps4: Math.max(0, (slots.config.p_ps4 || 0) - (slots.used.p_ps4 || 0)),
      p_ps5: Math.max(0, (slots.config.p_ps5 || 0) - (slots.used.p_ps5 || 0))
    };
    Array.from(selectCuenta.options).forEach(opt => {
      const val = opt.value;
      if (!val) return;
      if (!game.es_ps4 && val.includes('PS4')) opt.style.display = 'none';
      if (!(game.es_ps5 || game.es_ps4) && val.includes('PS5')) opt.style.display = 'none';
      if (opt.style.display !== 'none') {
        if (val === 'Primaria PS4' && disp.p_ps4 <= 0) opt.style.display = 'none';
        if (val === 'Secundaria PS4' && disp.p_ps4 > 0) opt.style.display = 'none';
        if (val === 'Primaria PS5' && disp.p_ps5 <= 0) opt.style.display = 'none';
        if (val === 'Secundaria PS5' && disp.p_ps5 > 0) opt.style.display = 'none';
      }
    });
    if (selectCuenta.selectedOptions[0] && selectCuenta.selectedOptions[0].style.display === 'none') selectCuenta.value = '';
  }
  selectCuenta.focus();
}

export function hasInventoryAvailability(item, field) {
  return val_hasInventoryAvailability(item, field);
}

export function handleVentaPaqueteAutocomplete(input, rowId) {
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
    const slots = getPaqueteSlots(p.id);
    return (Math.max(0, slots.config.p_ps4 - slots.used.p_ps4) + Math.max(0, slots.config.s_ps4 - slots.used.s_ps4) + Math.max(0, slots.config.p_ps5 - slots.used.p_ps5) + Math.max(0, slots.config.s_ps5 - slots.used.s_ps5)) > 0;
  });
  if (matches.length === 0) { container.style.display = 'none'; return; }
  container.innerHTML = matches.map(p => {
    const slots = getPaqueteSlots(p.id);
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
    if (slots.config.p_ps4 > 0 || slots.config.s_ps4 > 0) htmlSlots += `<div><span style="color:${colP4P}">${disp.p4} P.PS4</span> <span style="color:${colP4S}">${disp.s4} S.PS4</span></div>`;
    if (slots.config.p_ps5 > 0 || slots.config.s_ps5 > 0) htmlSlots += `<div><span style="color:${colP5P}">${disp.p5} P.PS5</span> <span style="color:${colP5S}">${disp.s5} S.PS5</span></div>`;
    htmlSlots += '</div>';
    return `<div class="autocomplete-suggestion" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px;" onclick="selectVentaPaqueteSuggestion('${rowId}', '${p.id}', '${(p.nombre || '').replace(/'/g, "\\'")}')">
      <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><span style="font-size:0.7rem; color:#ec4899;">#${p.id}</span> <span style="font-size:0.8rem; font-weight:500; color:#fff;">${p.nombre}</span></div>
      <div style="margin-left:10px;">${htmlSlots}</div>
    </div>`;
  }).join('');
  container.style.display = 'block';
}

export function selectVentaPaqueteSuggestion(rowId, id, title) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;
  row.querySelector('.row-paquete-search').value = `(${id}) ${title}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';
  const selectCuenta = row.querySelector('.row-tipo-cuenta');
  if (!selectCuenta) return;
  const slots = getPaqueteSlots(id);
  let optionsHtml = '<option value="">-- Selecciona Cuenta --</option>';
  const disp = {
    p4: Math.max(0, slots.config.p_ps4 - slots.used.p_ps4),
    s4: Math.max(0, slots.config.s_ps4 - slots.used.s_ps4),
    p5: Math.max(0, slots.config.p_ps5 - slots.used.p_ps5),
    s5: Math.max(0, slots.config.s_ps5 - slots.used.s_ps5)
  };
  [{v:'Primaria PS4',d:'p4'},{v:'Secundaria PS4',d:'s4'},{v:'Primaria PS5',d:'p5'},{v:'Secundaria PS5',d:'s5'}].forEach(m => {
    if (disp[m.d] > 0) {
      if ((m.v === 'Secundaria PS4' && disp.p4 > 0) || (m.v === 'Secundaria PS5' && disp.p5 > 0)) return;
      optionsHtml += `<option value="${m.v}">${m.v}</option>`;
    }
  });
  selectCuenta.innerHTML = optionsHtml;
}

export function handleVentaMembresiaAutocomplete(input, rowId) {
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
    const slots = getMembresiaSlots(m.id);
    return (Math.max(0, slots.config.p_ps4 - slots.used.p_ps4) + Math.max(0, slots.config.s_ps4 - slots.used.s_ps4) + Math.max(0, slots.config.p_ps5 - slots.used.p_ps5) + Math.max(0, slots.config.s_ps5 - slots.used.s_ps5)) > 0;
  });
  if (matches.length === 0) { container.style.display = 'none'; return; }
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
    return `<div class="autocomplete-suggestion" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px;" onclick="selectVentaMembresiaSuggestion('${rowId}', '${m.id}', '${(m.tipo || '').replace(/'/g, "\\'")}')">
      <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><span style="font-size:0.7rem; color:#f59e0b;">#${m.id}</span> <span style="font-size:0.8rem; font-weight:500; color:#fff;">${m.tipo}</span><div style="font-size:0.65rem; color:${calculateMembershipCountdown(m) <= 5 ? '#ef4444' : '#9ca3af'}; font-style:italic; margin-top:2px;">â³ ${formatDaysToMonths(calculateMembershipCountdown(m))} restantes</div></div>
      <div style="margin-left:10px;">${htmlSlots}</div>
    </div>`;
  }).join('');
  container.style.display = 'block';
}

export function selectVentaMembresiaSuggestion(rowId, id, title) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;
  row.querySelector('.row-membresia-search').value = `(${id}) ${title}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';
  const selectCuenta = row.querySelector('.row-tipo-cuenta');
  if (!selectCuenta) return;
  const slots = getMembresiaSlots(id);
  let optionsHtml = '<option value="">-- Selecciona Cuenta --</option>';
  const disp = {
    p4: Math.max(0, slots.config.p_ps4 - slots.used.p_ps4),
    s4: Math.max(0, slots.config.s_ps4 - slots.used.s_ps4),
    p5: Math.max(0, slots.config.p_ps5 - slots.used.p_ps5),
    s5: Math.max(0, slots.config.s_ps5 - slots.used.s_ps5)
  };
  [{v:'Primaria PS4',d:'p4'},{v:'Secundaria PS4',d:'s4'},{v:'Primaria PS5',d:'p5'},{v:'Secundaria PS5',d:'s5'}].forEach(m => {
    if (disp[m.d] > 0) {
      if ((m.v === 'Secundaria PS4' && disp.p4 > 0) || (m.v === 'Secundaria PS5' && disp.p5 > 0)) return;
      optionsHtml += `<option value="${m.v}">${m.v}</option>`;
    }
  });
  selectCuenta.innerHTML = optionsHtml;
}

export function handleVentaCodigoAutocomplete(input, rowId) {
  const container = document.getElementById(`suggestions-${rowId}`);
  const val = input.value.trim().toLowerCase();
  if (!val) {
    container.style.display = 'none';
    const row = document.getElementById(`row-${rowId}`);
    if (row) row.querySelector('.row-inventory-id').value = '';
    return;
  }
  const activeCod = (AppState.inventoryCodes || []).filter(c => c.estado === 'ON' && !c.usado);
  const matches = activeCod.filter(c => String(c.id).toLowerCase().includes(val) || (c.codigo && c.codigo.toLowerCase().includes(val)) || (c.juego && c.juego.toLowerCase().includes(val)));
  if (matches.length === 0) { container.style.display = 'none'; return; }
  container.innerHTML = matches.map(c => `<div class="autocomplete-suggestion" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px;" onclick="selectVentaCodigoSuggestion('${rowId}', '${c.id}', '${(c.juego || '').replace(/'/g, "\\'")}')">
    <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><span style="font-size:0.7rem; color:var(--accent-purple);">#${c.id}</span> <span style="font-size:0.8rem; font-weight:500; color:#fff;">${c.juego}</span></div>
    <div><span style="color:#10b981; font-size:0.65rem;">Disponible</span></div>
  </div>`).join('');
  container.style.display = 'block';
}

export function selectVentaCodigoSuggestion(rowId, id, title) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;
  row.querySelector('.row-codigo-search').value = `(${id}) ${title}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';
}

export function handleVentaXboxAutocomplete(input, rowId) {
  const container = document.getElementById(`suggestions-${rowId}`);
  const val = input.value.trim().toLowerCase();
  if (!val) { container.style.display = 'none'; return; }
  const matches = (AppState.xboxInventory || []).filter(x => x.estado === 'ON' && (String(x.id).toLowerCase().includes(val) || (x.detalle && x.detalle.toLowerCase().includes(val)))).slice(0, 10);
  if (matches.length === 0) { container.style.display = 'none'; return; }
  container.innerHTML = matches.map(x => `<div class="autocomplete-suggestion" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px;" onclick="selectVentaXboxSuggestion('${rowId}', '${x.id}', '${x.detalle.replace(/'/g, "\\'")}')">
    <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><span style="font-size:0.7rem; color:#888;">#${x.id}</span> <span style="font-size:0.8rem; font-weight:500; color:#fff;">${x.detalle}</span></div>
    <div><span style="color:#107c10; font-size:0.65rem;">Xbox ON</span></div>
  </div>`).join('');
  container.style.display = 'block';
}

export function selectVentaXboxSuggestion(rowId, id, detail) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;
  row.querySelector('.row-xbox-search').value = `(${id}) ${detail}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';
}

export function handleVentaPhysicalAutocomplete(input, rowId) {
  const container = document.getElementById(`suggestions-${rowId}`);
  const val = input.value.trim().toLowerCase();
  if (!val) { container.style.display = 'none'; return; }
  const matches = (AppState.physicalInventory || []).filter(p => p.estado === 'ON' && (String(p.id).toLowerCase().includes(val) || (p.detalle && p.detalle.toLowerCase().includes(val)))).slice(0, 10);
  if (matches.length === 0) { container.style.display = 'none'; return; }
  container.innerHTML = matches.map(p => `<div class="autocomplete-suggestion" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px;" onclick="selectVentaPhysicalSuggestion('${rowId}', '${p.id}', '${p.detalle.replace(/'/g, "\\'")}')">
    <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><span style="font-size:0.7rem; color:#888;">#${p.id}</span> <span style="font-size:0.8rem; font-weight:500; color:#fff;">${p.detalle}</span></div>
    <div><span style="color:#2dd4bf; font-size:0.65rem;">Physical ON</span></div>
  </div>`).join('');
  container.style.display = 'block';
}

export function selectVentaPhysicalSuggestion(rowId, id, detail) {
  const row = document.getElementById(`row-${rowId}`);
  if (!row) return;
  row.querySelector('.row-physical-search').value = `(${id}) ${detail}`;
  row.querySelector('.row-inventory-id').value = id;
  document.getElementById(`suggestions-${rowId}`).style.display = 'none';
}

export function openModalVenta(id = null) {
  const containers = ['ventaGameRowsContainer','ventaPaquetesRowsContainer','ventaMembresiasRowsContainer','ventaCodigosRowsContainer','ventaXboxRowsContainer','ventaPhysicalRowsContainer'];
  containers.forEach(c => { const el = document.getElementById(c); if (el) el.innerHTML = ''; });
  if (id) {
    const v = AppState.sales.find(s => String(s.id) === String(id));
    if (v) {
      document.getElementById('modalVentaTitle').innerHTML = '<i data-lucide="edit-3" class="minimalist-icon"></i> Editar Venta';
      document.getElementById('ventaFormId').value = v.id;
      document.getElementById('ventaFormClienteNombre').value = v.nombre_cliente || '';
      document.getElementById('ventaFormCedula').value = v.cedula || '';
      document.getElementById('ventaFormCelular').value = v.celular || '';
      document.getElementById('ventaFormEmail').value = v.correo || '';
      document.getElementById('ventaFormPago').value = v.pago || 'Nequi';
      document.getElementById('ventaFormTipoCliente').value = v.tipo_cliente || 'ðŸ’™ PUBLICIDAD';
      document.getElementById('ventaFormCiudad').value = v.ciudad || '';
      document.getElementById('ventaFormNota').value = v.nota || '';
      const lSel = document.getElementById('ventaFormLista');
      if (lSel) {
        lSel.innerHTML = '<option value="">-- Sin lista --</option>';
        (AppState.listas || []).forEach(L => { lSel.innerHTML += `<option value="${L.id}">${L.nombre}</option>`; });
        lSel.value = v.lista || '';
      }
      document.getElementById('ventaFormVendedor1').value = v.vendedor1 || v.vendedor || 'ADMIN';
      document.getElementById('ventaFormVendedor2').value = v.vendedor2 || '';
      const pD = { inventoryId: v.inventoryId, tipo_cuenta: v.tipo_cuenta, venta: v.venta };
      if (v.productType === 'paquete') addVentaPaqueteRow(pD, true);
      else if (v.productType === 'membresia') addVentaMembresiaRow(pD, true);
      else if (v.productType === 'xbox') addVentaXboxRow(pD, true);
      else if (v.productType === 'physical') addVentaPhysicalRow(pD, true);
      else addVentaGameRow(pD, true);
    }
  } else {
    document.getElementById('modalVentaTitle').innerHTML = '<i data-lucide="plus-circle" class="minimalist-icon"></i> Nueva Venta';
    document.getElementById('ventaFormId').value = '';
    ['ventaFormClienteNombre','ventaFormCedula','ventaFormCelular','ventaFormEmail','ventaFormCiudad','ventaFormNota'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('ventaFormPago').value = 'Nequi';
    document.getElementById('ventaFormTipoCliente').value = 'ðŸ’™ PUBLICIDAD';
    const lSel = document.getElementById('ventaFormLista');
    if (lSel) {
      lSel.innerHTML = '<option value="">-- Sin lista --</option>';
      (AppState.listas || []).forEach(L => { lSel.innerHTML += `<option value="${L.id}">${L.nombre}</option>`; });
      lSel.value = '';
    }
    document.getElementById('ventaFormVendedor1').value = AppState.currentUser?.name || 'ADMIN';
    document.getElementById('ventaFormVendedor2').value = '';
  }
  if (window.lucide) window.lucide.createIcons();
  document.getElementById('modalVentaOverlay').classList.add('show');
}

export function closeModalVenta() { document.getElementById('modalVentaOverlay').classList.remove('show'); }

export function addVentaGameRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaGameRowsContainer');
  const rowId = Date.now() + Math.floor(Math.random() * 1000);
  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box';
  rowDiv.id = `row-${rowId}`;
  let gT = '';
  if (data?.inventoryId) {
    const g = AppState.inventoryGames.find(ag => String(ag.id) === String(data.inventoryId));
    gT = g ? `(${g.id}) ${g.juego}` : data.inventoryId;
  }
  rowDiv.innerHTML = `
    <div class="form-group" style="position:relative; grid-column:1/-1; margin-bottom:5px;">
      <label>Título del Juego / ID</label>
      <input type="text" class="scraping-input row-juego-search" placeholder="Buscar..." value="${gT}" oninput="handleVentaGameAutocomplete(this, '${rowId}')" autocomplete="off" style="width:100%;">
      <input type="hidden" class="row-inventory-id" value="${data?.inventoryId || ''}">
      <input type="hidden" class="row-product-type" value="game">
      <div id="suggestions-${rowId}" class="autocomplete-suggestions"></div>
    </div>
    <div class="form-group"><label>Cuenta</label><select class="form-select row-tipo-cuenta" style="width:100%; height:38px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.1); border-radius:6px;">
      <option value="">--</option>
      <option value="Primaria PS4" ${data?.tipo_cuenta === 'Primaria PS4' ? 'selected' : ''}>P. PS4</option>
      <option value="Secundaria PS4" ${data?.tipo_cuenta === 'Secundaria PS4' ? 'selected' : ''}>S. PS4</option>
      <option value="Primaria PS5" ${data?.tipo_cuenta === 'Primaria PS5' ? 'selected' : ''}>P. PS5</option>
      <option value="Secundaria PS5" ${data?.tipo_cuenta === 'Secundaria PS5' ? 'selected' : ''}>S. PS5</option>
    </select></div>
    <div class="form-group"><label>Valor ($)</label><input type="number" class="scraping-input row-precio" placeholder="COP" value="${data?.venta || ''}" style="width:100%;"></div>
    <div style="display:flex; align-items:center;">
      ${!isEdit ? `<button type="button" onclick="removeVentaGameRow('${rowId}')" class="btn-remove-game" title="Quitar"><i data-lucide="trash-2" class="minimalist-icon"></i></button>` : `<div style="width:38px;"></div>`}
    </div>`;
  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}
export function removeVentaGameRow(id) { const el = document.getElementById(`row-${id}`); if (el) el.remove(); }

export function addVentaPaqueteRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaPaquetesRowsContainer');
  const rowId = 'paq_' + Date.now() + Math.floor(Math.random() * 1000);
  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box'; rowDiv.id = `row-${rowId}`;
  let iT = ''; if (data?.inventoryId) { const p = AppState.paquetes.find(ag => String(ag.id) === String(data.inventoryId)); iT = p ? `(${p.id}) ${p.nombre}` : data.inventoryId; }
  rowDiv.innerHTML = `
    <div class="form-group" style="position:relative; grid-column:1/-1; margin-bottom:5px;">
      <label style="color:#ec4899;">Paquete / ID</label>
      <input type="text" class="scraping-input row-paquete-search" placeholder="Buscar..." value="${iT}" oninput="handleVentaPaqueteAutocomplete(this, '${rowId}')" autocomplete="off" style="width:100%; border-color:rgba(236,72,153,0.3);">
      <input type="hidden" class="row-inventory-id" value="${data?.inventoryId || ''}"><input type="hidden" class="row-product-type" value="paquete">
      <div id="suggestions-${rowId}" class="autocomplete-suggestions"></div>
    </div>
    <div class="form-group"><label>Cuenta</label><select class="form-select row-tipo-cuenta" style="width:100%; height:38px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.1); border-radius:6px;">
      <option value="">--</option>${data?.tipo_cuenta ? `<option value="${data.tipo_cuenta}" selected>${data.tipo_cuenta}</option>` : ''}
    </select></div>
    <div class="form-group"><label>Valor ($)</label><input type="number" class="scraping-input row-precio" placeholder="COP" value="${data?.venta || ''}" style="width:100%;"></div>
    <div style="display:flex; align-items:center;"><button type="button" onclick="removeVentaPaqueteRow('${rowId}')" class="btn-remove-game" title="Quitar"><i data-lucide="trash-2" class="minimalist-icon" style="color:#ec4899;"></i></button></div>`;
  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}
export function removeVentaPaqueteRow(id) { const el = document.getElementById(`row-${id}`); if (el) el.remove(); }

export function addVentaMembresiaRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaMembresiasRowsContainer');
  const rowId = 'mem_' + Date.now() + Math.floor(Math.random() * 1000);
  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box'; rowDiv.id = `row-${rowId}`;
  let iT = ''; if (data?.inventoryId) { const m = AppState.membresias.find(ag => String(ag.id) === String(data.inventoryId)); iT = m ? `(${m.id}) ${m.tipo}` : data.inventoryId; }
  rowDiv.innerHTML = `
    <div class="form-group" style="position:relative; grid-column:1/-1; margin-bottom:5px;">
      <label style="color:#f59e0b;">Membresía / ID</label>
      <input type="text" class="scraping-input row-membresia-search" placeholder="Buscar..." value="${iT}" oninput="handleVentaMembresiaAutocomplete(this, '${rowId}')" autocomplete="off" style="width:100%; border-color:rgba(245,158,11,0.3);">
      <input type="hidden" class="row-inventory-id" value="${data?.inventoryId || ''}"><input type="hidden" class="row-product-type" value="membresia">
      <div id="suggestions-${rowId}" class="autocomplete-suggestions"></div>
    </div>
    <div class="form-group"><label>Cuenta</label><select class="form-select row-tipo-cuenta" style="width:100%; height:38px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.1); border-radius:6px;">
      <option value="">--</option>${data?.tipo_cuenta ? `<option value="${data.tipo_cuenta}" selected>${data.tipo_cuenta}</option>` : ''}
    </select></div>
    <div class="form-group"><label>Valor ($)</label><input type="number" class="scraping-input row-precio" placeholder="COP" value="${data?.venta || ''}" style="width:100%;"></div>
    <div style="display:flex; align-items:center;"><button type="button" onclick="removeVentaMembresiaRow('${rowId}')" class="btn-remove-game" title="Quitar"><i data-lucide="trash-2" class="minimalist-icon" style="color:#f59e0b;"></i></button></div>`;
  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}
export function removeVentaMembresiaRow(id) { const el = document.getElementById(`row-${id}`); if (el) el.remove(); }

export function addVentaXboxRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaXboxRowsContainer');
  const rowId = 'xbox_' + Date.now() + Math.floor(Math.random() * 1000);
  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box'; rowDiv.id = `row-${rowId}`;
  rowDiv.style.cssText = 'display:grid; grid-template-columns:1fr auto auto auto; gap:10px; align-items:end;';
  let iT = ''; if (data?.inventoryId) { const x = (AppState.xboxInventory || []).find(it => String(it.id) === String(data.inventoryId)); iT = x ? `(${x.id}) ${x.detalle}` : data.inventoryId; }
  rowDiv.innerHTML = `
    <div class="form-group" style="position:relative; margin:0;"><label style="color:#107c10; font-size:0.75rem; margin-bottom:4px; display:block;">Xbox / Producto</label>
      <input type="text" class="scraping-input row-xbox-search" placeholder="Buscar..." value="${iT}" oninput="handleVentaXboxAutocomplete(this, '${rowId}')" autocomplete="off" style="width:100%; border-color:rgba(16,124,16,0.3);">
      <input type="hidden" class="row-inventory-id" value="${data?.inventoryId || ''}"><input type="hidden" class="row-product-type" value="xbox"><input type="hidden" class="row-tipo-cuenta" value="Xbox">
      <div id="suggestions-${rowId}" class="autocomplete-suggestions"></div>
    </div>
    <div class="form-group" style="margin:0;"><label style="color:var(--text-muted); font-size:0.75rem; margin-bottom:4px; display:block;">Precio ($)</label><input type="number" class="scraping-input row-precio" placeholder="COP" value="${data?.venta || ''}" style="width:100%; border-color:rgba(16,124,16,0.3);"></div>
    <div style="display:flex; align-items:center;"><button type="button" onclick="removeVentaXboxRow('${rowId}')" class="btn-remove-game" title="Quitar"><i data-lucide="trash-2" class="minimalist-icon" style="color:#107c10;"></i></button></div>`;
  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}
export function removeVentaXboxRow(id) { const el = document.getElementById(`row-${id}`); if (el) el.remove(); }

export function addVentaPhysicalRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaPhysicalRowsContainer');
  const rowId = 'phys_' + Date.now() + Math.floor(Math.random() * 1000);
  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box'; rowDiv.id = `row-${rowId}`;
  rowDiv.style.cssText = 'display:grid; grid-template-columns:1fr auto auto auto; gap:10px; align-items:end;';
  let iT = ''; if (data?.inventoryId) { const p = (AppState.physicalInventory || []).find(it => String(it.id) === String(data.inventoryId)); iT = p ? `(${p.id}) ${p.detalle}` : data.inventoryId; }
  rowDiv.innerHTML = `
    <div class="form-group" style="position:relative; margin:0;"><label style="color:#2dd4bf; font-size:0.75rem; margin-bottom:4px; display:block;">Producto Físico</label>
      <input type="text" class="scraping-input row-physical-search" placeholder="Buscar..." value="${iT}" oninput="handleVentaPhysicalAutocomplete(this, '${rowId}')" autocomplete="off" style="width:100%; border-color:rgba(45,212,191,0.3);">
      <input type="hidden" class="row-inventory-id" value="${data?.inventoryId || ''}"><input type="hidden" class="row-product-type" value="physical"><input type="hidden" class="row-tipo-cuenta" value="Fisico">
      <div id="suggestions-${rowId}" class="autocomplete-suggestions"></div>
    </div>
    <div class="form-group" style="margin:0;"><label style="color:var(--text-muted); font-size:0.75rem; margin-bottom:4px; display:block;">Precio ($)</label><input type="number" class="scraping-input row-precio" placeholder="COP" value="${data?.venta || ''}" style="width:100%; border-color:rgba(45,212,191,0.3);"></div>
    <div style="display:flex; align-items:center;"><button type="button" onclick="removeVentaPhysicalRow('${rowId}')" class="btn-remove-game" title="Quitar"><i data-lucide="trash-2" class="minimalist-icon" style="color:#2dd4bf;"></i></button></div>`;
  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}
export function removeVentaPhysicalRow(id) { const el = document.getElementById(`row-${id}`); if (el) el.remove(); }

export function addVentaCodigoRow(data = null, isEdit = false) {
  const container = document.getElementById('ventaCodigosRowsContainer');
  if (!container) return;
  const rowId = 'cod_' + Date.now() + Math.round(Math.random() * 1000);
  const rowDiv = document.createElement('div');
  rowDiv.className = 'game-row-box'; rowDiv.id = `row-${rowId}`;
  rowDiv.style.cssText = 'display:flex; gap:10px; align-items:flex-end; padding:10px; background:rgba(168,85,247,0.05); border:1px solid rgba(168,85,247,0.1); border-radius:8px; margin-bottom:8px;';
  const denoms = [...new Set((AppState.inventoryCodes || []).filter(c => c.estado === 'ON' && !c.usado).map(c => c.precioUsd))].sort((a,b) => a-b);
  rowDiv.innerHTML = `
    <div class="form-group" style="margin:0; flex:1;"><label style="color:var(--accent-purple); font-size:0.75rem; margin-bottom:4px; display:block;">Denominación (USD)</label>
      <select class="form-select row-codigo-denom" onchange="updateCodigoRowMax('${rowId}', this)" style="width:100%; height:38px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(168,85,247,0.3); border-radius:6px;">
        <option value="">-- Seleccionar --</option>
        ${denoms.map(d => `<option value="${d}" ${String(d) === String(data?.codigoDenom || '') ? 'selected' : ''} data-max="${(AppState.inventoryCodes||[]).filter(c => c.estado === 'ON' && !c.usado && String(c.precioUsd) === String(d)).length}">${d} USD</option>`).join('')}
      </select>
      <input type="hidden" class="row-product-type" value="codigo"><input type="hidden" class="row-inventory-id" value=""><input type="hidden" class="row-tipo-cuenta" value="Código">
    </div>
    <div class="form-group" style="margin:0; width:100px;"><label style="color:var(--text-muted); font-size:0.75rem; margin-bottom:4px; display:block;">Cantidad</label>
      <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border-radius:6px; border:1px solid rgba(168,85,247,0.3); overflow:hidden;">
        <button type="button" onclick="stepCodigo('${rowId}', -1)" style="width:30px; height:36px; border:none; background:transparent; color:#fff; cursor:pointer; font-weight:bold;">-</button>
        <input type="number" id="qty-${rowId}" class="row-codigo-qty" value="${data?.qty || 1}" readonly style="width:38px; height:36px; border:none; background:transparent; color:#fff; text-align:center; font-size:0.9rem; outline:none;">
        <button type="button" onclick="stepCodigo('${rowId}', 1)" style="width:30px; height:36px; border:none; background:transparent; color:#fff; cursor:pointer; font-weight:bold;">+</button>
      </div>
    </div>
    <div class="form-group" style="margin:0;"><label style="color:var(--text-muted); font-size:0.75rem; margin-bottom:4px; display:block;">Precio u. ($)</label><input type="number" class="scraping-input row-precio" placeholder="COP" value="${data?.venta || ''}" style="width:110px; border-color:rgba(168,85,247,0.3);"></div>
    <div style="display:flex; align-items:center; padding-bottom:1px;"><button type="button" onclick="removeVentaCodigoRow('${rowId}')" class="btn-remove-game" title="Quitar"><i data-lucide="trash-2" class="minimalist-icon" style="color:var(--accent-purple);"></i></button></div>`;
  container.appendChild(rowDiv);
  if (window.lucide) window.lucide.createIcons();
}
export function stepCodigo(rowId, delta) {
  const qtyInput = document.getElementById(`qty-${rowId}`);
  const row = document.getElementById(`row-${rowId}`); if (!qtyInput || !row) return;
  const denomSelect = row.querySelector('.row-codigo-denom');
  const selectedOpt = denomSelect ? denomSelect.options[denomSelect.selectedIndex] : null;
  const maxDisp = selectedOpt ? parseInt(selectedOpt.getAttribute('data-max') || '99') : 99;
  let current = parseInt(qtyInput.value) || 1;
  qtyInput.value = Math.min(Math.max(current + delta, 1), maxDisp);
}
export function updateCodigoRowMax(rowId, selectEl) {
  const qtyInput = document.getElementById(`qty-${rowId}`); if (!qtyInput) return;
  const selectedOpt = selectEl.options[selectEl.selectedIndex];
  const maxDisp = parseInt(selectedOpt?.getAttribute('data-max') || '99');
  qtyInput.value = Math.min(parseInt(qtyInput.value) || 1, maxDisp);
}
export function removeVentaCodigoRow(id) { const el = document.getElementById(`row-${id}`); if (el) el.remove(); }

export function getFieldFromCuentaExacta(val) {
  if (!val) return null;
  const map = {
    'Pri PS4 1': 'PS41Estado', 'Pri PS4 2': 'PS42Estado', 'Sec PS4': 'SecPS4Estado',
    'Pri PS5 1': 'PS51Estado', 'Pri PS5 2': 'PS52Estado', 'Sec PS5': 'SecPS5Estado',
    'Primaria PS4': 'PS41Estado', 'Secundaria PS4': 'SecPS4Estado',
    'Primaria PS5': 'PS51Estado', 'Secundaria PS5': 'SecPS5Estado'
  };
  if (map[val]) return map[val];
  const v = val.toLowerCase();
  if (v.includes('ps4') && v.includes('pri')) return 'cupos_ps4_primaria';
  if (v.includes('ps4') && v.includes('sec')) return 'cupos_ps4_secundaria';
  if (v.includes('ps5') && v.includes('pri')) return 'cupos_ps5_primaria';
  if (v.includes('ps5') && v.includes('sec')) return 'cupos_ps5_secundaria';
  return null;
}

export function saveVenta() {
  const vId = document.getElementById('ventaFormId').value;
  const rows = document.querySelectorAll('.game-row-box');
  if (rows.length === 0) { showToast('âš ï¸ No hay juegos agregados para vender.'); return; }
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
    vendedor: document.getElementById('ventaFormVendedor1').value,
    lista: document.getElementById('ventaFormLista').value,
    nota: document.getElementById('ventaFormNota').value
  };
  const t = getColombiaTime();
  const txId = 'TX-' + Date.now().toString().slice(-6);
  if (vId) {
    const row = rows[0];
    const invId = row.querySelector('.row-inventory-id').value;
    const tCuenta = row.querySelector('.row-tipo-cuenta').value;
    const precio = parseFloat(row.querySelector('.row-precio').value) || 0;
    const pType = row.querySelector('.row-product-type')?.value || 'game';
    if (!invId || !tCuenta) { showToast('âš ï¸ Completa los datos para editar.'); return; }
    const index = AppState.sales.findIndex(v => String(v.id) === String(vId));
    if (index !== -1) {
      const oldSale = AppState.sales[index];
      // Restaurar stock viejo
      if (oldSale.productType === 'paquete') {
        const oldP = AppState.paquetes.find(p => String(p.id) === String(oldSale.inventoryId));
        if (oldP) { const f = getFieldFromCuentaExacta(oldSale.tipo_cuenta); if (f) oldP[f] = 'Disponible'; }
      } else if (oldSale.productType === 'membresia') {
        const oldM = AppState.membresias.find(m => String(m.id) === String(oldSale.inventoryId));
        if (oldM) { const f = getFieldFromCuentaExacta(oldSale.tipo_cuenta); if (f) oldM[f] = 'Disponible'; }
      } else if (oldSale.productType === 'codigo') {
        const oldC = (AppState.inventoryCodes||[]).find(c => String(c.id) === String(oldSale.inventoryId));
        if (oldC) oldC.usado = false;
      } else if (oldSale.productType === 'xbox') {
        const oldX = (AppState.xboxInventory||[]).find(x => String(x.id) === String(oldSale.inventoryId));
        if (oldX) oldX.estado = 'ON';
      } else if (oldSale.productType === 'physical') {
        const oldPh = (AppState.physicalInventory||[]).find(p => String(p.id) === String(oldSale.inventoryId));
        if (oldPh) oldPh.estado = 'ON';
      }
      // Aplicar nuevo stock
      if (pType === 'paquete') {
        const newP = AppState.paquetes.find(p => String(p.id) === String(invId));
        if (newP) { const f = getFieldFromCuentaExacta(tCuenta); if (f) newP[f] = 'Vendido'; }
      } else if (pType === 'membresia') {
        const newM = AppState.membresias.find(m => String(m.id) === String(invId));
        if (newM) { const f = getFieldFromCuentaExacta(tCuenta); if (f) newM[f] = 'Vendido'; }
      } else if (pType === 'codigo') {
        const newC = (AppState.inventoryCodes||[]).find(c => String(c.id) === String(invId));
        if (newC) newC.usado = true;
      } else if (pType === 'xbox') {
        const newX = (AppState.xboxInventory||[]).find(x => String(x.id) === String(invId));
        if (newX) newX.estado = 'OFF';
      } else if (pType === 'physical') {
        const newPh = (AppState.physicalInventory||[]).find(p => String(p.id) === String(invId));
        if (newPh) newPh.estado = 'OFF';
      }
      AppState.sales[index] = { ...oldSale, ...commonData, inventoryId: invId, tipo_cuenta: tCuenta, venta: precio, productType: pType };
      logEvent('Venta Modificada', `ID: ${vId} | Cliente: ${commonData.correo}`);
      if (commonData.nombre_cliente) asignarClienteALista(commonData.nombre_cliente.toLowerCase(), commonData.lista);
      showToast('âœ… Venta actualizada correctamente');
    }
  } else {
    let countSaved = 0;
    if (commonData.nombre_cliente && commonData.lista) asignarClienteALista(commonData.nombre_cliente.toLowerCase(), commonData.lista);
    rows.forEach(row => {
      const pType = row.querySelector('.row-product-type')?.value || 'game';
      const precio = parseFloat(row.querySelector('.row-precio').value) || 0;
      if (pType === 'codigo') {
        const denom = row.querySelector('.row-codigo-denom')?.value;
        const qty = Math.max(1, parseInt(row.querySelector('.row-codigo-qty')?.value || '1'));
        if (!denom) { showToast('âš ï¸ Selecciona denominación.', 'warning'); return; }
        const codesDisp = (AppState.inventoryCodes || []).filter(c => c.estado === 'ON' && !c.usado && parseFloat(c.precioUsd) === parseFloat(denom));
        if (codesDisp.length < qty) { showToast(`âš ï¸ Solo hay ${codesDisp.length} disponibles.`, 'warning'); return; }
        for (let i = 0; i < qty; i++) {
          const isSplit = commonData.vendedor2 && commonData.vendedor2 !== commonData.vendedor1;
          const finalPrice = isSplit ? precio / 2 : precio;
          const gId = 'V-' + Math.random().toString(36).substr(2, 6).toUpperCase();
          AppState.sales.unshift({ ...commonData, id: gId, transaction_id: txId, fecha: t.date, hora: t.time, inventoryId: '', codigoDenom: denom, tipo_cuenta: 'Código', venta: finalPrice, productType: 'codigo', vendedor: commonData.vendedor1 });
          countSaved++;
          if (isSplit) {
            const gId2 = 'V-' + Math.random().toString(36).substr(2, 6).toUpperCase();
            AppState.sales.unshift({ ...commonData, id: gId2, transaction_id: txId, fecha: t.date, hora: t.time, inventoryId: '', codigoDenom: denom, tipo_cuenta: 'Código', venta: finalPrice, productType: 'codigo', vendedor: commonData.vendedor2, isPartiallyPaid: true });
            countSaved++;
          }
        }
      } else {
        const invId = row.querySelector('.row-inventory-id').value;
        const tCuenta = row.querySelector('.row-tipo-cuenta').value;
        if (invId && tCuenta) {
          if (pType === 'paquete') {
            const p = AppState.paquetes.find(x => String(x.id) === String(invId));
            if (p) { const f = getFieldFromCuentaExacta(tCuenta); if (f) p[f] = 'Vendido'; }
          } else if (pType === 'membresia') {
            const m = AppState.membresias.find(x => String(x.id) === String(invId));
            if (m) { const f = getFieldFromCuentaExacta(tCuenta); if (f) m[f] = 'Vendido'; }
          } else if (pType === 'xbox') {
            const x = (AppState.xboxInventory || []).find(it => String(it.id) === String(invId));
            if (x) x.estado = 'OFF';
          } else if (pType === 'physical') {
            const ph = (AppState.physicalInventory || []).find(it => String(it.id) === String(invId));
            if (ph) ph.estado = 'OFF';
          }
          const isSplit = commonData.vendedor2 && commonData.vendedor2 !== commonData.vendedor1;
          const finalPrice = isSplit ? precio / 2 : precio;
          const gId = 'V-' + Math.random().toString(36).substr(2, 6).toUpperCase();
          AppState.sales.unshift({ ...commonData, id: gId, transaction_id: txId, fecha: t.date, hora: t.time, inventoryId: invId, tipo_cuenta: tCuenta, venta: finalPrice, productType: pType, vendedor: commonData.vendedor1 });
          countSaved++;
          if (isSplit) {
            const gId2 = 'V-' + Math.random().toString(36).substr(2, 6).toUpperCase();
            AppState.sales.unshift({ ...commonData, id: gId2, transaction_id: txId, fecha: t.date, hora: t.time, inventoryId: invId, tipo_cuenta: tCuenta, venta: finalPrice, productType: pType, vendedor: commonData.vendedor2, isPartiallyPaid: true });
            countSaved++;
          }
        }
      }
    });
    if (countSaved === 0) { showToast('âš ï¸ Completa al menos un juego.'); return; }
    logEvent('Venta Creada', `TX: ${txId} | items: ${countSaved}`);
    showToast(`âœ… ${countSaved} registrados con éxito.`);
  }
  saveLocal(); renderVentas(); closeModalVenta(); updateDashboard(); renderInventoryJuegos();
}

export function deleteVenta(id) {
  showDeleteConfirmModal('¿Eliminar este registro?', () => {
    const v = AppState.sales.find(s => String(s.id) === String(id));
    if (v) {
      if (v.productType === 'paquete') {
        const p = AppState.paquetes.find(it => String(it.id) === String(v.inventoryId));
        if (p) { const f = getFieldFromCuentaExacta(v.tipo_cuenta); if (f) p[f] = 'Disponible'; }
      } else if (v.productType === 'membresia') {
        const m = AppState.membresias.find(it => String(it.id) === String(v.inventoryId));
        if (m) { const f = getFieldFromCuentaExacta(v.tipo_cuenta); if (f) m[f] = 'Disponible'; }
      } else if (v.productType === 'codigo') {
        const c = (AppState.inventoryCodes||[]).find(it => String(it.id) === String(v.inventoryId));
        if (c) c.usado = false;
      } else if (v.productType === 'xbox') {
        const x = (AppState.xboxInventory||[]).find(it => String(it.id) === String(v.inventoryId));
        if (x) x.estado = 'ON';
      } else if (v.productType === 'physical') {
        const ph = (AppState.physicalInventory||[]).find(it => String(it.id) === String(v.inventoryId));
        if (ph) ph.estado = 'ON';
      }
    }
    AppState.sales = AppState.sales.filter(v => String(v.id) !== String(id));
    logEvent('Venta Eliminada', `ID: ${id}`);
    renderVentas(); saveLocal(); updateDashboard(); showToast('Registro eliminado');
  });
}

export function openModalHistorialVentas(itemId) {
  let item = AppState.inventoryGames.find(g => String(g.id) === String(itemId)) || AppState.paquetes.find(p => String(p.id) === String(itemId)) || AppState.membresias.find(m => String(m.id) === String(itemId));
  if (!item) return;
  const itemName = item.juego || item.nombre || item.tipo || '';
  const modalTitle = document.getElementById('historialVentasTitle');
  const modalContent = document.getElementById('historialVentasContent');
  const overlay = document.getElementById('historialVentasOverlay');
  modalTitle.innerHTML = `<i class="fa-solid fa-chart-line" style="margin-right:10px; color:var(--accent-purple)"></i> Historial: <span style="color:var(--accent-cyan)">${itemName}</span>`;
  const itemSales = AppState.sales.filter(v => String(v.inventoryId) === String(itemId));
  if (itemSales.length === 0) {
    modalContent.innerHTML = `<div style="padding:60px 20px; text-align:center; color:rgba(255,255,255,0.2);"><i class="fa-solid fa-receipt" style="font-size:3.5rem; margin-bottom:20px; opacity:0.1;"></i><p>No hay ventas registradas.</p></div>`;
  } else {
    itemSales.sort((a,b) => new Date(b.fecha+' '+(b.hora||'00:00')) - new Date(a.fecha+' '+(a.hora||'00:00')));
    modalContent.innerHTML = `<table class="premium-table" style="width:100%;"><thead><tr><th>FECHA/HORA</th><th>CLIENTE</th><th>TIPO</th><th>PRECIO</th><th>VENDEDOR</th></tr></thead><tbody>
      ${itemSales.map(v => `<tr><td>${v.fecha}<br>${v.hora||'--'}</td><td>${v.nombre_cliente}<br>CC: ${v.cedula}</td><td>${v.tipo_cuenta}</td><td>${formatCOP(v.venta||0)}</td><td>${v.vendedor}</td></tr>`).join('')}
    </tbody></table>`;
  }
  overlay.classList.add('show');
}
export function closeModalHistorialVentas() { document.getElementById('historialVentasOverlay').classList.remove('show'); }

export function showFactura(id) {
  const v = AppState.sales.find(s => s.id === id); if (!v) return;
  const text = `CANGEL GAMES\nRecibo Venta\nCliente: ${v.nombre_cliente}\nTotal: ${formatCOP(v.venta||0)}`;
  document.getElementById('facturaText').textContent = text;
  document.getElementById('facturaOverlay').classList.add('show');
}
export function closeFactura() { document.getElementById('facturaOverlay').classList.remove('show'); }

export function autocompletarCliente(cedula) {
  const cedLimpia = (cedula || '').trim();
  if (!cedLimpia) return;
  const match = [...AppState.sales].reverse().find(v => (v.cedula || '').trim() === cedLimpia);
  if (match) {
    if (match.nombre_cliente) document.getElementById('ventaFormClienteNombre').value = match.nombre_cliente;
    if (match.celular) document.getElementById('ventaFormCelular').value = match.celular;
    if (match.correo) document.getElementById('ventaFormEmail').value = match.correo;
    if (match.ciudad) document.getElementById('ventaFormCiudad').value = match.ciudad;
    const cedulaInput = document.getElementById('ventaFormCedula');
    cedulaInput.style.borderColor = 'var(--accent-green)';
    cedulaInput.style.boxShadow = '0 0 0 2px rgba(57,249,150,0.2)';
    setTimeout(() => {
      cedulaInput.style.borderColor = '';
      cedulaInput.style.boxShadow = '';
    }, 1500);
  }
}

export function openModalPlantillas() { const modal = document.getElementById('modalPlantillasOverlay'); if (modal) { modal.classList.add('show'); cargarPlantillaSeleccionada(); } }
export function closeModalPlantillas() { const modal = document.getElementById('modalPlantillasOverlay'); if (modal) modal.classList.remove('show'); }
export function cargarPlantillaSeleccionada() { const selector = document.getElementById('plantillaSelector'); const textarea = document.getElementById('plantillaTextarea'); if (selector && textarea) { const tipo = selector.value; textarea.value = AppState.plantillas[tipo] || ''; } }
export function actualizarPanelVariables() { const selector = document.getElementById('plantillaSelector'); const panelInd = document.getElementById('variablesIndividual'); const panelMJ = document.getElementById('variablesMultiJuego'); const helper = document.getElementById('plantillaHelperText'); if (!selector) return; const esMulti = selector.value.startsWith('Multi-Juego'); if (panelInd) panelInd.style.display = esMulti ? 'none' : 'flex'; if (panelMJ) panelMJ.style.display = esMulti ? 'flex' : 'none'; if (helper) { helper.textContent = esMulti ? '* {JUEGOS_DETALLE} se reemplaza automáticamenhte por los bloques de cada juego del pedido.' : '* Las etiquetas como {CLIENTE} se reemplazarán por los datos reales de la venta.'; } }
export function guardarPlantilla() { const selector = document.getElementById('plantillaSelector'); const textarea = document.getElementById('plantillaTextarea'); if (selector && textarea) { const tipo = selector.value; const texto = textarea.value; AppState.plantillas[tipo] = texto; if (typeof saveLocal === 'function') saveLocal(); if (typeof showToast === 'function') showToast('Plantilla guardada correctamente'); closeModalPlantillas(); } }
export function insertarVariable(variableStr) { const textarea = document.getElementById('plantillaTextarea'); if (!textarea) return; const startPos = textarea.selectionStart; const endPos = textarea.selectionEnd; const textBefore = textarea.value.substring(0, startPos); const textAfter = textarea.value.substring(endPos, textarea.value.length); textarea.value = textBefore + variableStr + textAfter; textarea.selectionStart = startPos + variableStr.length; textarea.selectionEnd = startPos + variableStr.length; textarea.focus(); }

// --- MÓDULO CUENTAS PSN (SOLO VENDIDAS) ---
export function renderCuentasPSN() {
  const user = AppState.currentUser;
  if (!user) return;
  const tbody = document.getElementById('cuentasPsnBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const searchTerm = (document.getElementById('searchCuentasPsn')?.value || '').toLowerCase();
  
  const soldGames = (AppState.inventoryGames || []).filter(g => g.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(g.id) && s.productType === 'game')).map(x => ({ ...x, _itemType: 'game' }));
  const soldPaquetes = (AppState.paquetes || []).filter(p => p.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(p.id) && s.productType === 'paquete')).map(x => ({ ...x, _itemType: 'paquete' }));
  const soldMembresias = (AppState.membresias || []).filter(m => m.estado === 'Vendido' || AppState.sales.some(s => String(s.inventoryId) === String(m.id) && s.productType === 'membresia')).map(x => ({ ...x, _itemType: 'membresia' }));
  const allCuentas = [...soldGames, ...soldPaquetes, ...soldMembresias];
  
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
      <td class="row-number">${index + 1}</td>
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
        if (!c.es_ps4 && !c.es_ps5) return ''; 
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
          <option value="Sospechoso" ${status === 'Sospechoso' ? 'selected' : ''}>Sospechoso</option>
          <option value="Fallas Técnicas" ${status === 'Fallas Técnicas' ? 'selected' : ''}>Fallas Técnicas</option>
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
}

export function updateCuentaPsnStatus(id, newStatus) {
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

export function getGameSlots(gameId) {
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
