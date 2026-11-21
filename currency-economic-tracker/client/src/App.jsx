import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownUp, BarChart3, Globe2, RefreshCw, Search, Sigma, TrendingUp, Wallet } from "lucide-react";
import { api } from "./api";
import WorldMap from "./components/WorldMap";
import MarketChart from "./components/MarketChart";

const currencyNames = {
  USD: "US Dollar", INR: "Indian Rupee", EUR: "Euro", GBP: "British Pound Sterling",
  JPY: "Japanese Yen", AUD: "Australian Dollar", CAD: "Canadian Dollar", CHF: "Swiss Franc",
  CNY: "Chinese Yuan", SGD: "Singapore Dollar", AED: "United Arab Emirates Dirham",
  NZD: "New Zealand Dollar", KRW: "South Korean Won", ZAR: "South African Rand",
  BRL: "Brazilian Real", MXN: "Mexican Peso"
};

function currencyWithName(code) {
  return `${code} (${currencyNames[code] || "Currency"})`;
}

function pairWithNames(base, quote) {
  return `${currencyWithName(base)} / ${currencyWithName(quote)}`;
}

const tabs = [
  ["Overview","overview",Globe2],["Converter","converter",ArrowDownUp],
  ["Exchange rates","rates",TrendingUp],["Historical data","history",BarChart3],
  ["Country comparison","compare",Activity],["Statistics","statistics",Sigma]
];
const indicators = [
  ["inflation","Inflation"],["gdpGrowth","GDP growth"],["unemployment","Unemployment"],
  ["interestRate","Real interest rate"],["debt","Government debt"]
];
const defaultPair = { base:"USD", quote:"INR" };
const currencyList = ["USD","INR","EUR","GBP","JPY","AUD","CAD","CHF","CNY","SGD","AED","NZD","KRW","ZAR","BRL","MXN"];
const compareCurrencyOptions = [
  { code: "IND", currency: "INR", name: "India" },
  { code: "USA", currency: "USD", name: "United States" },
  { code: "GBR", currency: "GBP", name: "United Kingdom" },
  { code: "DEU", currency: "EUR", name: "Germany" },
  { code: "JPN", currency: "JPY", name: "Japan" },
  { code: "AUS", currency: "AUD", name: "Australia" },
  { code: "CAN", currency: "CAD", name: "Canada" },
  { code: "CHE", currency: "CHF", name: "Switzerland" },
  { code: "CHN", currency: "CNY", name: "China" },
  { code: "SGP", currency: "SGD", name: "Singapore" },
  { code: "ARE", currency: "AED", name: "United Arab Emirates" },
  { code: "NZL", currency: "NZD", name: "New Zealand" },
  { code: "KOR", currency: "KRW", name: "South Korea" },
  { code: "ZAF", currency: "ZAR", name: "South Africa" },
  { code: "BRA", currency: "BRL", name: "Brazil" },
  { code: "MEX", currency: "MXN", name: "Mexico" }
];

function fmt(value, digits=4) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});
}
function PairCard({ item, active, onClick }) {
  return <button className={`pair-card ${active?"selected":""}`} onClick={onClick}>
    <span className="eyebrow">{pairWithNames(item.base,item.quote)}</span>
    <strong>{item.rate == null ? "—" : fmt(item.rate,5)}</strong>
    <span className={`change ${item.changePercent == null ? "" : item.changePercent >= 0 ? "positive" : "negative"}`}>
      {item.changePercent == null ? "Change unavailable" : `${item.changePercent >= 0 ? "+" : ""}${item.changePercent.toFixed(2)}%`}
    </span>
    <small>{item.date || "No observation date"}</small>
  </button>;
}
function Stat({ label, value, note }) {
  return <div className="stat"><span className="eyebrow">{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

export default function App() {
  const [tab,setTab] = useState("overview");
  const [pairs,setPairs] = useState([]);
  const [pair,setPair] = useState(defaultPair);
  const [period,setPeriod] = useState("1M");
  const [history,setHistory] = useState([]);
  const [indicator,setIndicator] = useState("inflation");
  const [mapRows,setMapRows] = useState([]);
  const [selectedCountry,setSelectedCountry] = useState(null);
  const [mapMode,setMapMode] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [lastUpdated,setLastUpdated] = useState("");
  const [amount,setAmount] = useState("1");
  const [from,setFrom] = useState("USD");
  const [to,setTo] = useState("INR");
  const [conversion,setConversion] = useState(null);
  const [compareSelections,setCompareSelections] = useState([
    compareCurrencyOptions[0], compareCurrencyOptions[1], compareCurrencyOptions[2]
  ]);
  const [compareRows,setCompareRows] = useState([]);
  const [compareIndicator,setCompareIndicator] = useState("inflation");
  const [customRateEntries,setCustomRateEntries] = useState([]);
  const [removedRateKeys,setRemovedRateKeys] = useState([]);
  const [rateBase,setRateBase] = useState("EUR");
  const [rateQuote,setRateQuote] = useState("GBP");
  const [sidebarCollapsed,setSidebarCollapsed] = useState(false);
  const [sidebarWidth,setSidebarWidth] = useState(224);
  const [sidebarResizing,setSidebarResizing] = useState(false);

  async function loadDashboard() {
    try {
      setLoading(true); setError("");
      const result = await api("/fx/dashboard");
      setPairs(result.data || []); setLastUpdated(result.fetchedAt || "");
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function loadHistory(nextPair=pair,nextPeriod=period) {
    try {
      const result = await api(`/fx/history?base=${nextPair.base}&quote=${nextPair.quote}&period=${nextPeriod}`);
      setHistory(Array.isArray(result.data) ? result.data : []);
    } catch(e) { setHistory([]); setError(e.message); }
  }
  async function loadMap(nextIndicator=indicator) {
    try {
      setLoading(true); setError("");
      const result = await api(`/economy/map?indicator=${nextIndicator}`);
      setMapRows(result.data || []); setLastUpdated(result.fetchedAt || "");
    } catch(e) { setError(e.message); setMapRows([]); }
    finally { setLoading(false); }
  }
  async function convert() {
    try {
      setError("");
      const result = await api(`/fx/convert?from=${from}&to=${to}&amount=${encodeURIComponent(amount)}`);
      setConversion(result);
    } catch(e) { setConversion(null); setError(e.message); }
  }
  async function compare() {
    try {
      const countryCodes = compareSelections.map(item => item.code).join(",");
      if (!countryCodes) {
        setCompareRows([]);
        setError("Select at least one country currency to compare.");
        return;
      }
      const result = await api(`/economy/compare?countries=${encodeURIComponent(countryCodes)}&indicator=${compareIndicator}`);
      setCompareRows(result.data || []);
    } catch(e) { setCompareRows([]); setError(e.message); }
  }
  async function addRateEntry() {
    if (rateBase === rateQuote) {
      setError("Select two different currencies.");
      return;
    }
    const key = `${rateBase}/${rateQuote}`;
    const alreadyVisible = pairs.some(item => `${item.base}/${item.quote}` === key && !removedRateKeys.includes(key));
    if (alreadyVisible || customRateEntries.some(item => `${item.base}/${item.quote}` === key)) {
      setError("This exchange-rate entry is already in the list.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const result = await api(`/fx/convert?from=${rateBase}&to=${rateQuote}&amount=1`);
      setCustomRateEntries(current => [...current, {
        base: rateBase,
        quote: rateQuote,
        label: pairWithNames(rateBase, rateQuote),
        rate: result.rate,
        date: result.date,
        changePercent: result.changePercent ?? null
      }]);
      setRemovedRateKeys(current => current.filter(removedKey => removedKey !== key));
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function removeCompareCurrency(code) {
    setCompareSelections(current => current.filter(item => item.code !== code));
  }
  function removeRateEntry(base, quote) {
    const key = `${base}/${quote}`;
    const isCustom = customRateEntries.some(item => item.base === base && item.quote === quote);
    if (isCustom) {
      setCustomRateEntries(current => current.filter(item => !(item.base === base && item.quote === quote)));
    } else {
      setRemovedRateKeys(current => current.includes(key) ? current : [...current, key]);
    }
  }

  function addCompareCurrency(code) {
    if (!code) return;
    const item = compareCurrencyOptions.find(option => option.code === code);
    if (!item) return;
    setCompareSelections(current => {
      if (current.length >= 5 || current.some(selected => selected.code === item.code)) return current;
      return [...current, item];
    });
  }

  function changeHistoricalBase(base) {
    if (!base || base === pair.quote) return;
    const nextPair = { base, quote: pair.quote };
    setPair(nextPair);
    setHistory([]);
    loadHistory(nextPair, period);
  }

  function changeHistoricalQuote(quote) {
    if (!quote || quote === pair.base) return;
    const nextPair = { base: pair.base, quote };
    setPair(nextPair);
    setHistory([]);
    loadHistory(nextPair, period);
  }

  useEffect(() => { loadDashboard(); loadMap("inflation"); }, []);
  useEffect(() => { loadHistory(pair,period); }, [pair.base,pair.quote,period]);
  useEffect(() => { loadMap(indicator); }, [indicator]);
  useEffect(() => { if(tab==="compare") compare(); }, [tab,compareIndicator,compareSelections]);

  const activePair = pairs.find(p => p.base===pair.base && p.quote===pair.quote) || { ...pair, rate:null };
  const values = mapRows.map(r=>Number(r.value)).filter(Number.isFinite);
  const stats = useMemo(() => {
    if(!values.length) return null;
    const sorted=[...values].sort((a,b)=>a-b);
    return {min:sorted[0],max:sorted.at(-1),avg:values.reduce((a,b)=>a+b,0)/values.length,count:values.length};
  },[mapRows]);
  const indicatorLabel = indicators.find(x=>x[0]===indicator)?.[1] || "Indicator";

  function selectPair(item) { setPair({base:item.base,quote:item.quote}); setTab("overview"); }
  function renderOverview() {
    const overviewKeys = new Set(["USD/INR","EUR/USD","GBP/USD","USD/JPY"]);
    const overviewPairs = pairs.filter(item => overviewKeys.has(`${item.base}/${item.quote}`));
    return <div className="overview-grid">
      <div className="pair-grid">{overviewPairs.map(item=><PairCard key={item.label} item={item} active={item.base===pair.base&&item.quote===pair.quote} onClick={()=>selectPair(item)}/>)}</div>
      <MarketChart data={history} pair={pair} period={period} setPeriod={setPeriod}/>
      <section className="panel map-panel">
        <div className="panel-heading">
          <div><div className="eyebrow">GLOBAL ECONOMIC INTELLIGENCE</div><h2>World overview</h2></div>
          <button className="outline-btn" onClick={()=>setMapMode(v=>!v)}>{mapMode?"Return to dashboard":"Expand map"}</button>
        </div>
        <div className="map-toolbar">
          <label>INDICATOR<select value={indicator} onChange={e=>setIndicator(e.target.value)}>{indicators.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
          <span className="map-unit">{indicatorLabel} · World Bank</span>
        </div>
        <WorldMap rows={mapRows} selected={selectedCountry} onSelect={setSelectedCountry}/>
        <div className="map-footer">
          <div className="legend"><span>Lower</span><i className="swatch s1"/><i className="swatch s2"/><i className="swatch s3"/><i className="swatch s4"/><i className="swatch s5"/><span>Higher</span></div>
        </div>
        {stats && <div className="map-stats"><Stat label="COUNTRIES WITH DATA" value={stats.count}/><Stat label="LOWEST OBSERVATION" value={`${fmt(stats.min,2)}%`}/><Stat label="HIGHEST OBSERVATION" value={`${fmt(stats.max,2)}%`}/><Stat label="GLOBAL AVERAGE" value={`${fmt(stats.avg,2)}%`}/></div>}
        <div className="source-line">Source: World Bank Indicators API · Latest available observation per country. Dark grey means no observation was returned.</div>
      </section>
    </div>;
  }
  function renderConverter() {
    return <section className="panel feature-panel">
      <div className="eyebrow">CURRENCY TOOLS</div><h2>Currency converter</h2>
      <p className="muted">Convert using the latest available daily reference rate.</p>
      <div className="converter-grid">
        <label>AMOUNT<input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="0"/></label>
        <label>FROM<select value={from} onChange={e=>setFrom(e.target.value)}>{currencyList.map(c=><option key={c} value={c}>{currencyWithName(c)}</option>)}</select></label>
        <button className="swap-btn" onClick={()=>{setFrom(to);setTo(from);setConversion(null);}} aria-label="Swap currencies"><ArrowDownUp/></button>
        <label>TO<select value={to} onChange={e=>setTo(e.target.value)}>{currencyList.map(c=><option key={c} value={c}>{currencyWithName(c)}</option>)}</select></label>
        <button className="gold-btn" onClick={convert}>Convert</button>
      </div>
      {conversion && <div className="conversion-result"><span>{fmt(amount,2)} {currencyWithName(conversion.base)} equals</span><strong>{fmt(conversion.result,2)} {currencyWithName(conversion.quote)}</strong><small>1 {currencyWithName(conversion.base)} = {fmt(conversion.rate,6)} {currencyWithName(conversion.quote)} · Observation: {conversion.date}</small></div>}
      <div className="source-line">Rates from Frankfurter. Reference rates may differ from bank/card provider rates.</div>
    </section>;
  }
  function renderRates() {
    const allEntries = [...pairs.filter(p=>!removedRateKeys.includes(`${p.base}/${p.quote}`)), ...customRateEntries];
    return <section className="panel feature-panel">
      <div className="rates-heading"><div><div className="eyebrow">REFERENCE MARKET</div><h2>Exchange rates</h2><p className="muted">Select two currencies to add an exchange-rate entry.</p></div>
        <div className="rate-entry-controls">
          <label>BASE<select value={rateBase} onChange={e=>setRateBase(e.target.value)}>{currencyList.map(code=><option key={code} value={code}>{currencyWithName(code)}</option>)}</select></label>
          <span className="rate-arrow">→</span>
          <label>QUOTE<select value={rateQuote} onChange={e=>setRateQuote(e.target.value)}>{currencyList.map(code=><option key={code} value={code}>{currencyWithName(code)}</option>)}</select></label>
          <button className="gold-btn" onClick={addRateEntry}>Add entry</button>
        </div>
      </div>
      <div className="exchange-rate-list">{allEntries.map(p=><div className="exchange-rate-row" key={`${p.base}/${p.quote}`}>
        <button className="exchange-rate-main" onClick={()=>selectPair(p)}><b>{pairWithNames(p.base,p.quote)}</b><strong>{fmt(p.rate,5)}</strong><span className={p.changePercent>=0?"positive":"negative"}>{p.changePercent==null?"—":`${p.changePercent>=0?"+":""}${p.changePercent.toFixed(2)}%`}</span><small>{p.date || "Unavailable"}</small></button>
        <button className="rate-remove" onClick={()=>removeRateEntry(p.base,p.quote)} aria-label={`Remove ${p.base} to ${p.quote}`}>×</button>
      </div>)}</div>
    </section>;
  }
  function renderHistory() {
    const chartKey = `${pair.base}/${pair.quote}/${period}`;
    return <div className="feature-stack">
      <section className="panel historical-selector-panel">
        <div><div className="eyebrow">HISTORICAL CURRENCY PAIR</div><h2>Select currencies</h2></div>
        <div className="historical-currency-controls">
          <label>BASE<select value={pair.base} onChange={e=>changeHistoricalBase(e.target.value)}>{currencyList.map(code=><option key={code} value={code}>{currencyWithName(code)}</option>)}</select></label>
          <span>→</span>
          <label>QUOTE<select value={pair.quote} onChange={e=>changeHistoricalQuote(e.target.value)}>{currencyList.map(code=><option key={code} value={code}>{currencyWithName(code)}</option>)}</select></label>
        </div>
      </section>
      <MarketChart key={chartKey} data={history} pair={pair} period={period} setPeriod={setPeriod}/>
      <section className="panel feature-panel">
        <div className="eyebrow">OBSERVATIONS</div>
        <h2>Historical data · {pairWithNames(pair.base,pair.quote)}</h2>
        <div className="data-table">
          <div className="data-row header"><span>Date</span><span>Base</span><span>Quote</span><span>Rate</span></div>
          {history.slice().reverse().map(r=><div className="data-row" key={r.date}><span>{r.date}</span><span>{currencyWithName(r.base || pair.base)}</span><span>{currencyWithName(r.quote || pair.quote)}</span><b>{fmt(r.rate,6)}</b></div>)}
        </div>
      </section>
    </div>;
  }
  function renderCompare() {
    return <section className="panel feature-panel"><div className="eyebrow">COUNTRY COMPARISON</div><h2>Compare economies</h2><p className="muted">Select up to five currencies. Each selected currency adds its country to the comparison field.</p>
      <div className="compare-controls">
        <div className="currency-tag-field">
          {compareSelections.map(item => <span className="currency-tag" key={item.code}><b>{item.currency}</b><small>{item.name}</small><button type="button" onClick={()=>removeCompareCurrency(item.code)} aria-label={`Remove ${item.name}`}>×</button></span>)}
          {!compareSelections.length && <span className="tag-placeholder">Select currencies below</span>}
        </div>
        <select className="currency-dropdown" value="" onChange={e=>{addCompareCurrency(e.target.value); e.target.value="";}} disabled={compareSelections.length >= 5}>
          <option value="">{compareSelections.length >= 5 ? "5 currencies selected" : "Add currency or country"}</option>
          {compareCurrencyOptions.map(item => <option key={item.code} value={item.code} disabled={compareSelections.some(selected=>selected.code===item.code)}>{item.currency} — {item.name}</option>)}
        </select>
        <select value={compareIndicator} onChange={e=>setCompareIndicator(e.target.value)}>{indicators.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
        <button className="gold-btn" onClick={compare}>Compare</button>
      </div>
      <div className="rate-table">{compareRows.map(r=>{const selected = compareCurrencyOptions.find(option=>option.code===r.countryCode); return <div key={r.countryCode}><b>{r.countryName}</b><strong>{selected ? `${selected.currency} (${currencyNames[selected.currency]})` : r.countryCode}</strong><span>{fmt(r.value,2)}%</span><small>{r.year}</small></div>;})}</div>
      {!compareRows.length && <div className="empty-state">No comparison observations are stored yet. Open the Overview map first to load World Bank data, then compare.</div>}
    </section>;
  }
  function renderStats() {
    return <section className="panel feature-panel"><div className="eyebrow">STATISTICAL ANALYSIS</div><h2>{indicatorLabel} · Global snapshot</h2><p className="muted">Calculations use the latest available observation returned for each country. This is a descriptive summary, not a forecast.</p>
      {stats ? <div className="stats-grid"><Stat label="OBSERVATIONS" value={stats.count}/><Stat label="AVERAGE" value={`${fmt(stats.avg,2)}%`}/><Stat label="MINIMUM" value={`${fmt(stats.min,2)}%`}/><Stat label="MAXIMUM" value={`${fmt(stats.max,2)}%`}/></div> : <div className="empty-state">No indicator data is currently available.</div>}
      <label className="inline-select">INDICATOR<select value={indicator} onChange={e=>setIndicator(e.target.value)}>{indicators.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
    </section>;
  }

  function logout() {
    localStorage.removeItem("currency_tracker_token");
    window.location.href = "/login";
  }

  function beginSidebarResize(event) {
    if (window.innerWidth <= 700) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarCollapsed ? 72 : sidebarWidth;
    let dragMoved = false;

    function resize(moveEvent) {
      const delta = moveEvent.clientX - startX;
      if (!dragMoved && Math.abs(delta) < 4) return;
      dragMoved = true;
      setSidebarResizing(true);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      const nextWidth = Math.min(360, Math.max(72, startWidth + delta));
      if (nextWidth <= 96) {
        setSidebarCollapsed(true);
        setSidebarWidth(72);
      } else {
        setSidebarCollapsed(false);
        setSidebarWidth(nextWidth);
      }
    }

    function stopResize() {
      setSidebarResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    }

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }

  function toggleSidebar() {
    setSidebarCollapsed(current => {
      const nextCollapsed = !current;
      if (!nextCollapsed) setSidebarWidth(224);
      return nextCollapsed;
    });
  }

  const renderers = { overview:renderOverview, converter:renderConverter, rates:renderRates, history:renderHistory, compare:renderCompare, statistics:renderStats };
  return <main className="app-shell">
    <aside className={`sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${sidebarResizing ? "sidebar-resizing" : ""} ${!sidebarCollapsed && sidebarWidth < 185 ? "sidebar-compact" : ""}`} style={sidebarCollapsed ? undefined : { width: sidebarWidth }}>
      <button className="sidebar-toggle" type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Open navigation" : "Close navigation"} title={sidebarCollapsed ? "Open navigation" : "Close navigation"}><span/><span/><span/></button>
      <div className="brand-mark"><img src="/Logo.png" alt="EcoTrac logo" /></div>
      <div className="brand-copy"><b>EcoTrac</b><span>GLOBAL<br />FINANCIAL INTELLIGENCE</span></div>
      <div className="side-caption">WORKSPACE</div>
      <nav>{tabs.map(([label,key,Icon])=><button key={key} className={tab===key?"nav-active":""} onClick={()=>setTab(key)} title={label}><Icon size={17}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><span className="live-dot"/> DATA CONNECTION <small>PHASE 01 · LOCAL TEST</small></div>
      {sidebarResizing && <div className="resize-indicator" />}
      <div className="sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Resize navigation" onPointerDown={beginSidebarResize} onDoubleClick={()=>{setSidebarCollapsed(false);setSidebarWidth(224);}} />
    </aside>
    <section className="main-area">
      <header className="topbar">
        <div><div className="eyebrow">INTERNATIONAL CURRENCY & ECONOMIC TREND TRACKER</div><h1>{tabs.find(t=>t[1]===tab)?.[0]}</h1></div>
        <div className="top-actions"><span className="connection"><i/> API CONNECTED</span><button className="icon-btn" onClick={()=>{loadDashboard();loadMap(indicator);loadHistory();}} title="Refresh data"><RefreshCw size={16}/></button><button className="outline-btn" onClick={logout}>Logout</button></div>
      </header>
      {error && <div className="error-banner">{error}<button onClick={()=>setError("")}>Dismiss</button></div>}
      {loading && <div className="loading-line">Updating data from source APIs…</div>}
      {renderers[tab]()}
      <footer><span>DATA SOURCES: FRANKFURTER · WORLD BANK</span><span>LAST FETCH: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}</span></footer>
    </section>
    {mapMode && <div className="map-focus">
      <div className="focus-top"><div><div className="eyebrow">GLOBAL ECONOMIC INTELLIGENCE</div><h2>World economic map</h2></div><button className="outline-btn" onClick={()=>setMapMode(false)}>Close map view</button></div>
      <div className="focus-controls"><label>INDICATOR<select value={indicator} onChange={e=>setIndicator(e.target.value)}>{indicators.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><span>World Bank · Latest available observations</span></div>
      <div className="focus-map"><WorldMap rows={mapRows} selected={selectedCountry} onSelect={setSelectedCountry}/></div>
      <div className="focus-bottom"><div className="legend"><span>Lower</span><i className="swatch s1"/><i className="swatch s2"/><i className="swatch s3"/><i className="swatch s4"/><i className="swatch s5"/><span>Higher</span></div></div>
    </div>}
  </main>;
}
