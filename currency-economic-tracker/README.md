# International Currency & Economic Trend Tracker

Phase 1 starter project. React + Vite frontend, Express backend, and a **remote MySQL** database.

## Included
- Dark black/charcoal interface with curved iPhone-style dashboard tabs.
- Gold/amber country fills on a world map (no highlighted country borders).
- Four currency pairs: USD/INR, EUR/USD, GBP/USD, USD/JPY.
- Historical exchange-rate chart and date-range controls.
- Currency converter.
- World Bank country indicators: inflation, GDP growth, unemployment, real interest rate, and government debt.
- Country comparison and basic statistical analysis.
- MySQL persistence for fetched exchange rates and economic observations.
- No NewsAPI integration in this phase.

## Data sources
- Frankfurter v2: daily reference exchange rates, no API key. These are **not intraday trading quotes**.
- World Bank Indicators API v2: economic indicator data, no API key.
- World map geometry: `world-atlas` package.

## Requirements
- Node.js 20 or newer
- npm
- A remote MySQL 8-compatible database (the database must accept connections from the backend host)
- Internet access for the data APIs

## 1. Configure the remote database
Create a database/schema in your chosen hosted MySQL provider. Use its connection details in `server/.env`.

Do not commit `.env` files or share database passwords. The browser never connects directly to MySQL; only the Express backend does.

If you are testing from several laptops, choose one of these arrangements:
- **Recommended for a shared test:** run the backend on one reachable computer/server and have all laptops open the frontend using that computer's LAN address; or
- run a backend on each laptop, with each backend connecting securely to the same remote MySQL database.

For a LAN test, the computer running the backend must allow inbound traffic on port `5000`, and the laptops must be on the same trusted network. Set `VITE_API_URL` in each laptop's frontend `.env` to `http://BACKEND-LAN-IP:5000`. Do not expose the MySQL port to the public internet. Restrict database access to the backend host/IP and use TLS if your provider supports it.

## 2. Configure environment variables
Copy `server/.env.example` to `server/.env`, then fill in the remote MySQL details.

Copy `client/.env.example` to `client/.env`.
- For one laptop running both parts: `VITE_API_URL=http://localhost:5000`
- For other laptops: `VITE_API_URL=http://BACKEND-LAN-IP:5000`

## 3. Install dependencies
Open two terminals at the project root.

Terminal 1:
```bash
cd server
npm install
```

Terminal 2:
```bash
cd client
npm install
```

## 4. Create database tables
From the project root, run the SQL in `database/schema.sql` against your **remote** MySQL database using your provider's SQL console or a MySQL client.

The backend can also create tables automatically when it starts (`DB_AUTO_INIT=true`), but applying the schema manually is recommended for the first setup.

## 5. Start the backend
```bash
cd server
npm run dev
```
Backend health check: `http://localhost:5000/api/health`

## 6. Start the frontend
In another terminal:
```bash
cd client
npm run dev -- --host 0.0.0.0
```
Open the URL printed by Vite. The `--host` option makes it reachable on your local network. Share the frontend LAN URL with other laptops, and set `VITE_API_URL` on those laptops to the backend computer's LAN IP.

## Notes
- Frankfurter may return the latest available business-day reference rate, not a rate for the current calendar date.
- World Bank indicators are annual and often have a reporting delay. The app shows the observation year returned by the API.
- Missing values are displayed as unavailable; the app does not invent values.
- The map uses gold/amber **fills**, not gold/amber outlines. Countries without indicator observations use a dark neutral fill.
- The chart's 1W/1M/3M/6M/1Y ranges are calendar lookbacks; weekends/holidays may have no observation.
- News headlines are intentionally omitted until a later project phase.

## Troubleshooting
- `Database connection failed`: check host, port, username, password, database name, provider IP allowlist, and TLS settings.
- `Failed to fetch`: confirm the backend is running and `VITE_API_URL` is correct.
- If your hosted MySQL provider requires TLS, set `DB_SSL=true`. The server uses TLS with certificate verification enabled.
- If testing on multiple laptops, do not use `localhost` as the backend URL on the other laptops; `localhost` always means that same laptop.
