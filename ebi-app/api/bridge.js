// api/bridge.js
// beta! — The Bridge

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");

let bibleDataCache = null;


// ==================================================
// MAIN HANDLER
// ==================================================

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Use POST"
    });
  }

  try {
    const body = req.body || {};

    const reading = String(
      body.reading || ""
    ).trim();

    const requestedVoice = String(
      body.voice || "susan"
    )
      .trim()
      .toLowerCase();

    if (!reading) {
      return res.status(400).json({
        error: "Missing reading"
      });
    }

    const allowedVoices = new Set([
      "joe",
      "susan",
      "ted"
    ]);

    const voice = allowedVoices.has(
      requestedVoice
    )
      ? requestedVoice
      : "susan";

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "OPENAI_API_KEY is not configured"
      });
    }

    const bibleData =
      loadBibleData();

    const parsedReference =
      parseBibleReference(
        reading,
        bibleData
      );

    if (!parsedReference) {
      return res.status(400).json({
        error:
          "Enter a specific verse such as John 19:34 or Exodus 17:6."
      });
    }

    const grounding =
      findGroundedCandidates(
        parsedReference,
        bibleData
      );

    if (!grounding.source) {
      return res.status(404).json({
        error:
          `I couldn't find ${reading} in the Bible dataset.`
      });
    }

    if (
      !grounding.candidates ||
      grounding.candidates.length === 0
    ) {
      return res.status(200).json(
        buildNoBridgeResponse(
          grounding,
          voice,
          reading
        )
      );
    }

    const result =
      await explainGroundedBridge({
        apiKey,
        voice,
        grounding
      });

    return res.status(200).json({
      ...result,

      guide:
        getGuideName(voice),

      guide_id:
        voice,

      grounding: {
        source:
          "CrossReferences.org dataset",

        grounded: true,

        candidate_count:
          grounding.candidates.length,

        selected_from:
          grounding.candidates.map(
            candidate =>
              candidate.reference
          )
      },

      input:
        reading,

      engine:
        "cross_reference_grounded",

      timestamp:
        new Date().toISOString()
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Server error",

      detail:
        err?.message ||
        String(err)
    });
  }
}


// ==================================================
// NO BRIDGE RESPONSE
// ==================================================

function buildNoBridgeResponse(
  grounding,
  voice,
  reading
) {
  return {
    old_reading:
      grounding.source.testament === "OT"
        ? {
            reference:
              grounding.source.reference,
            text:
              grounding.source.text
          }
        : {
            reference: "",
            text: ""
          },

    new_reading:
      grounding.source.testament === "NT"
        ? {
            reference:
              grounding.source.reference,
            text:
              grounding.source.text
          }
        : {
            reference: "",
            text: ""
          },

    bridge: {
      text:
        "The cross-reference database does not currently give this verse a strong cross-Testament Bridge. beta! would rather tell you that than manufacture one."
    },

    dig_deeper: {
      text: "",
      related_passages: [],
      people: [],
      questions: []
    },

    definitions: [],

    connection_type:
      "possible_connection",

    confidence:
      "low",

    guide:
      getGuideName(voice),

    guide_id:
      voice,

    grounding: {
      source:
        "CrossReferences.org dataset",
      grounded: true,
      candidate_count: 0
    },

    input:
      reading,

    engine:
      "cross_reference_grounded",

    timestamp:
      new Date().toISOString()
  };
}


// ==================================================
// LOAD BIBLE DATA
// ==================================================

function loadBibleData() {
  if (bibleDataCache) {
    return bibleDataCache;
  }

  const books =
    JSON.parse(
      fs.readFileSync(
        path.join(
          DATA_DIR,
          "bible_books.json"
        ),
        "utf8"
      )
    );

  const verses =
    JSON.parse(
      fs.readFileSync(
        path.join(
          DATA_DIR,
          "bible_verses.json"
        ),
        "utf8"
      )
    );

  const crossReferences =
    JSON.parse(
      fs.readFileSync(
        path.join(
          DATA_DIR,
          "cross_references.json"
        ),
        "utf8"
      )
    );

  const booksById =
    new Map();

  const booksByName =
    new Map();

  for (const book of books) {
    booksById.set(
      Number(book.id),
      book
    );

    addBookAlias(
      booksByName,
      book.name_eng,
      book
    );

    addBookAlias(
      booksByName,
      book.abbreviation_eng,
      book
    );
  }

  const aliases = {
    gen: "Genesis",
    ex: "Exodus",
    exod: "Exodus",
    lev: "Leviticus",
    num: "Numbers",
    deut: "Deuteronomy",
    dt: "Deuteronomy",
    josh: "Joshua",
    judg: "Judges",
    ps: "Psalms",
    psa: "Psalms",
    psalm: "Psalms",
    prov: "Proverbs",
    eccl: "Ecclesiastes",
    isa: "Isaiah",
    jer: "Jeremiah",
    ezek: "Ezekiel",
    dan: "Daniel",
    zech: "Zechariah",
    mal: "Malachi",

    matt: "Matthew",
    mk: "Mark",
    mrk: "Mark",
    lk: "Luke",
    jn: "John",
    rom: "Romans",

    "1 cor": "1 Corinthians",
    "2 cor": "2 Corinthians",

    gal: "Galatians",
    eph: "Ephesians",
    phil: "Philippians",
    col: "Colossians",

    "1 thess":
      "1 Thessalonians",

    "2 thess":
      "2 Thessalonians",

    "1 tim":
      "1 Timothy",

    "2 tim":
      "2 Timothy",

    heb: "Hebrews",
    jas: "James",

    "1 pet": "1 Peter",
    "2 pet": "2 Peter",

    "1 jn": "1 John",
    "2 jn": "2 John",
    "3 jn": "3 John",

    rev: "Revelation"
  };

  for (
    const [
      alias,
      canonicalName
    ] of Object.entries(aliases)
  ) {
    const book =
      books.find(
        b =>
          normalizeBookName(
            b.name_eng
          ) ===
          normalizeBookName(
            canonicalName
          )
      );

    if (book) {
      booksByName.set(
        normalizeBookName(alias),
        book
      );
    }
  }

  const versesById =
    new Map();

  const versesByLocation =
    new Map();

  for (const verse of verses) {
    versesById.set(
      Number(verse.id),
      verse
    );

    const key =
      makeVerseKey(
        Number(verse.book_id),
        Number(verse.bsb_ch),
        Number(verse.bsb_vs)
      );

    if (
      !versesByLocation.has(key)
    ) {
      versesByLocation.set(
        key,
        []
      );
    }

    versesByLocation
      .get(key)
      .push(verse);
  }

  const refsByVerseId =
    new Map();

  for (
    const row
    of crossReferences
  ) {
    const verseId =
      Number(row.verse_id);

    if (
      !refsByVerseId.has(
        verseId
      )
    ) {
      refsByVerseId.set(
        verseId,
        []
      );
    }

    refsByVerseId
      .get(verseId)
      .push(row);
  }

  bibleDataCache = {
    books,
    verses,
    crossReferences,
    booksById,
    booksByName,
    versesById,
    versesByLocation,
    refsByVerseId
  };

  return bibleDataCache;
}


function addBookAlias(
  map,
  value,
  book
) {
  if (!value) {
    return;
  }

  map.set(
    normalizeBookName(value),
    book
  );
}


// ==================================================
// PARSE REFERENCE
// ==================================================

function parseBibleReference(
  input,
  bibleData
) {
  const cleaned =
    String(input)
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

  const match =
    cleaned.match(
      /^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/
    );

  if (!match) {
    return null;
  }

  const book =
    bibleData.booksByName.get(
      normalizeBookName(
        match[1]
      )
    );

  if (!book) {
    return null;
  }

  return {
    book,

    chapter:
      Number(match[2]),

    verse:
      Number(match[3]),

    endVerse:
      match[4]
        ? Number(match[4])
        : Number(match[3])
  };
}


// ==================================================
// FIND GROUNDED CANDIDATES
// ==================================================

function findGroundedCandidates(
  parsed,
  bibleData
) {
  const {
    book,
    chapter,
    verse,
    endVerse
  } = parsed;

  const sourceRecords = [];

  for (
    let currentVerse = verse;
    currentVerse <= endVerse;
    currentVerse++
  ) {
    const key =
      makeVerseKey(
        Number(book.id),
        chapter,
        currentVerse
      );

    const records =
      bibleData
        .versesByLocation
        .get(key) || [];

    sourceRecords.push(
      ...records
    );
  }

  if (
    sourceRecords.length === 0
  ) {
    return {
      source: null,
      candidates: []
    };
  }

  const sourceTestament =
    getTestament(
      Number(book.id)
    );

  const source = {
    book_id:
      Number(book.id),

    reference:
      formatRangeReference(
        book.name_eng,
        chapter,
        verse,
        endVerse
      ),

    text:
      reconstructText(
        sourceRecords
      ),

    testament:
      sourceTestament
  };

  const rawCandidates = [];

  for (
    const sourceRecord
    of sourceRecords
  ) {
    const rows =
      bibleData
        .refsByVerseId
        .get(
          Number(
            sourceRecord.id
          )
        ) || [];

    for (const row of rows) {
      const anchor =
        String(
          row.bsb ||
          row.kjv ||
          ""
        ).trim();

      const groups =
        Array.isArray(row.refs)
          ? row.refs
          : [];

      for (
        let i = 0;
        i < groups.length;
        i++
      ) {
        const refIds =
          groups[i];

        if (
          !Array.isArray(refIds)
        ) {
          continue;
        }

        const resolved =
          resolveReferenceGroup(
            refIds,
            bibleData
          );

        if (!resolved) {
          continue;
        }

        if (
          resolved.testament ===
          sourceTestament
        ) {
          continue;
        }

        rawCandidates.push({
          ...resolved,

          anchor,

          anchor_sort:
            Number(
              row.sort || 0
            ),

          reference_order:
            i + 1
        });
      }
    }
  }

  const seen =
    new Set();

  const candidates = [];

  for (
    const candidate
    of rawCandidates
  ) {
    if (
      seen.has(
        candidate.reference
      )
    ) {
      continue;
    }

    seen.add(
      candidate.reference
    );

    candidates.push(
      candidate
    );

    if (
      candidates.length >= 30
    ) {
      break;
    }
  }

  return {
    source,
    candidates
  };
}


// ==================================================
// RESOLVE REFERENCE GROUP
// ==================================================

function resolveReferenceGroup(
  refIds,
  bibleData
) {
  const records =
    refIds
      .map(
        id =>
          bibleData
            .versesById
            .get(Number(id))
      )
      .filter(Boolean);

  if (
    records.length === 0
  ) {
    return null;
  }

  const first =
    records[0];

  const bookId =
    Number(
      first.book_id
    );

  const book =
    bibleData
      .booksById
      .get(bookId);

  if (!book) {
    return null;
  }

  const sameBook =
    records.filter(
      record =>
        Number(
          record.book_id
        ) === bookId
    );

  const chapter =
    Number(
      sameBook[0].bsb_ch
    );

  const firstVerse =
    Math.min(
      ...sameBook.map(
        record =>
          Number(
            record.bsb_vs
          )
      )
    );

  const lastVerse =
    Math.max(
      ...sameBook.map(
        record =>
          Number(
            record.bsb_vs
          )
      )
    );

  return {
    reference:
      formatRangeReference(
        book.name_eng,
        chapter,
        firstVerse,
        lastVerse
      ),

    text:
      reconstructText(
        sameBook
      ),

    testament:
      getTestament(
        bookId
      ),

    book_id:
      bookId
  };
}


// ==================================================
// REBUILD TEXT
// ==================================================

function reconstructText(
  records
) {
  return [...records]
    .sort(
      (a, b) =>
        Number(
          a.bsb_sort || 0
        ) -
        Number(
          b.bsb_sort || 0
        )
    )
    .map(
      record =>
        String(
          record.bsb_text ||
          record.kjv_text ||
          ""
        ).trim()
    )
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}


// ==================================================
// AI BRIDGE
// ==================================================

async function explainGroundedBridge({
  apiKey,
  voice,
  grounding
}) {
  const candidateText =
    grounding.candidates
      .map(
        (candidate, index) => `
CANDIDATE ${index + 1}

REFERENCE:
${candidate.reference}

ANCHOR:
${candidate.anchor || "(none)"}

TEXT:
${candidate.text}
`.trim()
      )
      .join("\n\n");

  let systemPrompt;

  if (voice === "joe") {
    systemPrompt =
      buildJoePrompt(
        grounding,
        candidateText
      );
  } else if (voice === "ted") {
    systemPrompt =
      buildTedPrompt(
        grounding,
        candidateText
      );
  } else {
    systemPrompt =
      buildSusanPrompt(
        grounding,
        candidateText
      );
  }

  const response =
    await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          model:
            process.env.BRIDGE_MODEL ||
            "gpt-4o-mini",

          temperature:
            voice === "susan"
              ? 0.45
              : 0.15,

          max_tokens:
            voice === "ted"
              ? 2800
              : voice === "joe"
                ? 900
                : 1700,

          response_format: {
            type: "json_object"
          },

          messages: [
            {
              role: "system",
              content:
                systemPrompt
            },

            {
              role: "user",
              content:
                `Build the Bridge for ${grounding.source.reference}.`
            }
          ]
        })
      }
    );

  if (!response.ok) {
    const text =
      await response
        .text()
        .catch(() => "");

    throw new Error(
      `OpenAI error ${response.status}: ${text}`
    );
  }

  const data =
    await response.json();

  const content =
    data?.choices?.[0]
      ?.message?.content;

  if (!content) {
    throw new Error(
      "No OpenAI content returned"
    );
  }

  const parsed =
    JSON.parse(content);

  return validateGroundedAnswer(
    parsed,
    grounding
  );
}


// ==================================================
// JOE ALPHA
// ==================================================

function buildJoePrompt(
  grounding,
  candidates
) {
  return `
YOU ARE JOE ALPHA.

Joe Alpha is for somebody who is interested in Christianity but may know very little about the Bible.

SOURCE VERSE:

${grounding.source.reference}

${grounding.source.text}

DATABASE CANDIDATES:

${candidates}

Choose the strongest legitimate candidate from the supplied list.

Never choose a passage outside the supplied candidates.

OLD READING:
Show the Old Testament passage.

NEW READING:
Show the New Testament passage.

THE BRIDGE:

Explain the connection in plain English.

Maximum 3 short sentences.

Speak like a normal person over coffee.

Avoid church language whenever possible.

Do NOT assume the reader knows words such as:

divine
Messiah
covenant
prophecy
fulfillment
atonement
salvation
disciple
Pharisee
Gentile
apostle
righteousness
sanctification
redemption
typology
sacrament
Trinity
incarnation
resurrection

If you use ANY word or concept that a beginner may reasonably not understand, ADD IT TO DEFINITIONS.

Example:

{
  "term": "divine",
  "definition": "Relating to God; having God's nature or authority."
}

DEFINITIONS ARE IMPORTANT.

Joe should err on the side of defining words.

Definitions must:
- use normal English
- be one sentence
- avoid defining a difficult word with another difficult word
- help someone completely new to Christianity

DIG DEEPER:

Maximum 2 short sentences.

Maximum:
- 3 related passages
- 2 people
- 2 questions

Joe's reader should think:

"Okay. I get it."

NOT:

"I need a theology degree."

RETURN ONLY JSON:

{
  "selected_candidate_reference": "exact supplied reference",

  "old_reading": {
    "reference": "",
    "text": ""
  },

  "new_reading": {
    "reference": "",
    "text": ""
  },

  "bridge": {
    "text": ""
  },

  "dig_deeper": {
    "text": "",
    "related_passages": [],
    "people": [],
    "questions": []
  },

  "definitions": [
    {
      "term": "",
      "definition": ""
    }
  ],

  "connection_type": "explicit_quote | explicit_interpretation | fulfillment | typology | strong_echo | possible_connection",

  "confidence": "high | medium | low"
}
`.trim();
}


// ==================================================
// beta! SUSAN
// ==================================================

function buildSusanPrompt(
  grounding,
  candidates
) {
  return `
YOU ARE beta! SUSAN.

Susan is an Explorer.

She helps people notice connections hiding in plain sight.

SOURCE VERSE:

${grounding.source.reference}

${grounding.source.text}

DATABASE CANDIDATES:

${candidates}

Choose the strongest legitimate candidate from the supplied list.

Never invent another primary passage.

OLD READING:
Show it cleanly.
Do not explain it.

NEW READING:
Show it cleanly.
Do not explain it.

THE BRIDGE:

Make the reader notice the connection.

4 to 7 conversational sentences.

At least one sentence should be a question.

Susan can say things like:

"Now look at those two again."

"See what's happening?"

"That's the part that's easy to miss."

But do not use canned phrases every time.

DIG DEEPER:

1 to 3 conversational paragraphs.

Maximum:
- 5 related passages
- 4 people
- exactly 3 questions

DEFINITIONS:

Only define words that could interrupt the reader's understanding.

Examples might include:

Messiah
covenant
atonement
divine
Gentile
Pharisee
typology
incarnation
resurrection
righteousness

Do not define ordinary words.

Definitions must be short and conversational.

RETURN ONLY JSON:

{
  "selected_candidate_reference": "exact supplied reference",

  "old_reading": {
    "reference": "",
    "text": ""
  },

  "new_reading": {
    "reference": "",
    "text": ""
  },

  "bridge": {
    "text": ""
  },

  "dig_deeper": {
    "text": "",
    "related_passages": [],
    "people": [],
    "questions": []
  },

  "definitions": [
    {
      "term": "",
      "definition": ""
    }
  ],

  "connection_type": "explicit_quote | explicit_interpretation | fulfillment | typology | strong_echo | possible_connection",

  "confidence": "high | medium | low"
}
`.trim();
}


// ==================================================
// THEOLOGY TED
// ==================================================

function buildTedPrompt(
  grounding,
  candidates
) {
  return `
YOU ARE THEOLOGY TED.

Ted assumes the reader already understands the basic biblical connection and wants to go deeper.

SOURCE VERSE:

${grounding.source.reference}

${grounding.source.text}

DATABASE CANDIDATES:

${candidates}

Choose the strongest legitimate candidate from the supplied list.

Never choose a primary passage outside the supplied candidates.

OLD READING:
Present the Old Testament evidence.

NEW READING:
Present the New Testament evidence.

THE BRIDGE:

Explain what KIND of connection this is.

Is it:
- explicit quotation
- explicit interpretation
- fulfillment
- typology
- literary echo
- later theological interpretation

Be precise.

DIG DEEPER:

Go underneath the connection.

When relevant discuss:

TEXTUAL BASIS

BIBLICAL PATTERN

HISTORICAL CONTEXT

THEOLOGICAL READING

EARLY CHRISTIAN INTERPRETATION

JEWISH CONTEXT

CATHOLIC / PROTESTANT / ORTHODOX INTERPRETATION

DEBATED QUESTIONS

Use Greek or Hebrew only when it actually adds something.

Do not manufacture disagreement.

Maximum:
- 8 related passages
- 6 people
- 4 to 6 serious questions

DEFINITIONS:

Ted may use more advanced theological or historical terms.

Whenever he does, include concise definitions.

Examples:

typology
Septuagint
Christology
eschatology
atonement
incarnation
covenant
soteriology
Messiah
sacrament
Trinity

Definitions should make the term understandable without flattening its meaning.

RETURN ONLY JSON:

{
  "selected_candidate_reference": "exact supplied reference",

  "old_reading": {
    "reference": "",
    "text": ""
  },

  "new_reading": {
    "reference": "",
    "text": ""
  },

  "bridge": {
    "text": ""
  },

  "dig_deeper": {
    "text": "",
    "related_passages": [],
    "people": [],
    "questions": []
  },

  "definitions": [
    {
      "term": "",
      "definition": ""
    }
  ],

  "connection_type": "explicit_quote | explicit_interpretation | fulfillment | typology | strong_echo | possible_connection",

  "confidence": "high | medium | low"
}
`.trim();
}


// ==================================================
// VALIDATE GROUNDED ANSWER
// ==================================================

function validateGroundedAnswer(
  data,
  grounding
) {
  const selectedReference =
    String(
      data?.selected_candidate_reference ||
      ""
    ).trim();

  const selectedCandidate =
    grounding.candidates.find(
      candidate =>
        normalizeReference(
          candidate.reference
        ) ===
        normalizeReference(
          selectedReference
        )
    );

  if (!selectedCandidate) {
    throw new Error(
      "AI selected a passage outside the grounded candidate list."
    );
  }

  const source =
    grounding.source;

  const oldReading =
    source.testament === "OT"
      ? {
          reference:
            source.reference,

          text:
            source.text
        }
      : {
          reference:
            selectedCandidate.reference,

          text:
            selectedCandidate.text
        };

  const newReading =
    source.testament === "NT"
      ? {
          reference:
            source.reference,

          text:
            source.text
        }
      : {
          reference:
            selectedCandidate.reference,

          text:
            selectedCandidate.text
        };

  const validTypes =
    new Set([
      "explicit_quote",
      "explicit_interpretation",
      "fulfillment",
      "typology",
      "strong_echo",
      "possible_connection"
    ]);

  const validConfidence =
    new Set([
      "high",
      "medium",
      "low"
    ]);

  const connectionType =
    String(
      data?.connection_type ||
      "possible_connection"
    ).trim();

  const confidence =
    String(
      data?.confidence ||
      "medium"
    ).trim();

  return {
    old_reading:
      oldReading,

    new_reading:
      newReading,

    bridge: {
      text:
        String(
          data?.bridge?.text ||
          ""
        ).trim()
    },

    dig_deeper: {
      text:
        String(
          data?.dig_deeper?.text ||
          ""
        ).trim(),

      related_passages:
        cleanArray(
          data?.dig_deeper
            ?.related_passages,
          10
        ),

      people:
        cleanArray(
          data?.dig_deeper
            ?.people,
          8
        ),

      questions:
        cleanArray(
          data?.dig_deeper
            ?.questions,
          6
        )
    },

    definitions:
      cleanDefinitions(
        data?.definitions
      ),

    connection_type:
      validTypes.has(
        connectionType
      )
        ? connectionType
        : "possible_connection",

    confidence:
      validConfidence.has(
        confidence
      )
        ? confidence
        : "medium",

    selected_candidate:
      selectedCandidate.reference
  };
}


// ==================================================
// GUIDE NAME
// ==================================================

function getGuideName(
  voice
) {
  if (voice === "joe") {
    return "Joe Alpha";
  }

  if (voice === "ted") {
    return "Theology Ted";
  }

  return "beta! Susan";
}


// ==================================================
// HELPERS
// ==================================================

function makeVerseKey(
  bookId,
  chapter,
  verse
) {
  return `${bookId}:${chapter}:${verse}`;
}


function normalizeBookName(
  value
) {
  return String(value)
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


function normalizeReference(
  value
) {
  return String(value)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}


function getTestament(
  bookId
) {
  return Number(bookId) <= 39
    ? "OT"
    : "NT";
}


function formatRangeReference(
  bookName,
  chapter,
  firstVerse,
  lastVerse
) {
  if (
    Number(firstVerse) ===
    Number(lastVerse)
  ) {
    return `${bookName} ${chapter}:${firstVerse}`;
  }

  return `${bookName} ${chapter}:${firstVerse}-${lastVerse}`;
}


function cleanArray(
  value,
  max
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      item =>
        String(item).trim()
    )
    .filter(Boolean)
    .slice(0, max);
}


function cleanDefinitions(
  value
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => ({
      term:
        String(
          item?.term || ""
        ).trim(),

      definition:
        String(
          item?.definition || ""
        ).trim()
    }))
    .filter(
      item =>
        item.term &&
        item.definition
    )
    .slice(0, 12);
}