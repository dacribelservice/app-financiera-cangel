/* ================================================
   CANGEL GAMES ERP — Validadores (V1.0)
   ================================================ */

/**
 * Validador de correo duplicado en el inventario de juegos.
 * @param {string} email - Correo a validar.
 * @param {Array} inventoryGames - Lista de juegos en inventario (AppState.inventoryGames).
 * @param {string|number} editId - ID del juego que se está editando (para omitir).
 * @returns {boolean} - true si el correo ya existe en otro registro.
 */
export function isValidDuplicateEmail(email, inventoryGames, editId) {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  return (inventoryGames || []).some(game =>
    game.correo?.toLowerCase() === normalizedEmail && game.id != editId
  );
}

/**
 * Validador de disponibilidad en campos de inventario.
 * @param {Object} item - El objeto que contiene el estado.
 * @param {string} field - Nombre del campo a revisar (ej: 'PS41Estado').
 * @returns {boolean} - true si el estado es 'Disponible'.
 */
export function hasInventoryAvailability(item, field) {
  return item && item[field] === 'Disponible';
}

/**
 * Validador de stock bajo para notificaciones.
 * @param {Array} games - Lista de juegos en inventario.
 * @param {number} threshold - Umbral de stock bajo (default 3).
 * @returns {Object} - Objeto con resumen de alertas.
 */
export function isInventoryLow(games, threshold = 3) {
  if (!Array.isArray(games)) return { count: 0, titles: [] };

  const stockCounts = {};
  games.forEach(g => {
    const title = g.juego || 'Sin Título';
    if (!stockCounts[title]) {
      stockCounts[title] = { count: 0 };
    }
    if (g.estado === 'Activo') {
      stockCounts[title].count++;
    }
  });

  const lowStockTitles = Object.entries(stockCounts)
    .filter(([, data]) => data.count <= threshold)
    .map(([title]) => title);

  return {
    count: lowStockTitles.length,
    titles: lowStockTitles
  };
}

/**
 * Validador de correo electrónico con RegEx estándar.
 * @param {string} email - Correo a validar.
 * @returns {boolean} - true si el correo es válido.
 */
export function isValidEmail(email) {
  if (!email) return false;
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email.trim());
}

/**
 * Validador de número de celular de Colombia (CO).
 * @param {string|number} phone - Número a validar.
 * @returns {boolean} - true si tiene 10 dígitos y empieza por 3.
 */
export function isValidPhoneCO(phone) {
  if (!phone) return false;
  const strPhone = String(phone).replace(/[\s\-\(\)\.]+/g, '');
  const regex = /^3\d{9}$/;
  return regex.test(strPhone);
}

/**
 * Validador estricto para Cédulas/IDs (solo números).
 * @param {string|number} cedula - Cédula a validar.
 * @returns {boolean} - true si contiene solo números (sin letras ni caracteres especiales).
 */
export function isValidCedula(cedula) {
  if (!cedula) return false;
  const strCedula = String(cedula).trim();
  if (strCedula.length === 0) return false;
  const regex = /^\d+$/;
  return regex.test(strCedula);
}
