import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock de funciones globales
global.alert = vi.fn();
global.confirm = vi.fn(() => true);

describe('Módulo de Ventas - UI & Logic', () => {
  let AppState;
  let GlobalBridge;

  beforeEach(async () => {
    // Resetear el DOM
    const dom = new JSDOM('<!DOCTYPE html><html><body>' +
      '<div id="modalVentaOverlay" class="modal-overlay"></div>' +
      '<div id="modalVentaTitle"></div>' +
      '<input type="hidden" id="ventaFormId">' +
      '<input type="text" id="ventaFormClienteNombre">' +
      '<input type="text" id="ventaFormCedula">' +
      '<input type="text" id="ventaFormCelular">' +
      '<input type="text" id="ventaFormEmail">' +
      '<input type="text" id="ventaFormCiudad">' +
      '<textarea id="ventaFormNota"></textarea>' +
      '<select id="ventaFormPago"><option value="Nequi">Nequi</option></select>' +
      '<select id="ventaFormTipoCliente"><option value="💙 PUBLICIDAD">Publicidad</option></select>' +
      '<select id="ventaFormLista"><option value="">Sin lista</option></select>' +
      '<input type="text" id="ventaFormVendedor1">' +
      '<input type="text" id="ventaFormVendedor2">' +
      '<div id="ventaGameRowsContainer"></div>' +
      '<div id="ventaPaquetesRowsContainer"></div>' +
      '<div id="ventaMembresiasRowsContainer"></div>' +
      '<div id="ventaCodigosRowsContainer"></div>' +
      '<div id="ventaXboxRowsContainer"></div>' +
      '<div id="ventaPhysicalRowsContainer"></div>' +
      '<div id="ventasFacturacionContainer"></div>' +
      '<div id="cuentasPsnContainer" class="hidden"></div>' +
      '<button id="btnVentasFact"></button>' +
      '<button id="btnVentasCuentas"></button>' +
      '<tbody id="inventoryTableBody"></tbody>' +
      '<tbody id="cuentasPsnBody"></tbody>' +
      '</body></html>');
    
    global.document = dom.window.document;
    global.window = dom.window;
    global.navigator = dom.window.navigator;

    // Cargar app.js (reiniciará el estado)
    const app = await import('../app.js');
    AppState = app.AppState || {};
    GlobalBridge = app.default;

    // Inicializar estados mínimos
    AppState.inventoryGames = [];
    AppState.sales = [];
    AppState.paquetes = [];
    AppState.membresias = [];
    AppState.listas = [];
  });

  it('debe abrir el modal de nueva venta y limpiar los campos', () => {
    GlobalBridge.openModalVenta();
    
    expect(document.getElementById('modalVentaOverlay').classList.contains('show')).toBe(true);
    expect(document.getElementById('ventaFormId').value).toBe('');
    expect(document.getElementById('ventaFormClienteNombre').value).toBe('');
  });

  it('debe cerrar el modal de venta', () => {
    document.getElementById('modalVentaOverlay').classList.add('show');
    GlobalBridge.closeModalVenta();
    expect(document.getElementById('modalVentaOverlay').classList.contains('show')).toBe(false);
  });

  it('debe añadir una fila de juego al modal', () => {
    GlobalBridge.openModalVenta();
    GlobalBridge.addVentaGameRow();
    
    const container = document.getElementById('ventaGameRowsContainer');
    expect(container.children.length).toBe(1);
    expect(container.querySelector('.row-juego-search')).not.toBeNull();
  });

  it('debe cambiar entre modo Facturación y Cuentas PSN', () => {
    GlobalBridge.switchVentasMode('cuentas');
    
    expect(AppState.ventasMode).toBe('cuentas');
    expect(document.getElementById('cuentasPsnContainer').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('ventasFacturacionContainer').classList.contains('hidden')).toBe(true);
  });

  it('debe permitir añadir y remover filas de diferentes productos', () => {
    GlobalBridge.addVentaPaqueteRow();
    GlobalBridge.addVentaMembresiaRow();
    
    expect(document.getElementById('ventaPaquetesRowsContainer').children.length).toBe(1);
    expect(document.getElementById('ventaMembresiasRowsContainer').children.length).toBe(1);
    
    // Simular remoción (usando el ID generado)
    const paqRow = document.getElementById('ventaPaquetesRowsContainer').children[0];
    const rowId = paqRow.id.replace('row-', '');
    GlobalBridge.removeVentaPaqueteRow(rowId);
    
    expect(document.getElementById('ventaPaquetesRowsContainer').children.length).toBe(0);
  });

  it('debe intentar guardar una venta y retornar temprano si no hay items', () => {
    const initialSalesCount = AppState.sales.length;
    GlobalBridge.saveVentaDataForm();
    // No debería haberse añadido ninguna venta
    expect(AppState.sales.length).toBe(initialSalesCount);
  });

  it('debe tener las funciones de autocompletado en el GlobalBridge', () => {
    expect(GlobalBridge.handleVentaGameAutocomplete).toBeDefined();
    expect(GlobalBridge.selectVentaGameSuggestion).toBeDefined();
    expect(GlobalBridge.handleVentaPaqueteAutocomplete).toBeDefined();
    expect(GlobalBridge.handleVentaMembresiaAutocomplete).toBeDefined();
    expect(GlobalBridge.handleVentaCodigoAutocomplete).toBeDefined();
    expect(GlobalBridge.handleVentaXboxAutocomplete).toBeDefined();
    expect(GlobalBridge.handleVentaPhysicalAutocomplete).toBeDefined();
  });

  it('debe tener las funciones de anulación y eliminación en el GlobalBridge', () => {
    expect(GlobalBridge.eliminarPedidoCompleto).toBeDefined();
    expect(GlobalBridge.anularFactura).toBeDefined();
    expect(GlobalBridge.anularPedidoCompleto).toBeDefined();
  });

  it('debe validar la carga de plantillas', () => {
    const overlay = document.createElement('div');
    overlay.id = 'modalPlantillasOverlay';
    document.body.appendChild(overlay);
    
    GlobalBridge.openModalPlantillas();
    expect(overlay.classList.contains('show')).toBe(true);
  });
});
