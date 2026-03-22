/**
 * utils/sanitizer.js
 * Función pura para limpiar duplicados en arreglos de inventario basándose en el ID.
 */

export function sanitizeInventoryDuplicates(inventoryArray) {
  if (!Array.isArray(inventoryArray)) return [];
  
  const originalSize = inventoryArray.length;
  const uniqueMap = new Map();
  
  inventoryArray.forEach(item => {
    if (item && item.id) {
      // Usamos el ID como llave. Si se repite, el Map sobreescribe con el último encontrado (o conservamos el primero si validamos).
      // El usuario pidió "conservando solo la primera o última versión válida". 
      // Usar set() sobre un Map sobrescribe, por lo que conservaremos la ÚLTIMA versión encontrada en el array original.
      uniqueMap.set(String(item.id), item);
    }
  });

  const sanitizedArray = Array.from(uniqueMap.values());
  const newSize = sanitizedArray.length;
  
  if (originalSize !== newSize) {
    console.warn(`🧹 Sanitización completada. Arreglo reducido de ${originalSize} a ${newSize} juegos.`);
  }

  return sanitizedArray;
}
