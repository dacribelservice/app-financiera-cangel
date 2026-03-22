import { describe, it, expect } from 'vitest';
import { sanitizeInventoryDuplicates } from '../utils/sanitizer.js';

describe('utils/sanitizer.js - sanitizeInventoryDuplicates', () => {
  it('debería eliminar duplicados basándose en el ID', () => {
    const input = [
      { id: '1', name: 'Original' },
      { id: '2', name: 'Unico' },
      { id: '1', name: 'Duplicado' },
    ];
    
    // El sanitizer (Map.set) conservará el último encontrado: {id:'1', name:'Duplicado'}
    const result = sanitizeInventoryDuplicates(input);
    
    expect(result.length).toBe(2);
    expect(result.some(item => item.name === 'Duplicado')).toBe(true);
    expect(result.some(item => item.name === 'Original')).toBe(false);
  });

  it('debería retornar un array vacío si el input no es válido', () => {
    expect(sanitizeInventoryDuplicates(null)).toEqual([]);
    expect(sanitizeInventoryDuplicates({})).toEqual([]);
  });

  it('no debería afectar arrays sin duplicados', () => {
    const input = [{ id: '1' }, { id: '2' }];
    expect(sanitizeInventoryDuplicates(input).length).toBe(2);
  });
});
