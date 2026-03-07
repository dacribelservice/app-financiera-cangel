const https = require('https');

/**
 * Módulo de Extracción Avanzada con IA (Gemini)
 */
const ExtractorAI = {
    // NOTA: El usuario debe proporcionar su API Key de Google AI Studio
    API_KEY: 'AIzaSyCOhik3UOySSPGiYMf-WgGBD3UBmYPB7F8',

    /**
     * Extrae datos detallados de una URL de PS Store usando Gemini
     */
    async extract(url) {
        try {
            // 1. Obtener el HTML de la página
            const html = await this._fetchHtml(url);

            // 2. Extraer Metadatos (JSON-LD y Meta Tags) que son la "fuente de verdad"
            const metadata = this._extractMetadata(html);

            // 3. Limpiar el HTML para contexto visual (opcional/secundario)
            const cleanHtml = this._simplifyHtml(html);

            // 4. Llamar a Gemini con ambos fragmentos
            return await this._callGemini(cleanHtml, url, metadata);
        } catch (error) {
            console.error('[Extractor-AI] Error:', error.message);
            throw error;
        }
    },

    /**
     * Busca bloques JSON-LD y Meta Tags que contienen la info real
     */
    _extractMetadata(html) {
        let metadata = '';

        // Extraer bloques JSON-LD (donde Sony suele guardar precios y nombres)
        const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
        if (jsonLdMatches) {
            metadata += "--- DATOS JSON-LD --- \n";
            jsonLdMatches.forEach(m => {
                metadata += m.replace(/<[^>]*>/g, '').trim() + "\n";
            });
        }

        // Extraer Meta Tags (OpenGraph)
        const metaMatches = html.match(/<meta (?:name|property)="[^"]+" content="[^"]+"[^>]*>/gi);
        if (metaMatches) {
            metadata += "\n--- META TAGS --- \n";
            metaMatches.forEach(m => {
                if (m.includes('og:') || m.includes('twitter:') || m.includes('title') || m.includes('price')) {
                    metadata += m + "\n";
                }
            });
        }

        return metadata.slice(0, 15000); // Límite razonable
    },

    /**
     * Descarga el contenido de la URL
     */
    _fetchHtml(url) {
        console.log(`[Extractor-AI] 🌐 Iniciando fetch: ${url}`);
        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-CO,es;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
                },
                timeout: 10000
            };
            https.get(url, options, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    console.log(`[Extractor-AI] ↪️ Redirección detectada a: ${res.headers.location}`);
                    return this._fetchHtml(res.headers.location).then(resolve).catch(reject);
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    },

    /**
     * Reduce el tamaño del HTML eliminando scripts y estilos innecesarios
     */
    _simplifyHtml(html) {
        let clean = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<svg[^>]*>.*?<\/svg>/gi, ' ')
            .replace(/<!--[\s\S]*?-->/g, '');

        clean = clean.replace(/ (?:id|class|style|data-[a-z0-9-]+)="[^"]*"/gi, '');
        return clean.replace(/\s+/g, ' ').slice(0, 30000);
    },

    /**
     * Realiza la llamada a la API de Google Gemini
     */
    _callGemini(htmlContext, originalUrl, metadata) {
        return new Promise((resolve, reject) => {
            if (!this.API_KEY || this.API_KEY.length < 20) {
                return reject(new Error('API Key de Gemini no configurada correctamente.'));
            }

            const prompt = `Analiza la información de este juego de PlayStation Store (${originalUrl}).
            
            FUENTES DE DATOS:
            1. METADATOS TÉCNICOS (Prioridad Alta): 
            ${metadata}
            
            2. CONTENIDO HTML (Referencia):
            ${htmlContext}

            INSTRUCCIONES:
            - Extrae el título oficial.
            - Busca el precio BASE y el precio de OFERTA (si existe). En PS Store, el precio de oferta suele estar en JSON-LD como "price".
            - Identifica si es para PS4, PS5 o ambos.
            
            Devuelve UNICAMENTE este JSON:
            {
              "title": "nombre",
              "image_url": "url imagen",
              "base_price": "$xx.xx",
              "discount_price": "$xx.xx (o null)",
              "discount_percentage": "-x% (o null)",
              "versions": [{"name": "edicion", "price": "precio"}],
              "publisher": "nombre",
              "rating": "número",
              "platform_tags": ["PS4", "PS5"],
              "ps4": boolean,
              "ps5": boolean
            }`;

            const data = JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            });

            const options = {
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/gemini-flash-latest:generateContent?key=${this.API_KEY}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(responseData);
                        const textResponse = json.candidates[0].content.parts[0].text;
                        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
                        resolve(JSON.parse(jsonMatch[0]));
                    } catch (e) {
                        reject(new Error('Error analizando respuesta de IA'));
                    }
                });
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }
};

module.exports = ExtractorAI;
