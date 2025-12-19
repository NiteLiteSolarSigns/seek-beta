// ebi-app/api/ebi.js

export default function handler(req, res) {
  // Basic CORS (safe default)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") return res.status(204).end();

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const body = req.body || {};
    const subject = String(body.subject || "").trim();
    const subjectType = String(body.subjectType || "person").trim();
    const notes = String(body.notes || "").trim();

    if (!subject) {
      return res.status(400).json({ error: "Missing subject" });
    }

    // -----------------------------
    // MODE SELECTION
    // Default = anchored (Beta stance)
    // Optional override: include "#explorer" in notes
    // -----------------------------
    const notesLower = notes.toLowerCase();
    const mode = notesLower.includes("#explorer") ? "explorer" : "anchored";

    // -----------------------------
    // NORMALIZE SUBJECT
    // -----------------------------
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ");

    const normalized = normalize(subject);

    // -----------------------------
    // PERMANENT ANCHOR: JESUS
    // Jesus is the reference point, not a contestant.
    // -----------------------------
    const JESUS_ALIASES = new Set([
      "jesus",
      "jesus christ",
      "christ",
      "the christ",
      "yeshua",
      "yeshua hamashiach",
      "lord jesus",
      "our lord jesus christ",
    ]);

    if (mode === "anchored" && JESUS_ALIASES.has(normalized)) {
      const scores = {
        scope_of_impact: 10,
        direction_of_tension: 10,
        longevity: 10,
        cost_paid: 10,
        bridge_function: 10,
      };

      return res.status(200).json({
        subject,
        subject_type: subjectType,
        mode,
        anchor: "Jesus (50/50 reference point)",
        scores,
        total_score: 50,
        one_liner: "Anchored Mode: Jesus is the EBI reference point (10/10 across all measures).",
        discussion_prompts: [
          "If Jesus is the 10/10 anchor, what changes in how you score everyone else?",
          "Which measure do you personally overweight (scope, cost, longevity, etc.)?",
          "What evidence supports your score adjustments?",
        ],
        timestamp: new Date().toISOString(),
      });
    }

    // -----------------------------
    // BASELINE SCORING ENGINE (deterministic + stable)
    // NOTE: This is still a starter engine for *everything else*.
    // In anchored mode, it's presented as "relative-to-anchor" discussion fuel.
    // -----------------------------
    const seed = (subject + "|" + subjectType + "|" + notes).length;
    const clamp = (n) => Math.max(1, Math.min(10, n));

    const scores = {
      scope_of_impact: clamp((seed % 10) + 1),
      direction_of_tension: clamp(((seed + 3) % 10) + 1),
      longevity: clamp(((seed + 6) % 10) + 1),
      cost_paid: clamp(((seed + 1) % 10) + 1),
      bridge_function: clamp(((seed + 8) % 10) + 1),
    };

    const total_score = Object.values(scores).reduce((a, b) => a + b, 0);

    const one_liner =
      mode === "anchored"
        ? `${subject} scored in Anchored Mode (measured in light of the Jesus anchor; baseline engine for now).`
        : `${subject} scored in Explorer Mode (unanchored; discussion-first baseline).`;

    const discussion_prompts =
      mode === "anchored"
        ? [
            "Relative to Jesus as the 10/10 anchor, what should change in these scores?",
            "Where do you see alignment with love, truth, and freedom?",
            "What is the cost paid (not inflicted)?",
            "What does this person/event help people cross?",
            "What would a thoughtful critic argue—and how would you respond charitably?",
          ]
        : [
            "What evidence supports this score?",
            "Which measure feels too high or too low—and why?",
            "What would someone who disagrees say?",
            "Does this move us toward love or toward control?",
          ];

    return res.status(200).json({
      subject,
      subject_type: subjectType,
      mode,
      anchor: mode === "anchored" ? "Jesus (reference point)" : "None (unanchored)",
      scores,
      total_score,
      one_liner,
      discussion_prompts,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      detail: err?.message || String(err),
    });
  }
}