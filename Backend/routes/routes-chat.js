const express = require('express');
const route = express.Router();
const multer = require('multer');

// Audio stored in memory for processing — not persisted to disk
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// POST /chat — text message to RAG AI
route.post('/chat', async (req, res) => {
  try {
    const { message, userId, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Le message est obligatoire' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TODO: Replace this block with your actual RAG / LLM integration.
    //
    // Example — Ollama (local):
    //   const ollamaRes = await fetch('http://localhost:11434/api/chat', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       model: 'your-model-name',          // set by server config
    //       messages: [
    //         ...history.map(h => ({ role: h.role, content: h.content })),
    //         { role: 'user', content: message.trim() },
    //       ],
    //       stream: false,
    //     }),
    //   });
    //   const ollamaData = await ollamaRes.json();
    //   return res.status(200).json({ reply: ollamaData.message.content });
    //
    // Example — OpenAI-compatible endpoint:
    //   const openaiRes = await fetch(process.env.LLM_BASE_URL + '/chat/completions', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LLM_API_KEY}` },
    //     body: JSON.stringify({
    //       model: process.env.LLM_MODEL,
    //       messages: [...history, { role: 'user', content: message.trim() }],
    //     }),
    //   });
    //   const openaiData = await openaiRes.json();
    //   return res.status(200).json({ reply: openaiData.choices[0].message.content });
    // ─────────────────────────────────────────────────────────────────────────

    // Placeholder — remove once your RAG is connected
    const reply = `[Assistant SESAME] Vous avez posé : "${message.trim()}". Connectez votre modèle RAG dans Backend/routes/routes-chat.js pour activer les vraies réponses.`;
    res.status(200).json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Erreur lors de la génération de la réponse' });
  }
});

// POST /chat/voice — audio file → transcription → RAG
route.post('/chat/voice', audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier audio requis' });
    }

    console.log(`[Voice] Received audio: ${req.file.originalname || 'audio'}, size: ${req.file.size} bytes`);

    // ─────────────────────────────────────────────────────────────────────────
    // TODO: Replace this block with your actual Speech-to-Text integration.
    //
    // Example — OpenAI Whisper:
    //   const FormData = require('form-data');
    //   const form = new FormData();
    //   form.append('file', req.file.buffer, {
    //     filename: req.file.originalname || 'audio.m4a',
    //     contentType: req.file.mimetype || 'audio/m4a',
    //   });
    //   form.append('model', 'whisper-1');
    //   form.append('language', 'fr');
    //   const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    //     method: 'POST',
    //     headers: { Authorization: `Bearer ${process.env.OPENAI_KEY}`, ...form.getHeaders() },
    //     body: form,
    //   });
    //   const { text: transcription } = await whisperRes.json();
    //   // Then pass transcription to RAG:
    //   // ... same logic as POST /chat with transcription as message
    // ─────────────────────────────────────────────────────────────────────────

    // Placeholder transcription — remove once STT is connected
    const transcription = '[Transcription placeholder — connectez votre fournisseur STT (ex. Whisper)]';
    const reply = `[Assistant SESAME] Message vocal reçu. Transcription : "${transcription}". Connectez votre STT dans Backend/routes/routes-chat.js.`;

    res.status(200).json({ reply, transcription });
  } catch (error) {
    console.error('Voice chat error:', error);
    res.status(500).json({ error: 'Erreur lors du traitement du message vocal' });
  }
});

module.exports = route;
