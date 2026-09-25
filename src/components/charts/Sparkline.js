"use strict";
import React from "react";

// Minimal inline-SVG trend line for a KPI card -- thin 2px stroke, rounded caps, no axes/
// gridlines/labels (the card's own delta text already says the direction and magnitude).
// `points` is an ordered array of numbers, with null/undefined for days with no snapshot yet
// (rendered as a gap in the line rather than dropping to zero).
export function Sparkline({ points, width = 108, height = 26, color }) {
  const known = points.filter((v) => v !== null && v !== undefined);
  if (known.length < 2) return null;
  const min = Math.min(...known);
  const max = Math.max(...known);
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  let d = "";
  let drawing = false;
  points.forEach((v, i) => {
    if (v === null || v === undefined) { drawing = false; return; }
    const x = i * step;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    d += (drawing ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    drawing = true;
  });
  return React.createElement("svg", { width, height, viewBox: `0 0 ${width} ${height}`, style: { display: "block", marginTop: 8 } },
    React.createElement("path", { d: d.trim(), fill: "none", stroke: color || "var(--success)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }));
}
