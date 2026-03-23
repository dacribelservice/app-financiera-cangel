import { saveLocal } from '../app.js';
import { logEvent } from './bitacora.js';
import { updateDashboard } from './dashboard.js';
import { AppState } from '../core/store.js';

// --- MODAL ELIMINACION PREMIUM ---
let deleteActionCallback = null;

export function showDeleteConfirmModal(message, onConfirm) {
  const overlay = document.getElementById('modalConfirmDeleteOverlay');
  const msgElement = document.getElementById('deleteConfirmMessage');
  if (overlay && msgElement) {
    msgElement.innerText = message || "¿Estás seguro de eliminar este registro?";
    deleteActionCallback = onConfirm;
    overlay.classList.add('show');
  }
}

export function closeDeleteConfirmModal() {
  const overlay = document.getElementById('modalConfirmDeleteOverlay');
  if (overlay) {
    overlay.classList.remove('show');
  }
  deleteActionCallback = null;
}

export function executeDeleteAction() {
  if (deleteActionCallback && typeof deleteActionCallback === 'function') {
    deleteActionCallback();
  }
  closeDeleteConfirmModal();
}

// --- ALERT PREMIUM ---
let alertResolve = null;

export function showPremiumAlert(title, message, type = 'success') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modalAlertOverlay');
    const titleEl = document.getElementById('alertTitle');
    const msgEl = document.getElementById('alertMessage');
    const iconContainer = document.getElementById('alertIconContainer');
    if (overlay && titleEl && msgEl && iconContainer) {
      titleEl.innerText = title;
      msgEl.innerText = message;
      let iconHtml = '';
      if (type === 'success') {
        iconHtml = `<div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(0, 184, 148, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 1px solid rgba(0, 184, 148, 0.3);"><i data-lucide="check-circle" style="color: #00b894; width: 30px; height: 30px;"></i></div>`;
      } else if (type === 'error') {
        iconHtml = `<div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(255, 71, 87, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 1px solid rgba(255, 71, 87, 0.3);"><i data-lucide="x-circle" style="color: #ff4757; width: 30px; height: 30px;"></i></div>`;
      } else {
        iconHtml = `<div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(0, 201, 255, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 1px solid rgba(0, 201, 255, 0.3);"><i data-lucide="info" style="color: #00c9ff; width: 30px; height: 30px;"></i></div>`;
      }
      iconContainer.innerHTML = iconHtml;
      alertResolve = resolve;
      overlay.classList.add('show');
      if (window.lucide) window.lucide.createIcons();
    }
  });
}

export function closePremiumAlert() {
  const overlay = document.getElementById('modalAlertOverlay');
  if (overlay) overlay.classList.remove('show');
  if (alertResolve) {
    alertResolve();
    alertResolve = null;
  }
}

// --- PROMPT PREMIUM ---
let promptResolve = null;

export function showPremiumPrompt(title, subtitle, label, defaultValue = '', inputType = 'text') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modalPromptOverlay');
    const titleEl = document.getElementById('promptTitle');
    const subtitleEl = document.getElementById('promptSubtitle');
    const labelEl = document.getElementById('promptLabel');
    const inputEl = document.getElementById('promptInput');
    if (overlay && titleEl && subtitleEl && labelEl && inputEl) {
      titleEl.innerText = title;
      subtitleEl.innerText = subtitle;
      labelEl.innerText = label;
      inputEl.value = defaultValue;
      inputEl.type = inputType;
      promptResolve = resolve;
      overlay.classList.add('show');
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 100);
      const handleEnter = (e) => {
        if (e.key === 'Enter') {
          inputEl.removeEventListener('keydown', handleEnter);
          closePremiumPrompt(true);
        }
      };
      inputEl.addEventListener('keydown', handleEnter);
    }
  });
}

export function closePremiumPrompt(isAccept) {
  const overlay = document.getElementById('modalPromptOverlay');
  const inputEl = document.getElementById('promptInput');
  const value = inputEl ? inputEl.value : '';
  if (overlay) overlay.classList.remove('show');
  if (promptResolve) {
    promptResolve(isAccept ? value : null);
    promptResolve = null;
  }
}

// --- TOAST SYSTEM ---
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
