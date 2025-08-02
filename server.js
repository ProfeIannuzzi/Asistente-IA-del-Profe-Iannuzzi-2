const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { OpenAI } = require("openai");

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json());

const entrenamientoDir = path.join(__dirname, "DOCUMENTOS DE ENTRENAMIENTO");

async function leerDocumentosEntrenamiento() {
  const archivos = fs.readdirSync(entrenamientoDir);
  const contenidos = await Promise.all(
    archivos.map(async (file) => {
      const ruta = path.join(entrenamientoDir, file);
      if (file.endsWith(".txt") || file.endsWith(".md")) {
        return fs.readFileSync(ruta, "utf8");
      } else if (file.endsWith(".pdf")) {
        const dataBuffer = fs.readFileSync(ruta);
        const data = await pdfParse(dataBuffer);
        return data.text;
      } else {
        return "";
      }
    })
  );
  return contenidos.join("\n");
}

app.post("/api/ask", async (req, res) => {
  const { question, ampliar, modo, tema } = req.body;
  if (!question && !tema) return res.status(400).json({ error: "Pregunta o tema faltante" });

  let prompt = "";

  if (modo === "repaso") {
    prompt = `Generá una única pregunta de repaso sobre el tema: "${tema}". 
Debe basarse exclusivamente en los materiales provistos por el profesor disponibles en el directorio DOCUMENTOS DE ENTRENAMIENTO.`;
  } else {
    const base = await leerDocumentosEntrenamiento();
    prompt = `Respondé a la siguiente pregunta como ayudante académico para un alumno de sexto año de escuela técnica. 
Usá en primer lugar este material base provisto por el profesor:\n${base}\n\n
Pregunta del alumno: "${question}".`;

    if (ampliar) {
      prompt += `\n\nLuego, si es necesario, ampliá con fuentes de confianza como universidades, Wikipedia o entidades educativas públicas o privadas, 
indicando claramente cuáles partes provienen del material del profesor y cuáles fueron extraídas de internet. Mostrá siempre los links a las fuentes.`;
    }

    prompt += `\n\nAl final indicá: "Esta respuesta es elaborada en base al material provisto por el Profesor"${ampliar ? " y ampliada con fuentes confiables." : "."}`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    const output = completion.choices[0].message.content;
    res.json({ answer: output.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor IA activo en puerto ${port}`);
});