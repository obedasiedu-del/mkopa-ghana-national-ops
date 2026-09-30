"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { AgingBarChart } from "../components/charts/AgingBarChart.js";
import { MovementTrendChart } from "../components/charts/MovementTrendChart.js";
import { AgingBreakdown } from "../components/AgingBreakdown.js";
import { DailySubmissionOverview } from "../components/DailySubmissionOverview.js";
import { DirectAccuracySection } from "../components/DirectAccuracySection.js";
import { ViewingAsOfSection } from "../components/ViewingAsOfSection.js";
import { REGION_ORDER, fmtNum, countsForDevices, WAREHOUSE_PENDING_ENABLED, STOCK_MOVEMENT_ENABLED } from "../lib/domain.js";
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

function IndirectChannelCard() {
  const { data, goRegion } = useApp();
  const counts = countsForDevices(ledgerDevices(data.deviceLedger, "INDIRECT"));
  return React.createElement("button", { className: "territory-card", onClick: () => goRegion("Indirect") },
    React.createElement("div", { className: "territory-name" }, "Indirect Channel", React.createElement("span", { className: "arrow" }, "→")),
    React.createElement("div", { className: "territory-stats" },
      React.createElement("div", null, React.createElement("div", { className: "territory-stat-num" }, fmtNum(counts.total)), React.createElement("div", { className: "territory-stat-label" }, "Devices")),
      React.createElement("div", null, React.createElement("div", { className: "territory-stat-num" }, fmtNum(counts.urgent)), React.createElement("div", { className: "territory-stat-label" }, "Aged 14+d"))));
}

export function NationalOverviewPage() {
  const { data, auth, openModal, goMovements, goAudit, goHalts } = useApp();
  const stats = overviewStats(data, "national");
  const c = stats.ledgerCounts;
  const userIsAdmin = isAdmin(auth.role);
  const nationalDevices = React.useMemo(() => ledgerDevicesForScope(data.deviceLedger, data.depots, "national"), [data.deviceLedger, data.depots]);

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
    React.createElement(ViewingAsOfSection, { scope: "national", movements7d }),
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
    React.createElement("div", { className: "section-heading" }, "Daily Submission — national"),
    React.createElement(DailySubmissionOverview, { scope: "national" }),
    React.createElement("div", { className: "section-heading", style: { marginTop: 22 } }, "Devices with DSRs — by age, national"),
    React.createElement(AgingBreakdown, { devices: nationalDevices, showDepotColumn: true }),
    React.createElement("div", { className: "section-heading", style: { marginTop: 22 } }, "Regions"),
    React.createElement("div", { className: "territory-grid" }, REGION_ORDER.map((r) => React.createElement(RegionCard, { key: r, region: r }))),
    React.createElement("div", { className: "section-heading", style: { marginTop: 18 } }, "Other Channels"),
    React.createElement("div", { className: "territory-grid", style: { marginBottom: 22 } }, React.createElement(IndirectChannelCard, null)),
    React.createElement(DirectAccuracySection, { scope: "national" }),
    userIsAdmin && React.createElement(React.Fragment, null,
      React.createElement("div", { className: "section-heading-row" },
        React.createElement("div", { className: "section-heading" }, "Bulk device data entry"),
        React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          STOCK_MOVEMENT_ENABLED && React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("bulkDepotStock") }, "Upload Stock (All Depots)"),
          React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => openModal("bulkLedger") }, "Upload Baseline (All Depots)"),
          React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("bulkPsdsr") }, "Upload PSDSR (All Depots)"),
          React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("bulkInventoryAccuracy") }, "Upload Inventory Accuracy (All Depots)"),
          WAREHOUSE_PENDING_ENABLED && React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("bulkWarehouseStock") }, "Upload Warehouse Stock"),
          React.createElement("button", { className: "btn btn-danger btn-sm", onClick: () => openModal("clearLedger") }, "Clear All Devices"))),
      React.createElement("div", { style: { fontSize: 12, color: "var(--text-faint)", marginBottom: 14 } }, "Paste a full national device or stock export once — rows are matched to a depot automatically. See each button for column format.")));
}
