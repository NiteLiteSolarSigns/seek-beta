// ebi-app/api/ebi.js
// Hybrid EBI:
// - Permanent anchors (Jesus + Jesus-events) => 50/50
// - Otherwise: AI scoring if OPENAI_API_KEY exists
// - Otherwise/failure: deterministic rubric fallback (never crashes)

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const body = req.body || {};
    const subject = String(body.subject || "").trim();
    const subjectType = String(body.subjectType || "person").trim(); // "person" | "event"
    const notes = String(body.notes || "").trim();

    if (!subject) return res.status(400).json({ error: "Missing subject" });

    // -----------------------------
    // Helpers
    // -----------------------------
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ");

    const clamp10 = (n) => Math.max(1, Math.min(10, Math.round(n)));

    const normSubject = normalize(subject);

    // Default stance: anchored (Beta)
    const mode = "anchored";

    // -----------------------------
    // Permanent anchors
    // -----------------------------
    const JESUS_PERSON_ALIASES = new Set([
      "jesus",
      "jesus christ",
      "christ",
      "the christ",
      "yeshua",
      "yeshua hamashiach",
      "lord jesus",
      "our lord jesus christ",
    ]);

    const JESUS_EVENT_ALIASES = new Set([
      // Incarnation / Birth
      "incarnation",
      "nativity",
      "birth of jesus",
      "birth of christ",
      "jesus birth",
      "christmas",

      // Passion / Death
      "passion",
      "crucifixion",
      "death of jesus",
      "jesus death",
      "good friday",
      "the cross",

      // Resurrection
      "resurrection",
      "easter",
      "empty tomb",
      "risen christ",

      // Ascension
      "ascension",
      "ascension of jesus",

      // Pentecost (Jesus sends the Spirit)
      "pentecost",
    ]);

    if (subjectType === "person" && JESUS_PERSON_ALIASES.has(normSubject)) {
      return res.status(200).json(anchor50(subject, subjectType, mode, "Jesus (permanent 50/50 reference point)", [
        "Anchor override applied: Jesus (person).",
      ]));
    }

    if (subjectType === "event" && JESUS_EVENT_ALIASES.has(normSubject)) {
      return res.status(200).json(anchor50(subject, subjectType, mode, "Jesus-events (permanent 50/50 reference point)", [
        "Anchor override applied: Jesus-event (Birth/Death/Resurrection/Ascension/Pentecost).",
      ]));
    }

    // -----------------------------
    // 1) Try AI scoring (if key exists)
    // -----------------------------
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        const ai = await scoreWithOpenAI({
          apiKey,
          subject,
          subjectType,
          notes,
        });

        // Ensure shape + clamp
        const cleaned = sanitizeAiPayload(ai, { subject, subjectType, mode });

        return res.status(200).json({
          ...cleaned,
          mode,
          anchor: "Jesus (permanent reference point)",
          engine: "ai",
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        // Fall through to deterministic fallback
      }
    }

    // -----------------------------
    // 2) Deterministic fallback (never crashes)
    // -----------------------------
    const fallback = deterministicRubric({ subject, subjectType, notes, mode });

    return res.status(200).json({
      ...fallback,
      engine: "deterministic_fallback",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err?.message || String(err) });
  }
}

// -----------------------------
// Anchor response (50/50)
// -----------------------------
function anchor50(subject, subjectType, mode, anchorLabel, rationale) {
  const scores = {
    scope_of_impact: 10,
    direction_of_tension: 10,
    longevity: 10,
    cost_paid: 10,
    bridge_function: 10,
  };

  return {
    subject,
    subject_type: subjectType,
    mode,
    anchor: anchorLabel,
    scores,
    total_score: 50,
    one_liner:
      subjectType === "event"
        ? "Anchored: This is a Jesus-event and scores 50/50 by definition."
        : "Anchored: Jesus is the EBI reference point (10/10 across all measures).",
    discussion_prompts: [
      "If this is an anchor, what does it clarify about everything else you score?",
      "Which dimension best explains why this is the hinge of the story?",
      "How does this reframe love vs fear, truth vs control, conscience vs coercion?",
    ],
    rationale,
  };
}

// -----------------------------
// OpenAI scoring (Chat Completions JSON mode)
// -----------------------------
async function scoreWithOpenAI({ apiKey, subject, subjectType, notes }) {
  const system = `
You are scoring an Explorer Bridge Index (EBI) entry for the SeekBeta program.

Permanent anchor:
- Jesus (person) = 50/50 (10/10 in each measure).
- Jesus-events (Incarnation/Birth, Passion/Crucifixion/Death, Resurrection, Ascension, Pentecost) = 50/50.
We are NOT scoring those here.

We score the given subject (person or event) as a DISCUSSION-STARTER, but in an anchored Christian frame:
love vs fear, truth vs control, conscience vs coercion.

Return ONLY valid JSON matching this schema:
{
  "scores": {
    "scope_of_impact": 1-10,
    "direction_of_tension": 1-10,
    "longevity": 1-10,
    "cost_paid": 1-10,
    "bridge_function": 1-10
  },
  "one_liner": "string",
  "discussion_prompts": ["string", "..."],
  "rationale": ["short bullet strings explaining why each dimension landed where it did"]
}

Definitions:
- scope_of_impact: breadth of influence (local -> civilizational)
- direction_of_tension: toward love/truth/freedom/conscience (+) vs fear/control/coercion (-)
- longevity: durability of influence across generations
- cost_paid: sacrifice borne by the subject (not harm inflicted)
- bridge_function: helps people cross (confusion->clarity, fear->love, division->unity)
Keep scores stable, charitable, and explainable. Avoid hot takes.
`.trim();

  const user = `
SUBJECT: ${subject}
TYPE: ${subjectType}
NOTES (user context, may be blank): ${notes || "(none)"}
`.trim();

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 700,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`OpenAI error ${resp.status}: ${txt}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No OpenAI content returned");

  return JSON.parse(content);
}

// -----------------------------
// Validate/clean AI output into your UI shape
// -----------------------------
function sanitizeAiPayload(ai, { subject, subjectType, mode }) {
  const s = ai?.scores || {};
  const clamp10 = (n) => Math.max(1, Math.min(10, Math.round(Number(n) || 1)));

  const scores = {
    scope_of_impact: clamp10(s.scope_of_impact),
    direction_of_tension: clamp10(s.direction_of_tension),
    longevity: clamp10(s.longevity),
    cost_paid: clamp10(s.cost_paid),
    bridge_function: clamp10(s.bridge_function),
  };

  const total_score = Object.values(scores).reduce((a, b) => a + b, 0);

  return {
    subject,
    subject_type: subjectType,
    mode,
    scores,
    total_score,
    one_liner: String(ai?.one_liner || "").trim() || `${subject} scored (anchored).`,
    discussion_prompts: Array.isArray(ai?.discussion_prompts) ? ai.discussion_prompts.slice(0, 6) : [],
    rationale: Array.isArray(ai?.rationale) ? ai.rationale.slice(0, 8) : [],
  };
}

// -----------------------------
// Deterministic fallback rubric (same as before, simplified)
// -----------------------------
function deterministicRubric({ subject, subjectType, notes, mode }) {
  const normalize = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ");

  const clamp10 = (n) => Math.max(1, Math.min(10, Math.round(n)));

  const text = `${normalize(subject)} ${normalize(notes)}`.trim();

  let scores =
    subjectType === "event"
      ? { scope_of_impact: 6, direction_of_tension: 6, longevity: 6, cost_paid: 5, bridge_function: 6 }
      : { scope_of_impact: 6, direction_of_tension: 6, longevity: 6, cost_paid: 6, bridge_function: 6 };

  const rationale = [];
  const add = (k, d, r) => {
    scores[k] += d;
    rationale.push(`${k}: ${r} (${d >= 0 ? "+" : ""}${d})`);
  };
  const hasAny = (arr) => arr.some((k) => text.includes(k));

  if (hasAny(["world", "global", "empire", "council", "creed", "reformation", "schism"])) add("scope_of_impact", 2, "civilizational-scale signal");
  if (hasAny(["martyr", "persecution", "exile", "prison", "torture", "poverty", "sacrifice"])) add("cost_paid", 3, "explicit cost/suffering language");
  if (hasAny(["love", "mercy", "forgiveness", "charity", "grace", "truth", "conscience", "freedom"])) add("direction_of_tension", 2, "love/truth/freedom language");
  if (hasAny(["tyranny", "control", "coercion", "genocide", "hate", "terror"])) add("direction_of_tension", -3, "control/harm language");
  if (hasAny(["creed", "canon", "scripture", "doctrine", "tradition", "monastery", "order", "university"])) add("longevity", 2, "institution/text endurance signal");
  if (hasAny(["bridge", "reconcile", "unity", "mission", "evangel", "catechesis", "teach", "disciple"])) add("bridge_function", 2, "explicit bridge-building language");
  if (hasAny(["schism", "division", "split", "war"])) add("bridge_function", -2, "division signal");

  scores = {
    scope_of_impact: clamp10(scores.scope_of_impact),
    direction_of_tension: clamp10(scores.direction_of_tension),
    longevity: clamp10(scores.longevity),
    cost_paid: clamp10(scores.cost_paid),
    bridge_function: clamp10(scores.bridge_function),
  };

  const total_score = Object.values(scores).reduce((a, b) => a + b, 0);

  return {
    subject,
    subject_type: subjectType,
    mode,
    anchor: "Jesus (permanent reference point)",
    scores,
    total_score,
    one_liner: `${subject} scored (anchored; fallback rubric—AI unavailable).`,
    discussion_prompts: [
      "Relative to Jesus as the anchor, which score would you adjust first—and why?",
      "Where do you see love vs fear, truth vs control, conscience vs coercion?",
      "What is the cost paid (not inflicted), and what does it produce?",
      "What does this help people cross?",
    ],
    rationale,
  };
}