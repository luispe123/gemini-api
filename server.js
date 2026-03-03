const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
// Habilita CORS para permitir que tu frontend se comunique con este backend
app.use(cors()); 
app.use(express.json());

// --- CONFIGURACIÓN DE LLAVES API ---
// En el backend, las llaves son invisibles para el usuario final.
// Lo ideal es usar variables de entorno (process.env.GEMINI_KEY), 
// pero aquí las dejo en arreglo como las tenías para mantener tu lógica de rotación.
const apiKeys = [
    "AIzaSyBnOUe3-OQm591hIqifDOXP3oyiNsQXU9A",  
    "AIzaSyCK5zZuhR1EmU4kJR4FLDMtjwCQxmjuc-E", 
    "AIzaSyAqp4-DxlrSyeek8jtAiYhGEomTaT4ctQg",
    "AIzaSyByThVfEFbw-ylfznjzzb9tyx-CGCWEwyI",
    "AIzaSyC_kBXBboh4oIcdFyPJu23aPhsvpVAwiOY",
    "AIzaSyDybU1exbPj8aSDhpP482UnlWkLgOBe7lY",
    "AIzaSyCgnj2kBSjgNCd_baqPX4aDTLDtDEEN3cU",
    "AIzaSyAr2RDiPVkFIiPkgixacoLRaRIpOQlwvbY",
    "AIzaSyDt6yiKpXiKsOn4qcEazZzaE2GlyM8vvAI",
    "AIzaSyAF0Ygrqp_ras-J2vj00FBilKB1KRM1900",
    "AIzaSyBgJ1ZyscG_THMRAOiK7R2_vG-0vRC4odQ"
];

// Endpoint que recibirá las peticiones de tu frontend
app.post('/api/consultar-ia', async (req, res) => {
    const promptText = req.body.prompt;

    if (!promptText) {
        return res.status(400).json({ error: "El prompt es requerido" });
    }

    const payload = {
        contents: [{ parts: [{ text: promptText }] }]
    };

    // Lógica de rotación de llaves y reintentos (Exponential Backoff)
    for (let k = 0; k < apiKeys.length; k++) {
        const currentKey = apiKeys[k];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta";
                
                // Enviamos la respuesta exitosa de vuelta al frontend
                return res.json({ respuesta: answerText });
            }
            
            if (response.status === 429) {
                console.warn(`[Backend] Llave ${k + 1} saturada. Intentando con la siguiente...`);
                continue;
            }
            
            console.warn(`[Backend] Error API con llave ${k + 1}: código ${response.status}`);
            
        } catch (error) {
            console.error(`[Backend] Error de red con llave ${k + 1}:`, error);
        }
    }
    
    // Si todas las llaves fallan
    res.status(503).json({ error: "El sistema de IA se encuentra saturado en este momento. Por favor, intenta de nuevo más tarde." });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);

});
