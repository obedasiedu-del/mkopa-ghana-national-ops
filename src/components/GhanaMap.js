"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { REGION_ORDER, deviceTotals } from "../lib/domain.js";
import { depotsForScope, activeDepots } from "../lib/selectors.js";
import { GHANA_MAP_VIEWBOX, GHANA_REGION_PATHS, GHANA_LABEL_POINTS, GHANA_DEPOT_PINS } from "../data/ghana-map-data.js";

// Colors are a validated categorical palette (dataviz skill) chosen so every pair of regions
// that actually border each other on this map stays distinguishable.
const GHANA_MAP_COLORS = {
  "Northern": "#2a78d6",
  "Bono": "#eb6834",
  "Ashanti": "#1baf7a",
  "Oti-Volta": "#eda100",
  "Western": "#e87ba4",
  "Eastern": "#e34948",
  "Central": "#008300",
  "Accra West": "#0e948f",
  "Accra East": "#8a3a5c",
};
function shortDepotName(name) {
  return name.replace(/\s*Depot\s*$/i, "");
}
export function GhanaMap() {
  const { data, goRegion, goDepot } = useApp();
  const [hovered, setHovered] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [pointer, setPointer] = React.useState({ x: 0, y: 0 });
  const statsFor = React.useCallback((r) => {
    const depots = depotsForScope(data.depots, r);
    const active = activeDepots(depots);
    const filled = active.filter((d) => d.scStatus === "active");
    let deviceTotal = 0;
    depots.forEach((d) => { deviceTotal += deviceTotals(data.depotStock[d.code]).total; });
    return { depots: active.length, scFilled: filled.length, deviceTotal };
  }, [data]);
  const selectedDepots = selected ? depotsForScope(data.depots, selected) : [];
  const handleRegionClick = (r) => setSelected((s) => (s === r ? null : r));
  return React.createElement("div", { className: "ghana-map-wrap" },
    selected && React.createElement("div", { className: "ghana-map-banner" },
      React.createElement("div", null,
        React.createElement("strong", null, selected),
        React.createElement("span", { className: "ghana-map-banner-count" }, selectedDepots.length, " depot", selectedDepots.length === 1 ? "" : "s")),
      React.createElement("div", { className: "ghana-map-banner-actions" },
        React.createElement("button", { className: "btn-primary", onClick: () => goRegion(selected) }, "View full list →"),
        React.createElement("button", { className: "ghana-map-banner-close", onClick: () => setSelected(null) }, "✕"))),
    React.createElement("svg", { className: "ghana-map-svg", viewBox: GHANA_MAP_VIEWBOX, onMouseMove: (e) => setPointer({ x: e.clientX, y: e.clientY }) },
      REGION_ORDER.map((r) => React.createElement("g", { key: r, className: selected && selected !== r ? "ghana-dim" : "" },
        (GHANA_REGION_PATHS[r] || []).map((d, i) => React.createElement("path", {
          key: i, className: "ghana-tile" + (hovered === r ? " hovered" : "") + (selected === r ? " selected" : ""),
          style: { fill: GHANA_MAP_COLORS[r] }, d,
          onMouseEnter: () => setHovered(r), onMouseLeave: () => setHovered((h) => (h === r ? null : h)),
          onClick: () => handleRegionClick(r),
        })))),
      REGION_ORDER.map((r) => {
        const p = GHANA_LABEL_POINTS[r];
        if (!p || selected === r) return null;
        return React.createElement("text", {
          key: r, className: "ghana-map-label" + (selected && selected !== r ? " ghana-dim" : ""),
          x: p[0], y: p[1], textAnchor: "middle", dominantBaseline: "middle",
          onMouseEnter: () => setHovered(r), onMouseLeave: () => setHovered((h) => (h === r ? null : h)),
          onClick: () => handleRegionClick(r),
        }, r);
      }),
      selected && selectedDepots.map((d) => {
        const p = GHANA_DEPOT_PINS[d.code] || GHANA_LABEL_POINTS[selected];
        if (!p) return null;
        return React.createElement("g", { key: d.code, className: "ghana-pin", onClick: (e) => { e.stopPropagation(); goDepot(d.code); } },
          React.createElement("circle", { cx: p[0], cy: p[1], r: "4" }),
          React.createElement("text", { x: p[0] + 6, y: p[1], dominantBaseline: "middle" }, shortDepotName(d.name)));
      })),
    hovered && !selected && React.createElement("div", { className: "ghana-map-tooltip", style: { left: pointer.x + 14, top: pointer.y + 14 } }, (() => {
      const s = statsFor(hovered);
      return React.createElement(React.Fragment, null,
        React.createElement("div", { className: "ghana-map-tooltip-title" }, hovered),
        React.createElement("div", { className: "ghana-map-tooltip-row" }, React.createElement("span", null, "Depots"), React.createElement("span", null, s.depots)),
        React.createElement("div", { className: "ghana-map-tooltip-row" }, React.createElement("span", null, "SC filled"), React.createElement("span", null, s.scFilled, "/", s.depots)),
        React.createElement("div", { className: "ghana-map-tooltip-row" }, React.createElement("span", null, "Devices tracked"), React.createElement("span", null, s.deviceTotal)),
        React.createElement("div", { className: "ghana-map-tooltip-hint" }, "Click to see depots on the map →"));
    })()));
}
