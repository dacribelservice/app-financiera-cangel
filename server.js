require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Para manejar AppState grandes
app.use(express.static(path.join(__dirname)));

// --- API ENDPOINTS ---

/**
 * Fase 2.2: Endpoint de Sincronización (Shadowing Migration)
 * Recibe el AppState y persiste datos de forma atómica.
 */
app.post('/api/sync', async (req, res) => {
    try {
        const { clients, sales, inventoryGames, exchangeRate, plantillas } = req.body;

        // 1. Sincronizar Clientes (Upsert por Cédula)
        if (clients && clients.length > 0) {
            const clientesToSync = clients.map(c => ({
                cedula: c.cedula,
                nombre: c.nombre_cliente || c.nombre,
                email: c.correo || c.email,
                celular: c.celular,
                ciudad: c.ciudad,
                lista_id: c.lista_id || null
            })).filter(c => c.cedula);

            if (clientesToSync.length > 0) {
                await supabase.from('clientes').upsert(clientesToSync, { onConflict: 'cedula' });
            }
        }

        // 2. Sincronizar Inventario de Juegos
        if (inventoryGames && inventoryGames.length > 0) {
            const gamesToSync = inventoryGames.map(g => ({
                juego: g.juego || g.nombre,
                costo_usd: g.costo_usd || g.compra,
                costo_cop: g.costo_cop || g.costo,
                correo: g.correo,
                password: g.password || g.pass,
                region: g.region,
                estado: g.estado || 'ON'
            }));
            await supabase.from('inventory_games').upsert(gamesToSync, { onConflict: 'juego' });
        }

        // 3. Guardar Configuración (TRM y Plantillas)
        await supabase.from('settings').upsert([
            { key: 'exchangeRate', value: { value: exchangeRate || 4200 } },
            { key: 'plantillas', value: plantillas || {} }
        ]);

        res.status(200).json({ status: 'success', message: 'Sync completado' });
    } catch (error) {
        console.error('Error en Sync:', error);
        res.status(500).json({ status: 'error', message: error.message });
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
    console.log(`✅ Cangel ERP V12 Server running at http://localhost:${PORT}`);
    console.log(`🚀 Supabase Integration Active`);
});
