import { AppState } from '../core/store.js';
import { apiFetchClientes } from '../services/api.js';
import { asignarClienteALista } from '../app.js';

/**
 * Fase 5.1c: Módulo de Clientes & CRM (Lectura y Renderizado)
 */

let _clientsCurrentPage = 0;
let _clientsTotalPages = 0;
const _clientsLimit = 50;
let _activeClientTab = 'historial';

export function renderClientsHistoryTable(data) {
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
    const opcionesLista = `<option value="">—— Sin lista ——</option>` +
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

export function switchClientTab(tab) {
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

export function renderListas() {
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
  
  listas.forEach(lista => {
    const clientesEnLista = allClients.filter(c => {
      const key = (c.nombre || '').toLowerCase();
      return clientsListas[key] === lista.id;
    });
    
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
        <td>--</td>
      `;
      tbody.appendChild(tr);
    });
  });
  if (window.lucide) window.lucide.createIcons();
}

export async function fetchClientesPage(page = 0) {
  const loading = document.getElementById('clientsLoadingIndicator');
  if (loading) loading.style.display = 'inline-flex';
  try {
    const result = await apiFetchClientes(page, _clientsLimit);
    _clientsCurrentPage = result.page;
    _clientsTotalPages = Math.ceil(result.total / result.limit);
    
    const mappedClients = result.clientes.map(c => ({
      nombre: c.nombre,
      cc: c.cedula || '--',
      ciudad: c.ciudad || '--',
      celular: c.celular || '--',
      totalComprasCOP: 0,
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

export function updatePaginationUI() {
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

export function changeClientsPage(delta) {
  const next = _clientsCurrentPage + delta;
  if (next < 0 || (next >= _clientsTotalPages && _clientsTotalPages > 0)) return;
  fetchClientesPage(next);
}

export function renderClientHistory() {
  fetchClientesPage(0);
}

export function filterClients(searchText) {
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
