"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { DataTable } from "./DataTable.js";
import { KpiTile, Pill } from "./ui.js";
import { SUBMISSION_MODELS, fmtNum, fmtDateShort, priorityLabel } from "../lib/domain.js";
import { submissionLatestStatsForScope, submissionDailyTotalsForScope } from "../lib/selectors.js";

const DAILY_TOTALS_DAYS = 14;

// "Daily Submission" = depot-held stock the Stock Controller reports each day, by model --
// what's still sitting at the depot and hasn't been handed to a DSR yet (that's the device
// ledger's "Devices with DSRs", a separate figure). Region/National roll-up of the same
// numbers a Stock Controller enters per depot, matching the standalone Central Region
// tracker's Daily Totals / By-model / Depot Performance layout.
export function DailySubmissionOverview({ scope }) {
  const { data, goDepot } = useApp();
  const latest = React.useMemo(() => submissionLatestStatsForScope(data, scope), [data, scope]);
  const dailyTotals = React.useMemo(() => submissionDailyTotalsForScope(data, scope, DAILY_TOTALS_DAYS), [data, scope]);

  const perfColumns = [
    {
      key: "depot", label: "Depot", sortable: true, sortValue: (r) => r.depot.name,
      render: (r) => React.createElement("div", null,
        React.createElement("div", null, r.depot.name),
        React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--text-faint)" } }, r.depot.code)),
    },
    { key: "scName", label: "Team Member", sortable: true, sortValue: (r) => r.depot.scName || "", render: (r) => r.depot.scName || "—" },
    { key: "total", label: "Total Stock", numeric: true, sortable: true, sortValue: (r) => (r.totals ? r.totals.totalStock : -1), render: (r) => (r.totals ? fmtNum(r.totals.totalStock) : "—") },
    { key: "aged", label: "Aged", numeric: true, sortable: true, sortValue: (r) => (r.totals ? r.totals.agedStock : -1), render: (r) => (r.totals ? fmtNum(r.totals.agedStock) : "—") },
    { key: "pctAged", label: "Aged %", numeric: true, sortable: true, sortValue: (r) => (r.pctAged === null ? -1 : r.pctAged), render: (r) => (r.pctAged === null ? "—" : r.pctAged + "%") },
    {
      key: "priority", label: "Priority",
      render: (r) => r.pctAged === null
        ? React.createElement(Pill, { cls: "pill-muted" }, "NO ENTRY YET")
        : React.createElement(Pill, { cls: priorityLabel(r.pctAged) === "HIGH AGING" ? "pill-critical" : "pill-success" }, priorityLabel(r.pctAged)),
    },
    { key: "lastSubmitted", label: "Last Submitted", sortable: true, sortValue: (r) => (r.latest ? r.latest.date : ""), render: (r) => (r.latest ? fmtDateShort(r.latest.date) : "—") },
  ];

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
      React.createElement(KpiTile, { label: "Total Stock (latest)", value: fmtNum(latest.total), foot: "at depots, not yet with DSRs" }),
      React.createElement(KpiTile, { label: "Aged Stock (within total)", value: fmtNum(latest.aged), foot: latest.pctAged === null ? "—" : latest.pctAged + "% of total" }),
      React.createElement(KpiTile, { label: "Depots Reported", value: latest.depotsReported + "/" + latest.totalDepots, foot: "latest submission on file" })),
    React.createElement("div", { className: "drawer-section-title" }, "By model (latest, scope-wide)"),
    React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
      SUBMISSION_MODELS.map((m) => React.createElement("div", { key: m, className: "kpi-tile" },
        React.createElement("div", { className: "kpi-label" }, m),
        React.createElement("div", { className: "kpi-value" }, fmtNum(latest.bySku[m].total)),
        React.createElement("div", { className: "kpi-foot" }, fmtNum(latest.bySku[m].aged), " aged")))),
    React.createElement("div", { className: "section-heading" }, "Daily Totals"),
    dailyTotals.length === 0
      ? React.createElement("div", { className: "table-wrap", style: { marginBottom: 16 } }, React.createElement("div", { style: { padding: 20, color: "var(--text-faint)", fontSize: 12.5 } }, "No daily submissions on file for this scope yet."))
      : React.createElement("div", { className: "table-wrap table-wrap-scroll", style: { marginBottom: 16 } },
        React.createElement("table", null,
          React.createElement("thead", null, React.createElement("tr", null,
            React.createElement("th", null, "Date"), React.createElement("th", { className: "num" }, "Depots Reporting"),
            SUBMISSION_MODELS.map((m) => React.createElement("th", { key: m, className: "num" }, m)),
            React.createElement("th", { className: "num" }, "Total"), React.createElement("th", { className: "num" }, "Aged"), React.createElement("th", { className: "num" }, "% Aged"))),
          React.createElement("tbody", null, dailyTotals.map((row) => React.createElement("tr", { key: row.date },
            React.createElement("td", null, fmtDateShort(row.date)),
            React.createElement("td", { className: "num" }, row.depotsReporting + "/" + row.totalDepots),
            SUBMISSION_MODELS.map((m) => React.createElement("td", { key: m, className: "num" }, fmtNum(row.models[m] ? row.models[m].total : 0))),
            React.createElement("td", { className: "num", style: { fontWeight: 600 } }, fmtNum(row.total)),
            React.createElement("td", { className: "num" }, fmtNum(row.aged)),
            React.createElement("td", { className: "num" }, row.pctAged + "%")))))),
    React.createElement("div", { className: "section-heading" }, "Depot Performance"),
    React.createElement(DataTable, {
      columns: perfColumns, rows: latest.perDepot, rowKey: (r) => r.depot.code,
      onRowClick: (r) => { window.location.hash = "#/depot/" + encodeURIComponent(r.depot.code) + "/submission"; },
      defaultSortKey: "pctAged", defaultSortDir: "desc",
      emptyMessage: "No depots in this scope.",
    }));
}
