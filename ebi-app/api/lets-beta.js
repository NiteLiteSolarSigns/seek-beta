// api/lets-beta.js
// beta! — Let's beta! V2: Human Voices Across Time
//
// Flow:
// feeling / struggle -> acknowledgment -> adaptive beta tone
// -> Scripture -> verified historical voice record -> reflection -> The Bridge

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");

let bibleDataCache = null;
let voiceLibraryCache = null;

const TONES = {
  go: { id: "go", mark: "!", color: "red" },
  question: { id: "question", mark: "?", color: "blue" },
  hold: { id: "hold", mark: "…", color: "gold" }
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const body = req.body || {};
    const feeling = String(body.feeling || body.emotion || "").trim().slice(0, 800);

    if (!feeling) {
      return res.status(400).json({ error: "Tell us what you're feeling or wrestling with." });
    }

    const mode = normalizeMode(body.mode);
    const requestedVoiceId = cleanId(body.voice_id);
    const requestedYearRaw = String(body.year || "").trim().slice(0, 40);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });

    const bibleData = loadBibleData();
    const voiceLibrary = loadVoiceLibrary();

    const selection = buildVoiceSelection({
      mode,
      requestedVoiceId,
      requestedYearRaw,
      voiceLibrary
    });

    const raw = await chooseExperience({
      apiKey,
      feeling,
      mode,
      requestedYearRaw,
      eligibleVoices: selection.eligibleVoices
    });

    const tone = TONES[cleanId(raw?.beta_tone)] || TONES.go;

    const voice = selection.eligibleVoices.find(v => v.id === cleanId(raw?.voice_id));
    if (!voice) {
      throw new Error("The response selected a voice outside the allowed beta! voice set for this request.");
    }

    const quote = voice.quotes.find(q => q.id === cleanId(raw?.quote_id));
    if (!quote) {
      throw new Error("The response selected a quote outside the verified beta! Voice Library.");
    }

    const parsedReference = parseBibleReference(raw?.passage_reference, bibleData);
    if (!parsedReference) {
      throw new Error("The response selected a Scripture reference that could not be validated.");
    }

    const passage = getPassage(parsedReference, bibleData);
    if (!passage) {
      throw new Error("The selected Scripture passage was not found in the Bible dataset.");
    }

    return res.status(200).json({
      input: feeling,
      mode,
      year_request: selection.yearRequest,

      feeling: cleanText(raw?.feeling_summary) || feeling,
      acknowledgment:
        cleanText(raw?.acknowledgment) ||
        "Thanks for telling us. Let's see what we can find.",

      beta_tone: tone,
      beta_label: `Let's beta${tone.mark}`,

      passage: {
        reference: passage.reference,
        text: passage.text,
        why: cleanText(raw?.passage_reason)
      },

      voice: {
        id: voice.id,
        name: voice.name,
        era_label: voice.era_label,
        era_note: voice.era_note || "",
        source_basis: voice.source_basis,
        connection: cleanText(raw?.voice_connection)
      },

      quote: {
        id: quote.id,
        text: quote.text,
        work: quote.work,
        location: quote.location,
        source_year_label: quote.source_year_label,
        context: quote.context,
        source_url: quote.source_url,
        verification: quote.verification
      },

      reflection_question: cleanText(raw?.reflection_question),

      bridge_url: `/bridge/?reading=${encodeURIComponent(
        passage.reference
      )}&voice=susan&auto=1`,

      engine: "lets_beta_v2_human_voices",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Let's beta! couldn't build this reflection.",
      detail: err?.message || String(err)
    });
  }
}

function normalizeMode(value) {
  const mode = cleanId(value);
  return ["surprise", "voice", "year"].includes(mode) ? mode : "surprise";
}

function buildVoiceSelection({ mode, requestedVoiceId, requestedYearRaw, voiceLibrary }) {
  const all = voiceLibrary.voices || [];

  if (mode === "voice") {
    const selected = all.find(v => v.id === requestedVoiceId);
    if (!selected) throw new Error("Choose a beta! voice first.");
    return { eligibleVoices: [selected], yearRequest: null };
  }

  if (mode === "year") {
    const year = parseHistoricalYear(requestedYearRaw);
    if (year === null) {
      throw new Error("Enter a year like 397, 1521, or 399 BC.");
    }

    const nearest = [...all]
      .sort((a, b) => Math.abs(a.anchor_year - year) - Math.abs(b.anchor_year - year))
      .slice(0, Math.min(4, all.length));

    return {
      eligibleVoices: nearest,
      yearRequest: {
        input: requestedYearRaw,
        normalized_year: year,
        label: formatHistoricalYear(year)
      }
    };
  }

  return { eligibleVoices: all, yearRequest: null };
}

function parseHistoricalYear(input) {
  const raw = String(input || "").trim().toUpperCase().replace(/\./g, "");
  if (!raw) return null;

  const bc = /\b(BC|BCE)\b/.test(raw);
  const ad = /\b(AD|CE)\b/.test(raw);
  const match = raw.match(/-?\d{1,4}/);
  if (!match) return null;

  let year = Number(match[0]);
  if (!Number.isFinite(year)) return null;

  if (bc) year = -Math.abs(year);
  if (ad) year = Math.abs(year);

  if (year < -2000 || year > 2100) return null;
  return year;
}

function formatHistoricalYear(year) {
  if (year < 0) return `${Math.abs(year)} BC`;
  return `AD ${year}`;
}

async function chooseExperience({ apiKey, feeling, mode, requestedYearRaw, eligibleVoices }) {
  const voiceCatalog = eligibleVoices
    .map(voice => {
      const quotes = voice.quotes
        .map(
          q => `QUOTE ID: ${q.id}\nQUOTE: "${q.text}"\nWORK: ${q.work}${q.location ? `, ${q.location}` : ""}\nTHEMES: ${(q.themes || []).join(", ")}\nCURATED CONTEXT: ${q.context}`
        )
        .join("\n\n");

      return `VOICE ID: ${voice.id}\nNAME: ${voice.name}\nERA: ${voice.era_label}\nSOURCE BASIS: ${voice.source_basis}\n\n${quotes}`;
    })
    .join("\n\n---\n\n");

  const modeInstruction =
    mode === "voice"
      ? "The user explicitly picked the only supplied voice. You MUST use that voice and one of its supplied quote IDs."
      : mode === "year"
      ? `The user asked for advice from around ${requestedYearRaw}. Choose the supplied voice whose documented material best fits both the human struggle and that historical doorway. Do not pretend the person lived in the exact requested year.`
      : "The user chose Surprise me. Choose the supplied voice and quote that genuinely fit best.";

  const systemPrompt = `
YOU ARE THE SELECTION ENGINE FOR "LET'S beta!" — HUMAN VOICES ACROSS TIME.

PURPOSE:
A person tells beta! what they are feeling or wrestling with. beta! listens first, then connects the person with Scripture and a real human voice from history.

YOUR JOB:
1. Acknowledge what the person said in 1-2 short, human sentences.
2. Choose the emotional beta! tone:
   - go = red + ! for energy, curiosity, hope, ordinary forward movement.
   - question = soft blue + ? for uncertainty, searching, doubt, confusion, discernment.
   - hold = gold + … for grief, shame, deep sadness, hurt, heaviness, or moments that should not be rushed.
3. Choose ONE Scripture passage that honestly meets the person where they are.
4. Choose ONE supplied beta! historical voice and ONE supplied verified QUOTE ID.
5. Explain why the Scripture fits.
6. Explain why this human voice belongs near the person's question, using ONLY the supplied source basis, themes, quote, and curated context.
7. Ask ONE open reflection question.

MODE:
${modeInstruction}

HARD TRUTH RULES:
- NEVER invent a quote.
- NEVER alter the supplied quote text.
- NEVER put new words in a historical person's mouth.
- Return the exact VOICE ID and exact QUOTE ID from the catalog.
- Do not claim the historical person felt exactly what the user feels unless the supplied context supports that.
- Do not write as if the historical person is literally speaking beyond the supplied quotation.
- Do not diagnose, therapize, preach, or use canned positivity.
- Do not say "I know how you feel."
- Match the seriousness of the user's words.
- Choose a concrete Bible verse or short same-chapter range, never more than 6 verses.
- Keep the tone warm, curious, direct, and beta!.

BETA! VOICE LIBRARY AVAILABLE FOR THIS REQUEST:

${voiceCatalog}

RETURN ONLY VALID JSON:
{
  "feeling_summary": "short human restatement",
  "acknowledgment": "1-2 short sentences showing the person was heard",
  "beta_tone": "go | question | hold",
  "passage_reference": "Book chapter:verse or Book chapter:verse-verse",
  "passage_reason": "2-4 conversational sentences",
  "voice_id": "exact supplied voice id",
  "quote_id": "exact supplied quote id",
  "voice_connection": "2-4 conversational sentences grounded only in supplied material",
  "reflection_question": "one open-ended question"
}
`.trim();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.LETS_BETA_MODEL || process.env.BRIDGE_MODEL || "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `What I'm feeling or wrestling with:\n${feeling}` }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No OpenAI content returned");
  return JSON.parse(content);
}

function loadVoiceLibrary() {
  if (voiceLibraryCache) return voiceLibraryCache;
  const raw = fs.readFileSync(path.join(DATA_DIR, "voice_library.json"), "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed?.voices) || parsed.voices.length === 0) {
    throw new Error("The beta! Voice Library is empty.");
  }

  for (const voice of parsed.voices) {
    if (!voice.id || !voice.name || !Array.isArray(voice.quotes) || voice.quotes.length === 0) {
      throw new Error(`Invalid Voice Library record: ${voice?.id || "unknown"}`);
    }
  }

  voiceLibraryCache = parsed;
  return voiceLibraryCache;
}

function loadBibleData() {
  if (bibleDataCache) return bibleDataCache;

  const books = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "bible_books.json"), "utf8")
  );
  const verses = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "bible_verses.json"), "utf8")
  );

  const booksByName = new Map();
  for (const book of books) {
    addBookAlias(booksByName, book.name_eng, book);
    addBookAlias(booksByName, book.abbreviation_eng, book);
  }

  const aliases = {
    gen: "Genesis", ex: "Exodus", exod: "Exodus", lev: "Leviticus",
    num: "Numbers", deut: "Deuteronomy", dt: "Deuteronomy", josh: "Joshua",
    judg: "Judges", ps: "Psalms", psa: "Psalms", psalm: "Psalms",
    prov: "Proverbs", eccl: "Ecclesiastes", isa: "Isaiah", jer: "Jeremiah",
    ezek: "Ezekiel", dan: "Daniel", zech: "Zechariah", mal: "Malachi",
    matt: "Matthew", mk: "Mark", mrk: "Mark", lk: "Luke", jn: "John",
    rom: "Romans", "1 cor": "1 Corinthians", "2 cor": "2 Corinthians",
    gal: "Galatians", eph: "Ephesians", phil: "Philippians", col: "Colossians",
    "1 thess": "1 Thessalonians", "2 thess": "2 Thessalonians",
    "1 tim": "1 Timothy", "2 tim": "2 Timothy", heb: "Hebrews", jas: "James",
    "1 pet": "1 Peter", "2 pet": "2 Peter", "1 jn": "1 John",
    "2 jn": "2 John", "3 jn": "3 John", rev: "Revelation"
  };

  for (const [alias, canonicalName] of Object.entries(aliases)) {
    const book = books.find(
      item => normalizeBookName(item.name_eng) === normalizeBookName(canonicalName)
    );
    if (book) booksByName.set(normalizeBookName(alias), book);
  }

  const versesByLocation = new Map();
  for (const verse of verses) {
    const key = makeVerseKey(Number(verse.book_id), Number(verse.bsb_ch), Number(verse.bsb_vs));
    if (!versesByLocation.has(key)) versesByLocation.set(key, []);
    versesByLocation.get(key).push(verse);
  }

  bibleDataCache = { books, verses, booksByName, versesByLocation };
  return bibleDataCache;
}

function addBookAlias(map, value, book) {
  if (!value) return;
  map.set(normalizeBookName(value), book);
}

function parseBibleReference(input, bibleData) {
  const cleaned = String(input || "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const match = cleaned.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return null;

  const book = bibleData.booksByName.get(normalizeBookName(match[1]));
  if (!book) return null;

  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  const endVerse = match[4] ? Number(match[4]) : verse;

  if (
    !Number.isFinite(chapter) ||
    !Number.isFinite(verse) ||
    !Number.isFinite(endVerse) ||
    chapter < 1 ||
    verse < 1 ||
    endVerse < verse ||
    endVerse - verse > 5
  ) {
    return null;
  }

  return { book, chapter, verse, endVerse };
}

function getPassage(parsed, bibleData) {
  const records = [];

  for (let currentVerse = parsed.verse; currentVerse <= parsed.endVerse; currentVerse++) {
    const key = makeVerseKey(Number(parsed.book.id), parsed.chapter, currentVerse);
    const verseRecords = bibleData.versesByLocation.get(key) || [];
    records.push(...verseRecords);
  }

  if (records.length === 0) return null;

  return {
    reference: formatRangeReference(
      parsed.book.name_eng,
      parsed.chapter,
      parsed.verse,
      parsed.endVerse
    ),
    text: reconstructText(records)
  };
}

function reconstructText(records) {
  return [...records]
    .sort((a, b) => Number(a.bsb_sort || 0) - Number(b.bsb_sort || 0))
    .map(record => String(record.bsb_text || record.kjv_text || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatRangeReference(bookName, chapter, firstVerse, lastVerse) {
  if (Number(firstVerse) === Number(lastVerse)) {
    return `${bookName} ${chapter}:${firstVerse}`;
  }
  return `${bookName} ${chapter}:${firstVerse}-${lastVerse}`;
}

function makeVerseKey(bookId, chapter, verse) {
  return `${bookId}:${chapter}:${verse}`;
}

function normalizeBookName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanId(value) {
  return String(value || "").trim().toLowerCase();
}
