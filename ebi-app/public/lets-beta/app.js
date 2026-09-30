const form = document.getElementById("betaForm");
const feelingInput = document.getElementById("feeling");
const submitButton = document.getElementById("submitButton");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const acknowledgmentEl = document.getElementById("acknowledgment");
const responseToneEl = document.getElementById("responseTone");

const modeButtons = [...document.querySelectorAll(".mode-button")];
const voicePicker = document.getElementById("voicePicker");
const yearPicker = document.getElementById("yearPicker");
const voiceSelect = document.getElementById("voiceSelect");
const yearInput = document.getElementById("yearInput");

const passageReference = document.getElementById("passageReference");
const passageText = document.getElementById("passageText");
const passageWhy = document.getElementById("passageWhy");

const yearEcho = document.getElementById("yearEcho");
const voiceName = document.getElementById("voiceName");
const voiceEra = document.getElementById("voiceEra");
const voiceQuote = document.getElementById("voiceQuote");
const quoteStage = document.getElementById("quoteStage");
const typeCursor = document.getElementById("typeCursor");
const quoteMeta = document.getElementById("quoteMeta");
const quoteSource = document.getElementById("quoteSource");
const quoteSourceLink = document.getElementById("quoteSourceLink");
const voiceConnection = document.getElementById("voiceConnection");
const quoteContext = document.getElementById("quoteContext");

const reflectionQuestion = document.getElementById("reflectionQuestion");
const bridgeLink = document.getElementById("bridgeLink");

let currentMode = "surprise";
let typingToken = 0;
let activeQuoteText = "";

const isLocal =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost";

const apiUrl = isLocal
  ? "http://localhost:3000/api/lets-beta"
  : "/api/lets-beta";

modeButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode || "surprise";

    modeButtons.forEach(item => {
      item.classList.toggle("active", item === button);
    });

    voicePicker.classList.toggle("hidden", currentMode !== "voice");
    yearPicker.classList.toggle("hidden", currentMode !== "year");

    if (currentMode === "voice") voiceSelect.focus();
    if (currentMode === "year") yearInput.focus();
  });
});

feelingInput.addEventListener("input", () => {
  setTone({ id: "go", mark: "!", color: "red" });
});

quoteStage.addEventListener("click", () => {
  if (!activeQuoteText) return;
  typingToken += 1;
  voiceQuote.textContent = activeQuoteText;
  typeCursor.classList.add("done");
  quoteMeta.classList.add("show");
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  const feeling = feelingInput.value.trim();
  if (!feeling) {
    statusEl.textContent = "Tell us what you're feeling or wrestling with.";
    return;
  }

  if (currentMode === "year" && !yearInput.value.trim()) {
    statusEl.textContent = "Pick a year first — 397, 1521, or even 399 BC.";
    yearInput.focus();
    return;
  }

  setLoading(true);

  const payload = {
    feeling,
    mode: currentMode
  };

  if (currentMode === "voice") payload.voice_id = voiceSelect.value;
  if (currentMode === "year") payload.year = yearInput.value.trim();

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.detail || data?.error || "Let's beta! couldn't build this reflection.");
    }

    renderResult(data);
    statusEl.textContent = "";
    resultsEl.classList.remove("hidden");

    resultsEl.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } catch (error) {
    resultsEl.classList.add("hidden");
    statusEl.textContent = error?.message || "Something went wrong.";
  } finally {
    setLoading(false);
  }
});

function renderResult(data) {
  acknowledgmentEl.textContent =
    data?.acknowledgment || "Thanks for telling us. Let's see what we can find.";

  setTone(data?.beta_tone || { id: "go", mark: "!", color: "red" });

  passageReference.textContent = data?.passage?.reference || "";
  passageText.textContent = data?.passage?.text || "";
  passageWhy.textContent = data?.passage?.why || "";

  if (data?.year_request?.label) {
    yearEcho.textContent = `You asked for ${data.year_request.label}. Here's a voice standing near that part of the trail.`;
    yearEcho.classList.remove("hidden");
  } else {
    yearEcho.textContent = "";
    yearEcho.classList.add("hidden");
  }

  voiceName.textContent = data?.voice?.name || "";
  voiceEra.textContent = data?.voice?.era_label || "";
  voiceConnection.textContent = data?.voice?.connection || "";
  quoteContext.textContent = data?.quote?.context || "";

  const sourceParts = [
    data?.quote?.work,
    data?.quote?.location,
    data?.quote?.source_year_label
  ].filter(Boolean);

  quoteSource.textContent = sourceParts.join(" · ");
  quoteSourceLink.href = data?.quote?.source_url || "#";

  bridgeLink.href = data?.bridge_url || "/bridge/";
  reflectionQuestion.textContent = data?.reflection_question || "";

  typeQuote(data?.quote?.text || "");
}

function setTone(tone) {
  const mark = ["!", "?", "…"].includes(tone?.mark) ? tone.mark : "!";
  const color = ["red", "blue", "gold"].includes(tone?.color) ? tone.color : "red";
  const label = `Let's beta${mark}`;

  submitButton.textContent = label;
  responseToneEl.textContent = label;

  [submitButton, responseToneEl].forEach(el => {
    el.classList.remove("tone-red", "tone-blue", "tone-gold");
    el.classList.add(`tone-${color}`);
  });
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;

  if (isLoading) {
    submitButton.textContent = "Let's see what we can find...";
    statusEl.textContent = "Looking through Scripture and the beta! voices...";
    resultsEl.classList.add("hidden");
    typingToken += 1;
    return;
  }

  if (resultsEl.classList.contains("hidden")) {
    setTone({ id: "go", mark: "!", color: "red" });
  }
}

async function typeQuote(text) {
  typingToken += 1;
  const token = typingToken;
  activeQuoteText = String(text || "");

  voiceQuote.textContent = "";
  quoteMeta.classList.remove("show");
  typeCursor.classList.remove("done");

  if (!activeQuoteText) {
    typeCursor.classList.add("done");
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    voiceQuote.textContent = activeQuoteText;
    typeCursor.classList.add("done");
    quoteMeta.classList.add("show");
    return;
  }

  const delay = activeQuoteText.length > 120 ? 18 : 24;

  for (let i = 0; i < activeQuoteText.length; i += 1) {
    if (token !== typingToken) return;
    voiceQuote.textContent += activeQuoteText[i];
    await sleep(delay);
  }

  if (token !== typingToken) return;
  typeCursor.classList.add("done");
  quoteMeta.classList.add("show");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
