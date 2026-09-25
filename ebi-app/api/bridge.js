// ebi-app/api/bridge.js
// beta! — The Bridge
// Input a Bible passage/reference.
// Output:
// 1. Old Reading
// 2. New Reading
// 3. The Bridge
// 4. Dig Deeper

export default async function handler(req, res) {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
  
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }
  
    try {
      const body = req.body || {};
      const reading = String(body.reading || "").trim();
  
      if (!reading) {
        return res.status(400).json({
          error: "Missing reading"
        });
      }
  
      const apiKey = process.env.OPENAI_API_KEY;
  
      if (!apiKey) {
        return res.status(500).json({
          error: "OPENAI_API_KEY is not configured"
        });
      }
  
      const result = await findBridgeWithOpenAI({
        apiKey,
        reading
      });
  
      return res.status(200).json({
        ...result,
        input: reading,
        engine: "ai",
        timestamp: new Date().toISOString()
      });
  
    } catch (err) {
      return res.status(500).json({
        error: "Server error",
        detail: err?.message || String(err)
      });
    }
  }
  
  
  // --------------------------------------------------
  // OpenAI Bridge Finder
  // --------------------------------------------------
  
  async function findBridgeWithOpenAI({ apiKey, reading }) {
    const system = `
  You are the Scripture Bridge engine for beta!.
  
  The central idea:
  
  The Old Testament and New Testament are not separate stories.
  They often function like two parts of one sentence.
  
  A user gives you a Bible verse, passage, or reference.
  
  Your job is to identify the strongest legitimate connection
  on the other side of the Old Testament / New Testament divide.
  
  The beta! format is ALWAYS:
  
  1. OLD READING
  2. NEW READING
  3. THE BRIDGE
  4. DIG DEEPER
  
  IMPORTANT RULES:
  
  - Do not explain the connection inside Old Reading.
  - Do not explain the connection inside New Reading.
  - Let the two readings sit beside each other first.
  - Reveal the meaning only in The Bridge.
  - Dig Deeper may then explain context, theology, history,
    related passages, people, and perspectives.
  
  Prioritize connections in this order:
  
  1. Explicit New Testament quotation of the Old Testament
  2. Explicit New Testament interpretation of an Old Testament passage
  3. Clear fulfillment language
  4. Strong and widely recognized biblical typology
  5. Strong literary or theological echo
  6. Possible thematic connection
  
  Do NOT invent a connection merely because two passages sound alike.
  
  If there is no strong connection, say so clearly.
  
  The supplied reading may come from either testament.
  
  If the input is Old Testament:
  find the strongest New Testament connection.
  
  If the input is New Testament:
  find the strongest Old Testament connection.
  
  Keep the readings SHORT and usable on a website/reel.
  Use a Bible reference and a brief excerpt or faithful summary.
  Do not bury the user in a long passage.
  
  Return ONLY valid JSON matching this schema:
  
  {
    "old_reading": {
      "reference": "string",
      "text": "string"
    },
    "new_reading": {
      "reference": "string",
      "text": "string"
    },
    "bridge": {
      "text": "string"
    },
    "dig_deeper": {
      "text": "string",
      "related_passages": ["string"],
      "people": ["string"],
      "questions": ["string"]
    },
    "connection_type": "explicit_quote | explicit_interpretation | fulfillment | typology | strong_echo | possible_connection",
    "confidence": "high | medium | low"
  }
  
  The Bridge should be concise and understandable to someone who is
  not a theologian.
  
  Dig Deeper can be richer, but still conversational.
  
  The purpose is discovery:
  "I knew both of those passages. I never knew they were connected."
  `.trim();
  
    const user = `
  READING OR REFERENCE:
  ${reading}
  `.trim();
  
    const resp = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
  
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
  
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
  
          response_format: {
            type: "json_object"
          },
  
          messages: [
            {
              role: "system",
              content: system
            },
            {
              role: "user",
              content: user
            }
          ],
  
          max_tokens: 1200
        })
      }
    );
  
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
  
      throw new Error(
        `OpenAI error ${resp.status}: ${txt}`
      );
    }
  
    const data = await resp.json();
  
    const content =
      data?.choices?.[0]?.message?.content;
  
    if (!content) {
      throw new Error(
        "No OpenAI content returned"
      );
    }
  
    const parsed = JSON.parse(content);
  
    return sanitizeBridge(parsed);
  }
  
  
  // --------------------------------------------------
  // Clean response
  // --------------------------------------------------
  
  function sanitizeBridge(data) {
    return {
      old_reading: {
        reference:
          String(
            data?.old_reading?.reference || ""
          ).trim(),
  
        text:
          String(
            data?.old_reading?.text || ""
          ).trim()
      },
  
      new_reading: {
        reference:
          String(
            data?.new_reading?.reference || ""
          ).trim(),
  
        text:
          String(
            data?.new_reading?.text || ""
          ).trim()
      },
  
      bridge: {
        text:
          String(
            data?.bridge?.text || ""
          ).trim()
      },
  
      dig_deeper: {
        text:
          String(
            data?.dig_deeper?.text || ""
          ).trim(),
  
        related_passages:
          Array.isArray(
            data?.dig_deeper?.related_passages
          )
            ? data.dig_deeper.related_passages.slice(0, 8)
            : [],
  
        people:
          Array.isArray(
            data?.dig_deeper?.people
          )
            ? data.dig_deeper.people.slice(0, 8)
            : [],
  
        questions:
          Array.isArray(
            data?.dig_deeper?.questions
          )
            ? data.dig_deeper.questions.slice(0, 5)
            : []
      },
  
      connection_type:
        String(
          data?.connection_type ||
          "possible_connection"
        ).trim(),
  
      confidence:
        String(
          data?.confidence || "medium"
        ).trim()
    };
  }