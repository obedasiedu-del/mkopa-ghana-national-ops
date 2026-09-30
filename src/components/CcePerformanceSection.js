"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { KpiTile } from "./ui.js";
import { DataTable } from "./DataTable.js";
import { fmtDateShort, fmtNum, todayStr, REGION_ORDER } from "../lib/domain.js";
import { isAdmin } from "../data/useAuth.js";

function firstOfMonth(dateStr) {
  return dateStr.slice(0, 8) + "01";
}

const NATIONAL_COLUMNS = [
  { key: "name", label: "Depot", sortable: true },
  { key: "region", label: "Region", sortable: true },
  { key: "cceName", label: "CCE", sortable: true, render: (r) => r.cceName || "—" },
  { key: "qualityPct", label: "Quality (avg)", numeric: true, sortable: true, sortValue: (r) => (r.qualityPct === null ? -1 : r.qualityPct), render: (r) => (r.qualityPct === null ? "—" : r.qualityPct + "%") },
  { key: "slaPct", label: "SLA (avg)", numeric: true, sortable: true, sortValue: (r) => (r.slaPct === null ? -1 : r.slaPct), render: (r) => (r.slaPct === null ? "—" : r.slaPct + "%") },
  { key: "footfall", label: "Footfall (sum)", numeric: true, sortable: true, sortValue: (r) => (r.footfall === null ? -1 : r.footfall), render: (r) => (r.footfall === null ? "—" : fmtNum(r.footfall)) },
  { key: "invAccPct", label: "Inventory Accuracy (avg)", numeric: true, sortable: true, sortValue: (r) => (r.invAccPct === null ? -1 : r.invAccPct), render: (r) => (r.invAccPct === null ? "—" : r.invAccPct + "%") },
  { key: "periodDate", label: "Latest in range", sortable: true, render: (r) => (r.periodDate ? fmtDateShort(r.periodDate) : "—") },
];
// Same columns minus "Region" -- redundant once the whole table is already confined to one.
const REGION_COLUMNS = NATIONAL_COLUMNS.filter((c) => c.key !== "region");

// CCE (Customer Care Executive) performance -- Quality and SLA Compliance are averaged over
// the selected range, Inventory Accuracy is averaged too (reusing the same depot-level
// inventory accuracy history everyone else uploads to -- it's a property of the depot's
// stock, not something a CCE reports separately), and Footfall is summed, not averaged.
// Defaults to month-to-date (the 1st of the current month through today) rather than the
// full history DirectAccuracySection defaults to, since "how's this CCE doing this month"
// is the question this section answers. `scope` is "national" or a region name, same as
// DirectAccuracySection.
export function CcePerformanceSection({ scope }) {
  const { data, auth, openModal, goRegion } = useApp();
  const userIsAdmin = isAdmin(auth.role);
  const isNational = scope === "national";
  const allDepots = React.useMemo(
    () => Object.values(data.depots).filter((d) => !d.isSynthetic && (isNational || d.region === scope)),
    [data.depots, scope, isNational]
  );
  const scopedCodes = React.useMemo(() => new Set(allDepots.map((d) => d.code)), [allDepots]);
  const cceHistory = React.useMemo(
    () => data.cceHistory.filter((r) => scopedCodes.has(r.depotCode)),
    [data.cceHistory, scopedCodes]
  );
  const invAccHistory = React.useMemo(
    () => data.inventoryAccuracyHistory.filter((r) => scopedCodes.has(r.depotCode)),
    [data.inventoryAccuracyHistory, scopedCodes]
  );

  const today = todayStr();
  const [fromDate, setFromDate] = React.useState(firstOfMonth(today));
  const [toDate, setToDate] = React.useState(today);
  const isMTD = fromDate === firstOfMonth(today) && toDate === today;

  const rangeCceRows = React.useMemo(
    () => cceHistory.filter((r) => r.periodDate >= fromDate && r.periodDate <= toDate),
    [cceHistory, fromDate, toDate]
  );
  const rangeInvAccRows = React.useMemo(
    () => invAccHistory.filter((r) => r.periodDate >= fromDate && r.periodDate <= toDate),
    [invAccHistory, fromDate, toDate]
  );

  const perDepot = React.useMemo(() => {
    const map = {};
    rangeCceRows.forEach((r) => {
      if (!map[r.depotCode]) map[r.depotCode] = { qualitySum: 0, qualityCount: 0, slaSum: 0, slaCount: 0, footfallSum: 0, footfallCount: 0, entries: 0, latestDate: null };
      const m = map[r.depotCode];
      m.entries++;
      if (r.qualityPct !== null) { m.qualitySum += r.qualityPct; m.qualityCount++; }
      if (r.slaPct !== null) { m.slaSum += r.slaPct; m.slaCount++; }
      if (r.footfall !== null) { m.footfallSum += r.footfall; m.footfallCount++; }
      if (!m.latestDate || r.periodDate > m.latestDate) m.latestDate = r.periodDate;
    });
    rangeInvAccRows.forEach((r) => {
      if (!map[r.depotCode]) map[r.depotCode] = { qualitySum: 0, qualityCount: 0, slaSum: 0, slaCount: 0, footfallSum: 0, footfallCount: 0, entries: 0, latestDate: null };
      const m = map[r.depotCode];
      if (!m.invAccSum) { m.invAccSum = 0; m.invAccCount = 0; }
      m.invAccSum += r.pct; m.invAccCount++;
      if (!m.latestDate || r.periodDate > m.latestDate) m.latestDate = r.periodDate;
    });
    return map;
  }, [rangeCceRows, rangeInvAccRows]);

  const depotRows = React.useMemo(() => allDepots.map((d) => {
    const agg = perDepot[d.code];
    return {
      code: d.code, name: d.name, region: d.region, cceName: d.cceName,
      qualityPct: agg && agg.qualityCount ? Math.round((agg.qualitySum / agg.qualityCount) * 10) / 10 : null,
      slaPct: agg && agg.slaCount ? Math.round((agg.slaSum / agg.slaCount) * 10) / 10 : null,
      footfall: agg && agg.footfallCount ? agg.footfallSum : null,
      invAccPct: agg && agg.invAccCount ? Math.round((agg.invAccSum / agg.invAccCount) * 10) / 10 : null,
      periodDate: agg ? agg.latestDate : null,
    };
  }), [allDepots, perDepot]);

  // "Reporting" means a CCE actually logged something (Quality/SLA/Footfall) -- Inventory
  // Accuracy is excluded from this count even though it's shown as a column/average here too,
  // since it's uploaded at the depot level (often by the Stock Controller) and would otherwise
  // make every depot with an inventory accuracy entry look like it has a reporting CCE.
  const reportingRows = depotRows.filter((r) => r.qualityPct !== null || r.slaPct !== null || r.footfall !== null);
  const avgOf = (key) => {
    const vals = reportingRows.map((r) => r[key]).filter((v) => v !== null);
    return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
  };
  const avgQuality = avgOf("qualityPct");
  const avgSla = avgOf("slaPct");
  const sumFootfall = depotRows.reduce((s, r) => s + (r.footfall || 0), 0);
  const avgInvAcc = avgOf("invAccPct");

  // Regional balance -- only meaningful at national scope, mirrors the Stock Controller
  // side's "Regions" grid but rolled up from this section's own CCE depot rows/date range.
  const regionRows = React.useMemo(() => {
    if (!isNational) return [];
    return REGION_ORDER.map((region) => {
      const rows = depotRows.filter((r) => r.region === region);
      const reporting = rows.filter((r) => r.qualityPct !== null || r.slaPct !== null || r.footfall !== null);
      const avg = (key) => {
        const vals = reporting.map((r) => r[key]).filter((v) => v !== null);
        return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
      };
      return {
        region,
        qualityPct: avg("qualityPct"),
        slaPct: avg("slaPct"),
        footfall: rows.reduce((s, r) => s + (r.footfall || 0), 0),
        depotCount: rows.length,
        reportingCount: reporting.length,
      };
    });
  }, [depotRows, isNational]);

  const [tableOpen, setTableOpen] = React.useState(false);

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "section-heading-row", style: { marginTop: 22 } },
      React.createElement("div", { className: "section-heading" }, "CCE Performance"),
      userIsAdmin && React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("bulkCcePerformance") }, "Upload CCE Performance (All Depots)")),
    React.createElement("div", { className: "kpi-datebar", style: { marginBottom: 14 } },
      React.createElement("span", { style: { fontSize: 12.5, color: "var(--text-muted)" } }, "From"),
      React.createElement("input", { type: "date", className: "field-input", style: { width: "auto" }, value: fromDate, max: toDate, onChange: (e) => setFromDate(e.target.value || firstOfMonth(today)) }),
      React.createElement("span", { style: { fontSize: 12.5, color: "var(--text-muted)" } }, "to"),
      React.createElement("input", { type: "date", className: "field-input", style: { width: "auto" }, value: toDate, min: fromDate, max: today, onChange: (e) => setToDate(e.target.value || today) }),
      !isMTD && React.createElement("button", { className: "btn btn-sm", onClick: () => { setFromDate(firstOfMonth(today)); setToDate(today); } }, "Reset to month-to-date"),
      React.createElement("div", { className: "kpi-datebar-summary" },
        isMTD ? "Month-to-date" : fmtDateShort(fromDate) + " – " + fmtDateShort(toDate))),
    React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
      React.createElement(KpiTile, { label: "Quality", value: avgQuality === null ? "—" : avgQuality + "%", foot: "average, " + (isMTD ? "month-to-date" : "selected range") }),
      React.createElement(KpiTile, { label: "SLA Compliance", value: avgSla === null ? "—" : avgSla + "%", foot: "average, " + (isMTD ? "month-to-date" : "selected range") }),
      React.createElement(KpiTile, { label: "Footfall", value: fmtNum(sumFootfall), foot: "sum total, " + (isMTD ? "month-to-date" : "selected range") }),
      React.createElement(KpiTile, { label: "Inventory Accuracy", value: avgInvAcc === null ? "—" : avgInvAcc + "%", foot: "average, " + (isMTD ? "month-to-date" : "selected range") })),
    isNational && React.createElement(React.Fragment, null,
      React.createElement("div", { className: "drawer-section-title", style: { marginBottom: 10 } }, "Regional Balance"),
      React.createElement("div", { className: "territory-grid", style: { marginBottom: 16 } }, regionRows.map((r) => (
        React.createElement("button", { key: r.region, className: "territory-card", onClick: () => goRegion(r.region, "cce") },
          React.createElement("div", { className: "territory-name" }, r.region, React.createElement("span", { className: "arrow" }, "→")),
          React.createElement("div", { className: "territory-stats" },
            React.createElement("div", null, React.createElement("div", { className: "territory-stat-num" }, r.qualityPct === null ? "—" : r.qualityPct + "%"), React.createElement("div", { className: "territory-stat-label" }, "Quality")),
            React.createElement("div", null, React.createElement("div", { className: "territory-stat-num" }, r.slaPct === null ? "—" : r.slaPct + "%"), React.createElement("div", { className: "territory-stat-label" }, "SLA")),
            React.createElement("div", null, React.createElement("div", { className: "territory-stat-num" }, fmtNum(r.footfall)), React.createElement("div", { className: "territory-stat-label" }, "Footfall"))),
          React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-faint)", marginTop: 10 } }, r.reportingCount, "/", r.depotCount, " depots reporting")))))),
    React.createElement("button", {
      className: "table-wrap",
      style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left", padding: "14px 16px", cursor: "pointer", marginBottom: tableOpen ? 16 : 0 },
      onClick: () => setTableOpen((o) => !o),
    },
      React.createElement("div", null,
        React.createElement("div", { className: "drawer-section-title", style: { marginBottom: 2 } }, "Depot Breakdown"),
        React.createElement("div", { style: { fontSize: 12, color: "var(--text-faint)" } },
          allDepots.length, " depot", allDepots.length === 1 ? "" : "s", " · ", reportingRows.length, " reporting in range")),
      React.createElement("span", { style: { fontSize: 12, color: "var(--text-muted)", flexShrink: 0, marginLeft: 12 } }, tableOpen ? "Hide ▲" : "Show ▼")),
    tableOpen && React.createElement(DataTable, {
      columns: isNational ? NATIONAL_COLUMNS : REGION_COLUMNS, rows: depotRows, rowKey: (r) => r.code, defaultSortKey: "qualityPct", defaultSortDir: "asc",
      emptyMessage: "No depots on file yet.",
    }));
}
