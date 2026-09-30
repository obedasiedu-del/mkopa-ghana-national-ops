"use strict";
import React from "react";
import { DataTable } from "./DataTable.js";
import { LEDGER_TIERS, LEDGER_TIER_COLOR_VAR, fmtNum, fmtDateShort, daysAllocated, agingDate, groupDevicesByTier } from "../lib/domain.js";

// Fresh/Aging/Aged tier breakdown -- click a tile to see its device list. Same interaction
// as the Depot page's own Stock Aging tab, but for a Region or National scope's devices
// (each tagged with depotCode/depotName by ledgerDevicesForScope), so a Depot column is
// shown when the device list spans more than one depot.
export function AgingBreakdown({ devices, showDepotColumn }) {
  const groups = React.useMemo(() => groupDevicesByTier(devices), [devices]);
  const [activeTier, setActiveTier] = React.useState(null);
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
  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
      LEDGER_TIERS.map((t) => React.createElement("button", {
        key: t.key, className: "kpi-tile",
        style: { textAlign: "left", cursor: "pointer", outline: activeTier === t.key ? "2px solid var(--accent, #2a78d6)" : "none" },
        onClick: () => setActiveTier((a) => (a === t.key ? null : t.key)),
      },
        React.createElement("div", { className: "kpi-label" }, t.label),
        React.createElement("div", { className: "kpi-value", style: { color: `var(${LEDGER_TIER_COLOR_VAR[t.cls]})` } }, fmtNum(groups[t.key].length)),
        React.createElement("div", { className: "kpi-foot" }, t.min === undefined ? "0–" + t.max + " days" : t.max === undefined ? t.min + "+ days" : t.min + "–" + t.max + " days")))),
    activeTier && React.createElement(React.Fragment, null,
      React.createElement("div", { className: "drawer-section-title" }, LEDGER_TIERS.find((t) => t.key === activeTier).label, " devices"),
      React.createElement(DataTable, {
        columns, rows: shown, rowKey: (dv) => dv.serial + "|" + (dv.depotCode || ""), defaultSortKey: "allocatedDate",
        emptyMessage: "No devices in this tier.",
      })),
    !activeTier && React.createElement("div", { style: { fontSize: 12.5, color: "var(--text-faint)" } }, "Click a tier above to see its devices."));
}
