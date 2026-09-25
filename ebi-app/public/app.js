const form =
  document.getElementById(
    "ebiForm"
  );

const statusEl =
  document.getElementById(
    "status"
  );

const runBtn =
  document.getElementById(
    "runBtn"
  );

const subjectInput =
  document.getElementById(
    "subject"
  );

const subjectTypeInput =
  document.getElementById(
    "subjectType"
  );

const notesInput =
  document.getElementById(
    "notes"
  );


const resultPanel =
  document.getElementById(
    "resultPanel"
  );

const emptyState =
  document.getElementById(
    "emptyState"
  );

const resultContent =
  document.getElementById(
    "resultContent"
  );

const resultSubject =
  document.getElementById(
    "resultSubject"
  );

const totalScoreEl =
  document.getElementById(
    "totalScore"
  );

const oneLiner =
  document.getElementById(
    "oneLiner"
  );

const barsEl =
  document.getElementById(
    "bars"
  );

const promptsEl =
  document.getElementById(
    "prompts"
  );


// =============================================
// API URL
// =============================================

const isLocal =
  window.location.hostname ===
    "127.0.0.1" ||
  window.location.hostname ===
    "localhost";


const apiUrl =
  isLocal
    ? "http://localhost:3000/api/ebi"
    : "/api/ebi";


// =============================================
// STATUS
// =============================================

function setStatus(
  message,
  kind = ""
) {

  statusEl.textContent =
    message || "";


  statusEl.className =
    "status" +
    (
      kind
        ? ` ${kind}`
        : ""
    );

}


// =============================================
// SCORE BAR
// =============================================

function createBar(
  label,
  value
) {

  const safeValue =
    Math.max(
      0,
      Math.min(
        10,
        Number(value) || 0
      )
    );


  const row =
    document.createElement(
      "div"
    );

  row.className =
    "bar-row";


  const top =
    document.createElement(
      "div"
    );

  top.className =
    "bar-top";


  const labelEl =
    document.createElement(
      "div"
    );

  labelEl.className =
    "bar-label";

  labelEl.textContent =
    label;


  const valueEl =
    document.createElement(
      "div"
    );

  valueEl.className =
    "bar-value";

  valueEl.textContent =
    `${safeValue}/10`;


  top.appendChild(
    labelEl
  );

  top.appendChild(
    valueEl
  );


  const track =
    document.createElement(
      "div"
    );

  track.className =
    "bar-track";


  const fill =
    document.createElement(
      "div"
    );

  fill.className =
    "bar-fill";


  track.appendChild(
    fill
  );


  row.appendChild(
    top
  );

  row.appendChild(
    track
  );


  requestAnimationFrame(
    () => {

      fill.style.width =
        `${safeValue * 10}%`;

    }
  );


  return row;
}


// =============================================
// PROMPTS
// =============================================

function renderPrompts(
  items
) {

  promptsEl.innerHTML =
    "";


  const prompts =
    Array.isArray(items)
      ? items.slice(0, 6)
      : [];


  const fallback = [
    "What do you agree with?",
    "What score would you change—and why?",
    "Which dimension matters most to your group right now?"
  ];


  const list =
    prompts.length
      ? prompts
      : fallback;


  list.forEach(
    prompt => {

      const item =
        document.createElement(
          "li"
        );

      item.textContent =
        prompt;


      promptsEl.appendChild(
        item
      );

    }
  );

}


// =============================================
// RESULT
// =============================================

function renderResult(
  data,
  subject
) {

  emptyState
    .classList
    .add("hidden");


  resultContent
    .classList
    .remove("hidden");


  resultSubject.textContent =
    subject ||
    "Result";


  const total =
    Number(
      data?.total_score
    );


  totalScoreEl.textContent =
    Number.isFinite(total)
      ? total
      : "—";


  oneLiner.textContent =
    data?.one_liner ||
    "No summary was returned.";


  barsEl.innerHTML =
    "";


  const scores =
    data?.scores || {};


  barsEl.appendChild(
    createBar(
      "Scope of Impact",
      scores.scope_of_impact
    )
  );


  barsEl.appendChild(
    createBar(
      "Direction of Tension",
      scores.direction_of_tension
    )
  );


  barsEl.appendChild(
    createBar(
      "Longevity",
      scores.longevity
    )
  );


  barsEl.appendChild(
    createBar(
      "Cost Paid",
      scores.cost_paid
    )
  );


  barsEl.appendChild(
    createBar(
      "Bridge Function",
      scores.bridge_function
    )
  );


  renderPrompts(
    data?.discussion_prompts
  );


  if (
    window.innerWidth <= 900
  ) {

    resultPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }

}


// =============================================
// RESET RESULT
// =============================================

function resetResult() {

  resultContent
    .classList
    .add("hidden");


  emptyState
    .classList
    .remove("hidden");


  totalScoreEl.textContent =
    "—";


  oneLiner.textContent =
    "";


  barsEl.innerHTML =
    "";


  promptsEl.innerHTML =
    "";

}


// =============================================
// SUBMIT
// =============================================

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const subject =
      subjectInput
        .value
        .trim();


    const subjectType =
      subjectTypeInput
        .value;


    const notes =
      notesInput
        .value
        .trim();


    if (!subject) {

      setStatus(
        "Enter a person, event, or idea.",
        "error"
      );

      return;

    }


    runBtn.disabled =
      true;


    runBtn.textContent =
      "Exploring...";


    setStatus(
      "Building the EBI..."
    );


    resetResult();


    try {

      const response =
        await fetch(
          apiUrl,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                subject,
                subjectType,
                notes
              })
          }
        );


      const payload =
        await response.json();


      if (!response.ok) {

        throw new Error(
          payload?.error ||
          "EBI request failed."
        );

      }


      renderResult(
        payload,
        subject
      );


      setStatus(
        "",
        "ok"
      );


    } catch (error) {

      setStatus(
        error?.message ||
        "Something went wrong.",
        "error"
      );


    } finally {

      runBtn.disabled =
        false;


      runBtn.textContent =
        "Explore EBI";

    }

  }
);