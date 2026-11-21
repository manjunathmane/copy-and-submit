import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

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

export default function MarketChart({ data = [], pair, period, setPeriod }) {
  const options = ["1W","1M","3M","6M","1Y"];
  const chartData = (Array.isArray(data) ? data : [])
    .map(row => ({ ...row, rate: Number(row.rate) }))
    .filter(row => row.date && Number.isFinite(row.rate));
  return <section className="panel chart-panel">
    <div className="panel-heading">
      <div><div className="eyebrow">HISTORICAL MOVEMENT</div><h2>{currencyWithName(pair.base)} / {currencyWithName(pair.quote)}</h2></div>
      <div className="segmented">{options.map(p => <button key={p} className={period===p?"active":""} onClick={() => setPeriod(p)}>{p}</button>)}</div>
    </div>
    {chartData.length ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{top:12,right:10,left:0,bottom:0}}>
        <defs><linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c99b42" stopOpacity={0.30}/><stop offset="100%" stopColor="#c99b42" stopOpacity={0}/></linearGradient></defs>
        <CartesianGrid stroke="#292723" strokeDasharray="3 5" vertical={false}/>
        <XAxis dataKey="date" tick={{fill:"#77736b",fontSize:10}} tickLine={false} axisLine={false} minTickGap={28}/>
        <YAxis domain={["auto","auto"]} tick={{fill:"#77736b",fontSize:10}} tickLine={false} axisLine={false} width={66}/>
        <Tooltip contentStyle={{background:"#171715",border:"1px solid #3b3528",borderRadius:12,color:"#f2eee5"}} labelStyle={{color:"#aaa"}}/>
        <Area type="monotone" dataKey="rate" stroke="#d2a64e" strokeWidth={2} fill="url(#goldFill)" dot={false} activeDot={{r:4,fill:"#f0cf88",stroke:"#171715"}}/>
      </AreaChart>
    </ResponsiveContainer></div> : <div className="empty-chart">Historical observations are not available for this selection yet.</div>}
    <div className="source-line">Source: Frankfurter · Daily reference rates, not intraday market quotes</div>
  </section>;
}
