/* ============================================================ */
/* CATALOG & E-COMMERCE MODULE - Gestión del Carrito y Checkout */
/* ============================================================ */
import { AppState } from '../core/store.js';
import { getColombiaTime } from '../utils/formatters.js';
import { showPremiumAlert, showDeleteConfirmModal, showToast } from './modals.js';
import { saveLocal } from '../core/persistence.js';

/**
 * Renderiza el catálogo de productos (SPA)
 */
export function renderCatalog() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;
  grid.innerHTML = '';
  AppState.catalog.forEach(game => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <div class="game-img-container">
        <img src="${game.image}" class="game-img" alt="${game.nombre}" onerror="this.onerror=null; this.style.display='none';">
        ${game.sale < game.precioBase ? '<span class="game-badge">OFERTA</span>' : ''}
      </div>
      <div class="game-info">
        <h3 class="game-title">${game.nombre}</h3>
        <select class="consola-select" id="consola-${game.id}">
          <option value="PS4">PS4</option>
          <option value="PS5">PS5</option>
        </select>
        <div class="game-pricing-row">
          <span>PS4 <strong>$${Math.round(game.precio_ps4)}</strong></span>
          <span class="price-separator">/</span>
          <span>PS5 <strong>$${Math.round(game.precio_ps5)}</strong></span>
        </div>
        <button class="btn-add-cart-premium" onclick="addToCartFromCard(${game.id})">
          Añadir al carrito
        </button>
        ${AppState.currentUser?.role === 'admin' ? `
          <button class="btn-delete-game-abs" onclick="removeFromCatalog(${game.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        ` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}

/**
 * Elimina un registro del catálogo (Admin Only)
 */
export function removeFromCatalog(id) {
  showDeleteConfirmModal(
    '¿Estás seguro de eliminar este juego del catálogo?',
    () => {
      AppState.catalog = AppState.catalog.filter(g => g.id !== id);
      renderCatalog();
      if (typeof saveLocal === 'function') saveLocal();
      if (typeof showToast === 'function') showToast('Juego eliminado del catálogo', 'info');
    }
  );
}

/**
 * Interceptor para capturar la consola seleccionada antes de añadir al carrito
 */
export function addToCartFromCard(id) {
  const consoleVal = document.getElementById(`consola-${id}`).value;
  addToCart(id, consoleVal);
}

/**
 * Añade un item al carrito de AppState
 */
export function addToCart(id, console) {
  const game = AppState.catalog.find(g => g.id === id);
  if (!game) return;
  AppState.cart.push({ 
    ...game, 
    cartId: Date.now(), 
    console, 
    price: console === 'PS4' ? game.precio_ps4 : game.precio_ps5 
  });
  updateCartBadge();
  renderCart();
  // Abrir popup del carrito siempre al agregar
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('show');
}

/**
 * Alterna la visibilidad del Drawer del carrito
 */
export function toggleCart() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (drawer) drawer.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show');
}

/**
 * Renderiza los items actuales del carrito
 */
export function renderCart() {
  const container = document.getElementById('cartItems');
  if (!container) return;
  container.innerHTML = AppState.cart.length === 0 ? '<p>Vacío</p>' : '';
  let total = 0;
  AppState.cart.forEach(item => {
    total += item.price;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `<span>${item.nombre} (${item.console})</span><span>$${item.price}</span>`;
    container.appendChild(div);
  });
  const cartTotal = document.getElementById('cartTotal');
  if (cartTotal) cartTotal.textContent = `$${total.toFixed(2)}`;
}

/**
 * Actualiza el indicador numérico del carrito
 */
export function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (badge) badge.textContent = AppState.cart.length;
}

/**
 * Abre el modal de Checkout
 */
export function openCheckout() {
  if (AppState.cart.length === 0) return;
  const isClient = AppState.currentUser?.role === 'cliente';
  const groupCanal = document.getElementById('groupCanal');
  const groupSorteo = document.getElementById('groupSorteo');
  if (groupCanal) groupCanal.style.display = isClient ? 'none' : 'block';
  if (groupSorteo) groupSorteo.style.display = isClient ? 'none' : 'block';
  const overlay = document.getElementById('checkoutOverlay');
  if (overlay) overlay.classList.add('show');
}

/**
 * Cierra el modal de Checkout
 */
export function closeCheckout() {
  const overlay = document.getElementById('checkoutOverlay');
  if (overlay) overlay.classList.remove('show');
}

/**
 * Realiza la transacción final y mueve datos a AppState.sales
 */
export async function confirmCheckout() {
  const cliente = document.getElementById('ckNombre').value;
  if (!cliente) {
    await showPremiumAlert('Error', 'Nombre requerido', 'error');
    return;
  }
  const time = getColombiaTime();
  AppState.cart.forEach(item => {
    const newSale = {
      id: Date.now() + Math.random(),
      fecha: time.date,
      hora: time.time,
      cliente,
      juego: item.nombre,
      consola: item.console,
      precio: item.price,
      pago: document.getElementById('ckPago').value,
      asesor: AppState.currentUser.name,
      canal: (AppState.currentUser?.role === 'cliente') ? 'CLIENTE' : document.getElementById('ckCanal').value,
      estado: 'ENTREGADO',
      _searchIndex: `${(cliente || '')} ${(item.nombre || '')} ${(item.console || '')} ${(AppState.currentUser.name || '')}`.toLowerCase()
    };
    AppState.sales.unshift(newSale);
  });
  AppState.cart = [];
  updateCartBadge();
  closeCheckout();
  toggleCart();
  if (typeof saveLocal === 'function') saveLocal();
  await showPremiumAlert("Venta Exitosa", "¡La compra se ha registrado correctamente!", "success");
}

/**
 * Filtra el catálogo por texto de búsqueda
 */
export function filterCatalog() {
  renderCatalog();
}
