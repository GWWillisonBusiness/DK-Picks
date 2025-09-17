import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { run } from "./evservice.js";

const app = express();
app.use(cors());

// --- API route ---
app.get("/api/ev-results", async (_req, res) => {
  try {
    const results = await run();
    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching EV results:", err);
    res.status(500).json({ error: "Failed to fetch EV results" });
  }
});

// --- Static React frontend build ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
app.use(express.static(path.join(__dirname, "../build")));

// Fallback to React's index.html for unknown routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../build", "index.html"));
});
 */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
