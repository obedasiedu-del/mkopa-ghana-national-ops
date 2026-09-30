"use strict";
import React from "react";
import { fmtDateShort } from "../../lib/domain.js";

function fmtSparkValue(v, isPct) {
  if (v === null || v === undefined) return "—";
  const rounded = Math.round(v * 10) / 10;
  return isPct ? rounded + "%" : String(Math.round(v));
}

// Readable trend chart for a KPI card -- a real line chart, not a bare squiggle: labeled
// start/end values and dates so the direction and magnitude are legible on sight (including
// in a screenshot, with nobody needing to hover), plus a hover crosshair that swaps the end
// label to whichever point the pointer is over. `points`/`dates` are parallel ordered arrays;
// a point of null/undefined (a day with no snapshot yet) renders as a gap in the line.
export function Sparkline({ points, dates, width = 160, height = 40, color, isPct }) {
  const svgRef = React.useRef(null);
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const known = points.map((v, i) => (v === null || v === undefined ? null : i)).filter((i) => i !== null);
  if (known.length < 2) return null;
  const min = Math.min(...known.map((i) => points[i]));
  const max = Math.max(...known.map((i) => points[i]));
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const xAt = (i) => i * step;
  const yAt = (v) => height - 3 - ((v - min) / range) * (height - 6);

  let line = "";
  let area = "";
  let drawing = false;
  points.forEach((v, i) => {
    if (v === null || v === undefined) { drawing = false; return; }
    const x = xAt(i), y = yAt(v);
    line += (drawing ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    area += (drawing ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    drawing = true;
  });
  const firstIdx = known[0], lastIdx = known[known.length - 1];
  area += "L" + xAt(lastIdx).toFixed(1) + "," + height + " L" + xAt(firstIdx).toFixed(1) + "," + height + " Z";

  const activeIdx = hoverIdx !== null && points[hoverIdx] !== null && points[hoverIdx] !== undefined ? hoverIdx : lastIdx;
  const startLabel = { i: firstIdx, v: points[firstIdx] };
  const endLabel = { i: activeIdx, v: points[activeIdx] };

  function onMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    let idx = Math.round(frac * (points.length - 1));
    // snap to the nearest day that actually has data
    let best = null, bestDist = Infinity;
    known.forEach((i) => { const d = Math.abs(i - idx); if (d < bestDist) { bestDist = d; best = i; } });
    setHoverIdx(best);
  }

  const col = color || "var(--success)";
  return React.createElement("div", { style: { marginTop: 10 } },
    React.createElement("svg", {
      ref: svgRef, width: "100%", height, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none",
      style: { display: "block", cursor: "crosshair", overflow: "visible" },
      onMouseMove: onMove, onMouseLeave: () => setHoverIdx(null),
    },
      React.createElement("line", { x1: 0, y1: height - 0.5, x2: width, y2: height - 0.5, stroke: "var(--border)", strokeWidth: 1 }),
      React.createElement("path", { d: area.trim(), fill: col, fillOpacity: 0.12, stroke: "none" }),
      React.createElement("path", { d: line.trim(), fill: "none", stroke: col, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }),
      hoverIdx !== null && React.createElement("line", { x1: xAt(activeIdx), y1: 0, x2: xAt(activeIdx), y2: height, stroke: "var(--text-faint)", strokeWidth: 1, strokeDasharray: "2,2" }),
      React.createElement("circle", { cx: xAt(activeIdx), cy: yAt(points[activeIdx]), r: 3, fill: col })),
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 3 } },
      React.createElement("span", { style: { fontSize: 11, fontWeight: 500, color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" } }, fmtSparkValue(startLabel.v, isPct)),
      React.createElement("span", { style: { fontSize: 11, fontWeight: 600, color: col, fontFamily: "'IBM Plex Mono', monospace" } }, fmtSparkValue(endLabel.v, isPct))),
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 1 } },
      React.createElement("span", { style: { fontSize: 10, color: "var(--text-faint)" } }, fmtDateShort(dates ? dates[startLabel.i] : null)),
      React.createElement("span", { style: { fontSize: 10, color: "var(--text-faint)" } }, fmtDateShort(dates ? dates[endLabel.i] : null))));
}
