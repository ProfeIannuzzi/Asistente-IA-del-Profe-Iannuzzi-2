import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { Configuration, OpenAIApi } from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Ruta base de documentos entrenados
const TRAINING_DOCS_PATH = path.join(process.cwd(), 'DOCUMENTOS DE ENTRENAMIENTO');

// Helper para leer documentos de entrenamiento (puedes ampliar según formato)
function getTrainingTexts() {
  const files = fs.readdirSync(TRAINING_DOCS_PATH);
  let allText = '';

  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.txt') {
      const content = fs.readFileSync(path.join(TRAINING_DOCS_PATH, file), 'utf8');
      allText += '\n' + content;
    } else if (ext === '.pdf') {
      // Aquí podrías usar librerías para leer PDFs, ejemplo: pdf-parse o similar
      // Por simplicidad, este ejemplo no extrae PDFs
    }
  });

  return allText;
}

// Estado simple en memoria para modo repaso (ideal guardar en DB)
const sessions = {};

// API para iniciar tema y generar primera pregunta
app.post('/start-review', async (req, res) => {
  try {
    const { userId, topic } = req.body;
    if (!userId || !topic) {
      return res.status(400).json({ error: 'Faltan parámetros userId o topic.' });
    }

    // Leer material de entrenamiento
    const trainingText = getTrainingTexts();

    // Prompt para generar pregunta
    const prompt = `
Eres un profesor que genera preguntas didácticas para repaso de un tema específico.

Tema: ${topic}

Usa SOLO el siguiente material para generar la pregunta:

${trainingText}

Si no hay suficiente información sobre el tema en el material, indica explícitamente que la pregunta será de fuentes externas.

Haz una pregunta corta y clara para el alumno.
`;

    const response = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
    });

    const question = response.data.choices[0].message.content.trim();

    // Guardar estado sesión simple
    sessions[userId] = {
      topic,
      lastQuestion: question,
      fromTrainingMaterial: trainingText.toLowerCase().includes(topic.toLowerCase()),
      stage: 'question-asked',
    };

    res.json({
      question,
      infoSource: sessions[userId].fromTrainingMaterial
        ? 'Material provisto por el Profesor'
        : 'Fuentes externas de internet',
    });
  } catch (error) {
    console.error('Error en /start-review:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// API para que alumno responda y se corrija
app.post('/answer-review', async (req, res) => {
  try {
    const { userId, answer } = req.body;
    if (!userId || !answer) {
      return res.status(400).json({ error: 'Faltan parámetros userId o answer.' });
    }
    const session = sessions[userId];
    if (!session || session.stage !== 'question-asked') {
      return res.status(400).json({ error: 'No hay pregunta activa para este usuario.' });
    }

    // Prompt para corregir respuesta y dar retroalimentación
    let prompt = `
Eres un profesor que corrige la respuesta de un alumno a una pregunta específica y da retroalimentación clara.

Tema: ${session.topic}
Pregunta: ${session.lastQuestion}
Respuesta del alumno: ${answer}

Evalúa si la respuesta es correcta o incorrecta y explica por qué, utilizando 
${session.fromTrainingMaterial ? 'el material provisto por el Profesor.' : 'fuentes externas de internet.'}

Finaliza indicando si la información es de material propio o externo.
`;

    const response = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.6,
      max_tokens: 250,
    });

    const correction = response.data.choices[0].message.content.trim();

    // Preparar siguiente pregunta solo si la respuesta fue correcta o no, para seguir el repaso
    // Generamos nueva pregunta igual que en /start-review, pero acá podrías agregar lógica más avanzada
    const trainingText = getTrainingTexts();

    const promptNextQuestion = `
Eres un profesor que genera la siguiente pregunta didáctica para repaso del tema: ${session.topic}.

Usa SOLO el siguiente material para generar la pregunta:

${trainingText}

Si no hay suficiente información, indica que las preguntas serán de fuentes externas.

Haz una pregunta corta y clara que complemente el aprendizaje.
`;

    const responseNext = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: promptNextQuestion }],
      temperature: 0.7,
      max_tokens: 150,
    });

    const nextQuestion = responseNext.data.choices[0].message.content.trim();

    // Actualizar sesión
    session.lastQuestion = nextQuestion;
    session.stage = 'question-asked';
    session.fromTrainingMaterial = trainingText.toLowerCase().includes(session.topic.toLowerCase());

    res.json({
      correction,
      nextQuestion,
      infoSourceNext: session.fromTrainingMaterial
        ? 'Material provisto por el Profesor'
        : 'Fuentes externas de internet',
    });
  } catch (error) {
    console.error('Error en /answer-review:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server escuchando en puerto ${PORT}`);
});