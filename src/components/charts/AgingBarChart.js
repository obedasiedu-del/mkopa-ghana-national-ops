"use strict";
import React from "react";
import { LEDGER_TIERS, fmtNum } from "../../lib/domain.js";

// Horizontal bar per aging tier. Fresh -> High Risk is an ORDERED severity scale, not a
// set of independent categories, so it gets a single-hue sequential ramp (light->dark)
// rather than the app's categorical status colors -- validated as an ordinal ramp with
// the dataviz skill's checks (monotone lightness, >=0.06 adjacent step gaps, light end
// clears 2:1 contrast in both light and dark mode). Each bar is directly labeled by its
// row, so no legend is needed.
const TIER_RAMP = ["--aging-1", "--aging-2", "--aging-3", "--aging-4", "--aging-5"];
export function AgingBarChart({ counts }) {
  const max = Math.max(1, ...LEDGER_TIERS.map((t) => counts[t.key] || 0));
  return React.createElement("div", { className: "aging-chart" },
    LEDGER_TIERS.map((t, i) => {
      const value = counts[t.key] || 0;
      const pct = Math.round((value / max) * 100);
      return React.createElement("div", { key: t.key, className: "aging-chart-row" },
        React.createElement("div", { className: "aging-chart-label" }, t.label),
        React.createElement("div", { className: "aging-chart-track" },
          React.createElement("div", { className: "aging-chart-bar", style: { width: pct + "%", background: `var(${TIER_RAMP[i]})` } })),
        React.createElement("div", { className: "aging-chart-value mono" }, fmtNum(value)));
    }));
}
