import { describe, it, expect, vi, beforeEach } from 'vitest';
import GlobalBridge, { AppState } from '../app.js';

global.Chart = vi.fn().mockImplementation(function() {
  this.destroy = vi.fn();
  this.update = vi.fn();
});
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
});
window.lucide = { createIcons: vi.fn() };

describe('Módulo de Balance - UI & Logic', () => {
  beforeEach(() => {
    AppState.sales = [];
    AppState.expenses = [];
    AppState.incomeExtra = [];
    AppState.inventoryGames = [];
    AppState.inventoryCodes = [];
    
    document.body.innerHTML = `
      <div id="balIngresos"></div>
      <div id="balCostos"></div>
      <div id="balGastos"></div>
      <div id="balNeta"></div>
      <div id="balSocio1"></div>
      <div id="balSocio2"></div>
      <div id="totalIngresosAdicionales"></div>
      <table><tbody id="gastosOperativosBody"></tbody></table>
      <table><tbody id="gastosOcasionalesBody"></tbody></table>
      <table><tbody id="ingresosAdicionalesBody"></tbody></table>
      <div id="modalConfirmDeleteOverlay">
        <div id="deleteConfirmMessage"></div>
      </div>
      <canvas id="pagoMetodoChart"></canvas>
      <div id="pagoMetodoCards"></div>
      
      <!-- Modal Prompt real (para pruebas de interacción) -->
      <div id="modalPromptOverlay">
        <div id="promptTitle"></div>
        <div id="promptSubtitle"></div>
        <div id="promptLabel"></div>
        <input id="promptInput">
      </div>
    `;

    // Vincular funciones
    Object.keys(GlobalBridge).forEach(key => {
      window[key] = GlobalBridge[key];
    });
  });

  it('debe calcular el balance correctamente con ventas y gastos', () => {
    AppState.sales = [
      { id: 1, venta: 100000, esta_anulada: false },
      { id: 2, venta: 50000, esta_anulada: false },
      { id: 3, venta: 30000, esta_anulada: true }
    ];
    AppState.expenses = [
      { id: 101, monto: 20000, desc: 'Internet', type: 'operativo' }
    ];
    AppState.inventoryGames = [
      { id: 'G1', costoCop: 30000 }
    ];

    window.updateBalance();

    expect(document.getElementById('balIngresos').textContent).toBe('$150.000');
    expect(document.getElementById('balCostos').textContent).toBe('$30.000');
    expect(document.getElementById('balGastos').textContent).toBe('$20.000');
    expect(document.getElementById('balNeta').textContent).toBe('$100.000');
  });

  it('debe permitir añadir un gasto mediante interacción con el modal', async () => {
    const promise = window.addExpense('operativo');
    
    // 1. Llenamos descripción
    const input = document.getElementById('promptInput');
    input.value = 'Luz';
    window.closePremiumPrompt(true);
    
    // Esperamos un tick para que se procese el primer prompt y aparezca el segundo
    await new Promise(r => setTimeout(r, 0));
    
    // 2. Llenamos monto
    input.value = '15000';
    window.closePremiumPrompt(true);
    
    await promise;

    expect(AppState.expenses.length).toBe(1);
    expect(AppState.expenses[0].desc).toBe('Luz');
    expect(AppState.expenses[0].monto).toBe(15000);
  });

  it('debe permitir añadir un ingreso adicional mediante interacción', async () => {
    const promise = window.addIngreso();
    
    const input = document.getElementById('promptInput');
    input.value = 'Aporte Capital';
    window.closePremiumPrompt(true);
    
    await new Promise(r => setTimeout(r, 0));
    
    input.value = '500000';
    window.closePremiumPrompt(true);
    
    await promise;

    expect(AppState.incomeExtra.length).toBe(1);
    expect(AppState.incomeExtra[0].monto).toBe(500000);
    expect(document.getElementById('totalIngresosAdicionales').textContent).toBe('$500.000');
  });

  it('debe pedir confirmación al eliminar un gasto', () => {
    AppState.expenses = [{ id: 999, desc: 'Gasto a borrar', monto: 1000, type: 'operativo' }];
    window.renderExpenses();
    
    window.eliminarGasto(999);
    
    expect(document.getElementById('modalConfirmDeleteOverlay').classList.contains('show')).toBe(true);
  });
});
