"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { DepotTable } from "../components/DepotTable.js";
import { KpiTile, Breadcrumb } from "../components/ui.js";
import { AgingBarChart } from "../components/charts/AgingBarChart.js";
import { MovementTrendChart } from "../components/charts/MovementTrendChart.js";
import { fmtNum, REGION_ORDER, WAREHOUSE_PENDING_ENABLED, STOCK_MOVEMENT_ENABLED, trueAgePct } from "../lib/domain.js";
import { depotsForScope, overviewStats, bucketMovementsByDay, haltStatusesForScope, psdsrStatsForScope, inventoryAccuracyStatsForScope, scScoreStatsForScope } from "../lib/selectors.js";
import { isAdmin } from "../data/useAuth.js";

export function RegionPage() {
  const { data, auth, route, search, goNational, goMovements, goAudit, goHalts } = useApp();
  const region = route.region;
  if (!REGION_ORDER.includes(region)) {
    return React.createElement("div", { className: "content" },
      React.createElement("div", { className: "banner" }, React.createElement("span", null, "⚠"), React.createElement("div", null, "Unknown region \"" + region + "\".")));
  }
  const stats = overviewStats(data, region);
  const c = stats.ledgerCounts;
  const wh = stats.warehousePendingCounts;
  const agedTotal = stats.aged10Plus;
  const agedPct = c.inTrade ? Math.round((agedTotal / c.inTrade) * 1000) / 10 : null;
  const aged14Total = c.urgent;
  const trueAge = trueAgePct(c);
  const psdsr = psdsrStatsForScope(data, region);
  const invAcc = inventoryAccuracyStatsForScope(data, region);
  const scScore = scScoreStatsForScope(data, region);
  const totalStock = stats.deviceTotal + c.total;
  const fifo = stats.fifoCompliance;
  const userIsAdmin = isAdmin(auth.role);
  const depots = depotsForScope(data.depots, region);

  const haltStatuses = React.useMemo(() => haltStatusesForScope(data, region), [data, region]);
  const haltedDepots = haltStatuses.filter((s) => s.halted);
  const haltPhase = haltStatuses[0]?.phase || null;

  const [movements7d, setMovements7d] = React.useState(null);
  React.useEffect(() => {
    if (!STOCK_MOVEMENT_ENABLED) return;
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    data.fetchMovementCount({ depotCodes: depots.map((d) => d.code), sinceIso: since }).then(setMovements7d).catch(() => setMovements7d(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, data]);

  const TREND_DAYS = 14;
  const [trendPoints, setTrendPoints] = React.useState(null);
  React.useEffect(() => {
    if (!STOCK_MOVEMENT_ENABLED) return;
    const since = new Date(Date.now() - TREND_DAYS * 86400000).toISOString();
    data.fetchMovements({ depotCodes: depots.map((d) => d.code), sinceIso: since, limit: 2000 }).then((rows) => setTrendPoints(bucketMovementsByDay(rows, TREND_DAYS))).catch(() => setTrendPoints([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, data]);

  return React.createElement("div", { className: "content" },
    React.createElement(Breadcrumb, { items: [{ label: "National", onClick: goNational }, { label: region }] }),
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 14 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, region),
        React.createElement("div", { className: "scope-sub" }, stats.activeDepots, " active depots"))),
    haltedDepots.length > 0 && React.createElement("div", { className: "banner banner-critical" },
      React.createElement("span", null, "⛔"),
      React.createElement("div", null,
        React.createElement("strong", null, haltedDepots.length, " depot", haltedDepots.length === 1 ? "" : "s", " on allocation halt"),
        " in ", region, " under ", haltPhase.label, " — aged stock (14d+) above the phase limit. ",
        React.createElement("button", { className: "btn btn-sm", style: { marginLeft: 6 }, onClick: () => goHalts(region) }, "View Halt Status Report →"))),
    React.createElement("div", { className: "kpi-grid" },
      React.createElement(KpiTile, { label: "Total Stock", value: fmtNum(totalStock), foot: "at depots + with DSRs" }),
      React.createElement(KpiTile, { label: "Devices at Depots", value: fmtNum(stats.deviceTotal), foot: "from daily submissions" }),
      React.createElement(KpiTile, { label: "Devices with DSRs", value: fmtNum(c.total), foot: "serial-level" }),
      WAREHOUSE_PENDING_ENABLED && React.createElement(KpiTile, { label: "In Warehouse (Pending)", value: fmtNum(wh.total), foot: fmtNum(wh.urgent) + " aged 14d+ · not yet at depot" }),
      React.createElement(KpiTile, { label: "Daily Submission Status", value: stats.submittedToday + "/" + stats.expectedSubmissions, foot: "depots with today's entry" }),
      userIsAdmin && React.createElement(KpiTile, { label: "Stock Aging", value: agedPct === null ? "—" : agedPct + "%", foot: fmtNum(agedTotal) + " devices 10d+" }),
      React.createElement(KpiTile, { label: "Aged 14d+", value: fmtNum(aged14Total), foot: "halt-policy threshold" }),
      React.createElement(KpiTile, { label: "True Age", value: trueAge === null ? "—" : trueAge + "%", foot: "14d+ share of active (in-trade) stock" }),
      React.createElement(KpiTile, { label: "PSDSR", value: psdsr.pct === null ? "—" : psdsr.pct + "%", foot: fmtNum(psdsr.depotsReporting) + "/" + fmtNum(stats.activeDepots) + " depots reporting" }),
      React.createElement(KpiTile, { label: "Inventory Accuracy", value: invAcc.pct === null ? "—" : invAcc.pct + "%", foot: fmtNum(invAcc.depotsReporting) + "/" + fmtNum(stats.activeDepots) + " depots reporting" }),
      React.createElement(KpiTile, { label: "SC Score", value: scScore.avg === null ? "—" : scScore.avg, foot: fmtNum(scScore.depotsScored) + "/" + fmtNum(stats.activeDepots) + " depots scored" }),
      React.createElement(KpiTile, { label: "FIFO Compliance", value: fifo.pct === null ? "—" : fifo.pct + "%", foot: fmtNum(fifo.sold) + "/" + fmtNum(fifo.cohort) + " aged stock sold this week" }),
      STOCK_MOVEMENT_ENABLED && React.createElement(KpiTile, { label: "Stock Movement", value: movements7d === null ? "—" : fmtNum(movements7d), foot: "movements in last 7 days" }),
      React.createElement(KpiTile, { label: "Active Depots", value: fmtNum(stats.activeDepots), foot: (stats.totalDepots - stats.activeDepots) + " closed" }),
      React.createElement(KpiTile, { label: "SC Coverage", value: stats.scFilled + "/" + stats.activeDepots, foot: stats.scVacant + " vacant" }),
      React.createElement(KpiTile, { label: "Allocation Halts", value: fmtNum(haltedDepots.length), foot: haltPhase ? haltPhase.label + " active" : "policy not started" })),
    React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16 } },
      STOCK_MOVEMENT_ENABLED && React.createElement("button", { className: "btn btn-sm", onClick: () => goMovements(region) }, "View Stock Movement Log →"),
      userIsAdmin && React.createElement("button", { className: "btn btn-sm", onClick: () => goAudit(region) }, "View Audit History →"),
      React.createElement("button", { className: "btn btn-sm", onClick: () => goHalts(region) }, "View Halt Status Report →")),
    (userIsAdmin || STOCK_MOVEMENT_ENABLED) && React.createElement("div", { className: "chart-grid", style: { marginBottom: 22 } },
      userIsAdmin && React.createElement("div", null,
        React.createElement("div", { className: "section-heading" }, "Stock Aging Distribution"),
        React.createElement(AgingBarChart, { counts: c })),
      STOCK_MOVEMENT_ENABLED && React.createElement("div", null,
        React.createElement("div", { className: "section-heading" }, "Stock Movement — last ", TREND_DAYS, " days"),
        React.createElement(MovementTrendChart, { points: trendPoints }))),
    React.createElement("div", { className: "section-heading", style: { marginTop: 14 } }, "Depots in ", region),
    React.createElement(DepotTable, { depots }));
}
