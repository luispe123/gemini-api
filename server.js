const express = require('express');
const cors = require('cors');

const app = express();

// Configuración para permitir que tu página web se comunique con este servidor
app.use(cors()); 
app.use(express.json());

// --- LECTURA SEGURA DE LLAVES ---
// Aquí leemos la variable de entorno que configuraste en Render.
// process.env.GEMINI_KEYS contiene el texto con tus llaves separadas por comas.
const keysString = process.env.GEMINI_KEYS || "";

// Convertimos ese texto en un arreglo (lista) de llaves limpias
const apiKeys = keysString
    .split(',') // Corta el texto donde haya comas
    .map(key => key.trim()) // Quita espacios en blanco accidentales
    .filter(key => key.length > 0); // Ignora partes vacías

// Solo para diagnóstico en los logs de Render al encender
console.log(`[Sistema] Servidor inicializado. Llaves API cargadas: ${apiKeys.length}`);

// --- RUTA PRINCIPAL DE LA IA ---
app.post('/api/consultar-ia', async (req, res) => {
    const promptText = req.body.prompt;

    // Validación básica: que el usuario haya enviado texto
    if (!promptText) {
        return res.status(400).json({ error: "El prompt es requerido" });
    }

    // Validación de seguridad: si olvidaste poner las llaves en Render
    if (apiKeys.length === 0) {
        console.error("[Error] No se encontraron llaves en la variable GEMINI_KEYS.");
        return res.status(500).json({ error: "Error de configuración del servidor. Faltan las llaves API." });
    }

    const payload = {
        contents: [{ parts: [{ text: promptText }] }]
    };

    // --- SISTEMA DE ROTACIÓN DE LLAVES ---
    // Intentamos con la primera llave. Si falla por cuota (429), probamos la siguiente.
    for (let k = 0; k < apiKeys.length; k++) {
        const currentKey = apiKeys[k];
        
        // Usamos el modelo 1.5-flash por estabilidad
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${currentKey}`;

        try {
            console.log(`[Petición] Procesando con Llave #${k + 1}...`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Si la respuesta es exitosa (200 OK)
            if (response.ok) {
                const data = await response.json();
                const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar una respuesta.";
                
                // Devolvemos la respuesta al Frontend
                return res.json({ respuesta: answerText });
            }
            
            // Si la llave actual agotó sus peticiones (429 Too Many Requests)
            if (response.status === 429) {
                console.warn(`[Advertencia] Llave #${k + 1} saturada (Error 429). Saltando a la siguiente...`);
                continue; // Pasa a la siguiente iteración del ciclo 'for'
            }
            
            // Si es un error de seguridad (403), significa que Google canceló esa llave
            if (response.status === 403) {
                console.error(`[CRÍTICO] La llave #${k + 1} está bloqueada/inválida (Error 403).`);
                continue; // Saltamos a la siguiente para intentar salvar la petición
            }
            
            // Otros errores no previstos
            console.warn(`[Error API] Llave #${k + 1} falló con código: ${response.status}`);
            
        } catch (error) {
            console.error(`[Error de Red] Falla al intentar usar la llave #${k + 1}:`, error.message);
        }
    }
    
    // Si el código llega hasta esta línea, significa que probó TODAS las llaves y ninguna funcionó
    console.error("[Colapso] Todas las llaves fallaron o están saturadas.");
    res.status(503).json({ error: "En este momento todas las líneas de IA están ocupadas. Por favor, intenta en 1 minuto." });
});

// --- INICIO DEL SERVIDOR ---
// Render asigna un puerto dinámico a través de process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo exitosamente en el puerto ${PORT}`);
});
