const form = document.getElementById("ebiForm");
const statusEl = document.getElementById("status");
const runBtn = document.getElementById("runBtn");
const copyBtn = document.getElementById("copyBtn");

const jsonOut = document.getElementById("jsonOut");
const oneLiner = document.getElementById("oneLiner");
const prompts = document.getElementById("prompts");

const scoreStrip = document.getElementById("scoreStrip");
const totalScoreEl = document.getElementById("totalScore");
const scoreBandEl = document.getElementById("scoreBand");
const barsEl = document.getElementById("bars");

let lastJson = null;

function setStatus(msg, kind = "") {
  statusEl.textContent = msg || "";
  statusEl.className = "status" + (kind ? ` ${kind}` : "");
}

function scoreBand(total) {
  if (total >= 45) return "Foundational / Exemplary (45–50)";
  if (total >= 40) return "High-impact, integrative (40–44)";
  if (total >= 35) return "Significant but incomplete (35–39)";
  if (total >= 25) return "Disruptive / cautionary (25–34)";
  return "Destructive or misaligned (<25)";
}

function mkBarRow(label, val) {
  const row = document.createElement("div");
  row.className = "barRow";

  const lab = document.createElement("div");
  lab.className = "barLabel";
  lab.textContent = label;

  const track = document.createElement("div");
  track.className = "barTrack";

  const fill = document.createElement("div");
  fill.className = "barFill";
  fill.style.width = `${Math.max(0, Math.min(10, val)) * 10}%`;

  // simple color logic
  const pct = val / 10;
  fill.style.background = pct >= 0.8 ? "var(--good)" : pct >= 0.55 ? "var(--warn)" : "var(--bad)";

  track.appendChild(fill);

  const v = document.createElement("div");
  v.className = "barVal";
  v.textContent = `${val}/10`;

  row.appendChild(lab);
  row.appendChild(track);
  row.appendChild(v);

  return row;
}

function renderResult(data) {
  lastJson = data;
  copyBtn.disabled = false;

  jsonOut.textContent = JSON.stringify(data, null, 2);
  jsonOut.classList.remove("muted");

  oneLiner.textContent = data.one_liner || "—";
  oneLiner.classList.remove("muted");

  prompts.innerHTML = "";
  (data.discussion_prompts || []).slice(0, 6).forEach(p => {
    const li = document.createElement("li");
    li.textContent = p;
    prompts.appendChild(li);
  });
  prompts.classList.remove("muted");

  const total = data.total_score ?? null;
  if (typeof total === "number") {
    totalScoreEl.textContent = String(total);
    scoreBandEl.textContent = scoreBand(total);
    scoreStrip.classList.remove("hidden");
  }

  barsEl.innerHTML = "";
  const s = data.scores || {};
  barsEl.appendChild(mkBarRow("Scope of Impact", s.scope_of_impact ?? 0));
  barsEl.appendChild(mkBarRow("Direction of Tension", s.direction_of_tension ?? 0));
  barsEl.appendChild(mkBarRow("Longevity", s.longevity ?? 0));
  barsEl.appendChild(mkBarRow("Cost Paid", s.cost_paid ?? 0));
  barsEl.appendChild(mkBarRow("Bridge Function", s.bridge_function ?? 0));
  barsEl.classList.remove("hidden");
}

copyBtn.addEventListener("click", async () => {
  if (!lastJson) return;
  await navigator.clipboard.writeText(JSON.stringify(lastJson, null, 2));
  setStatus("Copied JSON to clipboard.", "ok");
  setTimeout(() => setStatus(""), 1500);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const subject = document.getElementById("subject").value.trim();
  const subjectType = document.getElementById("subjectType").value;
  const notes = document.getElementById("notes").value.trim();

  if (!subject) return;

  runBtn.disabled = true;
  copyBtn.disabled = true;
  setStatus("Running EBI…");
  jsonOut.textContent = "{}";
  jsonOut.classList.add("muted");
  oneLiner.textContent = "—";
  oneLiner.classList.add("muted");
  barsEl.classList.add("hidden");
  scoreStrip.classList.add("hidden");

  try {
    const res = await fetch("/api/ebi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, subjectType, notes })
    });

    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload?.error || "Request failed");
    }

    renderResult(payload);
    setStatus("Done.", "ok");
  } catch (err) {
    setStatus(`Error: ${err.message}`, "error");
  } finally {
    runBtn.disabled = false;
  }
});