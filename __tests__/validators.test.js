import { describe, it, expect } from 'vitest';
import { isValidEmail, isValidPhoneCO, isValidCedula } from '../utils/validators.js';

describe('Pruebas Unitarias - Validadores RegEx', () => {
  
  describe('isValidEmail', () => {
    it('debería retornar true para un correo válido', () => {
      expect(isValidEmail('test@cangel.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co')).toBe(true);
    });

    it('debería retornar false para un correo sin @', () => {
      expect(isValidEmail('testcangel.com')).toBe(false);
    });

    it('debería retornar false para un correo sin dominio', () => {
      expect(isValidEmail('test@')).toBe(false);
    });

    it('debería manejar espacios en blanco', () => {
      expect(isValidEmail('  test@cangel.com  ')).toBe(true);
    });
  });

  describe('isValidPhoneCO', () => {
    it('debería retornar true para un celular CO válido (inicia con 3 y tiene 10 dígitos)', () => {
      expect(isValidPhoneCO('3001234567')).toBe(true);
    });

    it('debería retornar false para un número de 9 dígitos', () => {
      expect(isValidPhoneCO('300123456')).toBe(false);
    });

    it('debería retornar false si no empieza con 3', () => {
      expect(isValidPhoneCO('4001234567')).toBe(false);
    });

    it('debería limpiar caracteres de formato (espacios, guiones, paréntesis)', () => {
      expect(isValidPhoneCO('310 123 4567')).toBe(true);
      expect(isValidPhoneCO('310-123-4567')).toBe(true);
      expect(isValidPhoneCO('(310) 123 4567')).toBe(true);
    });
  });

  describe('isValidCedula', () => {
    it('debería retornar true para una cédula con solo números', () => {
      expect(isValidCedula('1234567890')).toBe(true);
    });

    it('debería retornar false si contiene letras', () => {
      expect(isValidCedula('12345X789')).toBe(false);
    });

    it('debería retornar false si contiene caracteres especiales', () => {
      expect(isValidCedula('123.456.789')).toBe(false);
    });

    it('debería retornar false para entrada vacía', () => {
      expect(isValidCedula('')).toBe(false);
      expect(isValidCedula('   ')).toBe(false);
    });
  });
});
