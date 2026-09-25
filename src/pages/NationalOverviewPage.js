"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { KpiTile, KpiCard, EmptyRow } from "../components/ui.js";
import { AgingBarChart } from "../components/charts/AgingBarChart.js";
import { MovementTrendChart } from "../components/charts/MovementTrendChart.js";
import { REGION_ORDER, fmtNum, groupDevicesByAgent, countsForDevices, WAREHOUSE_PENDING_ENABLED, STOCK_MOVEMENT_ENABLED, todayStr, addDaysStr, kpiBadge, kpiDeltaText, KPI_PCT_METRICS } from "../lib/domain.js";
import { overviewStats, ledgerDevices, ledgerDevicesForScope, bucketMovementsByDay, haltStatusesForScope, snapshotMetricsFromStats } from "../lib/selectors.js";
import { isAdmin } from "../data/useAuth.js";

const SNAPSHOT_RANGE_DAYS = 14;
const SNAPSHOT_DELTA_DAYS = 3;
const SNAPSHOT_TARGET_KEYS = ["submissionPct", "scCoveragePct", "haltedCount"];

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
  return React.createElement("div", { className: "table-wrap table-wrap-scroll" },
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
  const stats = overviewStats(data, "national");
  const c = stats.ledgerCounts;
  const wh = stats.warehousePendingCounts;
  const userIsAdmin = isAdmin(auth.role);

  const haltStatuses = React.useMemo(() => haltStatusesForScope(data, "national"), [data]);
  const haltedDepots = haltStatuses.filter((s) => s.halted);
  const haltPhase = haltStatuses[0]?.phase || null;

  // "Viewing as of" date picker -- KPI card values/badges/deltas/sparklines below switch to
  // a stored daily snapshot for any past date; everything else on the page (map, halt
  // banner, agents table) always reflects live current data regardless of the picker.
  const liveMetrics = React.useMemo(() => snapshotMetricsFromStats(stats, haltedDepots.length), [stats, haltedDepots.length]);
  const [viewDate, setViewDate] = React.useState(todayStr());
  const isToday = viewDate === todayStr();
  const [rangeSnapshots, setRangeSnapshots] = React.useState([]);
  const [rangeLoading, setRangeLoading] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    setRangeLoading(true);
    const fromDate = addDaysStr(viewDate, -(SNAPSHOT_RANGE_DAYS - 1));
    data.fetchSnapshotRange("national", fromDate, viewDate)
      .then((rows) => { if (!cancelled) setRangeSnapshots(rows); })
      .catch(() => { if (!cancelled) setRangeSnapshots([]); })
      .finally(() => { if (!cancelled) setRangeLoading(false); });
    return () => { cancelled = true; };
  }, [data, viewDate]);
  const snapshotByDate = React.useMemo(() => {
    const m = {};
    rangeSnapshots.forEach((r) => { m[r.date] = r.metrics; });
    return m;
  }, [rangeSnapshots]);
  const dm = isToday ? liveMetrics : (snapshotByDate[viewDate] || null);
  const deltaMetrics = snapshotByDate[addDaysStr(viewDate, -SNAPSHOT_DELTA_DAYS)] || null;
  function buildSparkline(key) {
    const fromDate = addDaysStr(viewDate, -(SNAPSHOT_RANGE_DAYS - 1));
    const out = [];
    for (let i = 0; i < SNAPSHOT_RANGE_DAYS; i++) {
      const d = addDaysStr(fromDate, i);
      if (isToday && d === viewDate) { out.push(liveMetrics[key] ?? null); continue; }
      const m = snapshotByDate[d];
      out.push(m ? (m[key] ?? null) : null);
    }
    return out;
  }
  function cardExtras(key) {
    const value = dm ? dm[key] : null;
    const badge = dm ? kpiBadge(key, value) : null;
    const past = deltaMetrics ? deltaMetrics[key] : null;
    const diff = value !== null && value !== undefined && past !== null && past !== undefined ? value - past : null;
    const deltaText = diff !== null ? kpiDeltaText(diff, !!KPI_PCT_METRICS[key], SNAPSHOT_DELTA_DAYS) : null;
    return { badge, deltaText, sparkPoints: buildSparkline(key) };
  }
  const onTargetCount = dm ? SNAPSHOT_TARGET_KEYS.filter((k) => kpiBadge(k, dm[k]).cls === "pill-success").length : 0;
  const offTargetCount = dm ? SNAPSHOT_TARGET_KEYS.filter((k) => kpiBadge(k, dm[k]).cls === "pill-critical").length : 0;
  // Opportunistic capture -- once per page mount, after live data has actually loaded, this
  // upserts today's national snapshot so tomorrow (and every day after) has a "3 days ago"
  // and a growing sparkline to look back on. No cron/edge function needed: with ~100 people
  // loading this page daily, today's row gets written (and re-written with fresher numbers)
  // many times before midnight locks it in as history.
  const capturedRef = React.useRef(false);
  React.useEffect(() => {
    if (capturedRef.current || !data.loaded) return;
    capturedRef.current = true;
    data.captureSnapshot("national", liveMetrics).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loaded]);

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
    React.createElement("div", { className: "kpi-datebar" },
      React.createElement("span", { style: { fontSize: 12.5, color: "var(--text-muted)" } }, "Viewing as of"),
      React.createElement("input", { type: "date", className: "field-input", value: viewDate, max: todayStr(), onChange: (e) => setViewDate(e.target.value || todayStr()) }),
      !isToday && React.createElement("button", { className: "btn btn-sm", onClick: () => setViewDate(todayStr()) }, "Latest"),
      React.createElement("div", { className: "kpi-datebar-summary" },
        dm ? (onTargetCount + offTargetCount) + " KPIs tracked · " + onTargetCount + " on target · " + offTargetCount + " off target" : (rangeLoading ? "Loading…" : "")),
      !isToday && !dm && !rangeLoading && React.createElement("div", { className: "kpi-datebar-note" }, "No snapshot recorded for " + viewDate + " yet — history accumulates day by day from when this was switched on.")),
    React.createElement("div", { className: "kpi-grid" },
      React.createElement(KpiCard, { label: "Total Stock", value: dm ? fmtNum(dm.totalStock) : "—", foot: "at depots + with DSRs", ...cardExtras("totalStock") }),
      React.createElement(KpiCard, { label: "Devices at Depots", value: dm ? fmtNum(dm.deviceTotal) : "—", foot: "from daily submissions, all regions", ...cardExtras("deviceTotal") }),
      React.createElement(KpiCard, { label: "Devices with DSRs", value: dm ? fmtNum(dm.dsrTotal) : "—", foot: "serial-level, all regions", ...cardExtras("dsrTotal") }),
      WAREHOUSE_PENDING_ENABLED && React.createElement(KpiTile, { label: "In Warehouse (Pending)", value: fmtNum(wh.total), foot: fmtNum(wh.urgent) + " aged 14d+ · not yet at depot" }),
      React.createElement(KpiCard, { label: "Daily Submission Status", value: dm ? dm.submittedToday + "/" + dm.expectedSubmissions : "—", foot: "depots with today's entry", ...cardExtras("submissionPct") }),
      userIsAdmin && React.createElement(KpiCard, { label: "Stock Aging", value: dm && dm.agedPct !== null ? dm.agedPct + "%" : "—", foot: dm ? fmtNum(dm.agedTotal) + " devices 10d+" : "", ...cardExtras("agedPct") }),
      React.createElement(KpiCard, { label: "Aged 14d+", value: dm ? fmtNum(dm.aged14Total) : "—", foot: "halt-policy threshold", ...cardExtras("aged14Total") }),
      React.createElement(KpiCard, { label: "True Age", value: dm && dm.trueAgePct !== null ? dm.trueAgePct + "%" : "—", foot: "14d+ share of active (in-trade) stock", ...cardExtras("trueAgePct") }),
      React.createElement(KpiCard, { label: "FIFO Compliance", value: dm && dm.fifoPct !== null ? dm.fifoPct + "%" : "—", foot: dm ? fmtNum(dm.fifoSold) + "/" + fmtNum(dm.fifoCohort) + " aged stock sold this week" : "", ...cardExtras("fifoPct") }),
      STOCK_MOVEMENT_ENABLED && React.createElement(KpiTile, { label: "Stock Movement", value: movements7d === null ? "—" : fmtNum(movements7d), foot: "movements in last 7 days" }),
      React.createElement(KpiCard, { label: "Active Depots", value: dm ? fmtNum(dm.activeDepots) : "—", foot: dm ? (dm.totalDepots - dm.activeDepots) + " closed" : "", ...cardExtras("activeDepots") }),
      React.createElement(KpiCard, { label: "SC Coverage", value: dm ? dm.scFilled + "/" + dm.activeDepots : "—", foot: dm ? dm.scVacant + " vacant" : "", ...cardExtras("scCoveragePct") }),
      React.createElement(KpiCard, { label: "Allocation Halts", value: dm ? fmtNum(dm.haltedCount) : "—", foot: haltPhase ? haltPhase.label + " active" : "policy not started", ...cardExtras("haltedCount") })),
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
    React.createElement("div", { className: "section-heading" }, "Regions"),
    React.createElement("div", { className: "territory-grid" }, REGION_ORDER.map((r) => React.createElement(RegionCard, { key: r, region: r }))),
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
