import { Router } from "express";
import { fetchFxSeries, fetchWorldBankIndicator, INDICATORS } from "./dataSources.js";
import { saveFxRows, saveEconomicRows, pool } from "./db.js";

const router = Router();
const pairs = [
  { base: "USD", quote: "INR", label: "USD (US Dollar) / INR (Indian Rupee)" },
  { base: "EUR", quote: "USD", label: "EUR (Euro) / USD (US Dollar)" },
  { base: "GBP", quote: "USD", label: "GBP (British Pound Sterling) / USD (US Dollar)" },
  { base: "USD", quote: "JPY", label: "USD (US Dollar) / JPY (Japanese Yen)" },
  { base: "USD", quote: "CAD", label: "USD (US Dollar) / CAD (Canadian Dollar)" },
  { base: "USD", quote: "AUD", label: "USD (US Dollar) / AUD (Australian Dollar)" },
  { base: "USD", quote: "CHF", label: "USD (US Dollar) / CHF (Swiss Franc)" },
  { base: "USD", quote: "CNY", label: "USD (US Dollar) / CNY (Chinese Yuan)" },
  { base: "USD", quote: "SGD", label: "USD (US Dollar) / SGD (Singapore Dollar)" },
  { base: "USD", quote: "AED", label: "USD (US Dollar) / AED (United Arab Emirates Dirham)" },
  { base: "USD", quote: "NZD", label: "USD (US Dollar) / NZD (New Zealand Dollar)" },
  { base: "USD", quote: "KRW", label: "USD (US Dollar) / KRW (South Korean Won)" },
  { base: "USD", quote: "ZAR", label: "USD (US Dollar) / ZAR (South African Rand)" },
  { base: "USD", quote: "BRL", label: "USD (US Dollar) / BRL (Brazilian Real)" },
  { base: "USD", quote: "MXN", label: "USD (US Dollar) / MXN (Mexican Peso)" }
];

const dateOnly = d => d.toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return dateOnly(d); };

router.get("/health", async (_req, res) => {
  let database = "unavailable";
  try { await pool.query("SELECT 1"); database = "connected"; } catch {}
  res.json({ status: "ok", database, timestamp: new Date().toISOString() });
});

router.get("/fx/dashboard", async (_req, res, next) => {
  try {
    const from = daysAgo(14), to = dateOnly(new Date());
    const results = await Promise.all(pairs.map(async pair => {
      const rows = await fetchFxSeries(pair.base, pair.quote, from, to);
      await saveFxRows(rows);
      const sorted = [...rows].sort((a,b) => a.date.localeCompare(b.date));
      const latest = sorted.at(-1);
      const previous = sorted.at(-2);
      const change = latest && previous ? ((latest.rate - previous.rate) / previous.rate) * 100 : null;
      return { ...pair, rate: latest?.rate ?? null, date: latest?.date ?? null, changePercent: change };
    }));
    res.json({ data: results, source: "Frankfurter reference rates", fetchedAt: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.get("/fx/history", async (req, res, next) => {
  try {
    const base = String(req.query.base || "USD").toUpperCase();
    const quote = String(req.query.quote || "INR").toUpperCase();
    const allowed = /^[A-Z]{3}$/;
    if (!allowed.test(base) || !allowed.test(quote) || base === quote) {
      return res.status(400).json({ error: "Provide two different three-letter currency codes." });
    }
    const period = ["1W","1M","3M","6M","1Y"].includes(String(req.query.period)) ? String(req.query.period) : "1M";
    const days = { "1W": 7, "1M": 31, "3M": 92, "6M": 183, "1Y": 366 }[period];
    const rows = await fetchFxSeries(base, quote, daysAgo(days), dateOnly(new Date()));
    await saveFxRows(rows);
    res.json({ data: rows.sort((a,b) => a.date.localeCompare(b.date)), source: "Frankfurter reference rates" });
  } catch (error) { next(error); }
});

router.get("/fx/convert", async (req, res, next) => {
  try {
    const base = String(req.query.from || "USD").toUpperCase();
    const quote = String(req.query.to || "INR").toUpperCase();
    const amount = Number(req.query.amount);
    if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote) || !Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "Enter valid currencies and a non-negative amount." });
    }
    if (base === quote) return res.json({ rate: 1, result: amount, date: dateOnly(new Date()), base, quote });
    const rows = await fetchFxSeries(base, quote, daysAgo(14), dateOnly(new Date()));
    const sorted = rows.sort((a,b) => a.date.localeCompare(b.date));
    const latest = sorted.at(-1);
    const previous = sorted.at(-2);
    if (!latest) return res.status(404).json({ error: "No reference rate is available for this pair." });
    await saveFxRows(rows);
    const changePercent = latest && previous && previous.rate ? ((latest.rate - previous.rate) / previous.rate) * 100 : null;
    res.json({ rate: latest.rate, result: amount * latest.rate, date: latest.date, base, quote, changePercent });
  } catch (error) { next(error); }
});

router.get("/economy/indicators", (_req, res) => {
  res.json(Object.entries(INDICATORS).map(([key, value]) => ({ key, ...value })));
});

router.get("/economy/map", async (req, res, next) => {
  try {
    const key = String(req.query.indicator || "inflation");
    const indicator = INDICATORS[key];
    if (!indicator) return res.status(400).json({ error: "Unknown indicator." });
    const rows = await fetchWorldBankIndicator(key);
    await saveEconomicRows(rows);
    res.json({
      indicator: { key, ...indicator },
      data: rows.map(r => ({ countryCode: r.countryCode, countryName: r.countryName, year: r.year, value: r.value })),
      source: "World Bank",
      fetchedAt: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

router.get("/economy/country/:code", async (req, res, next) => {
  try {
    const code = String(req.params.code).toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return res.status(400).json({ error: "Use a three-letter country code." });
    const rows = await pool.query(
      `SELECT country_name AS countryName, indicator_code AS indicatorCode,
       indicator_name AS indicatorName, observation_year AS year, value
       FROM economic_indicators WHERE country_code=? ORDER BY observation_year DESC`,
      [code]
    );
    res.json({ data: rows[0] });
  } catch (error) { next(error); }
});

router.get("/economy/compare", async (req, res, next) => {
  try {
    const codes = String(req.query.countries || "IND,USA,GBR").split(",").map(x => x.trim().toUpperCase()).filter(x => /^[A-Z]{3}$/.test(x)).slice(0,5);
    const indicatorKey = String(req.query.indicator || "inflation");
    const indicator = INDICATORS[indicatorKey];
    if (!indicator) return res.status(400).json({ error: "Unknown indicator." });
    const placeholders = codes.map(() => "?").join(",");
    const [rows] = await pool.query(
      `SELECT country_code AS countryCode, country_name AS countryName,
       observation_year AS year, value FROM economic_indicators
       WHERE indicator_code=? AND country_code IN (${placeholders})
       ORDER BY observation_year DESC`,
      [indicator.code, ...codes]
    );
    const latest = new Map();
    for (const row of rows) if (!latest.has(row.countryCode)) latest.set(row.countryCode, row);
    res.json({ indicator: { key: indicatorKey, ...indicator }, data: [...latest.values()] });
  } catch (error) { next(error); }
});

export default router;
