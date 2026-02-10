import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

function fallbackFeedback({ type, rubric, text }) {
  const tips = {
    structure: [
      "Skriv en tydlig inledning med ämne + tes.",
      "Dela upp texten i stycken: ett argument per stycke.",
      "Avsluta med en slutsats som knyter ihop allt."
    ],
    language: [
      "Variera meningsstarter så texten känns mer flytande.",
      "Byt ut vaga ord (”bra”, ”dåligt”) mot mer specifika ord.",
      "Läs igenom och rätta stavning och syftning."
    ],
    analysis: [
      "Utveckla dina påståenden med exempel och konsekvenser.",
      "Ta upp minst två perspektiv och jämför dem.",
      "Skriv tydligt varför du tycker som du gör."
    ],
    sources: [
      "Lägg till minst en trovärdig källa som stöd.",
      "Skriv källor på ett konsekvent sätt (titel, datum, författare).",
      "Förklara kort varför källan är trovärdig."
    ]
  };

  const short = text.length > 200 ? text.slice(0, 200) + "…" : text;

  return {
    summary:
      `Du har en tydlig idé och ett ämne som går att utveckla. För att höja kvaliteten behöver du göra resonemanget mer konkret och förbättra helheten. (Utdrag: “${short}”)`,
    improvements: tips[rubric] || tips.structure,
    nextStep:
      `Välj 1 tips och skriv om ett stycke. Om det är en ${type === "lab" ? "labbrapport" : "uppsats"}, fokusera på röd tråd och tydliga övergångar.`
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/feedback", (req, res) => {
  const { type, rubric, text } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Ingen text skickades." });
  }

  const cleanText = text.trim();
  if (cleanText.length < 20) {
    return res.status(400).json({ error: "Texten är för kort. Skriv lite mer." });
  }

  const result = fallbackFeedback({
    type: String(type || "essay"),
    rubric: String(rubric || "structure"),
    text: cleanText
  });

  res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server kör: http://localhost:${PORT}`);
});
export default app;
