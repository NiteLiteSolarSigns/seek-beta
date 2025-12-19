// ebi-app/api/ebi.js

export default function handler(req, res) {
  // CORS (safe default)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const body = req.body || {};
    const subject = String(body.subject || "").trim();
    const subjectType = String(body.subjectType || "person").trim();
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
    const normNotes = normalize(notes);

    // Optional override (rare): put "#explorer" in notes
    // Default = anchored (Beta stance)
    const mode = normNotes.includes("explorer") && notes.toLowerCase().includes("#explorer")
      ? "explorer"
      : "anchored";

    // -----------------------------
    // Permanent PERSON anchor: Jesus
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

    // -----------------------------
    // Permanent EVENT anchors: Jesus-events
    // Any event directly constitutive of Jesus' saving work = 50/50
    // -----------------------------
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

      // Pentecost (Spirit poured out as promised by Christ)
      "pentecost",
    ]);

    // Anchor returns (only in anchored mode)
    if (mode === "anchored") {
      if (subjectType === "person" && JESUS_PERSON_ALIASES.has(normSubject)) {
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
          anchor: "Jesus (permanent 50/50 reference point)",
          scores,
          total_score: 50,
          one_liner:
            "Anchored: Jesus is the EBI reference point (10/10 across all measures).",
          discussion_prompts: [
            "If Jesus is the 10/10 anchor, what changes in how you score everyone else?",
            "Which measure do you personally overweight (scope, cost, longevity, etc.)?",
            "What evidence supports your score adjustments?",
          ],
          rationale: ["Anchor override applied: Jesus (person)."],
          timestamp: new Date().toISOString(),
        });
      }

      if (subjectType === "event" && JESUS_EVENT_ALIASES.has(normSubject)) {
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
          anchor: "Jesus-events (permanent 50/50 reference point)",
          scores,
          total_score: 50,
          one_liner:
            "Anchored: This is a Jesus-event (Birth/Death/Resurrection/Ascension/Pentecost) and scores 50/50 by definition.",
          discussion_prompts: [
            "If this is a 50/50 anchor-event, what does it clarify about all other events?",
            "Which measure best explains why this event is the hinge of the story?",
          ],
          rationale: ["Anchor override applied: Jesus-event."],
          timestamp: new Date().toISOString(),
        });
      }
    }

    // -----------------------------
    // Deterministic rubric scorer (no AI)
    // Uses keywords in subject + notes to adjust 5 dimensions.
    // Stable, explainable, discussion-first.
    // -----------------------------
    const text = `${normSubject} ${normNotes}`.trim();

    // Starting point (slightly different for person vs event)
    let scores = subjectType === "event"
      ? { scope_of_impact: 6, direction_of_tension: 6, longevity: 6, cost_paid: 5, bridge_function: 6 }
      : { scope_of_impact: 6, direction_of_tension: 6, longevity: 6, cost_paid: 6, bridge_function: 6 };

    const rationale = [];

    const add = (key, delta, reason) => {
      scores[key] += delta;
      if (reason) rationale.push(`${key}: ${reason} (${delta >= 0 ? "+" : ""}${delta})`);
    };

    const hasAny = (arr) => arr.some((k) => text.includes(k));

    // --- Scope of Impact (reach: local → civilizational)
    if (hasAny(["world", "global", "empire", "roman", "islam", "reformation", "schism", "crusade", "council", "creed"])) {
      add("scope_of_impact", 2, "civilizational-scale signal");
    }
    if (hasAny(["printing press", "gutenberg", "internet", "industrial", "revolution", "aviation", "wright", "atomic"])) {
      add("scope_of_impact", 2, "tech/epoch-changing signal");
    }
    if (hasAny(["local", "parish", "village", "small", "regional"])) {
      add("scope_of_impact", -1, "local/regional framing");
    }

    // --- Direction of Tension (love/truth/freedom vs fear/control/coercion)
    if (hasAny(["love", "mercy", "forgiveness", "charity", "grace", "truth", "conscience", "freedom", "dignity"])) {
      add("direction_of_tension", 2, "love/truth/freedom language");
    }
    if (hasAny(["tyranny", "control", "coercion", "propaganda", "genocide", "hate", "terror", "racism", "slavery"])) {
      add("direction_of_tension", -3, "control/harm language");
    }
    if (hasAny(["reform", "repent", "renewal", "revival", "awakening"])) {
      add("direction_of_tension", 1, "renewal language");
    }

    // --- Longevity (enduring effects, institutions, doctrines, texts)
    if (hasAny(["creed", "canon", "scripture", "bible", "doctrine", "council", "tradition"])) {
      add("longevity", 2, "doctrinal/textual endurance signal");
    }
    if (hasAny(["monastery", "benedict", "order", "rule", "university", "scholastic", "aquinas"])) {
      add("longevity", 2, "institution-building signal");
    }
    if (hasAny(["trend", "fad", "short", "temporary"])) {
      add("longevity", -2, "short-lived framing");
    }

    // --- Cost Paid (suffering borne, sacrifice, martyrdom)
    if (hasAny(["martyr", "martyred", "persecution", "exile", "prison", "torture", "suffer", "poverty", "sacrifice"])) {
      add("cost_paid", 3, "explicit cost/suffering language");
    }
    if (hasAny(["risk", "lost", "gave up", "renounced"])) {
      add("cost_paid", 1, "voluntary cost language");
    }
    if (hasAny(["power", "wealth", "fame", "political"])) {
      add("cost_paid", -1, "status/power framing (often lowers personal cost)");
    }

    // --- Bridge Function (helps people cross: confusion→clarity, fear→love, division→unity)
    if (hasAny(["bridge", "reconcile", "unity", "mission", "evangel", "convert", "catechesis", "teach", "disciple"])) {
      add("bridge_function", 2, "explicit bridge-building language");
    }
    if (hasAny(["translation", "books", "saved the books", "manuscript", "scribe"])) {
      add("bridge_function", 2, "preservation/hand-off signal");
    }
    if (hasAny(["schism", "division", "split", "sect", "war"])) {
      add("bridge_function", -2, "division signal");
    }

    // Clamp
    scores = {
      scope_of_impact: clamp10(scores.scope_of_impact),
      direction_of_tension: clamp10(scores.direction_of_tension),
      longevity: clamp10(scores.longevity),
      cost_paid: clamp10(scores.cost_paid),
      bridge_function: clamp10(scores.bridge_function),
    };

    const total_score = Object.values(scores).reduce((a, b) => a + b, 0);

    const one_liner =
      mode === "anchored"
        ? `${subject} scored in Anchored Mode (measured in light of Jesus; deterministic rubric).`
        : `${subject} scored in Explorer Mode (unanchored; deterministic rubric).`;

    const discussion_prompts =
      mode === "anchored"
        ? [
            "Relative to Jesus as the 10/10 anchor, which score would you adjust first—and why?",
            "Where do you see love vs fear, truth vs control, conscience vs coercion in this subject/event?",
            "What is the cost paid (not inflicted), and what does it produce?",
            "What does this help people cross (confusion→clarity, fear→love, division→unity)?",
          ]
        : [
            "What assumptions are you bringing to this score?",
            "Which dimension is most debatable here—and why?",
            "What evidence would change your mind?",
            "What would a thoughtful person who disagrees argue?",
          ];

    return res.status(200).json({
      subject,
      subject_type: subjectType,
      mode,
      anchor: mode === "anchored" ? "Jesus (permanent reference point)" : "None (unanchored)",
      scores,
      total_score,
      one_liner,
      discussion_prompts,
      rationale,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      detail: err?.message || String(err),
    });
  }
}