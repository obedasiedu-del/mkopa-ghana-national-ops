"use strict";
import React from "react";
import { LEDGER_TIERS, fmtNum } from "../../lib/domain.js";

// Horizontal bar per aging tier, colored to match the same Fresh/Aging/Aged status colors
// used everywhere else in the app (LedgerAgingBadge, DepotTable, etc.) -- green/amber/red,
// not a sequential ramp, so the chart reads consistently with the rest of the dashboard.
const TIER_COLOR = { "pill-success": "--success", "pill-warning": "--warning", "pill-critical": "--critical" };
export function AgingBarChart({ counts }) {
  const max = Math.max(1, ...LEDGER_TIERS.map((t) => counts[t.key] || 0));
  return React.createElement("div", { className: "aging-chart" },
    LEDGER_TIERS.map((t) => {
      const value = counts[t.key] || 0;
      const pct = Math.round((value / max) * 100);
      const colorVar = TIER_COLOR[t.cls] || "--text-faint";
      return React.createElement("div", { key: t.key, className: "aging-chart-row" },
        React.createElement("div", { className: "aging-chart-label" }, t.label),
        React.createElement("div", { className: "aging-chart-track" },
          React.createElement("div", { className: "aging-chart-bar", style: { width: pct + "%", background: `var(${colorVar})` } })),
        React.createElement("div", { className: "aging-chart-value mono" }, fmtNum(value)));
    }));
}
