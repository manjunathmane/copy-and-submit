CREATE TABLE IF NOT EXISTS fx_rates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rate_date DATE NOT NULL,
  base_currency CHAR(3) NOT NULL,
  quote_currency CHAR(3) NOT NULL,
  rate DECIMAL(24,10) NOT NULL,
  provider VARCHAR(80) NOT NULL DEFAULT 'Frankfurter',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fx_rate (rate_date, base_currency, quote_currency),
  INDEX idx_fx_pair_date (base_currency, quote_currency, rate_date)
);

CREATE TABLE IF NOT EXISTS economic_indicators (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  country_code CHAR(3) NOT NULL,
  country_name VARCHAR(120) NOT NULL,
  indicator_code VARCHAR(40) NOT NULL,
  indicator_name VARCHAR(120) NOT NULL,
  observation_year SMALLINT NOT NULL,
  value DECIMAL(24,8) NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'World Bank',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_economic_observation (country_code, indicator_code, observation_year),
  INDEX idx_indicator_year (indicator_code, observation_year),
  INDEX idx_country_indicator (country_code, indicator_code)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(40) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pending_registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(40) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  resend_after DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
