"use strict";
import React from "react";
import { fmtDateShort, fmtNum } from "../../lib/domain.js";

const W = 640, H = 140, PAD = 8;

// Single-series line chart (movements per day) -- one hue (var(--accent)), no legend
// needed since the title names the one series. 2px line, ~10% opacity area wash,
// hairline baseline gridline, an end-marker with a surface ring, and a hover
// crosshair + tooltip (reuses the ghana-map-tooltip visual pattern already in this app).
export function MovementTrendChart({ points }) {
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const [pointer, setPointer] = React.useState({ x: 0, y: 0 });
  if (!points || points.length === 0) {
    return React.createElement("div", { style: { padding: 20, color: "var(--text-faint)", fontSize: 12.5 } }, "No movement data in this range yet.");
  }
  const max = Math.max(1, ...points.map((p) => p.count));
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  function xAt(i) { return PAD + i * stepX; }
  function yAt(v) { return H - PAD - (v / max) * (H - PAD * 2); }
  const linePath = points.map((p, i) => (i === 0 ? "M" : "L") + xAt(i).toFixed(1) + "," + yAt(p.count).toFixed(1)).join(" ");
  const areaPath = linePath + ` L${xAt(points.length - 1).toFixed(1)},${H - PAD} L${xAt(0).toFixed(1)},${H - PAD} Z`;
  const last = points[points.length - 1];

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let idx = Math.round((relX - PAD) / (stepX || 1));
    idx = Math.max(0, Math.min(points.length - 1, idx));
    setHoverIdx(idx);
    setPointer({ x: e.clientX, y: e.clientY });
  }

  return React.createElement("div", { className: "trend-chart-wrap" },
    React.createElement("svg", {
      className: "trend-chart-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none",
      onMouseMove: onMove, onMouseLeave: () => setHoverIdx(null),
    },
      React.createElement("line", { x1: PAD, y1: H - PAD, x2: W - PAD, y2: H - PAD, className: "trend-chart-gridline" }),
      React.createElement("path", { d: areaPath, className: "trend-chart-area" }),
      React.createElement("path", { d: linePath, className: "trend-chart-line" }),
      React.createElement("circle", { cx: xAt(points.length - 1), cy: yAt(last.count), r: 4, className: "trend-chart-enddot" }),
      hoverIdx !== null && React.createElement(React.Fragment, null,
        React.createElement("line", { x1: xAt(hoverIdx), y1: PAD, x2: xAt(hoverIdx), y2: H - PAD, className: "trend-chart-crosshair" }),
        React.createElement("circle", { cx: xAt(hoverIdx), cy: yAt(points[hoverIdx].count), r: 4, className: "trend-chart-enddot" }))),
    React.createElement("div", { className: "trend-chart-endlabel" }, fmtNum(last.count), " on ", fmtDateShort(last.date)),
    hoverIdx !== null && React.createElement("div", { className: "ghana-map-tooltip", style: { left: pointer.x + 14, top: pointer.y + 14 } },
      React.createElement("div", { className: "ghana-map-tooltip-title" }, fmtDateShort(points[hoverIdx].date)),
      React.createElement("div", { className: "ghana-map-tooltip-row" }, React.createElement("span", null, "Movements"), React.createElement("span", null, fmtNum(points[hoverIdx].count)))));
}
