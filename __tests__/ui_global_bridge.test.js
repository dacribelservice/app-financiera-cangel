import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * 🕵️ RADAR DE BUCS: PRE-PRODUCCIÓN V13.1
 * Estos tests verifican si las funciones críticas necesarias por index.html
 * están correctamente expuestas en el objeto global 'window' vía GlobalBridge.
 */
describe('🕵️ Auditoría GlobalBridge - Cacería de Funciones Críticas', () => {
  
  beforeEach(async () => {
    vi.resetModules();
    // Simulamos el entorno de navegador y cargamos app.js
    vi.stubGlobal('window', {
      lucide: { createIcons: vi.fn() },
      location: { reload: vi.fn() },
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      },
      document: {
        addEventListener: vi.fn(),
        getElementById: vi.fn().mockReturnValue({ addEventListener: vi.fn() }),
        querySelectorAll: vi.fn().mockReturnValue([])
      }
    });

    // Importamos dinámicamente para asegurar que se ejecute la inyección al window
    await import('../app.js');
  });

  it('🔴 BUG 1: toggleStatusFilter debe estar expuesta para filtros de Inventario', () => {
    expect(window.toggleStatusFilter).toBeDefined();
    expect(typeof window.toggleStatusFilter).toBe('function');
  });

  it('🔴 BUG 2: toggleDenomFilter debe estar expuesta para filtros de Códigos', () => {
    expect(window.toggleDenomFilter).toBeDefined();
    expect(typeof window.toggleDenomFilter).toBe('function');
  });

  it('🔴 BUG 3: selectDenomFilter debe estar expuesta para filtros de Códigos', () => {
    expect(window.selectDenomFilter).toBeDefined();
    expect(typeof window.selectDenomFilter).toBe('function');
  });

  it('🔴 BUG 4: selectVentaGameSuggestion debe estar expuesta para Autocomplete de Ventas', () => {
    expect(window.selectVentaGameSuggestion).toBeDefined();
    expect(typeof window.selectVentaGameSuggestion).toBe('function');
  });

  it('🔴 BUG 5: Otros modales de UI deben estar accesibles globalmente', () => {
    // Verificamos algunos que se sospecha faltan o son críticos en index.html
    expect(window.showToast).toBeDefined();
    expect(window.closePremiumAlert).toBeDefined();
  });
});
