import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import ebiHandler from "./api/ebi.js";
import bridgeHandler from "./api/bridge.js";

dotenv.config();

const app = express();

app.use(
  express.json({
    limit: "200kb"
  })
);

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);


// --------------------------------------------------
// Static site
// --------------------------------------------------

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


// --------------------------------------------------
// EBI
//
// Uses the SAME api/ebi.js file
// locally and on Vercel.
// --------------------------------------------------

app.all(
  "/api/ebi",
  async (req, res) => {
    return ebiHandler(
      req,
      res
    );
  }
);


// --------------------------------------------------
// THE BRIDGE
//
// Uses the SAME api/bridge.js file
// locally and on Vercel.
// --------------------------------------------------

app.all(
  "/api/bridge",
  async (req, res) => {
    return bridgeHandler(
      req,
      res
    );
  }
);


// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get(
  "/api/health",
  (_, res) => {

    res.json({
      ok: true,
      ebi: true,
      bridge: true
    });

  }
);


// --------------------------------------------------
// Start
// --------------------------------------------------

const port =
  process.env.PORT || 3000;


app.listen(
  port,
  () => {

    console.log(
      `beta! running on http://localhost:${port}`
    );

    console.log(
      `EBI: http://localhost:${port}`
    );

    console.log(
      `The Bridge: http://localhost:${port}/bridge/`
    );

  }
);