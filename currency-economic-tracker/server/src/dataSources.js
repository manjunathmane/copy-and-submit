const FRANKFURTER = "https://api.frankfurter.dev/v2";
const WORLD_BANK = "https://api.worldbank.org/v2";

export const INDICATORS = {
  inflation: { code: "FP.CPI.TOTL.ZG", name: "Inflation (annual %)", unit: "%" },
  gdpGrowth: { code: "NY.GDP.MKTP.KD.ZG", name: "GDP growth (annual %)", unit: "%" },
  unemployment: { code: "SL.UEM.TOTL.ZS", name: "Unemployment (% of labor force)", unit: "%" },
  interestRate: { code: "FR.INR.RINR", name: "Real interest rate (%)", unit: "%" },
  debt: { code: "GC.DOD.TOTL.GD.ZS", name: "Central government debt (% of GDP)", unit: "%" }
};

export async function fetchFxSeries(base, quote, startDate, endDate) {
  const url = new URL(`${FRANKFURTER}/rates`);
  url.searchParams.set("base", base);
  url.searchParams.set("quotes", quote);
  url.searchParams.set("from", startDate);
  url.searchParams.set("to", endDate);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Frankfurter returned ${response.status}`);
  return response.json();
}

export async function fetchWorldBankIndicator(indicatorKey) {
  const indicator = INDICATORS[indicatorKey];
  if (!indicator) throw new Error("Unsupported indicator");
  const url = `${WORLD_BANK}/country/all/indicator/${indicator.code}?format=json&mrnev=1&per_page=20000`;
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`World Bank returned ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) return [];
  return payload[1]
    .filter(row => row.value !== null && row.countryiso3code && row.country?.value)
    .map(row => ({
      countryCode: row.countryiso3code,
      countryName: row.country.value,
      indicatorCode: indicator.code,
      indicatorName: indicator.name,
      year: row.date,
      value: Number(row.value)
    }));
}
