import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
for (const key of required) {
  if (!process.env[key]) console.warn(`[database] ${key} is not configured.`);
}

export const pool = mysql.createPool({
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

export async function initializeDatabase() {
  const connection = await pool.getConnection();
  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS fx_rates (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        rate_date DATE NOT NULL, base_currency CHAR(3) NOT NULL,
        quote_currency CHAR(3) NOT NULL, rate DECIMAL(24,10) NOT NULL,
        provider VARCHAR(80) NOT NULL DEFAULT 'Frankfurter',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_fx_rate (rate_date, base_currency, quote_currency),
        INDEX idx_fx_pair_date (base_currency, quote_currency, rate_date)
      )`,
      `CREATE TABLE IF NOT EXISTS economic_indicators (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        country_code CHAR(3) NOT NULL, country_name VARCHAR(120) NOT NULL,
        indicator_code VARCHAR(40) NOT NULL, indicator_name VARCHAR(120) NOT NULL,
        observation_year SMALLINT NOT NULL, value DECIMAL(24,8) NULL,
        source VARCHAR(80) NOT NULL DEFAULT 'World Bank',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_economic_observation (country_code, indicator_code, observation_year),
        INDEX idx_indicator_year (indicator_code, observation_year),
        INDEX idx_country_indicator (country_code, indicator_code)
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(40) NOT NULL UNIQUE,
        email VARCHAR(254) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS pending_registrations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(40) NOT NULL,
        email VARCHAR(254) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        resend_after DATETIME NOT NULL,
        attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ];
    for (const sql of statements) await connection.query(sql);
  } finally {
    connection.release();
  }
}

export async function saveFxRows(rows) {
  if (!rows.length) return;
  const values = rows.map(r => [r.date, r.base, r.quote, r.rate, "Frankfurter"]);
  await pool.query(
    `INSERT INTO fx_rates (rate_date, base_currency, quote_currency, rate, provider)
     VALUES ? ON DUPLICATE KEY UPDATE rate=VALUES(rate), provider=VALUES(provider)`,
    [values]
  );
}

export async function saveEconomicRows(rows) {
  if (!rows.length) return;
  const values = rows.map(r => [
    r.countryCode, r.countryName, r.indicatorCode, r.indicatorName,
    Number(r.year), r.value
  ]);
  await pool.query(
    `INSERT INTO economic_indicators
     (country_code,country_name,indicator_code,indicator_name,observation_year,value)
     VALUES ? ON DUPLICATE KEY UPDATE value=VALUES(value), country_name=VALUES(country_name)`,
    [values]
  );
}
