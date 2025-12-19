import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "200kb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve the static site from /public
app.use(express.static(path.join(__dirname, "public")));

function clamp10(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(10, Math.round(x)));
}

app.post("/api/ebi", async (req, res) => {
  try {
    const { subject, subjectType = "person", notes = "" } = req.body || {};
    if (!subject || typeof subject !== "string") {
      return res.status(400).json({ error: "Missing subject" });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Server missing OPENAI_API_KEY" });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const framework = `
You are scoring the Explorer Bridge Index (EBI), a DISCUSSION framework (not verdicts).
Return JSON only.

EBI Dimensions (0–10 each):
1) scope_of_impact: How much of the human story it touched. (Scope ≠ goodness.)
2) direction_of_tension: Net movement on: Love↔Fear, Truth↔Control, Conscience↔Coercion.
3) longevity: Endurance over time (fruit under pressure).
4) cost_paid: Cost borne by the carrier (NOT suffering inflicted on others).
5) bridge_function: What it helps people cross; does it lead toward love/truth/freedom?

Rules:
- Use bands, not fake precision; integers 0–10 only.
- If subject is controversial, be respectful and non-sensational.
- Avoid theological verdicts; focus on historical/cultural function.
- Include 4–6 discussion prompts.

Output schema:
{
  "subject": string,
  "subject_type": "person"|"event"|"idea",
  "scores": { "scope_of_impact": int, "direction_of_tension": int, "longevity": int, "cost_paid": int, "bridge_function": int },
  "total_score": int,   // sum of the five
  "one_liner": string,
  "rationales": { ... }, // brief 1–2 sentences per dimension
  "discussion_prompts": string[]
}
`.trim();

    const userPrompt = `
Subject: ${subject}
Type: ${subjectType}
Notes: ${notes || "(none)"}

Score using EBI and return JSON in the required schema. 
`.trim();

    // Responses API (recommended for new projects)
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: framework },
          { role: "user", content: userPrompt }
        ],
        // Ask for strict JSON output
        response_format: { type: "json_object" }
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.error?.message || "OpenAI request failed",
        details: data?.error || data
      });
    }

    // Responses API returns content in output text; parse it
    const text = (data?.output_text || "").trim();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "Model did not return valid JSON", raw: text });
    }

    // Normalize scores
    const s = parsed?.scores || {};
    const scores = {
      scope_of_impact: clamp10(s.scope_of_impact),
      direction_of_tension: clamp10(s.direction_of_tension),
      longevity: clamp10(s.longevity),
      cost_paid: clamp10(s.cost_paid),
      bridge_function: clamp10(s.bridge_function),
    };
    const total = scores.scope_of_impact + scores.direction_of_tension + scores.longevity + scores.cost_paid + scores.bridge_function;

    parsed.subject = String(parsed.subject || subject);
    parsed.subject_type = ["person", "event", "idea"].includes(parsed.subject_type) ? parsed.subject_type : subjectType;
    parsed.scores = scores;
    parsed.total_score = total;

    return res.json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
});

// Basic health check
app.get("/api/health", (_, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`EBI running on http://localhost:${port}`));