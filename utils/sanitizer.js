/**
 * utils/sanitizer.js
 * Función pura para limpiar duplicados en arreglos de inventario basándose en el ID.
 */

export function sanitizeInventoryDuplicates(inventoryArray) {
  if (!Array.isArray(inventoryArray)) return [];
  
  const originalSize = inventoryArray.length;
  const uniqueMap = new Map();
  
  inventoryArray.forEach(item => {
    // Para Juegos, la clave de unicidad absoluta debe ser el CORREO. 
    // Los IDs generados por Date.now() pueden fallar si hay colisiones o re-creaciones rápidas.
    if (item && item.correo) {
      const uniqueKey = item.correo.trim().toLowerCase();
      // Si el correo ya existía, conservamos el más nuevo (el que llega después en el array)
      uniqueMap.set(uniqueKey, item);
    } else if (item && item.id) {
      // Fallback para otros tipos de inventario que no tengan correo
      uniqueMap.set(String(item.id), item);
    }
  });

  const sanitizedArray = Array.from(uniqueMap.values());
  const newSize = sanitizedArray.length;
  
  if (originalSize !== newSize) {
    console.warn(`🧹 Sanitización completada. Arreglo reducido de ${originalSize} a ${newSize} juegos (basado en correo/ID).`);
  }

  return sanitizedArray;
}

/**
 * Recorre recursivamente un objeto o array y blanquea cualquier propiedad
 * que contenga URLs de placeholder externas (erradicación de herencia).
 */
export function sanitizeLegacyData(data) {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLegacyData(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    const newData = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        let value = data[key];
        
        if (typeof value === 'string' && value.includes('placeholder.com')) {
          newData[key] = "";
        } else if (typeof value === 'object' && value !== null) {
          newData[key] = sanitizeLegacyData(value);
        } else {
          newData[key] = value;
        }
      }
    }
    return newData;
  }
  
  return data;
}
