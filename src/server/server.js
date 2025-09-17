import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { run } from "./evservice.js";

const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Cache variables ===
let cache = {
  data: null,
  timestamp: 0,
};
const TWO_HOURS = 1000 * 60 * 60 * 2; // 2 hours

// --- API route with 2-hour caching ---
app.get("/api/ev-results", async (_req, res) => {
  try {
    const now = Date.now();

    if (!cache.data || now - cache.timestamp > TWO_HOURS) {
      console.log("🔄 Fetching fresh EV results...");
      const results = await run();
      cache = { data: results, timestamp: now };
    } else {
      console.log("✅ Using cached EV results");
    }

    res.json(cache.data);
  } catch (err) {
    console.error("❌ Error fetching EV results:", err);
    res.status(500).json({ error: "Failed to fetch EV results" });
  }
});

// --- Force refresh endpoint ---
app.get("/api/ev-refresh", async (_req, res) => {
  try {
    console.log("⚡ Force refreshing EV results...");
    const results = await run();
    cache = { data: results, timestamp: Date.now() };
    res.json(cache.data);
  } catch (err) {
    console.error("❌ Error in force refresh:", err);
    res.status(500).json({ error: "Failed to refresh EV results" });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
