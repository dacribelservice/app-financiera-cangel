import { describe, it, expect, vi, beforeEach } from 'vitest';
import GlobalBridge, { AppState } from '../app.js';

window.lucide = { createIcons: vi.fn() };

describe('Módulo de Bitácora - Seguridad y Usuarios', () => {
  beforeEach(() => {
    AppState.auditLog = [];
    AppState.users = [];
    
    document.body.innerHTML = `
      <div id="bitacoraVisorEventos"></div>
      <div id="bitacoraGestionUsuarios"></div>
      <button id="btnTabVisorEventos"></button>
      <button id="btnTabGestionUsuarios"></button>
      <input type="checkbox" id="filterBitacoraAnulaciones" checked>
      <table><tbody id="bodyBitacoraEventos"></tbody></table>
      <table><tbody id="bodyGestionUsuarios"></tbody></table>
      <div id="modalConfirmDeleteOverlay">
        <div id="deleteConfirmMessage"></div>
      </div>
    `;

    // Vincular funciones
    Object.keys(GlobalBridge).forEach(key => {
      window[key] = GlobalBridge[key];
    });
  });

  it('debe cambiar entre pestañas de Bitácora y Visor', () => {
    // Inicialmente visor está visible (en index.html suele estarlo)
    window.switchBitacoraTab('gestionUsuarios');
    
    expect(document.getElementById('bitacoraVisorEventos').style.display).toBe('none');
    expect(document.getElementById('bitacoraGestionUsuarios').style.display).toBe('block');
  });

  it('debe renderizar eventos en la bitácora', () => {
    AppState.auditLog = [
      { timestamp: '2026-03-14T10:00:00Z', usuarioNombre: 'Admin User', accion: 'Login', detalles: 'Acceso exitoso' }
    ];
    
    window.renderBitacoraEventos();
    
    const body = document.getElementById('bodyBitacoraEventos');
    expect(body.children.length).toBe(1);
    expect(body.innerHTML).toContain('Login');
    expect(body.innerHTML).toContain('Acceso exitoso');
  });

  it('debe pedir confirmación antes de limpiar datos', () => {
    window.confirmarLimpiezaDatos();
    
    expect(document.getElementById('modalConfirmDeleteOverlay').classList.contains('show')).toBe(true);
  });
});
