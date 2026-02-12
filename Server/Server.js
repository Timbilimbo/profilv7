// server/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import fs from "fs";

const config = JSON.parse(
  fs.readFileSync("./config.local.json", "utf8")
);

const apiKey = config.OPENAI_API_KEY;

dotenv.config();

console.log("ENV KEY loaded:", !!apiKey);

const app = express();
app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }
});

const client = apiKey
  ? new OpenAI({ apiKey: apiKey })
  : null;

const SYSTEM_PROMPT = `Du är Study Buddy, en Study Content Generator.

MÅL
Skapa quiz och flashcards som är tydliga, korrekta och redo att användas i en studie-app.

HÅRDA REGLER (viktigt)
- Inga långa stycken i frågor/svar.
- Flashcards: front max 1 mening; back max 2–3 meningar.
- Quiz question: max 2 meningar (undantag max 4).
- Inga dubbletter: samma fråga får inte förekomma två gånger.
- Quiz ska täcka olika delar av materialet, inte samma sak om och om igen.

QUIZ-TYPER
- multiple_choice: måste ha exakt 4 korta alternativ (A–D). answer måste vara exakt ett av alternativen.
- true_false: options ska vara ["Sant","Falskt"]. answer måste vara "Sant" eller "Falskt".
- short_answer: options ska vara [] (tom lista). answer ska vara ett kort facit (1–2 meningar).

TVÅ LÄGEN
- Om underlaget är långt: använd främst materialet, sammanfatta internt, citera inte.
- Om input är kort (ämne): använd allmän kunskap.

OUTPUT
Svara ENDAST med giltig JSON.

Flashcards:
{"mode":"flashcards","flashcards":[{"front":"...","back":"..."}]}

Quiz:
{"mode":"quiz","quiz":[{"type":"...","level":"...","question":"...","options":[...],"answer":"..."}]}

Inga studietips, inga följdfrågor.`;

function clampCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 10;
  return Math.max(3, Math.min(25, Math.floor(n)));
}

function cleanText(s) {
  return String(s || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function truncateForAI(text, maxChars = 12000) {
  const t = cleanText(text);
  return t.length > maxChars ? t.slice(0, maxChars) : t;
}

function buildExportFlashcards(cards) {
  let out = "";
  cards.forEach((c, i) => {
    out += `Flashcard ${i + 1}\n`;
    out += `Framsida: ${c.front}\n`;
    out += `Baksida: ${c.back}\n\n`;
  });
  return out.trim();
}

function buildExportQuiz(questions) {
  let out = "";
  questions.forEach((q, i) => {
    const typeLabel =
      q.type === "multiple_choice" ? "Flervalsfråga" :
      q.type === "true_false" ? "Sant / falskt" :
      "Kortsvar";

    out += `Fråga ${i + 1} (${typeLabel}, ${q.level})\n`;
    out += `${q.question}\n`;

    if (q.options && q.options.length) {
      q.options.forEach((opt) => (out += `${opt}\n`));
    }

    out += `Rätt svar: ${q.answer}\n\n`;
  });
  return out.trim();
}

// fallback om ingen nyckel finns
function fallbackFlashcards(topicOrText, count) {
  const topic = cleanText(topicOrText).slice(0, 80) || "Ämne";
  const cards = [];
  for (let i = 0; i < count; i++) {
    cards.push({
      front: `Vad betyder ett centralt begrepp i "${topic}"?`,
      back: `Kort svar. (Lägg till OPENAI_API_KEY för bättre resultat.)`
    });
  }
  return cards;
}

function fallbackQuiz(topicOrText, count) {
  const topic = cleanText(topicOrText).slice(0, 80) || "Ämne";
  const qs = [];
  for (let i = 0; i < count; i++) {
    qs.push({
      type: "true_false",
      level: i % 3 === 0 ? "lätt" : i % 3 === 1 ? "medel" : "svår",
      question: `Det här handlar om ${topic}.`,
      options: ["Sant", "Falskt"],
      answer: "Sant"
    });
  }
  return qs;
}

function safeString(x, maxLen) {
  const s = String(x || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s;
}

function normalizeFlashcards(cards, count) {
  const out = (cards || []).slice(0, count).map((c) => ({
    front: safeString(c.front, 160),
    back: safeString(c.back, 320)
  }));
  while (out.length < count) out.push({ front: "Begrepp?", back: "Kort svar." });
  return out;
}

function dedupeByQuestion(items, count) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = (it.question || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= count) break;
  }
  return out;
}

function normalizeQuiz(quiz, count) {
  let normalized = (quiz || []).map((q) => {
    let type = String(q.type || "short_answer");
    let level = String(q.level || "medel");
    let question = safeString(q.question, 240);
    let answer = safeString(q.answer, 200);

    let options = Array.isArray(q.options) ? q.options.map(String) : [];
    options = options.map(o => safeString(o, 80)).filter(Boolean);

    if (type === "true_false") {
      options = ["Sant", "Falskt"];
      const a = answer.toLowerCase();
      answer = a.includes("fals") ? "Falskt" : a.includes("sant") ? "Sant" : "Sant";
    }

    if (type === "multiple_choice") {
      if (options.length !== 4) {
        // om modellen inte gav 4 alternativ, gör om till kortsvar
        type = "short_answer";
        options = [];
      } else {
        // säkerställ att answer matchar ett av alternativen
        if (!options.includes(answer)) {
          // försök matcha på bokstav A/B/C/D
          const m = answer.match(/^[A-D]\)/);
          if (m) {
            const found = options.find(o => o.startsWith(m[0]));
            if (found) answer = found;
          }
          if (!options.includes(answer)) answer = options[0];
        }
      }
    }

    if (type === "short_answer") {
      options = [];
      // svar kan vara tomt ibland, fyll med kort facit-text
      if (!answer) answer = "Kort facit baserat på materialet.";
    }

    return { type, level, question, options, answer };
  });

  // ta bort exakta dubbletter av frågor
  normalized = dedupeByQuestion(normalized, count);

  // fyll på om det blev för få efter dedupe
  while (normalized.length < count) {
    normalized.push({
      type: "short_answer",
      level: "lätt",
      question: "Förklara ett centralt begrepp i materialet (kort).",
      options: [],
      answer: "Kort facit."
    });
  }

  return normalized.slice(0, count);
}

async function generateWithOpenAI({ mode, count, materialText }) {
  const isTopicMode = materialText.length < 250;

  const schemaHint = mode === "flashcards"
    ? `Skapa exakt ${count} flashcards.
Regler:
- front: max 1 mening / max 120 tecken
- back: max 2–3 meningar / max 280 tecken
- inga dubbletter
Returnera ENDAST JSON:
{"mode":"flashcards","flashcards":[{"front":"...","back":"..."}]}`
    : `Skapa exakt ${count} quizfrågor med blandade typer.
Regler:
- inga dubbletter
- täck olika delar av materialet
- question: max 2 meningar (undantag max 4) / max 240 tecken
- true_false: 1 kort påstående, options ["Sant","Falskt"], answer = Sant eller Falskt
- multiple_choice: exakt 4 korta alternativ (A)–D)), answer måste vara exakt ett av alternativen
- short_answer: options [], answer kort facit
Returnera ENDAST JSON:
{"mode":"quiz","quiz":[{"type":"...","level":"...","question":"...","options":[...],"answer":"..."}]}`;

  const sourceRule = isTopicMode
    ? `ÄMNES-LÄGE: Input är kort. Använd allmän kunskap om ämnet.`
    : `MATERIAL-LÄGE: Input är långt. Sammanfatta internt och skapa frågor utan att citera långa stycken.`;

  const input = `SVARA ENDAST MED JSON.

INSTRUKTION:
${schemaHint}

${sourceRule}

UNDERLAG/ÄMNE:
${materialText}`;

  const resp = await client.responses.create({
    model:  "gpt-4o-mini",
    instructions: SYSTEM_PROMPT,
    input
  });

  const raw = resp.output_text || "";
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) throw new Error("AI svarade inte i JSON.");

  return JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/generate", upload.single("pdf"), async (req, res) => {
  try {
    const mode = String(req.body.mode || "flashcards");
    const count = clampCount(req.body.count);
    const text = cleanText(req.body.text);

    let materialText = text;

    if (req.file) {
      const pdf = await pdfParse(req.file.buffer);
      materialText = cleanText(pdf.text);
    }

    if (!materialText || materialText.length < 3) {
      return res.status(400).json({ error: "Skriv ett ämne, klistra in text eller välj en PDF." });
    }

    materialText = truncateForAI(materialText, 12000);

    let result;
    if (client) {
      result = await generateWithOpenAI({ mode, count, materialText });
    } else {
      result = mode === "quiz"
        ? { mode: "quiz", quiz: fallbackQuiz(materialText, count) }
        : { mode: "flashcards", flashcards: fallbackFlashcards(materialText, count) };
    }

    if (result.mode === "flashcards") {
      const cards = normalizeFlashcards(result.flashcards, count);
      return res.json({
        mode: "flashcards",
        flashcards: cards,
        exportText: buildExportFlashcards(cards)
      });
    }

    if (result.mode === "quiz") {
      const questions = normalizeQuiz(result.quiz, count);
      return res.json({
        mode: "quiz",
        quiz: questions,
        exportText: buildExportQuiz(questions)
      });
    }

    return res.status(500).json({ error: "Ogiltigt svarformat." });
  } catch (e) {
    console.error("GENERATE ERROR:", e);
    return res.status(500).json({ error: e?.message || "Serverfel" });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server kör: http://localhost:${PORT}`));
