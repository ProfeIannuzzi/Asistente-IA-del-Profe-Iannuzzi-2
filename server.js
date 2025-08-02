const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Verificar si la clave está definida
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ ERROR: La variable OPENAI_API_KEY NO está definida.");
} else {
  console.log("✅ Clave API detectada (truncada):", process.env.OPENAI_API_KEY.slice(0, 10) + "...");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/ask", async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Pregunta faltante" });
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: question }],
      temperature: 0.7,
    });
    res.json({ answer: response.choices[0].message.content.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => console.log(`Servidor IA activo en puerto ${port}`));