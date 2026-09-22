"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Pill, Breadcrumb } from "../components/ui.js";
import { DataTable } from "../components/DataTable.js";
import { REGION_ORDER, fmtNum } from "../lib/domain.js";
import { haltStatusesForScope } from "../lib/selectors.js";
import { activeHaltPhase } from "../lib/haltPolicy.js";

export function HaltReportPage() {
  const { data, route, goNational, goRegion } = useApp();
  const [region, setRegion] = React.useState(route.region);

  const phase = activeHaltPhase();
  const rows = React.useMemo(() => haltStatusesForScope(data, region || "national"), [data, region]);
  const halted = rows.filter((r) => r.halted);

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

  return React.createElement("div", { className: "content" },
    React.createElement(Breadcrumb, { items: breadcrumbItems }),
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 4 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, "Allocation Halt Status", region ? " — " + region : " — National"),
        React.createElement("div", { className: "scope-sub" },
          phase ? phase.label + " active since " + phase.startDate + " — " + halted.length + " of " + rows.length + " depots halted" : "The halt-of-allocation policy has not started yet."))),
    React.createElement("div", { className: "filter-bar", style: { marginTop: 14 } },
      React.createElement("select", { className: "field-input filter-input", value: region || "", onChange: (e) => setRegion(e.target.value || null) },
        React.createElement("option", { value: "" }, "All regions"),
        REGION_ORDER.map((r) => React.createElement("option", { key: r, value: r }, r))),
      region && React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => setRegion(null) }, "Clear filter")),
    !phase
      ? React.createElement("div", { style: { padding: 20, color: "var(--text-faint)" } }, "No halt phase is active yet — Phase 1 starts 17/09/2026.")
      : React.createElement("div", { style: { marginTop: 14 } },
        React.createElement(DataTable, {
          columns, rows, rowKey: (r) => r.depot.code, defaultSortKey: "halted", defaultSortDir: "desc",
          emptyMessage: "No active depots in scope.",
        })));
}
