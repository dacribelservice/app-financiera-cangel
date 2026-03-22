require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

// Configuración Supabase (ADMIN PRIVILEGES)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Para manejar AppState grandes
app.use(express.static(path.join(__dirname)));

// --- UTILIDADES ---
function formatDateToISO(dateStr) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    
    // Si ya es YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    
    // Si es D/M/YYYY o DD/MM/YYYY
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            let [d, m, y] = parts;
            d = d.padStart(2, '0');
            m = m.padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }
    
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch (e) {}
    
    return new Date().toISOString().split('T')[0];
}

// --- API ENDPOINTS ---

/**
 * Fase 2.2: Endpoint de Sincronización (Shadowing Migration)
 * Recibe el AppState y persiste datos de forma atómica.
 */
app.post('/api/sync', async (req, res) => {
    const { clients, sales, inventoryGames, exchangeRate, plantillas } = req.body;
    const syncResults = { clients: 'skipped', sales: 'skipped', inventory: 'skipped', settings: 'skipped' };

    // 1. Sincronizar Clientes
    try {
        let clientsArray = [];
        if (clients) {
            clientsArray = Array.isArray(clients) ? clients : Object.values(clients);
        }

        if (clientsArray.length > 0) {
            const clientesToSync = clientsArray.map(c => ({
                cedula: c.cedula,
                nombre: c.nombre_cliente || c.nombre,
                email: c.correo || c.email,
                celular: c.celular,
                ciudad: c.ciudad,
                lista_id: c.lista_id || null
            })).filter(c => c.cedula);

            if (clientesToSync.length > 0) {
                const { error } = await supabase.from('clientes').upsert(clientesToSync, { onConflict: 'cedula' });
                if (error) throw error;
                syncResults.clients = 'success';
            }
        }
    } catch (error) {
        console.error('Error sincronizando clientes:', error);
        syncResults.clients = `error: ${error.message}`;
    }

    // 2. Sincronizar Inventario de Juegos
    try {
        if (inventoryGames && inventoryGames.length > 0) {
            const gamesToSync = inventoryGames.map(g => ({
                local_id: String(g.id),
                juego: g.juego || g.nombre,
                costo_usd: parseFloat(g.costo_usd || g.compra || 0),
                costo_cop: parseFloat(g.costo_cop || g.costo || 0),
                correo: g.correo,
                password: g.password || g.pass,
                correo_hosting: g.correo_hosting,
                password_hosting: g.password_hosting,
                region: g.region,
                estado: g.estado || 'ON',
                es_ps4: g.es_ps4 !== undefined ? g.es_ps4 : true,
                es_ps5: g.es_ps5 !== undefined ? g.es_ps5 : true,
                cupos_ps4_primaria: g.cupos_ps4_primaria || 2,
                cupos_ps4_secundaria: g.cupos_ps4_secundaria || 1,
                cupos_ps5_primaria: g.cupos_ps5_primaria || 2,
                cupos_ps5_secundaria: g.cupos_ps5_secundaria || 1
            }));

            const { error } = await supabase.from('inventory_games').upsert(gamesToSync, { onConflict: 'local_id' });
            if (error) throw error;
            syncResults.inventory = 'success';
        }
    } catch (error) {
        console.error('Error sincronizando inventario:', error);
        syncResults.inventory = `error: ${error.message}`;
    }

    // 3. Sincronizar Ventas
    try {
        if (sales && sales.length > 0) {
            const { data: dbClients } = await supabase.from('clientes').select('id, cedula');
            const clientMap = {};
            if (dbClients) {
                dbClients.forEach(c => { clientMap[c.cedula] = c.id; });
            }

            const salesToSync = sales.map(s => ({
                local_id: String(s.id),
                transaction_id: s.transaction_id || `TX-${s.id}`,
                cliente_id: clientMap[s.cedula] || null,
                vendedor_1: s.vendedor || s.vendedor1 || s.asesor,
                vendedor_2: s.vendedor2 || null,
                juego_nombre: s.juego,
                precio_venta: parseFloat(s.venta || s.precio || 0),
                metodo_pago: s.pago,
                fecha: formatDateToISO(s.fecha),
                esta_anulada: s.esta_anulada === true,
                is_partially_paid: s.isPartiallyPaid === true,
                nota: s.nota || ""
            }));

            const { error } = await supabase.from('sales').upsert(salesToSync, { onConflict: 'local_id' });
            if (error) throw error;
            syncResults.sales = 'success';
        }
    } catch (error) {
        console.error('Error sincronizando ventas:', error);
        syncResults.sales = `error: ${error.message}`;
    }

    // 4. Guardar Configuración
    try {
        const { error } = await supabase.from('settings').upsert([
            { key: 'exchangeRate', value: { value: exchangeRate || 4200 } },
            { key: 'plantillas', value: plantillas || {} }
        ]);
        if (error) throw error;
        syncResults.settings = 'success';
    } catch (error) {
        console.error('Error sincronizando configuración:', error);
        syncResults.settings = `error: ${error.message}`;
    }

    res.status(200).json({ status: 'partial_complete', results: syncResults });
});

/**
 * MICRO-PARCHE: HARD RESET CLOUD
 * Elimina todos los registros de inventario y ventas de Supabase.
 */
app.delete('/api/clear-inventory', async (req, res) => {
    try {
        console.log('🧹 Iniciando limpieza masiva de datos en Supabase...');
        
        // Ejecutamos los deletes con filtro universal (id no nulo) para aniquilar zombis.
        const [invResult, salesResult] = await Promise.all([
            supabase.from('inventory_games').delete().not('id', 'is', null),
            supabase.from('sales').delete().not('id', 'is', null)
        ]);

        if (invResult.error) throw invResult.error;
        if (salesResult.error) throw salesResult.error;

        console.log('✅ Nube limpia: Registros de inventario y ventas eliminados.');
        res.status(200).json({ success: true, message: 'Inventario y ventas eliminados de la nube.' });
    } catch (error) {
        console.error('❌ Error al limpiar la nube:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Fase 2.3: Endpoint de Lectura con Paginación
 * Evita cargar los 20,000 clientes de una sola vez.
 */
app.get('/api/clientes', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 50;
        const from = page * limit;
        const to = from + limit - 1;

        const { data, count, error } = await supabase
            .from('clientes')
            .select('*', { count: 'exact' })
            .order('nombre', { ascending: true })
            .range(from, to);

        if (error) throw error;

        res.status(200).json({
            clientes: data,
            total: count,
            page: page,
            limit: limit
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Fase 4.1: Endpoint de Carga Inicial
 * Obtiene Inventario, TRM y Ventas recientes.
 */
app.get('/api/initial-data', async (req, res) => {
    try {
        // Ejecutamos consultas en paralelo para velocidad
        const [inventoryResult, settingsResult, salesResult] = await Promise.all([
            supabase.from('inventory_games').select('*').order('juego', { ascending: true }),
            supabase.from('settings').select('*'),
            supabase.from('sales').select('*').order('fecha', { ascending: false }).limit(200)
        ]);

        if (inventoryResult.error) throw inventoryResult.error;
        if (settingsResult.error) throw settingsResult.error;

        // Formatear settings a objeto
        const settings = {};
        settingsResult.data.forEach(s => {
            settings[s.key] = s.value;
        });

        res.status(200).json({
            inventoryGames: inventoryResult.data,
            settings: settings,
            recentSales: salesResult.data || []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Mantener funcionalidad existente de Extracción IA
 */
app.get('/api/ps-details-ai', async (req, res) => {
    try {
        const extractorPath = path.resolve(__dirname, 'extractor_ai.js');
        // Limpiar caché para desarrollo
        delete require.cache[require.resolve(extractorPath)];
        const ExtractorAI = require(extractorPath);
        const targetUrl = req.query.url;
        
        if (!targetUrl) return res.status(400).json({ error: 'Falta URL' });
        
        const data = await ExtractorAI.extract(targetUrl);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Cangel ERP V13.0 Server running at http://localhost:${PORT}`);
    console.log(`🚀 Supabase Integration Active`);
});
