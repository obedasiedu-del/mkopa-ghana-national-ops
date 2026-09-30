"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { KpiTile } from "./ui.js";
import { DataTable } from "./DataTable.js";
import { fmtDateShort } from "../lib/domain.js";
import { isAdmin } from "../data/useAuth.js";

const NATIONAL_COLUMNS = [
  { key: "name", label: "Depot", sortable: true },
  { key: "region", label: "Region", sortable: true },
  { key: "pct", label: "Accuracy (range avg)", numeric: true, sortable: true, sortValue: (r) => (r.pct === null ? -1 : r.pct), render: (r) => (r.pct === null ? "—" : r.pct + "%") },
  { key: "entries", label: "Entries", numeric: true, sortable: true },
  { key: "periodDate", label: "Latest in range", sortable: true, render: (r) => (r.periodDate ? fmtDateShort(r.periodDate) : "—") },
];
// Same columns minus "Region" -- redundant once the whole table is already confined to one.
const REGION_COLUMNS = NATIONAL_COLUMNS.filter((c) => c.key !== "region");

// Direct Stock Accuracy -- the full weekly history (not just each depot's latest) is kept in
// memory so a from/to range picker can show the average over a chosen period instead of always
// just the single latest week. `scope` is "national" (all depots) or a region name (only that
// region's depots) -- used on both the National Overview and each Region page.
export function DirectAccuracySection({ scope }) {
  const { data, auth, openModal } = useApp();
  const userIsAdmin = isAdmin(auth.role);
  const isNational = scope === "national";
  const allDepots = React.useMemo(
    () => Object.values(data.depots).filter((d) => !d.isSynthetic && (isNational || d.region === scope)),
    [data.depots, scope, isNational]
  );
  const scopedCodes = React.useMemo(() => new Set(allDepots.map((d) => d.code)), [allDepots]);
  const history = React.useMemo(
    () => data.inventoryAccuracyHistory.filter((r) => scopedCodes.has(r.depotCode)),
    [data.inventoryAccuracyHistory, scopedCodes]
  );
  const sortedDates = React.useMemo(() => history.map((r) => r.periodDate).sort(), [history]);
  const minDate = sortedDates[0] || null;
  const maxDate = sortedDates[sortedDates.length - 1] || null;
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [tableOpen, setTableOpen] = React.useState(false);
  const effFrom = fromDate || minDate;
  const effTo = toDate || maxDate;
  const isCustomRange = !!(fromDate || toDate);

  const rangeRows = React.useMemo(() => {
    if (!effFrom || !effTo) return [];
    return history.filter((r) => r.periodDate >= effFrom && r.periodDate <= effTo);
  }, [history, effFrom, effTo]);
  const perDepot = React.useMemo(() => {
    const map = {};
    rangeRows.forEach((r) => {
      if (!map[r.depotCode]) map[r.depotCode] = { sum: 0, count: 0, latestDate: null };
      const m = map[r.depotCode];
      m.sum += r.pct; m.count++;
      if (!m.latestDate || r.periodDate > m.latestDate) m.latestDate = r.periodDate;
    });
    return map;
  }, [rangeRows]);
  const rangeAvg = rangeRows.length ? Math.round((rangeRows.reduce((s, r) => s + r.pct, 0) / rangeRows.length) * 10) / 10 : null;
  const depotsInRange = Object.keys(perDepot).length;
  const depotRows = React.useMemo(() => allDepots.map((d) => {
    const agg = perDepot[d.code];
    return {
      code: d.code, name: d.name, region: d.region,
      pct: agg ? Math.round((agg.sum / agg.count) * 10) / 10 : null,
      periodDate: agg ? agg.latestDate : null,
      entries: agg ? agg.count : 0,
    };
  }), [allDepots, perDepot]);

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "section-heading-row", style: { marginTop: 22 } },
      React.createElement("div", { className: "section-heading" }, "Direct Stock Accuracy"),
      userIsAdmin && React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("bulkInventoryAccuracy") }, "Upload Inventory Accuracy (All Depots)")),
    !minDate && React.createElement("div", { className: "banner", style: { marginBottom: 14 } },
      React.createElement("span", null, "⚠"),
      React.createElement("div", null, "No Direct Stock Accuracy entries on file yet.")),
    minDate && React.createElement("div", { className: "kpi-datebar", style: { marginBottom: 14 } },
      React.createElement("span", { style: { fontSize: 12.5, color: "var(--text-muted)" } }, "From"),
      React.createElement("input", { type: "date", className: "field-input", style: { width: "auto" }, value: effFrom || "", min: minDate, max: effTo || maxDate, onChange: (e) => setFromDate(e.target.value) }),
      React.createElement("span", { style: { fontSize: 12.5, color: "var(--text-muted)" } }, "to"),
      React.createElement("input", { type: "date", className: "field-input", style: { width: "auto" }, value: effTo || "", min: effFrom || minDate, max: maxDate, onChange: (e) => setToDate(e.target.value) }),
      isCustomRange && React.createElement("button", { className: "btn btn-sm", onClick: () => { setFromDate(""); setToDate(""); } }, "Reset to all data"),
      React.createElement("div", { className: "kpi-datebar-summary" },
        rangeRows.length ? rangeRows.length + " entr" + (rangeRows.length === 1 ? "y" : "ies") + " · " + depotsInRange + " depot" + (depotsInRange === 1 ? "" : "s") + " in range" : "No entries in this range")),
    React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
      React.createElement(KpiTile, { label: "Direct Stock Accuracy", value: rangeAvg === null ? "—" : rangeAvg + "%", foot: effFrom && effTo ? fmtDateShort(effFrom) + " – " + fmtDateShort(effTo) : "no entries yet" }),
      React.createElement(KpiTile, { label: "Depots Reporting", value: depotsInRange + "/" + allDepots.length, foot: "in selected range" })),
    React.createElement("button", {
      className: "table-wrap",
      style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left", padding: "14px 16px", cursor: "pointer", marginBottom: tableOpen ? 16 : 0 },
      onClick: () => setTableOpen((o) => !o),
    },
      React.createElement("div", null,
        React.createElement("div", { className: "drawer-section-title", style: { marginBottom: 2 } }, "Depot Breakdown"),
        React.createElement("div", { style: { fontSize: 12, color: "var(--text-faint)" } },
          allDepots.length, " depot", allDepots.length === 1 ? "" : "s", " · ", depotsInRange, " reporting in range")),
      React.createElement("span", { style: { fontSize: 12, color: "var(--text-muted)", flexShrink: 0, marginLeft: 12 } }, tableOpen ? "Hide ▲" : "Show ▼")),
    tableOpen && React.createElement(DataTable, {
      columns: isNational ? NATIONAL_COLUMNS : REGION_COLUMNS, rows: depotRows, rowKey: (r) => r.code, defaultSortKey: "pct", defaultSortDir: "asc",
      emptyMessage: "No depots on file yet.",
    }));
}
