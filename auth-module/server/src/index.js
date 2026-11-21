import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import routes from "./routes.js";
import authRoutes from "./authRoutes.js";
import { initializeDatabase, pool } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 5000);
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map(x => x.trim());

app.use(helmet());
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("Origin is not allowed by CORS."));
}}));
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/auth", authRoutes);
app.use("/api", routes);

app.use((err, _req, res, _next) => {
  console.error("[api]", err.message);
  res.status(500).json({ error: "The request could not be completed. Check the server logs and data-source availability." });
});

async function start() {
  if (process.env.DB_AUTO_INIT !== "false") {
    try { await initializeDatabase(); console.log("[database] tables ready"); }
    catch (error) { console.error("[database] initialization failed:", error.message); }
  }
  app.listen(port, "0.0.0.0", () => console.log(`API listening on http://0.0.0.0:${port}`));
}
start();

process.on("SIGINT", async () => { await pool.end(); process.exit(0); });
process.on("SIGTERM", async () => { await pool.end(); process.exit(0); });
