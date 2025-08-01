const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

app.post('/api/ask', async (req, res) => {
  try {
    const { question } = req.body;

    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { role: "system", content: "Sos un asistente académico del profesor Iannuzzi. Respondé con lenguaje técnico apropiado para alumnos de 6to año de escuela técnica. Prioridad a contenido de documentos del profe, luego Wikipedia, luego fuentes académicas confiables. Indicá fuente al final. Si querés ampliar con internet, preguntá primero al alumno. No respondas si se te habla con lenguaje inapropiado." },
        { role: "user", content: question }
      ]
    });

    res.json(completion.data);
  } catch (error) {
    console.error("Error al consultar OpenAI:", error);
    res.status(500).json({ error: "Error al consultar OpenAI" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});