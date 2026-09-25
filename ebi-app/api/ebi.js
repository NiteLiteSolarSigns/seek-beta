// ebi-app/api/ebi.js

// Explorer Bridge Index
//
// Permanent anchors:
// - Jesus (person) = 50/50
// - Jesus-events = 50/50
//
// Otherwise:
// - OpenAI scoring when OPENAI_API_KEY exists
// - Deterministic fallback if AI is unavailable
//
// EBI is a discussion framework, not a verdict machine.


export default async function handler(req, res) {

  // =============================================
  // CORS
  // =============================================

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );


  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }


  if (req.method !== "POST") {
    return res
      .status(405)
      .json({
        error: "Use POST"
      });
  }


  try {

    const body =
      req.body || {};


    const subject =
      String(
        body.subject || ""
      ).trim();


    const subjectType =
      String(
        body.subjectType || "person"
      ).trim();


    const notes =
      String(
        body.notes || ""
      ).trim();


    if (!subject) {

      return res
        .status(400)
        .json({
          error: "Missing subject"
        });

    }


    const mode =
      "anchored";


    const normSubject =
      normalize(subject);


    // =============================================
    // PERMANENT ANCHORS
    // =============================================

    const JESUS_PERSON_ALIASES =
      new Set([
        "jesus",
        "jesus christ",
        "christ",
        "the christ",
        "yeshua",
        "yeshua hamashiach",
        "lord jesus",
        "our lord jesus christ"
      ]);


    const JESUS_EVENT_ALIASES =
      new Set([

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


        // Pentecost

        "pentecost"

      ]);


    if (
      subjectType === "person" &&
      JESUS_PERSON_ALIASES.has(
        normSubject
      )
    ) {

      return res
        .status(200)
        .json(
          anchor50(
            subject,
            subjectType,
            mode,
            "Jesus (permanent 50/50 reference point)",
            [
              "Anchor override applied: Jesus."
            ]
          )
        );

    }


    if (
      subjectType === "event" &&
      JESUS_EVENT_ALIASES.has(
        normSubject
      )
    ) {

      return res
        .status(200)
        .json(
          anchor50(
            subject,
            subjectType,
            mode,
            "Jesus-events (permanent 50/50 reference point)",
            [
              "Anchor override applied: Jesus-event."
            ]
          )
        );

    }


    // =============================================
    // TRY OPENAI
    // =============================================

    const apiKey =
      process.env.OPENAI_API_KEY;


    if (apiKey) {

      try {

        const ai =
          await scoreWithOpenAI({
            apiKey,
            subject,
            subjectType,
            notes
          });


        const cleaned =
          sanitizeAiPayload(
            ai,
            {
              subject,
              subjectType,
              mode
            }
          );


        return res
          .status(200)
          .json({

            ...cleaned,

            mode,

            anchor:
              "Jesus (permanent reference point)",

            engine:
              "ai",

            timestamp:
              new Date().toISOString()

          });


      } catch (error) {

        console.error(
          "EBI OpenAI error:",
          error?.message ||
          error
        );

        // Continue into fallback.

      }

    }


    // =============================================
    // FALLBACK
    // =============================================

    const fallback =
      deterministicRubric({
        subject,
        subjectType,
        notes,
        mode
      });


    return res
      .status(200)
      .json({

        ...fallback,

        engine:
          "deterministic_fallback",

        timestamp:
          new Date().toISOString()

      });


  } catch (error) {

    console.error(
      "EBI server error:",
      error
    );


    return res
      .status(500)
      .json({

        error:
          "Server error",

        detail:
          error?.message ||
          String(error)

      });

  }

}


// =============================================
// NORMALIZE
// =============================================

function normalize(value) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^\w\s]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    );

}


// =============================================
// 50 / 50 ANCHOR
// =============================================

function anchor50(
  subject,
  subjectType,
  mode,
  anchorLabel,
  rationale
) {

  const scores = {

    scope_of_impact:
      10,

    direction_of_tension:
      10,

    longevity:
      10,

    cost_paid:
      10,

    bridge_function:
      10

  };


  return {

    subject,

    subject_type:
      subjectType,

    mode,

    anchor:
      anchorLabel,

    scores,

    total_score:
      50,

    one_liner:
      subjectType === "event"
        ? "This Jesus-event is a permanent EBI reference point."
        : "Jesus is the permanent EBI reference point across all five lenses.",

    discussion_prompts: [

      "If this is the anchor, what does it clarify about everything else we explore?",

      "Which lens best explains why this is a hinge in the story?",

      "How does this illuminate love and fear, truth and control, or conscience and coercion?"

    ],

    rationale

  };

}


// =============================================
// OPENAI
// CURRENT RESPONSES API
// =============================================

async function scoreWithOpenAI({
  apiKey,
  subject,
  subjectType,
  notes
}) {

  const system = `

You are helping generate an Explorer Bridge Index (EBI)
for beta!.

EBI is a DISCUSSION FRAMEWORK, not a verdict machine.

Its purpose is to help Explorers look at a person,
event, or idea through five lenses and then discuss
why the scores landed where they did.

PERMANENT CHRISTIAN ANCHOR:

Jesus is the reference point.

Jesus as a person = 50/50.

Jesus-events —
Incarnation/Birth,
Passion/Crucifixion/Death,
Resurrection,
Ascension,
and Pentecost —
are also permanent 50/50 reference points.

Those permanent anchors are handled elsewhere.
Do not apply that override yourself.


THE FIVE EBI LENSES:

1. Scope of Impact
How much of the human story did this touch?

2. Direction of Tension
Consider movement along tensions such as:
Love ↔ Fear
Truth ↔ Control
Conscience ↔ Coercion

3. Longevity
Did the influence endure under time and pressure?

4. Cost Paid
What did the subject personally carry, sacrifice,
risk, or lose?
Do NOT confuse cost paid with harm inflicted on others.

5. Bridge Function
What did this help people cross?
Examples:
confusion → clarity
fear → courage
division → unity
old understanding → new understanding


SCORING:

Score every lens from 1 through 10.

The scores are discussion starters.
They are not declarations of absolute truth.

Be historically responsible.
Be charitable without sanitizing history.
Do not manufacture facts.
Avoid hot takes.
Distinguish influence from moral approval.

A person can have enormous Scope of Impact
while scoring very differently on another lens.

Cost Paid means cost personally borne by the subject,
not suffering the subject caused others.

Bridge Function asks whether something genuinely helped
people cross from one state or understanding toward another.


VOICE:

Clear.
Curious.
Conversational.
Thoughtful.

This should sound useful around a beta! discussion table,
not like an academic grading rubric.


Return ONLY a JSON object with exactly this shape:

{
  "scores": {
    "scope_of_impact": 1,
    "direction_of_tension": 1,
    "longevity": 1,
    "cost_paid": 1,
    "bridge_function": 1
  },
  "one_liner": "A concise summary.",
  "discussion_prompts": [
    "Question one?",
    "Question two?",
    "Question three?"
  ],
  "rationale": [
    "Scope of Impact: short explanation.",
    "Direction of Tension: short explanation.",
    "Longevity: short explanation.",
    "Cost Paid: short explanation.",
    "Bridge Function: short explanation."
  ]
}

`.trim();


  const user = `

SUBJECT:
${subject}

TYPE:
${subjectType}

NOTES:
${notes || "(none)"}

`.trim();


  const model =
    process.env.EBI_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini";


  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {

        method:
          "POST",

        headers: {

          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify({

            model,

            input: [

              {
                role:
                  "system",

                content:
                  system
              },

              {
                role:
                  "user",

                content:
                  user
              }

            ],


            text: {

              format: {
                type:
                  "json_object"
              }

            },


            max_output_tokens:
              1000

          })

      }
    );


  if (!response.ok) {

    const text =
      await response
        .text()
        .catch(
          () => ""
        );


    throw new Error(
      `OpenAI error ${response.status}: ${text}`
    );

  }


  const data =
    await response.json();


  const content =
    extractOutputText(
      data
    );


  if (!content) {

    throw new Error(
      "No OpenAI output returned."
    );

  }


  try {

    return JSON.parse(
      content
    );


  } catch {

    throw new Error(
      "OpenAI returned invalid JSON."
    );

  }

}


// =============================================
// EXTRACT TEXT FROM RESPONSES API
// =============================================

function extractOutputText(data) {

  // Some Responses clients expose this directly.

  if (
    typeof data?.output_text ===
    "string"
  ) {

    return data.output_text;

  }


  const output =
    Array.isArray(
      data?.output
    )
      ? data.output
      : [];


  for (
    const item of output
  ) {

    if (
      item?.type !==
      "message"
    ) {
      continue;
    }


    const content =
      Array.isArray(
        item?.content
      )
        ? item.content
        : [];


    for (
      const part of content
    ) {

      if (
        part?.type ===
          "output_text" &&
        typeof part?.text ===
          "string"
      ) {

        return part.text;

      }

    }

  }


  return "";

}


// =============================================
// CLEAN AI OUTPUT
// =============================================

function sanitizeAiPayload(
  ai,
  {
    subject,
    subjectType,
    mode
  }
) {

  const incoming =
    ai?.scores || {};


  const scores = {

    scope_of_impact:
      clamp10(
        incoming.scope_of_impact
      ),

    direction_of_tension:
      clamp10(
        incoming.direction_of_tension
      ),

    longevity:
      clamp10(
        incoming.longevity
      ),

    cost_paid:
      clamp10(
        incoming.cost_paid
      ),

    bridge_function:
      clamp10(
        incoming.bridge_function
      )

  };


  const total_score =
    Object
      .values(scores)
      .reduce(
        (total, value) =>
          total + value,
        0
      );


  const discussionPrompts =
    Array.isArray(
      ai?.discussion_prompts
    )
      ? ai.discussion_prompts
          .map(
            item =>
              String(item).trim()
          )
          .filter(Boolean)
          .slice(0, 6)
      : [];


  const rationale =
    Array.isArray(
      ai?.rationale
    )
      ? ai.rationale
          .map(
            item =>
              String(item).trim()
          )
          .filter(Boolean)
          .slice(0, 8)
      : [];


  return {

    subject,

    subject_type:
      subjectType,

    mode,

    scores,

    total_score,

    one_liner:
      String(
        ai?.one_liner || ""
      ).trim() ||
      `${subject} through the five EBI lenses.`,

    discussion_prompts:
      discussionPrompts,

    rationale

  };

}


// =============================================
// SCORE CLAMP
// =============================================

function clamp10(value) {

  const number =
    Number(value);


  if (
    !Number.isFinite(number)
  ) {

    return 1;

  }


  return Math.max(
    1,
    Math.min(
      10,
      Math.round(number)
    )
  );

}


// =============================================
// DETERMINISTIC FALLBACK
// =============================================

function deterministicRubric({
  subject,
  subjectType,
  notes,
  mode
}) {

  const text =
    `${normalize(subject)} ${normalize(notes)}`
      .trim();


  let scores = {

    scope_of_impact:
      6,

    direction_of_tension:
      6,

    longevity:
      6,

    cost_paid:
      subjectType === "event"
        ? 5
        : 6,

    bridge_function:
      6

  };


  const rationale =
    [];


  const add =
    (
      key,
      change,
      reason
    ) => {

      scores[key] +=
        change;


      rationale.push(
        `${key}: ${reason}`
      );

    };


  const hasAny =
    words =>
      words.some(
        word =>
          text.includes(word)
      );


  if (
    hasAny([
      "world",
      "global",
      "empire",
      "council",
      "creed",
      "reformation",
      "schism"
    ])
  ) {

    add(
      "scope_of_impact",
      2,
      "Civilizational-scale influence signal."
    );

  }


  if (
    hasAny([
      "martyr",
      "persecution",
      "exile",
      "prison",
      "torture",
      "poverty",
      "sacrifice"
    ])
  ) {

    add(
      "cost_paid",
      3,
      "Clear personal cost or suffering signal."
    );

  }


  if (
    hasAny([
      "love",
      "mercy",
      "forgiveness",
      "charity",
      "grace",
      "truth",
      "conscience",
      "freedom"
    ])
  ) {

    add(
      "direction_of_tension",
      2,
      "Love, truth, conscience, or freedom signal."
    );

  }


  if (
    hasAny([
      "tyranny",
      "control",
      "coercion",
      "genocide",
      "hate",
      "terror"
    ])
  ) {

    add(
      "direction_of_tension",
      -3,
      "Fear, control, coercion, or harm signal."
    );

  }


  if (
    hasAny([
      "creed",
      "canon",
      "scripture",
      "doctrine",
      "tradition",
      "monastery",
      "order",
      "university"
    ])
  ) {

    add(
      "longevity",
      2,
      "Institutional or textual endurance signal."
    );

  }


  if (
    hasAny([
      "bridge",
      "reconcile",
      "unity",
      "mission",
      "evangel",
      "catechesis",
      "teach",
      "disciple"
    ])
  ) {

    add(
      "bridge_function",
      2,
      "Bridge-building signal."
    );

  }


  if (
    hasAny([
      "schism",
      "division",
      "split",
      "war"
    ])
  ) {

    add(
      "bridge_function",
      -2,
      "Division signal."
    );

  }


  scores = {

    scope_of_impact:
      clamp10(
        scores.scope_of_impact
      ),

    direction_of_tension:
      clamp10(
        scores.direction_of_tension
      ),

    longevity:
      clamp10(
        scores.longevity
      ),

    cost_paid:
      clamp10(
        scores.cost_paid
      ),

    bridge_function:
      clamp10(
        scores.bridge_function
      )

  };


  const total_score =
    Object
      .values(scores)
      .reduce(
        (total, value) =>
          total + value,
        0
      );


  return {

    subject,

    subject_type:
      subjectType,

    mode,

    anchor:
      "Jesus (permanent reference point)",

    scores,

    total_score,

    one_liner:
      `${subject} was evaluated using the local fallback because AI was unavailable.`,

    discussion_prompts: [

      "Which score would you change first, and why?",

      "Where do you see love and fear, truth and control, or conscience and coercion?",

      "What cost was personally paid, and what did that cost produce?",

      "What did this person, event, or idea help people cross?"

    ],

    rationale

  };

}