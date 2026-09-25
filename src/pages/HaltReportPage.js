"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Pill, Breadcrumb } from "../components/ui.js";
import { DataTable } from "../components/DataTable.js";
import { REGION_ORDER, fmtNum, agedSkuBreakdown } from "../lib/domain.js";
import { haltStatusesForScope, ledgerDevices } from "../lib/selectors.js";
import { activeHaltPhase } from "../lib/haltPolicy.js";

export function HaltReportPage() {
  const { data, route, goNational, goRegion } = useApp();
  const [region, setRegion] = React.useState(route.region);
  const [selectedDepotCode, setSelectedDepotCode] = React.useState(null);

  const phase = activeHaltPhase();
  const rows = React.useMemo(() => haltStatusesForScope(data, region || "national"), [data, region]);
  const halted = rows.filter((r) => r.halted);
  const selectedRow = selectedDepotCode ? rows.find((r) => r.depot.code === selectedDepotCode) : null;
  const skuBreakdown = React.useMemo(
    () => (selectedDepotCode ? agedSkuBreakdown(ledgerDevices(data.deviceLedger, selectedDepotCode)) : []),
    [data.deviceLedger, selectedDepotCode]
  );

  const columns = React.useMemo(() => [
    {
      key: "depot", label: "Depot", sortable: true, sortValue: (r) => r.depot.name,
      render: (r) => r.depot.status === "closed" ? [r.depot.name, " ", React.createElement(Pill, { key: "closed", cls: "pill-muted" }, "Closed")] : r.depot.name,
    },
    { key: "region", label: "Region", sortable: true, sortValue: (r) => r.depot.region, render: (r) => r.depot.region },
    { key: "allocated", label: "Devices with DSRs", numeric: true, sortable: true, render: (r) => fmtNum(r.allocated) },
    { key: "agedCount", label: "Aged (14d+)", numeric: true, sortable: true, render: (r) => fmtNum(r.agedCount) },
    { key: "limit", label: "Phase Limit", numeric: true, sortable: true, render: (r) => fmtNum(r.limit) },
    {
      key: "halted", label: "Status", sortable: true, sortValue: (r) => (r.halted ? 1 : 0),
      render: (r) => React.createElement(Pill, { cls: r.halted ? "pill-severe" : "pill-success" }, r.halted ? "Allocation Halted" : "OK"),
    },
  ], []);

  const breadcrumbItems = region
    ? [{ label: "National", onClick: goNational }, { label: region, onClick: () => goRegion(region) }, { label: "Halt Status" }]
    : [{ label: "National", onClick: goNational }, { label: "Halt Status" }];

  let skuPanel = null;
  if (selectedRow) {
    const header = React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
      React.createElement("div", { className: "drawer-section-title", style: { margin: 0 } },
        "Aged Stock by Product — ", selectedRow.depot.name, " (", fmtNum(selectedRow.agedCount), " devices, 14d+)"),
      React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => setSelectedDepotCode(null) }, "Close"));
    const body = skuBreakdown.length === 0
      ? React.createElement("div", { style: { color: "var(--text-faint)", fontSize: 12.5 } }, "No aged devices at this depot.")
      : React.createElement("table", null,
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", null, "Product / SKU"),
              React.createElement("th", null, "Aged Devices (14d+)"))),
          React.createElement("tbody", null,
            skuBreakdown.map((row) => React.createElement("tr", { key: row.model },
              React.createElement("td", null, row.model),
              React.createElement("td", null, fmtNum(row.count))))));
    skuPanel = React.createElement("div", { style: { marginTop: 14, border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px" } }, header, body);
  }

  return React.createElement("div", { className: "content" },
    React.createElement(Breadcrumb, { items: breadcrumbItems }),
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 4 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, "Allocation Halt Status", region ? " — " + region : " — National"),
        React.createElement("div", { className: "scope-sub" },
          phase ? phase.label + " active since " + phase.startDate + " — " + halted.length + " of " + rows.length + " depots halted" : "The halt-of-allocation policy has not started yet."))),
    React.createElement("div", { className: "filter-bar", style: { marginTop: 14 } },
      React.createElement("select", { className: "field-input filter-input", value: region || "", onChange: (e) => { setRegion(e.target.value || null); setSelectedDepotCode(null); } },
        React.createElement("option", { value: "" }, "All regions"),
        REGION_ORDER.map((r) => React.createElement("option", { key: r, value: r }, r))),
      region && React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => { setRegion(null); setSelectedDepotCode(null); } }, "Clear filter")),
    !phase
      ? React.createElement("div", { style: { padding: 20, color: "var(--text-faint)" } }, "No halt phase is active yet — Phase 1 starts 17/09/2026.")
      : React.createElement("div", { style: { marginTop: 14 } },
        React.createElement(DataTable, {
          columns, rows, rowKey: (r) => r.depot.code, defaultSortKey: "halted", defaultSortDir: "desc",
          emptyMessage: "No active depots in scope.",
          onRowClick: (r) => setSelectedDepotCode(r.depot.code === selectedDepotCode ? null : r.depot.code),
        }),
        skuPanel));
}
