# 🚀 PLAN DE MIGRACIÓN QUIRÚRGICA: SUPABASE MCP
**Versión:** 12.7 (Actualizado: 13/03/2026)
**Meta:** Zero-Downtime Migration & Multi-User Support

---

## 🏗️ 1. CÓDIGO SQL (DEFINICIÓN DE TABLAS E ÍNDICES)

Ejecutar este bloque para inicializar PostgreSQL. Incluye **Índices B-Tree** vitales para el rendimiento con 20,000+ registros.

```sql
-- TABLA: CLIENTES (Optimización para 20k+ registros)
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    email TEXT,
    celular TEXT,
    cedula TEXT UNIQUE,
    ciudad TEXT,
    lista_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES B-TREE (Vitales para prevenir colapsos de CPU en búsquedas)
CREATE INDEX IF NOT EXISTS idx_clientes_cedula ON clientes(cedula);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre text_pattern_ops);

-- TABLA: INVENTARIO JUEGOS
CREATE TABLE IF NOT EXISTS inventory_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    juego TEXT NOT NULL,
    costo_usd NUMERIC(15,2),
    costo_cop NUMERIC(15,2),
    correo TEXT,
    password TEXT,
    correo_hosting TEXT,
    password_hosting TEXT,
    region TEXT, -- USA/TUR
    estado TEXT DEFAULT 'ON',
    es_ps4 BOOLEAN DEFAULT TRUE,
    es_ps5 BOOLEAN DEFAULT TRUE,
    cupos_ps4_primaria INTEGER DEFAULT 2,
    cupos_ps4_secundaria INTEGER DEFAULT 1,
    cupos_ps5_primaria INTEGER DEFAULT 2,
    cupos_ps5_secundaria INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: VENTAS (Relacional)
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT, -- Para agrupar pedidos multi-juego
    cliente_id UUID REFERENCES clientes(id),
    vendedor_1 TEXT,
    vendedor_2 TEXT,
    juego_nombre TEXT,
    precio_venta NUMERIC(15,2),
    metodo_pago TEXT,
    fecha DATE DEFAULT CURRENT_DATE,
    esta_anulada BOOLEAN DEFAULT FALSE,
    is_partially_paid BOOLEAN DEFAULT FALSE,
    nota TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_transaction_id ON sales(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sales_fecha ON sales(fecha);

-- TABLA: CONFIGURACIONES (TRM, Plantillas, etc.)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ✅ 2. CHECKLIST DE MICRO-TAREAS (PASO A PASO)

### 🟢 FASE 1: INFRAESTRUCTURA (VÍA MCP)
*   [x] **Fase 1.1**: Leer el código SQL de este documento y ejecutarlo en Supabase a través del servidor MCP. (Completado: Esquema inyectado y activo).
*   [x] **Fase 1.2**: Verificar mediante MCP que las tablas y los índices se crearon correctamente (Tablas e índices B-Tree verificados).

### 🟡 FASE 2: BACKEND (NODE.JS/EXPRESS)
*   [x] **Fase 2.1**: Instalar dependencias e inyectar el cliente de Supabase en `server.js`. (Express, Supabase-js, Dotenv instalados y configurados).
*   [x] **Fase 2.2**: Crear el endpoint `POST /api/sync` para escritura persistente. (Mapeo de Clientes, Inventario y Ventas con formateo ISO-8601).
*   [x] **Fase 2.3**: Crear el endpoint `GET /api/clientes` con **PAGINACIÓN (LIMIT/OFFSET)**. (Soporte nativo para 20k+ registros verificado).

### 🟠 FASE 3: FRONTEND - ESCRITURA DUAL (SHADOWING)
*   [x] **Fase 3.1**: Modificar `saveLocal()` en `app.js` (delegado a `core/persistence.js` y `services/api.js`) para enviar datos al Backend en segundo plano. (Shadow Writing activo con Timeout de 5s).
*   [x] **Fase 3.2**: Implementar lógica de reintentos y manejo de Timeouts (5s) para no bloquear la UI. (Implementado `processSyncQueue` y cola `sync_queue` en `localStorage`).

### 🔴 FASE 4: FRONTEND - LECTURA ASÍNCRONA
*   [x] **Fase 4.1**: Refactorizar carga inicial para leer Inventario y TRM desde Supabase vía Express. (Implementado con patrón Stale-while-revalidate con detección de cambios).
*   [x] **Fase 4.2**: Implementar búsqueda de clientes por demanda (Fetch de 50 en 50) para manejar los 20k+. (Implementada paginación y freno a carga masiva).

### ⚪ FASE 5: LIMPIEZA Y AUDITORÍA
*   [x] **Fase 5.1**: Implementar "Soft Disable" (Feature Flag) y auditoría de consistencia. (Local vs Supabase verificado).
*   [x] **Fase 5.2**: Limpieza de logs de desarrollo y andamiaje.

---
**ESTADO FINAL:** 🚀 **MIGRACIÓN COMPLETADA CON ÉXITO**. 
La aplicación ahora opera sobre Supabase con resiliencia de triple capa (Local Cache -> Shadow Write -> Retry Queue).

