/**
 * Utilidades de formato y tiempo para Cangel ERP
 */

/**
 * Formato de moneda Pesos Colombianos (COP)
 */
export const formatCOP = (num) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(num || 0);
};

/**
 * Formato de moneda Dólares (USD)
 */
export const formatUSD = (num) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(num || 0);
};

/**
 * Obtiene la fecha y hora actual en el huso horario de Colombia
 */
export function getColombiaTime() {
  const now = new Date();
  const d = now.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  const t = now.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: true });
  return { date: d, time: t };
}

/**
 * Calcula los días restantes de una membresía basándose en su fecha de compra y tipo.
 */
export function calculateMembershipCountdown(m) {
  if (!m || !m.fecha || !m.tipo) return 0;

  let totalDays = 0;
  if (m.tipo.includes('1 mes')) totalDays = 30;
  else if (m.tipo.includes('3 meses')) totalDays = 90;
  else if (m.tipo.includes('12 meses')) totalDays = 365;
  else return 0;

  try {
    const buyDate = new Date(m.fecha + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const diffTime = today - buyDate;
    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, totalDays - daysPassed);
  } catch (e) {
    return 0;
  }
}

/**
 * Convierte un número de días en formato "X Meses Y Días"
 */
export function formatDaysToMonths(remainingDays) {
  if (remainingDays <= 0) return "Expirada";

  const months = Math.floor(remainingDays / 30);
  const days = remainingDays % 30;

  let result = [];
  if (months > 0) result.push(`${months} Mes${months !== 1 ? 'es' : ''}`);
  if (days > 0) result.push(`${days} Día${days !== 1 ? 's' : ''}`);

  return result.join(' ') || "0 Días";
}
