# 📡 Radiografía de Pre-Producción: Cangel ERP V13.1

A continuación, se detalla el diagnóstico estructural y operativo actual antes del despliegue a producción vía Vercel.

---

### 1. 🛑 Estado de la UI (Bugs del 8%)
Tras auditar el `GlobalBridge` de `app.js` frente a los handlers de `index.html`, se han detectado las siguientes desconexiones:
*   **Inventario (Filtros de Dropdown)**: Funciones como `toggleStatusFilter`, `toggleDenomFilter` y `selectDenomFilter` **no están expuestas** en el puente global. Los dropdowns táctiles de la UI no responderán al clic.
*   **Ventas (Autocomplete)**: La lógica de los autocompletados en formularios de venta (`selectVentaGameSuggestion`, etc.) requiere revisión de rutas de importación tras la modularización.
*   **UI Helpers**: Falta la exposición de ciertos modales de éxito/error que se disparan tras acciones asíncronas.

### 2. 🛡️ Salud de Supabase (Seguridad Crítica)
*   **Vulnerabilidad de Endpoints**: `server.js` utiliza el `SERVICE_ROLE_KEY`, saltándose el **RLS (Row Level Security)**. Los endpoints como `/api/clear-inventory` y `/api/sync` están actualmente **abiertos al público**.
*   **Falta de Middleware**: Se requiere un sistema de autenticación básica (ej. `x-api-key` o JWT) en Express para evitar accesos no autorizados a la base de datos de producción.
*   **Validación de Datos**: No hay esquemas de validación (tipo Joi o Zod) para prevenir la inyección de datos corruptos desde el frontend.

### 3. 🚀 Preparación para Vercel (Infraestructura)
*   **Frontend**: Los archivos estáticos están mayormente listos, pero se debe verificar la resolución de rutas de módulos en producción (MIME types).
*   **Backend (Inexistente)**: Falta el archivo **`vercel.json`**. Sin él, Vercel servirá el backend como archivos estáticos y no como funciones Serverless.
*   **Limpieza de Build**: Deben excluirse scripts locales (`compact.ps1`, `fix_chars.ps1`) del despliegue final.

### 4. 🔒 Protección de Entorno
*   **Estado**: **SEGURO**. El archivo `.env` está correctamente listado en `.gitignore` y sus claves no serán expuestas en repositorios públicos.

---

### 👨‍💻 Recomendación del Equipo de Ingeniería

Se recomienda un enfoque de **"Saneamiento Local"** antes del despliegue:

1.  **Fase de Saneamiento**: Corregir los clics rotos en el `GlobalBridge` y blindar `server.js` con una API Key básica.
2.  **Fase de Configuración**: Crear el `vercel.json` y ajustar el servidor para producción.
3.  **Despliegue Final**: Subida a Vercel con un sistema seguro y 100% operativo.

---
**Ultima actualización**: 2026-03-23
**Estado del Proyecto**: 92% (Bloqueado para despliegue hasta saneamiento)
