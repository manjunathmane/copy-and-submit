import { useMemo } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import world from "world-atlas/countries-110m.json";
import { feature } from "topojson-client";

const geoData = feature(world, world.objects.countries);
const aliases = {
  "united states of america":"united states",
  "russian federation":"russia",
  "republic of korea":"south korea",
  "democratic people's republic of korea":"north korea",
  "iran":"iran, islamic republic of",
  "viet nam":"vietnam",
  "lao pdr":"laos",
  "syrian arab republic":"syria",
  "tanzania":"united republic of tanzania",
  "bolivia":"bolivia (plurinational state of)",
  "venezuela":"venezuela (bolivarian republic of)",
  "moldova":"moldova, republic of",
  "brunei":"brunei darussalam",
  "egypt":"egypt, arab rep."
};
const norm = s => {
  const key = String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return aliases[key] || key;
};
function shade(value, min, max) {
  if (value == null || !Number.isFinite(value)) return "#242321";
  if (max === min) return "#c99b42";
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const palette = ["#5b421e", "#805b25", "#a7792f", "#c99b42", "#e1bd70"];
  return palette[Math.min(4, Math.floor(t * 5))];
}

export default function WorldMap({ rows = [], selected, onSelect }) {
  const values = useMemo(() => {
    const map = new Map();
    rows.forEach(row => map.set(norm(row.countryName), row));
    return map;
  }, [rows]);
  const nums = rows.map(r => Number(r.value)).filter(Number.isFinite);
  const min = nums.length ? Math.min(...nums) : 0;
  const max = nums.length ? Math.max(...nums) : 1;

  return <div className="map-wrap">
    <ComposableMap
      projection="geoNaturalEarth1"
      projectionConfig={{ scale: 178, center: [8, 3] }}
      width={980}
      height={470}
      preserveAspectRatio="xMidYMid meet"
      style={{ width:"100%", height:"100%", display:"block" }}
    >
      <ZoomableGroup>
        <Geographies geography={geoData}>
          {({ geographies }) => geographies.map(geo => {
            const name = geo.properties.name;
            const row = values.get(norm(name));
            const active = selected && row?.countryCode === selected.countryCode;
            return <Geography
              key={geo.rsmKey}
              geography={geo}
              onClick={() => row && onSelect(row)}
              style={{
                default: { fill: shade(row?.value, min, max), stroke: "transparent", outline: "none", cursor: row ? "pointer" : "default" },
                hover: { fill: row ? "#f0cf88" : "#34312c", stroke: "transparent", outline: "none" },
                pressed: { fill: "#f0cf88", stroke: "transparent", outline: "none" }
              }}
              fill={active ? "#f0cf88" : undefined}
            />;
          })}
        </Geographies>
      </ZoomableGroup>
    </ComposableMap>
    {selected && <div className="map-country-tab">
      <div><b>{selected.countryName}</b><span>{Number.isFinite(Number(selected.value)) ? Number(selected.value).toFixed(2) : "—"}% · {selected.year}</span></div>
      <button type="button" onClick={()=>onSelect(null)} aria-label="Close country details">×</button>
    </div>}
    <div className="map-overlay-note">WORLD ECONOMIC OVERVIEW · SELECT A SHADED COUNTRY</div>
  </div>;
}
