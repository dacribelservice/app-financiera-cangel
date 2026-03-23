/* ============================================================ */
/* ANALYSIS MODULE - Gestión de Auditoría de Precios e IA       */
/* ============================================================ */
import { AppState } from '../core/store.js';
import { apiFetchPSDetails } from '../services/api.js';
import { updateDashboard } from './dashboard.js';
import { showPremiumAlert, showPremiumPrompt } from './modals.js';

// NOTA: Estas funciones deben ser importadas desde app.js (main entry point)
import { saveLocal } from '../core/persistence.js';
import { renderCatalog } from './catalog.js';

/**
 * Extrae detalles de PlayStation Store usando IA (Gemini)
 */
export async function handleExtractAI() {
  const url = document.getElementById('urlAI').value.trim();
  if (!url) return;
  const status = document.getElementById('extractStatus');
  status.innerHTML = `<span class="status-loading"></span> Extrayendo con IA (Gemini)...`;
  try {
    const data = await apiFetchPSDetails(url);
    console.log('[IA-Extract] Raw Data:', data);
    if (data.error) throw new Error(data.error);
    if (!data.title) throw new Error('No se pudo extraer el título del juego');
    
    const normalizedData = {
      nombre: data.title || 'Juego Desconocido',
      imagen: data.image_url || '',
      precioBase: parseFloat((data.base_price || "0").replace(/[^\d.]/g, '')),
      precioSale: parseFloat((data.discount_price || data.base_price || "0").replace(/[^\d.]/g, '')),
      ps4: data.ps4 !== undefined ? data.ps4 : true,
      ps5: data.ps5 !== undefined ? data.ps5 : true,
      raw: data
    };
    processExtractionResult(normalizedData, url);
    renderGameCard(data);
    status.innerHTML = `<span style="color:var(--accent-cyan)">✨ Completado (IA)</span>`;
  } catch (e) {
    console.error('[IA-Error]', e);
    status.innerHTML = `<span style="color:var(--accent-red)">✖ Error: ${e.message}</span>`;
  }
}

/**
 * Procesa el resultado de la extracción y lo agrega al AppState.analysis
 */
function processExtractionResult(data, url) {
  const existingIndex = AppState.analysis.findIndex(a => a.nombre === data.nombre);
  const actualSale = (data.precioSale && data.precioSale > 0) ? data.precioSale : data.precioBase;
  const isNew = existingIndex < 0;
  const oldItem = !isNew ? AppState.analysis[existingIndex] : null;
  
  let compVal = actualSale;
  if (!isNew && oldItem.compra > 0) compVal = oldItem.compra;
  
  const inventoryMinPrices = {};
  (AppState.inventoryGames || []).forEach(g => {
    const title = (g.juego || '').toUpperCase().trim();
    const price = parseFloat(g.costoUsd);
    if (!isNaN(price) && title) {
      if (!inventoryMinPrices[title] || price < inventoryMinPrices[title]) {
        inventoryMinPrices[title] = price;
      }
    }
  });

  const titleMatch = (data.nombre || '').toUpperCase().trim();
  if (inventoryMinPrices[titleMatch] !== undefined) compVal = inventoryMinPrices[titleMatch];

  const costVal = Math.round(compVal * AppState.exchangeRate);
  const v4Val = !isNew ? oldItem.venta4 : 0;
  const pMinVal = v4Val > 0 ? Math.round(costVal / v4Val) : 0;
  const psnVal = Math.round(actualSale * AppState.exchangeRate);

  const analysisItem = {
    id: !isNew ? oldItem.id : Date.now(),
    url: url,
    image: data.imagen || 'https://via.placeholder.com/150',
    nombre: data.nombre,
    precioBase: data.precioBase || 0,
    sale: actualSale || 0,
    ps4: data.ps4 !== undefined ? data.ps4 : true,
    ps5: data.ps5 !== undefined ? data.ps5 : true,
    compra: compVal,
    costo: costVal,
    venta4: v4Val,
    pMinimo: pMinVal,
    ps4Price: !isNew ? oldItem.ps4Price : 0,
    ps5Price: !isNew ? oldItem.ps5Price : 0,
    psnUsd: psnVal,
    color: !isNew ? oldItem.color : '-'
  };

  if (!isNew) AppState.analysis[existingIndex] = analysisItem;
  else AppState.analysis.unshift(analysisItem);
  renderAnalysisTable();
  if (typeof saveLocal === 'function') saveLocal();
}

/**
 * Renderiza la tarjeta visual del juego extraído
 */
export function renderGameCard(data, size = 'medium') {
  const container = document.getElementById('extractionCardContainer');
  if (!container) return;
  const isXS = size === 'xs';
  const isSmall = size === 'small';
  const isMedium = size === 'medium';
  
  const savingsHtml = data.discount_percentage
    ? `<span style="color:#10b981; font-size:${isXS ? '0.6rem' : '0.8rem'}; font-weight:800; background:rgba(16,185,129,0.1); padding:2px 6px; border-radius:4px;">
        -${data.discount_percentage.replace(/[^0-9]/g, '')}%
       </span>`
    : '';

  const limit = isXS ? 0 : (isSmall ? 2 : 4);
  const versionsHtml = data.versions && limit > 0 ? data.versions.slice(0, limit).map(v => `
    <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:rgba(255,255,255,0.4); border-bottom:1px solid rgba(255,255,255,0.03);">
      <span>${v.name.length > (isSmall ? 20 : 40) ? v.name.substring(0, isSmall ? 20 : 40) + '...' : v.name}</span>
      <span style="color:#fff; font-weight:600;">${v.price}</span>
    </div>
  `).join('') : '';

  let cardStyle = `background:#0f172a; border:1px solid rgba(255,255,255,0.1); border-radius:12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-family:'Inter',sans-serif; position:relative; overflow:hidden; transition: all 0.2s ease;`;
  if (isXS) cardStyle += `display:flex; align-items:center; gap:10px; padding:8px 12px; max-width:320px;`;
  else if (isSmall) cardStyle += `display:grid; grid-template-columns:80px 1fr; gap:15px; padding:15px; max-width:400px;`;
  else cardStyle += `display:flex; flex-direction:column; gap:12px; padding:20px; max-width:480px;`;

  container.innerHTML = `
    <div class="card-premium-ai" style="${cardStyle}">
      <img src="${data.image_url || 'https://via.placeholder.com/80'}" 
           style="width:${isXS ? '35px' : (isSmall ? '80px' : '100%')}; height:${isXS ? '35px' : (isSmall ? '80px' : '150px')}; border-radius:8px; object-fit:cover; flex-shrink:0;">
      <div style="flex:1; min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h2 style="color:#fff; font-size:${isXS ? '0.85rem' : '1.1rem'}; margin:0; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.title || 'Juego'}</h2>
          ${!isMedium ? savingsHtml : ''}
        </div>
        ${isMedium ? `<p style="color:var(--accent-cyan); font-size:0.8rem; margin:2px 0; font-weight:700;">${data.publisher || 'Publisher'}</p>` : ''}
        <div style="display: flex; gap: 6px; margin: 8px 0;">
          ${data.ps4 && data.ps5 ?
      `<span style="background:rgba(0,112,204,0.15); color:#00a3ff; padding:2px 10px; border-radius:6px; font-size:0.65rem; font-weight:900; border:1px solid rgba(0,163,255,0.3); text-transform:uppercase; letter-spacing:0.5px;">PS4 | PS5</span>` :
      data.ps5 ?
        `<span style="background:rgba(255,255,255,0.1); color:#fff; padding:2px 10px; border-radius:6px; font-size:0.65rem; font-weight:900; border:1px solid rgba(255,255,255,0.2); text-transform:uppercase; letter-spacing:0.5px;">PS5 Only</span>` :
        data.ps4 ?
          `<span style="background:rgba(0,112,204,0.1); color:rgba(255,255,255,0.8); padding:2px 10px; border-radius:6px; font-size:0.65rem; font-weight:900; border:1px solid rgba(255,255,255,0.2); text-transform:uppercase; letter-spacing:0.5px;">PS4 Only</span>` : ''
    }
        </div>
        <div style="display:flex; align-items:baseline; gap:8px; margin-top:${isXS ? '0' : '4px'};">
          <span style="color:#fff; font-size:${isXS ? '1rem' : '1.6rem'}; font-weight:900;">${data.discount_price || data.base_price || '---'}</span>
          ${isMedium && data.discount_price && data.base_price !== data.discount_price ? `<span style="color:rgba(255,255,255,0.2); text-decoration:line-through; font-size:1rem;">${data.base_price}</span>` : ''}
          ${isMedium ? savingsHtml : ''}
        </div>
        ${!isXS && versionsHtml ? `<div style="margin-top:5px; border-top:1px solid rgba(255,255,255,0.05);">${versionsHtml}</div>` : ''}
      </div>
    </div>
  `;
  AppState.lastAIExtract = data;
}

/**
 * Agrega los resultados del análisis al catálogo real
 */
export async function addToCatalogFromAnalysis() {
  if (AppState.analysis.length === 0) {
    await showPremiumAlert('Catálogo', 'No hay datos para agregar', 'info');
    return;
  }
  const tbody = document.getElementById('tableBody');
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');
    const item = AppState.analysis[index];
    const precioVentaPS4 = parseFloat(cells[9].textContent.replace('$', '').replace(/\./g,'')) || 0;
    const precioVentaPS5 = parseFloat(cells[10].textContent.replace('$', '').replace(/\./g,'')) || 0;
    
    const catalogIndex = AppState.catalog.findIndex(c => c.nombre.trim().toLowerCase() === item.nombre.trim().toLowerCase());
    if (catalogIndex >= 0) {
      AppState.catalog[catalogIndex].precio_ps4 = precioVentaPS4 || item.sale;
      AppState.catalog[catalogIndex].precio_ps5 = precioVentaPS5 || item.sale;
      AppState.catalog[catalogIndex].image = item.image;
    } else {
      AppState.catalog.push({
        id: Date.now() + index,
        nombre: item.nombre,
        precio_ps4: precioVentaPS4 || item.sale,
        precio_ps5: precioVentaPS5 || item.sale,
        image: item.image
      });
    }
  });
  renderAnalysisTable();
  if (typeof renderCatalog === 'function') renderCatalog();
  if (typeof saveLocal === 'function') saveLocal();
  await showPremiumAlert("Catálogo", "Juegos agregados/actualizados en el catálogo correctamente", "success");
}

/**
 * Agrega una fila vacía para edición manual
 */
export function addEmptyRow() {
  AppState.analysis.unshift({
    id: Date.now(),
    image: 'https://via.placeholder.com/150',
    nombre: 'Nuevo Juego',
    precioBase: 0,
    sale: 0,
    ps4: true,
    ps5: true,
    compra: 0,
    costo: 0,
    venta4: 0,
    pMinimo: 0,
    ps4Price: 0,
    ps5Price: 0,
    psnUsd: 0,
    color: '-'
  });
  renderAnalysisTable();
  if (typeof saveLocal === 'function') saveLocal();
}

/**
 * Renderiza la tabla completa de auditoría de precios
 */
export function renderAnalysisTable() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const formatterCOP = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  });

  const inventoryMinPrices = {};
  (AppState.inventoryGames || []).forEach(g => {
    const title = (g.juego || '').toUpperCase().trim();
    const price = parseFloat(g.costoUsd);
    if (!isNaN(price) && title) {
      if (!inventoryMinPrices[title] || price < inventoryMinPrices[title]) {
        inventoryMinPrices[title] = price;
      }
    }
  });

  const colorOrder = { '-': 0, 'Verde': 1, 'Amarillo': 2, 'Rojo': 3 };
  AppState.analysis.sort((a, b) => (colorOrder[a.color] || 0) - (colorOrder[b.color] || 0));

  AppState.analysis.forEach((row, i) => {
    const tr = document.createElement('tr');
    if (row.color === 'Verde') tr.classList.add('row-pastel-verde');
    else if (row.color === 'Amarillo') tr.classList.add('row-pastel-amarillo');
    else if (row.color === 'Rojo') tr.classList.add('row-pastel-rojo');
    
    const titleMatch = (row.nombre || '').toUpperCase().trim();
    const historicoInv = inventoryMinPrices[titleMatch];
    if (historicoInv !== undefined) row.compra = historicoInv;
    row.costo = Math.round((row.compra || 0) * AppState.exchangeRate);
    const numVentas = parseFloat(row.venta4) || 0;
    row.pMinimo = numVentas > 0 ? Math.round(row.costo / numVentas) : 0;

    tr.innerHTML = `
      <td class="row-number-header">${i + 1}</td>
      <td class="img-cell">
        <div class="analysis-img-container">
          <img src="${row.image}" width="32" height="32" id="img-analysis-${row.id}">
          <button class="btn-edit-img" onclick="editAnalysisImage(${row.id})">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
        </div>
      </td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'nombre', this.innerText)">${row.nombre}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'precioBase', this.innerText)">$${row.precioBase}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'sale', this.innerText)" style="color:var(--accent-green)">$${row.sale}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'compra', this.innerText)" style="color: ${historicoInv !== undefined ? 'var(--accent-cyan)' : 'inherit'}; font-weight: ${historicoInv !== undefined ? 'bold' : 'normal'}">$${row.compra || 0}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'costo', this.innerText)">${formatterCOP.format(row.costo || 0)}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'venta4', this.innerText)">${row.venta4 || 0}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'pMinimo', this.innerText)">${formatterCOP.format(row.pMinimo || 0)}</td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'ps4Price', this.innerText)" class="${row.ps4 ? '' : 'version-x'}">
        ${row.ps4 ? '<i data-lucide="check-circle" style="color:var(--accent-green); width:14px; height:14px;"></i> ' + formatterCOP.format(row.ps4Price || 0) : '<i data-lucide="x-circle" style="color:var(--accent-red); width:14px; height:14px;"></i>'}
      </td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'ps5Price', this.innerText)" class="${(row.ps5 || row.ps4) ? '' : 'version-x'}">
        ${(row.ps5 || row.ps4) ? '<i data-lucide="check-circle" style="color:var(--accent-green); width:14px; height:14px;"></i> ' + formatterCOP.format(row.ps5Price || 0) : '<i data-lucide="x-circle" style="color:var(--accent-red); width:14px; height:14px;"></i>'}
      </td>
      <td contenteditable="true" onblur="updateAnalysisData(${row.id}, 'psnUsd', this.innerText)">${formatterCOP.format(row.psnUsd || 0)}</td>
      <td>
        <select class="color-select-premium" onchange="updateAnalysisData(${row.id}, 'color', this.value)">
          <option value="-" ${(!row.color || row.color === '-') ? 'selected' : ''}>-</option>
          <option value="Verde" ${row.color === 'Verde' ? 'selected' : ''}>Verde</option>
          <option value="Amarillo" ${row.color === 'Amarillo' ? 'selected' : ''}>Amarillo</option>
          <option value="Rojo" ${row.color === 'Rojo' ? 'selected' : ''}>Rojo</option>
        </select>
      </td>
      <td><button class="btn-icon-only" onclick="deleteAnalysis(${row.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button></td>
    `;
    tbody.appendChild(tr);
  });
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Edita la imagen de un elemento en el análisis
 */
export async function editAnalysisImage(id) {
  const url = await showPremiumPrompt('Imagen del Juego', 'Pega el enlace de la imagen a continuación:', 'URL de la Imagen:');
  if (url) {
    const item = AppState.analysis.find(a => a.id === id);
    if (item) {
      item.image = url;
      renderAnalysisTable();
      if (typeof saveLocal === 'function') saveLocal();
    }
  }
}

/**
 * Actualiza dinámicamente los datos de una celda en el análisis
 */
export function updateAnalysisData(id, field, val) {
  const item = AppState.analysis.find(a => a.id === id);
  if (item) {
    let cleanVal = val.replace(/[^\d.]/g, '').trim();
    const numericFields = ['precioBase', 'sale', 'compra', 'costo', 'venta4', 'pMinimo', 'ps4Price', 'ps5Price', 'psnUsd'];
    if (numericFields.includes(field)) {
      let numVal = parseFloat(cleanVal) || 0;
      if (['venta4'].includes(field)) numVal = Math.round(numVal);
      item[field] = numVal;
      if (field === 'compra' || item.costo === 0) item.costo = Math.round(item.compra * AppState.exchangeRate);
      if (field === 'sale' || item.psnUsd === 0) item.psnUsd = Math.round(item.sale * AppState.exchangeRate);
      if (['compra', 'costo', 'venta4'].includes(field) || item.pMinimo === 0) {
        const numVentas = parseFloat(item.venta4) || 0;
        item.pMinimo = numVentas > 0 ? Math.round(item.costo / numVentas) : 0;
      }
    } else {
      item[field] = val;
    }
    // logEvent si existe (se asume global o inyectado)
    if (window.logEvent) window.logEvent('Análisis: Modificado', `Juego: ${item.nombre} | Campo: ${field}`);
    if (typeof saveLocal === 'function') saveLocal();
  }
}

/**
 * Elimina un registro del análisis
 */
export function deleteAnalysis(id) {
  AppState.analysis = AppState.analysis.filter(a => a.id !== id);
  renderAnalysisTable();
  if (typeof saveLocal === 'function') saveLocal();
}

/**
 * Actualiza la TRM global y recalcula todos los precios del análisis
 */
export function updateGlobalTRM(val) {
  const trm = parseFloat(val);
  if (isNaN(trm) || trm <= 0) return;
  AppState.exchangeRate = trm;
  AppState.analysis.forEach(item => {
    item.costo = Math.round((item.compra || 0) * trm);
    const numVentas = parseFloat(item.venta4) || 0;
    item.pMinimo = numVentas > 0 ? Math.round(item.costo / numVentas) : 0;
    item.psnUsd = Math.round((item.sale || 0) * trm);
  });
  if (AppState.activeTab === 'dashboard' && typeof updateDashboard === 'function') updateDashboard();
  if (AppState.activeTab === 'analisis') renderAnalysisTable();
  if (typeof saveLocal === 'function') saveLocal();
}
