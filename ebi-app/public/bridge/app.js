const form =
  document.getElementById(
    "bridgeForm"
  );

const readingInput =
  document.getElementById(
    "reading"
  );

const statusEl =
  document.getElementById(
    "status"
  );

const resultsEl =
  document.getElementById(
    "results"
  );


const oldReference =
  document.getElementById(
    "oldReference"
  );

const oldText =
  document.getElementById(
    "oldText"
  );


const newReference =
  document.getElementById(
    "newReference"
  );

const newText =
  document.getElementById(
    "newText"
  );


const bridgeText =
  document.getElementById(
    "bridgeText"
  );

const digDeeperText =
  document.getElementById(
    "digDeeperText"
  );


const relatedPassages =
  document.getElementById(
    "relatedPassages"
  );

const people =
  document.getElementById(
    "people"
  );

const questions =
  document.getElementById(
    "questions"
  );


const definitionsBlock =
  document.getElementById(
    "definitionsBlock"
  );

const definitionsEl =
  document.getElementById(
    "definitions"
  );


// ==================================================
// API URL
//
// Live Server:
// 127.0.0.1:5500
// talks to Express:
// localhost:3000
//
// Production:
// uses /api/bridge normally
// ==================================================

const isLocal =
  window.location.hostname ===
    "127.0.0.1" ||
  window.location.hostname ===
    "localhost";

const apiUrl =
  isLocal
    ? "http://localhost:3000/api/bridge"
    : "/api/bridge";


// ==================================================
// Submit
// ==================================================

form.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const reading =
      readingInput
        .value
        .trim();


    const voice =
      document.querySelector(
        'input[name="voice"]:checked'
      )?.value || "susan";


    if (!reading) {
      statusEl.textContent =
        "Enter a Bible verse or reading.";

      return;
    }


    setLoading(true);


    try {

      const response =
        await fetch(
          apiUrl,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                reading,
                voice
              })
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data?.error ||
          "The Bridge request failed."
        );
      }


      renderBridge(data);


      statusEl.textContent =
        "";


      resultsEl
        .classList
        .remove("hidden");


    } catch (error) {

      resultsEl
        .classList
        .add("hidden");


      statusEl.textContent =
        error?.message ||
        "Something went wrong.";

    } finally {

      setLoading(false);

    }
  }
);


// ==================================================
// Render response
// ==================================================

function renderBridge(data) {

  oldReference.textContent =
    data?.old_reading
      ?.reference || "";


  oldText.textContent =
    data?.old_reading
      ?.text || "";


  newReference.textContent =
    data?.new_reading
      ?.reference || "";


  newText.textContent =
    data?.new_reading
      ?.text || "";


  bridgeText.textContent =
    data?.bridge
      ?.text || "";


  digDeeperText.textContent =
    data?.dig_deeper
      ?.text || "";


  renderDefinitions(
    data?.definitions
  );


  renderList(
    relatedPassages,
    data?.dig_deeper
      ?.related_passages
  );


  renderList(
    people,
    data?.dig_deeper
      ?.people
  );


  renderList(
    questions,
    data?.dig_deeper
      ?.questions
  );
}


// ==================================================
// Definitions
// ==================================================

function renderDefinitions(
  definitions
) {

  definitionsEl.innerHTML =
    "";


  if (
    !Array.isArray(definitions) ||
    definitions.length === 0
  ) {

    definitionsBlock
      .classList
      .add("hidden");

    return;
  }


  definitionsBlock
    .classList
    .remove("hidden");


  definitions.forEach(
    item => {

      const wrapper =
        document.createElement(
          "div"
        );


      wrapper.style.marginBottom =
        "12px";


      const term =
        document.createElement(
          "strong"
        );


      term.textContent =
        item.term;


      const dash =
        document.createTextNode(
          " — "
        );


      const definition =
        document.createTextNode(
          item.definition
        );


      wrapper.appendChild(
        term
      );

      wrapper.appendChild(
        dash
      );

      wrapper.appendChild(
        definition
      );


      definitionsEl.appendChild(
        wrapper
      );
    }
  );
}


// ==================================================
// Lists
// ==================================================

function renderList(
  element,
  items
) {

  element.innerHTML =
    "";


  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {

    const li =
      document.createElement(
        "li"
      );


    li.textContent =
      "None listed.";


    element.appendChild(
      li
    );


    return;
  }


  items.forEach(
    item => {

      const li =
        document.createElement(
          "li"
        );


      li.textContent =
        item;


      element.appendChild(
        li
      );
    }
  );
}


// ==================================================
// Loading
// ==================================================

function setLoading(
  isLoading
) {

  const button =
    form.querySelector(
      "button"
    );


  button.disabled =
    isLoading;


  if (isLoading) {

    button.textContent =
      "Finding...";


    statusEl.textContent =
      "Looking for the bridge...";


    resultsEl
      .classList
      .add("hidden");

  } else {

    button.textContent =
      "Find the Bridge";

  }
}