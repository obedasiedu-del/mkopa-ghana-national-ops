"use strict";
import React from "react";
import { DataTable } from "./DataTable.js";
import { LEDGER_TIERS, LEDGER_TIER_COLOR_VAR, fmtNum, fmtDateShort, daysAllocated, agingDate, groupDevicesByTier } from "../lib/domain.js";

// Fresh/Aging/Aged tier breakdown -- click a tile to see its device list. Same interaction
// as the Depot page's own Stock Aging tab, but for a Region or National scope's devices
// (each tagged with depotCode/depotName by ledgerDevicesForScope), so a Depot column is
// shown when the device list spans more than one depot. When `heading` is passed (the
// National/Region page usages), the whole thing sits behind a collapsed-by-default toggle,
// same pattern as DailySubmissionOverview's "Daily Totals" -- it's one of the page's longer
// sections and most visits don't need it open. DepotPage's own usage (no heading) stays
// always-expanded since it's already behind its own "Devices with DSRs" tab click.
export function AgingBreakdown({ devices, showDepotColumn, tiers = LEDGER_TIERS, heading }) {
  const groups = React.useMemo(() => groupDevicesByTier(devices), [devices]);
  const [activeTier, setActiveTier] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const shown = activeTier ? groups[activeTier] : [];
  const columns = React.useMemo(() => {
    const cols = [
      { key: "serial", label: "Serial", sortable: true, render: (dv) => React.createElement("span", { className: "mono" }, dv.serial) },
    ];
    if (showDepotColumn) cols.push({ key: "depotName", label: "Depot", sortable: true, render: (dv) => dv.depotName || dv.depotCode || "—" });
    cols.push(
      { key: "model", label: "Product", sortable: true, render: (dv) => dv.model || "—" },
      { key: "dsrName", label: "DSR", sortable: true, render: (dv) => dv.dsrName || "—" },
      { key: "allocatedDate", label: "In Channel Since", sortable: true, sortValue: (dv) => agingDate(dv), render: (dv) => fmtDateShort(agingDate(dv)) },
      { key: "days", label: "Days", numeric: true, sortable: true, sortValue: (dv) => daysAllocated(agingDate(dv)), render: (dv) => daysAllocated(agingDate(dv)) },
    );
    return cols;
  }, [showDepotColumn]);
  const body = React.createElement(React.Fragment, null,
    React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
      tiers.map((t) => React.createElement("button", {
        key: t.key, className: "kpi-tile",
        style: { textAlign: "left", cursor: "pointer", outline: activeTier === t.key ? "2px solid var(--accent, #2a78d6)" : "none" },
        onClick: () => setActiveTier((a) => (a === t.key ? null : t.key)),
      },
        React.createElement("div", { className: "kpi-label" }, t.label),
        React.createElement("div", { className: "kpi-value", style: { color: `var(${LEDGER_TIER_COLOR_VAR[t.cls]})` } }, fmtNum(groups[t.key].length)),
        React.createElement("div", { className: "kpi-foot" }, t.min === undefined ? "0–" + t.max + " days" : t.max === undefined ? t.min + "+ days" : t.min + "–" + t.max + " days")))),
    activeTier && React.createElement(React.Fragment, null,
      React.createElement("div", { className: "drawer-section-title" }, tiers.find((t) => t.key === activeTier).label, " devices"),
      React.createElement(DataTable, {
        columns, rows: shown, rowKey: (dv) => dv.serial + "|" + (dv.depotCode || ""), defaultSortKey: "allocatedDate",
        emptyMessage: "No devices in this tier.",
      })),
    !activeTier && React.createElement("div", { style: { fontSize: 12.5, color: "var(--text-faint)" } }, "Click a tier above to see its devices."));
  if (!heading) return body;
  return React.createElement(React.Fragment, null,
    React.createElement("button", {
      className: "table-wrap",
      style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left", padding: "14px 16px", cursor: "pointer", marginTop: 22, marginBottom: open ? 16 : 0 },
      onClick: () => setOpen((o) => !o),
    },
      React.createElement("div", null,
        React.createElement("div", { className: "drawer-section-title", style: { marginBottom: 2 } }, heading),
        React.createElement("div", { style: { fontSize: 12, color: "var(--text-faint)" } }, fmtNum(devices.length), " devices")),
      React.createElement("span", { style: { fontSize: 12, color: "var(--text-muted)", flexShrink: 0, marginLeft: 12 } }, open ? "Hide ▲" : "Show ▼")),
    open && body);
}
