import { describe, it, expect, vi, beforeEach } from 'vitest';
import GlobalBridge, { AppState } from '../app.js';

const mockAlert = vi.fn();
const mockConfirm = vi.fn(() => true);
global.alert = mockAlert;
global.confirm = mockConfirm;
window.lucide = { createIcons: vi.fn() };

describe('Pruebas de UI - Inventario', () => {
  beforeEach(async () => {
    // Reiniciamos el estado compartido
    AppState.inventoryGames = [];
    AppState.paquetes = [];
    AppState.membresias = [];
    AppState.xboxInventory = [];
    AppState.physicalInventory = [];
    AppState.currentUser = { 
      role: 'admin', 
      name: 'Tester Admin',
      permisos: { acceso_total: true }
    };
    AppState.vendors = [];
    AppState.sales = [];

    // Vincular al objeto window para compatibilidad con lógica legacy si fuera necesario
    window.AppState = AppState;

    // Configurar el DOM mínimo necesario para el módulo de inventario
    document.body.innerHTML = `
      <!-- Pestañas -->
      <button id="btnInvJuegos"></button>
      <button id="btnInvPaquetes"></button>
      <div id="invJuegosContainer"></div>
      <div id="invPaquetesContainer" class="hidden"></div>
      <div id="invMembresiasContainer" class="hidden"></div>
      <div id="invCodigosContainer" class="hidden"></div>
      <div id="invXboxContainer" class="hidden"></div>
      <div id="invPhysicalContainer" class="hidden"></div>

      <!-- Modal Juegos -->
      <div id="modalJuegoOverlay" class="modal-overlay">
        <h3 id="modalJuegoTitle"></h3>
        <input type="hidden" id="editGameId">
        <input type="text" id="invJuegoNombre">
        <input type="text" id="invJuegoCorreo">
        <div id="duplicateInvEmailError" style="display:none"></div>
        <input type="text" id="invJuegoUsd">
        <input type="text" id="invJuegoTrm">
        <input type="date" id="invJuegoFecha">
        <input type="date" id="invJuegoFechaCuenta">
        <input type="text" id="invJuegoHosting">
        <input type="text" id="invJuegoPassHosting">
        <select id="invJuegoPais"><option value="USA">USA</option></select>
        <input type="text" id="invJuegoPass">
        <textarea id="invJuego2fa"></textarea>
      </div>

      <!-- Modal Paquetes -->
      <div id="modalPaqueteOverlay" class="modal-overlay">
        <input type="hidden" id="editPaqueteId">
        <input type="text" id="invPaqueteNombre">
        <input type="text" id="invPaqueteCorreo">
        <input type="text" id="invPaqueteHosting">
        <input type="text" id="invPaquetePassHosting">
        <input type="text" id="invPaquetePass">
        <input type="text" id="invPaquete2fa">
        <input type="date" id="invPaqueteFecha">
        <input type="date" id="invPaqueteFechaCuenta">
        <input type="text" id="invPaqueteUsd">
        <input type="text" id="invPaqueteTrm">
        <select id="invPaquetePais"><option value="USA">USA</option></select>
        <textarea id="invPaqueteJuegos"></textarea>
      </div>

      <!-- Modal Membresías -->
      <div id="modalMembresiaOverlay" class="modal-overlay">
        <input type="hidden" id="editMembresiaId">
        <select id="invMembresiaTipo"><option value="12 meses Essential">12 meses Essential</option></select>
        <input type="text" id="invMembresiaCorreo">
        <input type="text" id="invMembresiaHosting">
        <input type="text" id="invMembresiaPassHosting">
        <input type="text" id="invMembresiaPass">
        <input type="text" id="invMembresia2fa">
        <input type="date" id="invMembresiaFecha">
        <input type="date" id="invMembresiaFechaCuenta">
        <input type="text" id="invMembresiaUsd">
        <input type="text" id="invMembresiaTrm">
        <select id="invMembresiaPais"><option value="USA">USA</option></select>
      </div>

      <!-- Modal Xbox -->
      <div id="modalXboxInventory" class="modal-overlay">
        <input type="hidden" id="xboxFormId">
        <input type="date" id="xboxFormFecha">
        <input type="text" id="xboxFormDetalle">
        <input type="text" id="xboxFormCorreo">
        <input type="text" id="xboxFormPassword">
        <input type="text" id="xboxFormCostoCop">
        <input type="text" id="xboxFormProveedor">
        <select id="xboxFormEstado"><option value="ON">ON</option><option value="OFF">OFF</option></select>
      </div>

      <!-- Modal Physical -->
      <div id="modalPhysicalInventory" class="modal-overlay">
        <input type="hidden" id="physicalFormId">
        <input type="date" id="physicalFormFecha">
        <input type="text" id="physicalFormDetalle">
        <input type="text" id="physicalFormSerial">
        <input type="text" id="physicalFormCostoCop">
        <select id="physicalFormEstado"><option value="ON">ON</option><option value="OFF">OFF</option></select>
      </div>

      <!-- Buscador y Tabla -->
      <input type="text" id="searchJuegos">
      <input type="text" id="searchPaquetes">
      <input type="text" id="searchMembresias">
      <div id="statusDropdownContainer">
        <span id="statusSelectedText"></span>
      </div>
      <input type="hidden" id="filterStatus" value="all">
      <table id="inventoryGamesTable"><tbody id="inventoryGamesBody"></tbody></table>
      <table id="inventoryPaquetesTable"><tbody id="inventoryPaquetesBody"></tbody></table>
      <table id="inventoryMembresiasTable"><tbody id="inventoryMembresiasBody"></tbody></table>
      <table id="invCodigosTable"><tbody id="invCodigosBody"></tbody></table>
      <table id="invXboxTable"><tbody id="invXboxBody"></tbody></table>
      <table id="invPhysicalTable"><tbody id="invPhysicalBody"></tbody></table>

      <!-- KPIs (Necesarios para updateDashboard) -->
      <div id="kpiIngresos"></div>
      <div id="kpiGanancia"></div>
      <div id="kpiCostos"></div>
      <div id="kpiCostosJuegos"></div>
      <div id="kpiCostosPaquetes"></div>
      <div id="kpiCostosMembresias"></div>
      <div id="kpiCostosCodigos"></div>
      <div id="kpiGastosExtras"></div>
      <div id="kpiJuegos"></div>
      <div id="top5Content"></div>
      <div id="dashboardCharts"></div>

      <!-- Modal Historial y Detalles -->
      <div id="historialVentasOverlay" class="modal-overlay">
        <h3 id="historialVentasTitle"></h3>
        <div id="historialVentasContent"></div>
      </div>
      <div id="modalDetallesVentaOverlay" class="modal-overlay"></div>

      <!-- Modal de Confirmación de Borrado -->
      <div id="modalConfirmDeleteOverlay"><div id="deleteConfirmMessage"></div></div>
      <div id="toast-container"></div>
    `;

    // Sincronizar sistema de modales con ui/modals.js para corregir el flujo de eliminación
    const modals = await import('../ui/modals.js');
    
    // Inyectar manualmente en el bridge para que coincidan las referencias de estado
    GlobalBridge.showDeleteConfirmModal = modals.showDeleteConfirmModal;
    GlobalBridge.executeDeleteAction = modals.executeDeleteAction;
    GlobalBridge.closeDeleteConfirmModal = modals.closeDeleteConfirmModal;

    // Vincular funciones del GlobalBridge al objeto window...
    Object.keys(GlobalBridge).forEach(key => {
      window[key] = GlobalBridge[key];
    });

    // Mocks de funciones globales para trackeo (sobrescribiendo los del bridge si existen)
    window.alert = vi.fn();
    window.showToast = vi.fn();
    window.saveLocal = vi.fn();
    window.logEvent = vi.fn();
    window.calculateBalances = vi.fn();
    window.checkLowInventory = vi.fn();
    window.updateDashboard = vi.fn();
    window.renderTop5 = vi.fn();
    window.updateDashboardCharts = vi.fn();
  });

  it('debería abrir el modal de inventario al llamar a openModalJuego', () => {
    // Arrange: Estado inicial verificado en beforeEach
    const modal = document.getElementById('modalJuegoOverlay');

    // Act
    window.openModalJuego();

    // Assert
    expect(modal.classList.contains('show')).toBe(true);
    expect(document.getElementById('modalJuegoTitle').textContent).toContain('Ingresar Nuevo Juego');
  });

  it('debería filtrar los juegos cuando el usuario escribe en el buscador', () => {
    // Arrange: Agregar datos al AppState
    AppState.inventoryGames = [
      { id: 1, juego: 'Halo Infinite', correo: 'test1@test.com', fecha: '2024-01-01' },
      { id: 2, juego: 'God of War', correo: 'test2@test.com', fecha: '2024-01-01' }
    ];
    const searchInput = document.getElementById('searchJuegos');
    searchInput.value = 'Halo';

    // Act
    window.filterInventoryGames();

    // Assert
    const tbody = document.getElementById('inventoryGamesBody');
    expect(tbody.innerHTML).toContain('Halo Infinite');
    expect(tbody.innerHTML).not.toContain('God of War');
  });

  it('debería validar campos obligatorios al intentar guardar un juego vacío', () => {
    // Arrange
    document.getElementById('invJuegoNombre').value = ''; 

    // Act
    window.saveGameInventory();

    // Assert
    expect(window.alert).toHaveBeenCalled();
  });

  it('debería guardar un juego nuevo cuando los datos son correctos', () => {
    // Arrange
    document.getElementById('invJuegoNombre').value = 'Spider-Man 2';
    document.getElementById('invJuegoCorreo').value = 'spidey@psn.com';
    document.getElementById('invJuegoUsd').value = '60';
    document.getElementById('invJuegoTrm').value = '4000';
    document.getElementById('invJuegoPais').value = 'USA';
    
    // Act
    window.saveGameInventory();

    // Assert
    expect(AppState.inventoryGames.length).toBe(1);
    expect(AppState.inventoryGames[0].juego).toBe('Spider-Man 2');
  });

  it('debería completar el flujo de eliminación con confirmación', () => {
    // Arrange
    const testId = Date.now();
    AppState.inventoryGames = [{ id: testId, juego: 'Juego para Borrar', correo: 'borrar@test.com' }];
    
    // Act: Paso 1 - Intentar borrar (debe abrir modal)
    window.deleteGameInventory(testId);
    
    // Act: Paso 2 - Ejecutar la acción confirmada
    window.executeDeleteAction();

    // Assert
    expect(AppState.inventoryGames.length).toBe(0);
  });

  it('debería cambiar de pestaña en el inventario al llamar a switchInvMode', () => {
    // Arrange
    const btnJuegos = document.getElementById('btnInvJuegos');
    const containerJuegos = document.getElementById('invJuegosContainer');
    const containerPaquetes = document.getElementById('invPaquetesContainer');
    
    // Act
    window.switchInvMode('paquetes');

    // Assert
    expect(containerPaquetes.classList.contains('hidden')).toBe(false);
    expect(containerJuegos.classList.contains('hidden')).toBe(true);
  });

  it('debería filtrar por estado cuando se selecciona una opción del dropdown', () => {
    // Arrange
    const filterInput = document.getElementById('filterStatus');
    
    // Act
    window.selectStatusFilter({ stopPropagation: () => {} }, 'ON', 'ON (En Stock)');

    // Assert
    expect(filterInput.value).toBe('ON');
  });

  it('debería guardar un nuevo registro de Xbox', () => {
    // Arrange
    document.getElementById('xboxFormFecha').value = '2024-03-14';
    document.getElementById('xboxFormDetalle').value = 'Game Pass Ultimate';
    document.getElementById('xboxFormCorreo').value = 'xbox@test.com';
    document.getElementById('xboxFormCostoCop').value = '50000';
    
    // Act
    window.saveXboxInventory();

    // Assert
    expect(AppState.xboxInventory.length).toBe(1);
    expect(AppState.xboxInventory[0].detalle).toBe('Game Pass Ultimate');
  });

  it('debería guardar un nuevo producto físico', () => {
    // Arrange
    document.getElementById('physicalFormFecha').value = '2024-03-14';
    document.getElementById('physicalFormDetalle').value = 'Control PS5 DualSense';
    document.getElementById('physicalFormSerial').value = 'SN123456';
    document.getElementById('physicalFormCostoCop').value = '300000';
    
    // Act
    window.savePhysicalInventory();

    // Assert
    expect(AppState.physicalInventory.length).toBe(1);
    expect(AppState.physicalInventory[0].detalle).toBe('Control PS5 DualSense');
  });

  it('debería guardar un nuevo paquete', () => {
    // Arrange
    document.getElementById('invPaqueteNombre').value = 'Mega Bundle 2024';
    document.getElementById('invPaqueteCorreo').value = 'bundle@test.com';
    document.getElementById('invPaqueteUsd').value = '100';
    document.getElementById('invPaqueteTrm').value = '4000';
    
    // Act
    window.savePaqueteInventory();

    // Assert
    expect(AppState.paquetes.length).toBe(1);
    expect(AppState.paquetes[0].nombre).toBe('Mega Bundle 2024');
  });

  it('debería guardar una nueva membresía', () => {
    // Arrange
    document.getElementById('invMembresiaTipo').value = '12 meses Essential';
    document.getElementById('invMembresiaCorreo').value = 'psplus@test.com';
    document.getElementById('invMembresiaUsd').value = '60';
    document.getElementById('invMembresiaTrm').value = '4000';
    
    // Act
    window.saveMembresiaInventory();

    // Assert
    expect(AppState.membresias.length).toBe(1);
    expect(AppState.membresias[0].tipo).toBe('12 meses Essential');
  });

  it('debería cerrar el modal y limpiar los campos al llamar a closeModalJuego', () => {
    // Arrange
    const modal = document.getElementById('modalJuegoOverlay');
    modal.classList.add('show');
    document.getElementById('invJuegoNombre').value = 'Juego de Prueba';

    // Act
    window.closeModalJuego();

    // Assert
    expect(modal.classList.contains('show')).toBe(false);
    expect(document.getElementById('invJuegoNombre').value).toBe('');
  });

  it('debe permitir abrir la edición de un juego con ID alfanumérico (Escapado)', () => {
    AppState.inventoryGames = [{ id: '123-ABC', juego: 'Test Game', estado: 'ON' }];
    GlobalBridge.renderInventoryJuegos();
    
    expect(GlobalBridge.editGameInventory).toBeDefined();
    GlobalBridge.editGameInventory('123-ABC');
    
    expect(document.getElementById('modalJuegoOverlay').classList.contains('show')).toBe(true);
    expect(document.getElementById('editGameId').value).toBe('123-ABC');
  });

  it('debe permitir abrir el historial de ventas (Ver) con ID alfanumérico', () => {
    AppState.inventoryGames = [{ id: '123-ABC', juego: 'Test Game', estado: 'ON' }];
    
    expect(GlobalBridge.openModalHistorialVentas).toBeDefined();
    GlobalBridge.openModalHistorialVentas('123-ABC');
    
    expect(document.getElementById('historialVentasOverlay').classList.contains('show')).toBe(true);
    expect(document.getElementById('historialVentasTitle').innerHTML).toContain('Test Game');
  });

  it('debe mostrar modal de confirmación al eliminar un juego con ID alfanumérico', () => {
    AppState.inventoryGames = [{ id: '123-ABC', juego: 'Test Game', estado: 'ON' }];
    
    expect(GlobalBridge.deleteGameInventory).toBeDefined();
    GlobalBridge.deleteGameInventory('123-ABC');
    
    // Verificamos que se muestre el modal de confirmación
    expect(document.getElementById('modalConfirmDeleteOverlay').classList.contains('show')).toBe(true);
  });
});
