import mysql from "mysql2/promise";
import sqlite3 from "sqlite3";

const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
for (const key of required) {
  if (!process.env[key]) console.warn(`[database] ${key} is not configured.`);
}

const mysqlPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 8,
  queueLimit: 0,
  enableKeepAlive: true,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
});

let sqliteDb = null;
let usingSqlite = false;

function sqliteRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve({ insertId: this.lastID, affectedRows: this.changes });
    });
  });
}

function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows || []));
  });
}

async function sqliteQuery(sql, params = []) {
  const text = String(sql).replace(/\s+/g," ").trim();
  const upper = text.toUpperCase();

  if (upper.startsWith("INSERT INTO PENDING_REGISTRATIONS") && Array.isArray(params) && params.length === 4) {
    const [username,email,passwordHash,otpHash] = params;
    const now = Date.now();
    const expiresAt = new Date(now + 5 * 60_000).toISOString();
    const resendAfter = new Date(now + 60_000).toISOString();
    await sqliteRun(`INSERT INTO pending_registrations (username,email,password_hash,otp_hash,expires_at,resend_after,attempts)
      VALUES (?,?,?,?,?,?,0)
      ON CONFLICT(email) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash,
      otp_hash=excluded.otp_hash,expires_at=excluded.expires_at,resend_after=excluded.resend_after,attempts=0`,
      [username,email,passwordHash,otpHash,expiresAt,resendAfter]);
    return [{ insertId: 0, affectedRows: 1 }];
  }

  if (upper.includes("SELECT 1")) return [[{ "1": 1 }], {}];
  if (/^(SELECT|WITH)/i.test(text)) {
    const rows = await sqliteAll(text, params.flat ? params.flat() : params);
    return [rows, {}];
  }

  const result = await sqliteRun(text, params.flat ? params.flat() : params);
  return [result, {}];
}

const fallbackPool = {
  async query(sql, params = []) {
    if (!usingSqlite) return mysqlPool.query(sql, params);
    return sqliteQuery(sql, params);
  },
  async getConnection() {
    if (!usingSqlite) return mysqlPool.getConnection();
    return {
      async beginTransaction() { await sqliteRun("BEGIN"); },
      async commit() { await sqliteRun("COMMIT"); },
      async rollback() { await sqliteRun("ROLLBACK"); },
      async query(sql, params = []) { return sqliteQuery(sql, params); },
      release() {}
    };
  },
  async end() {
    if (usingSqlite && sqliteDb) await new Promise(resolve => sqliteDb.close(resolve));
    else await mysqlPool.end();
  }
};

export const pool = fallbackPool;

async function initializeSqlite() {
  sqliteDb = new sqlite3.Database("./currency_tracker.sqlite");
  usingSqlite = true;
  const statements = [
    `CREATE TABLE IF NOT EXISTS fx_rates (id INTEGER PRIMARY KEY AUTOINCREMENT, rate_date TEXT NOT NULL, base_currency TEXT NOT NULL, quote_currency TEXT NOT NULL, rate REAL NOT NULL, provider TEXT NOT NULL DEFAULT 'Frankfurter', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(rate_date,base_currency,quote_currency))`,
    `CREATE TABLE IF NOT EXISTS economic_indicators (id INTEGER PRIMARY KEY AUTOINCREMENT, country_code TEXT NOT NULL, country_name TEXT NOT NULL, indicator_code TEXT NOT NULL, indicator_name TEXT NOT NULL, observation_year INTEGER NOT NULL, value REAL, source TEXT NOT NULL DEFAULT 'World Bank', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(country_code,indicator_code,observation_year))`,
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS pending_registrations (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, otp_hash TEXT NOT NULL, expires_at TEXT NOT NULL, resend_after TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  ];
  for (const sql of statements) await sqliteRun(sql);
  console.log("[database] using local SQLite fallback");
}

export async function initializeDatabase() {
  try {
    const connection = await mysqlPool.getConnection();
    const statements = [
      `CREATE TABLE IF NOT EXISTS fx_rates (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, rate_date DATE NOT NULL, base_currency CHAR(3) NOT NULL, quote_currency CHAR(3) NOT NULL, rate DECIMAL(24,10) NOT NULL, provider VARCHAR(80) NOT NULL DEFAULT 'Frankfurter', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_fx_rate (rate_date, base_currency, quote_currency), INDEX idx_fx_pair_date (base_currency, quote_currency, rate_date))`,
      `CREATE TABLE IF NOT EXISTS economic_indicators (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, country_code CHAR(3) NOT NULL, country_name VARCHAR(120) NOT NULL, indicator_code VARCHAR(40) NOT NULL, indicator_name VARCHAR(120) NOT NULL, observation_year SMALLINT NOT NULL, value DECIMAL(24,8) NULL, source VARCHAR(80) NOT NULL DEFAULT 'World Bank', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_economic_observation (country_code, indicator_code, observation_year), INDEX idx_indicator_year (indicator_code, observation_year), INDEX idx_country_indicator (country_code, indicator_code))`,
      `CREATE TABLE IF NOT EXISTS users (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, username VARCHAR(40) NOT NULL UNIQUE, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS pending_registrations (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, username VARCHAR(40) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, otp_hash VARCHAR(255) NOT NULL, expires_at DATETIME NOT NULL, resend_after DATETIME NOT NULL, attempts TINYINT UNSIGNED NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    ];
    for (const sql of statements) await connection.query(sql);
    connection.release();
  } catch (error) {
    await initializeSqlite();
  }
}

export async function saveFxRows(rows) {
  if (!rows.length) return;
  if (usingSqlite) {
    for (const r of rows) await sqliteQuery(
      `INSERT INTO fx_rates (rate_date,base_currency,quote_currency,rate,provider) VALUES (?,?,?,?,?) ON CONFLICT(rate_date,base_currency,quote_currency) DO UPDATE SET rate=excluded.rate,provider=excluded.provider`,
      [r.date,r.base,r.quote,r.rate,"Frankfurter"]);
  } else {
    const values = rows.map(r => [r.date,r.base,r.quote,r.rate,"Frankfurter"]);
    await pool.query(`INSERT INTO fx_rates (rate_date, base_currency, quote_currency, rate, provider) VALUES ? ON DUPLICATE KEY UPDATE rate=VALUES(rate), provider=VALUES(provider)`, [values]);
  }
}

export async function saveEconomicRows(rows) {
  if (!rows.length) return;
  if (usingSqlite) {
    for (const r of rows) await sqliteQuery(
      `INSERT INTO economic_indicators (country_code,country_name,indicator_code,indicator_name,observation_year,value) VALUES (?,?,?,?,?,?) ON CONFLICT(country_code,indicator_code,observation_year) DO UPDATE SET value=excluded.value,country_name=excluded.country_name`,
      [r.countryCode,r.countryName,r.indicatorCode,r.indicatorName,Number(r.year),r.value]);
  } else {
    const values = rows.map(r => [r.countryCode,r.countryName,r.indicatorCode,r.indicatorName,Number(r.year),r.value]);
    await pool.query(`INSERT INTO economic_indicators (country_code,country_name,indicator_code,indicator_name,observation_year,value) VALUES ? ON DUPLICATE KEY UPDATE value=VALUES(value), country_name=VALUES(country_name)`, [values]);
  }
}
