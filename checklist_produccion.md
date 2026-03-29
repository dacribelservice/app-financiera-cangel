# ✅ Checklist de Lanzamiento a Producción: Cangel ERP v13.1

Este documento detalla los pasos críticos para el despliegue exitoso en Vercel, siguiendo la auditoría de pre-producción.

## 🟢 FASE 1: SANEAMIENTO LOCAL (UI Y SEGURIDAD)
- [x] Creación de tests de cacería de bugs (Radares TDD).
- [x] Inyectar funciones de Filtros de Inventario en el GlobalBridge (`toggleStatusFilter`, `toggleDenomFilter`, `selectDenomFilter`).
- [x] Reparar rutas de importación en Autocomplete de Ventas (`selectVentaGameSuggestion`, etc.).
- [x] Exponer modales de UI (`showToast`, `closePremiumAlert`, etc.) en el GlobalBridge.
- [x] Implementar Middleware de Seguridad (API Key) en `server.js`.
- [x] Implementar validación básica de entrada en endpoints de backend.

## 🟡 FASE 2: CONFIGURACIÓN VERCEL
- [x] Crear archivo `vercel.json` con enrutamiento Serverless.
- [x] Ajustar `server.js` para compatibilidad con Vercel Functions.
- [ ] Verificar rutas relativas de carga de módulos en producción.
- [ ] Limpiar archivos innecesarios de la raíz del proyecto.

## 🔵 FASE 3: DESPLIEGUE FINAL
- [ ] Configurar variables de entorno en el panel de Vercel (URL de Supabase, API Key).
- [ ] Realizar despliegue de prueba (Vercel Preview).
- [ ] Validación final de 100% de funcionalidades online.
- [ ] Cierre oficial de versión v13.1.

---
**Estado Actual**: Fase 1 COMPLETADA. Listo para configuración de Vercel (Fase 2).
