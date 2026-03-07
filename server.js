/**
 * Servidor HTTP para la app financiera (Versión Simplificada - Solo Estáticos)
 * Se ha eliminado toda la lógica de scraping y proxy.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const https = require('https');

const PORT = 3000;
const DIR = path.resolve(__dirname);

const MIME = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    png: 'image/png',
    jpg: 'image/jpeg',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
};



http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
        return res.end();
    }

    const reqUrl = url.parse(req.url).pathname;

    // Rutas de API
    if (reqUrl.startsWith('/api/ps-details-ai')) {
        delete require.cache[require.resolve('./extractor_ai')];
        const ExtractorAI = require('./extractor_ai');
        const q = url.parse(req.url, true).query;
        ExtractorAI.extract(q.url)
            .then(data => {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify(data));
            })
            .catch(err => {
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: err.message }));
            });
        return;
    }



    // Archivos estáticos
    const filePath = path.join(DIR, reqUrl === '/' ? 'index.html' : reqUrl);
    const ext = path.extname(filePath).slice(1);
    const mime = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Not found: ' + reqUrl);
        }
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
    });

}).listen(PORT, () => {
    console.log(`✅ Servidor en http://localhost:${PORT}`);
});
