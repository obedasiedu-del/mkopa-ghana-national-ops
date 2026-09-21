"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { GhanaMap } from "../components/GhanaMap.js";
import { KpiTile, EmptyRow } from "../components/ui.js";
import { REGION_ORDER, fmtNum, groupDevicesByAgent, countsForDevices } from "../lib/domain.js";
import { overviewStats, ledgerDevicesForScope } from "../lib/selectors.js";
import { isAdmin } from "../data/useAuth.js";

function RegionCard({ region }) {
  const { data, goRegion } = useApp();
  const stats = overviewStats(data, region);
  const pct = stats.activeDepots ? Math.round((stats.scFilled / stats.activeDepots) * 100) : 0;
  return React.createElement("button", { className: "territory-card", onClick: () => goRegion(region) },
    React.createElement("div", { className: "territory-name" }, region, React.createElement("span", { className: "arrow" }, "→")),
    React.createElement("div", { className: "territory-stats" },
      React.createElement("div", null, React.createElement("div", { className: "territory-stat-num" }, stats.activeDepots), React.createElement("div", { className: "territory-stat-label" }, "Depots")),
      React.createElement("div", null, React.createElement("div", { className: "territory-stat-num" }, stats.scFilled, "/", stats.activeDepots), React.createElement("div", { className: "territory-stat-label" }, "SC filled"))),
    React.createElement("div", { className: "territory-bar" }, React.createElement("div", { className: "territory-bar-fill", style: { width: pct + "%" } })));
}

function AgentsByDsrTable() {
  const { data, openModal } = useApp();
  const groups = groupDevicesByAgent(ledgerDevicesForScope(data.deviceLedger, data.depots, "national")).slice(0, 20);
  return React.createElement("div", { className: "table-wrap" },
    React.createElement("table", null,
      React.createElement("thead", null, React.createElement("tr", null,
        React.createElement("th", null, "Agent / DSR"), React.createElement("th", null, "Depot(s)"),
        React.createElement("th", { className: "num" }, "Devices"), React.createElement("th", { className: "num" }, "High Risk"))),
      React.createElement("tbody", null,
        groups.length === 0 && React.createElement(EmptyRow, { colSpan: 4 }, "No devices with DSRs on file yet."),
        groups.map((g) => {
          const c = countsForDevices(g.devices);
          const depotNames = Object.keys(g.depotNames);
          return React.createElement("tr", { key: g.name, className: "clickable", onClick: () => openModal("agentLedger", { group: g, scope: "national" }) },
            React.createElement("td", null, g.name),
            React.createElement("td", null, depotNames.length <= 1 ? (depotNames[0] || "—") : depotNames.length + " depots"),
            React.createElement("td", { className: "num", style: { fontWeight: 600 } }, c.total),
            React.createElement("td", { className: "num" }, c.highrisk));
        }))));
}

export function NationalOverviewPage() {
  const { data, auth, openModal } = useApp();
  const [view, setView] = React.useState("map");
  const stats = overviewStats(data, "national");
  const c = stats.ledgerCounts;
  const agedTotal = c.aged + c.urgent + c.highrisk;
  const agedPct = c.total ? Math.round((agedTotal / c.total) * 1000) / 10 : null;
  const canBulkEdit = isAdmin(auth.role);

  return React.createElement("div", { className: "content" },
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 14 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, "National Overview"),
        React.createElement("div", { className: "scope-sub" }, REGION_ORDER.length, " regions · ", stats.activeDepots, " active depots"))),
    React.createElement("div", { className: "kpi-grid" },
      React.createElement(KpiTile, { label: "Devices tracked", value: fmtNum(stats.deviceTotal), foot: "at depot, all regions" }),
      React.createElement(KpiTile, { label: "Active depots", value: fmtNum(stats.activeDepots), foot: (stats.totalDepots - stats.activeDepots) + " closed" }),
      React.createElement(KpiTile, { label: "SC coverage", value: stats.scFilled + "/" + stats.activeDepots, foot: stats.scVacant + " vacant" }),
      React.createElement(KpiTile, { label: "Submitted today", value: stats.submittedToday + "/" + stats.expectedSubmissions, foot: "depots with today's entry" }),
      React.createElement(KpiTile, { label: "Aged stock (11d+)", value: agedPct === null ? "—" : agedPct + "%", foot: fmtNum(agedTotal) + " devices" }),
      React.createElement(KpiTile, { label: "High risk (30d+)", value: fmtNum(c.highrisk), foot: "escalate now" })),
    React.createElement("div", { className: "section-heading-row" },
      React.createElement("div", { className: "section-heading" }, "Regions"),
      React.createElement("div", { className: "view-toggle" },
        React.createElement("button", { className: view === "map" ? "active" : "", onClick: () => setView("map") }, "Map"),
        React.createElement("button", { className: view === "cards" ? "active" : "", onClick: () => setView("cards") }, "Cards"))),
    view === "map" ? React.createElement(GhanaMap, null) : React.createElement("div", { className: "territory-grid" }, REGION_ORDER.map((r) => React.createElement(RegionCard, { key: r, region: r }))),
    canBulkEdit && React.createElement(React.Fragment, null,
      React.createElement("div", { className: "section-heading-row" },
        React.createElement("div", { className: "section-heading" }, "Bulk device data entry"),
        React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("bulkDepotStock") }, "Upload Stock (All Depots)"),
          React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => openModal("bulkLedger") }, "Upload Baseline (All Depots)"),
          React.createElement("button", { className: "btn btn-danger btn-sm", onClick: () => openModal("clearLedger") }, "Clear All Devices"))),
      React.createElement("div", { style: { fontSize: 12, color: "var(--text-faint)", marginBottom: 14 } }, "Paste a full national device or stock export once — rows are matched to a depot automatically. See each button for column format.")),
    React.createElement("div", { className: "section-heading" }, "Devices with DSRs — by agent (national)"),
    React.createElement(AgentsByDsrTable, null));
}
