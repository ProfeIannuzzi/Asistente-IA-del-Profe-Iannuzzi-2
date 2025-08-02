const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let conocimientoBase = "";

// Leer PDFs de DOCUMENTOS DE ENTRENAMIENTO
async function cargarPDFs() {
  const dir = path.join(__dirname, "DOCUMENTOS DE ENTRENAMIENTO");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".pdf"));
  let contenido = "";

  for (const file of files) {
    const buffer = fs.readFileSync(path.join(dir, file));
    const data = await pdfParse(buffer);
    contenido += `\n\n[Documento: ${file}]\n${data.text}`;
  }

  return contenido;
}

// Cargar también enlaces de videos
function cargarVideos() {
  const ruta = path.join(__dirname, "DOCUMENTOS DE ENTRENAMIENTO", "videos_utiles.txt");
  if (fs.existsSync(ruta)) {
    return `\n\n[Videos útiles]\n${fs.readFileSync(ruta, "utf-8")}`;
  }
  return "";
}

async function inicializarConocimiento() {
  const textoPDFs = await cargarPDFs();
  const videos = cargarVideos();
  conocimientoBase = textoPDFs + "\n" + videos;
  console.log("✅ Conocimiento cargado");
}

inicializarConocimiento();

// Ruta principal: responder preguntas normales
app.post("/api/ask", async (req, res) => {
  const { question, modo, tema } = req.body;

  if (modo === "repaso" && tema) {
    return responderModoRepaso(res, tema);
  }

  if (!question) return res.status(400).json({ error: "Pregunta faltante" });

  try {
    const prompt = `
Actuá como un profesor técnico de electrónica para alumnos de sexto año. Respondé de forma clara y técnica. Siempre indicá si la información proviene del material del profesor o si fue ampliada con fuentes externas confiables como universidades, Wikipedia u otras entidades educativas. Ofrecé la cita al final en formato APA, incluyendo enlaces.

Pregunta del alumno: "${question}"

Material del profesor:
${conocimientoBase}

Si necesitás ampliar, indicá: "¿Querés que amplíe esta información con fuentes confiables externas?".
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    const respuesta = response.choices[0].message.content.trim() + "\n\nEsta respuesta es elaborada en base al material provisto por el Profesor.";
    res.json({ answer: respuesta });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta /api/ampliar: usar solo fuentes externas confiables
app.post("/api/ampliar", async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Pregunta faltante" });

  try {
    const prompt = `
Ampliá la siguiente consulta solo con fuentes confiables externas (universidades, entidades educativas, Wikipedia, organismos públicos o privados reconocidos).
Incluí al final una lista en formato APA con enlaces reales a las fuentes utilizadas.

Consulta: "${question}"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    const texto = response.choices[0].message.content.trim();
    const links = [...texto.matchAll(/https?:\/\/[^\s)\]]+/g)].map(match => match[0]);

    res.json({
      answer: texto,
      sources: links,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para modo repaso
async function responderModoRepaso(res, tema) {
  try {
    const prompt = `
Actuá como profesor técnico. Hacé una pregunta conceptual del tema "${tema}" para evaluar conocimientos. Luego de cada respuesta, deberás indicar si está bien (✅) o mal (❌), y en este último caso explicarlo basándote en el material del profesor.

Usá solo este material:
${conocimientoBase}

Si se agota el material, decilo y comenzá a usar fuentes externas confiables.

Al final de cada pregunta, ofrecé:
📚 Nueva pregunta del mismo tema.
🔙 Volver a la página de bienvenida.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const texto = response.choices[0].message.content.trim() + "\n\nEsta respuesta es elaborada en base al material provisto por el Profesor.";
    res.json({ answer: texto });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

app.listen(port, () => console.log(`Servidor IA activo en puerto ${port}`));