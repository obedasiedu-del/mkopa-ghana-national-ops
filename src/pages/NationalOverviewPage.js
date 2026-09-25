"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { GhanaMap } from "../components/GhanaMap.js";
import { KpiTile, EmptyRow } from "../components/ui.js";
import { AgingBarChart } from "../components/charts/AgingBarChart.js";
import { MovementTrendChart } from "../components/charts/MovementTrendChart.js";
import { REGION_ORDER, fmtNum, groupDevicesByAgent, countsForDevices, WAREHOUSE_PENDING_ENABLED, STOCK_MOVEMENT_ENABLED } from "../lib/domain.js";
import { overviewStats, ledgerDevices, ledgerDevicesForScope, bucketMovementsByDay, haltStatusesForScope } from "../lib/selectors.js";
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
        React.createElement("th", { className: "num" }, "Devices"), React.createElement("th", { className: "num" }, "14+ Days"))),
      React.createElement("tbody", null,
        groups.length === 0 && React.createElement(EmptyRow, { colSpan: 4 }, "No devices with DSRs on file yet."),
        groups.map((g) => {
          const c = countsForDevices(g.devices);
          const depotNames = Object.keys(g.depotNames);
          return React.createElement("tr", { key: g.name, className: "clickable", onClick: () => openModal("agentLedger", { group: g, scope: "national" }) },
            React.createElement("td", null, g.name),
            React.createElement("td", null, depotNames.length <= 1 ? (depotNames[0] || "—") : depotNames.length + " depots"),
            React.createElement("td", { className: "num", style: { fontWeight: 600 } }, c.total),
            React.createElement("td", { className: "num" }, c.urgent));
        }))));
}

function IndirectChannelCard() {
  const { data, goDepot } = useApp();
  const counts = countsForDevices(ledgerDevices(data.deviceLedger, "INDIRECT"));
  return React.createElement("button", { className: "territory-card", onClick: () => goDepot("INDIRECT") },
    React.createElement("div", { className: "territory-name" }, "Indirect Channel", React.createElement("span", { className: "arrow" }, "→")),
    React.createElement("div", { className: "territory-stats" },
      React.createElement("div", null, React.createElement("div", { className: "territory-stat-num" }, fmtNum(counts.total)), React.createElement("div", { className: "territory-stat-label" }, "Devices")),
      React.createElement("div", null, React.createElement("div", { className: "territory-stat-num" }, fmtNum(counts.urgent)), React.createElement("div", { className: "territory-stat-label" }, "Aged 14+d"))));
}

export function NationalOverviewPage() {
  const { data, auth, openModal, goMovements, goAudit, goHalts } = useApp();
  const [view, setView] = React.useState("map");
  const stats = overviewStats(data, "national");
  const c = stats.ledgerCounts;
  const wh = stats.warehousePendingCounts;
  const agedTotal = stats.aged10Plus;
  const agedPct = c.total ? Math.round((agedTotal / c.total) * 1000) / 10 : null;
  const aged14Total = c.urgent;
  const totalStock = stats.deviceTotal + c.total;
  const fifo = stats.fifoCompliance;
  const userIsAdmin = isAdmin(auth.role);

  const haltStatuses = React.useMemo(() => haltStatusesForScope(data, "national"), [data]);
  const haltedDepots = haltStatuses.filter((s) => s.halted);
  const haltPhase = haltStatuses[0]?.phase || null;

  const [movements7d, setMovements7d] = React.useState(null);
  React.useEffect(() => {
    if (!STOCK_MOVEMENT_ENABLED) return;
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    data.fetchMovementCount({ sinceIso: since }).then(setMovements7d).catch(() => setMovements7d(null));
  }, [data]);

  const TREND_DAYS = 14;
  const [trendPoints, setTrendPoints] = React.useState(null);
  React.useEffect(() => {
    if (!STOCK_MOVEMENT_ENABLED) return;
    const since = new Date(Date.now() - TREND_DAYS * 86400000).toISOString();
    data.fetchMovements({ sinceIso: since, limit: 2000 }).then((rows) => setTrendPoints(bucketMovementsByDay(rows, TREND_DAYS))).catch(() => setTrendPoints([]));
  }, [data]);

  return React.createElement("div", { className: "content" },
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 14 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, "National Overview"),
        React.createElement("div", { className: "scope-sub" }, REGION_ORDER.length, " regions · ", stats.activeDepots, " active depots"))),
    haltedDepots.length > 0 && React.createElement("div", { className: "banner banner-critical" },
      React.createElement("span", null, "⛔"),
      React.createElement("div", null,
        React.createElement("strong", null, haltedDepots.length, " depot", haltedDepots.length === 1 ? "" : "s", " on allocation halt"),
        " under ", haltPhase.label, " — aged stock (14d+) above the phase limit. ",
        React.createElement("button", { className: "btn btn-sm", style: { marginLeft: 6 }, onClick: () => goHalts() }, "View Halt Status Report →"))),
    React.createElement("div", { className: "kpi-grid" },
      React.createElement(KpiTile, { label: "Total Stock", value: fmtNum(totalStock), foot: "at depots + with DSRs" }),
      React.createElement(KpiTile, { label: "Devices at Depots", value: fmtNum(stats.deviceTotal), foot: "from daily submissions, all regions" }),
      React.createElement(KpiTile, { label: "Devices with DSRs", value: fmtNum(c.total), foot: "serial-level, all regions" }),
      WAREHOUSE_PENDING_ENABLED && React.createElement(KpiTile, { label: "In Warehouse (Pending)", value: fmtNum(wh.total), foot: fmtNum(wh.urgent) + " aged 14d+ · not yet at depot" }),
      React.createElement(KpiTile, { label: "Daily Submission Status", value: stats.submittedToday + "/" + stats.expectedSubmissions, foot: "depots with today's entry" }),
      userIsAdmin && React.createElement(KpiTile, { label: "Stock Aging", value: agedPct === null ? "—" : agedPct + "%", foot: fmtNum(agedTotal) + " devices 10d+" }),
      React.createElement(KpiTile, { label: "Aged 14d+", value: fmtNum(aged14Total), foot: "halt-policy threshold" }),
      React.createElement(KpiTile, { label: "FIFO Compliance", value: fifo.pct === null ? "—" : fifo.pct + "%", foot: fmtNum(fifo.sold) + "/" + fmtNum(fifo.cohort) + " aged stock sold this week" }),
      STOCK_MOVEMENT_ENABLED && React.createElement(KpiTile, { label: "Stock Movement", value: movements7d === null ? "—" : fmtNum(movements7d), foot: "movements in last 7 days" }),
      React.createElement(KpiTile, { label: "Active Depots", value: fmtNum(stats.activeDepots), foot: (stats.totalDepots - stats.activeDepots) + " closed" }),
      React.createElement(KpiTile, { label: "SC Coverage", value: stats.scFilled + "/" + stats.activeDepots, foot: stats.scVacant + " vacant" }),
      React.createElement(KpiTile, { label: "Allocation Halts", value: fmtNum(haltedDepots.length), foot: haltPhase ? haltPhase.label + " active" : "policy not started" })),
    React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 22 } },
      STOCK_MOVEMENT_ENABLED && React.createElement("button", { className: "btn btn-sm", onClick: () => goMovements() }, "View Stock Movement Log →"),
      userIsAdmin && React.createElement("button", { className: "btn btn-sm", onClick: () => goAudit() }, "View Audit History →"),
      React.createElement("button", { className: "btn btn-sm", onClick: () => goHalts() }, "View Halt Status Report →")),
    (userIsAdmin || STOCK_MOVEMENT_ENABLED) && React.createElement("div", { className: "chart-grid", style: { marginBottom: 22 } },
      userIsAdmin && React.createElement("div", null,
        React.createElement("div", { className: "section-heading" }, "Stock Aging Distribution"),
        React.createElement(AgingBarChart, { counts: c })),
      STOCK_MOVEMENT_ENABLED && React.createElement("div", null,
        React.createElement("div", { className: "section-heading" }, "Stock Movement — last ", TREND_DAYS, " days"),
        React.createElement(MovementTrendChart, { points: trendPoints }))),
    React.createElement("div", { className: "section-heading-row" },
      React.createElement("div", { className: "section-heading" }, "Regions"),
      React.createElement("div", { className: "view-toggle" },
        React.createElement("button", { className: view === "map" ? "active" : "", onClick: () => setView("map") }, "Map"),
        React.createElement("button", { className: view === "cards" ? "active" : "", onClick: () => setView("cards") }, "Cards"))),
    view === "map" ? React.createElement(GhanaMap, null) : React.createElement("div", { className: "territory-grid" }, REGION_ORDER.map((r) => React.createElement(RegionCard, { key: r, region: r }))),
    React.createElement("div", { className: "section-heading", style: { marginTop: 18 } }, "Other Channels"),
    React.createElement("div", { className: "territory-grid", style: { marginBottom: 22 } }, React.createElement(IndirectChannelCard, null)),
    userIsAdmin && React.createElement(React.Fragment, null,
      React.createElement("div", { className: "section-heading-row" },
        React.createElement("div", { className: "section-heading" }, "Bulk device data entry"),
        React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          STOCK_MOVEMENT_ENABLED && React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("bulkDepotStock") }, "Upload Stock (All Depots)"),
          React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => openModal("bulkLedger") }, "Upload Baseline (All Depots)"),
          WAREHOUSE_PENDING_ENABLED && React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("bulkWarehouseStock") }, "Upload Warehouse Stock"),
          React.createElement("button", { className: "btn btn-danger btn-sm", onClick: () => openModal("clearLedger") }, "Clear All Devices"))),
      React.createElement("div", { style: { fontSize: 12, color: "var(--text-faint)", marginBottom: 14 } }, "Paste a full national device or stock export once — rows are matched to a depot automatically. See each button for column format.")),
    React.createElement("div", { className: "section-heading" }, "Devices with DSRs — by agent (national)"),
    React.createElement(AgentsByDsrTable, null));
}
