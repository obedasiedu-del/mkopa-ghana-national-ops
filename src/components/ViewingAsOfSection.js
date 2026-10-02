"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { KpiTile, KpiCard } from "./ui.js";
import { fmtNum, WAREHOUSE_PENDING_ENABLED, STOCK_MOVEMENT_ENABLED, todayStr, addDaysStr, kpiBadge, kpiDeltaText, KPI_PCT_METRICS } from "../lib/domain.js";
import { overviewStats, haltStatusesForScope, snapshotMetricsFromStats, psdsrStatsForScope, inventoryAccuracyStatsForScope, clockInStatsForScope } from "../lib/selectors.js";
import { isAdmin } from "../data/useAuth.js";

const SNAPSHOT_RANGE_DAYS = 14;
const SNAPSHOT_DELTA_DAYS = 3;
const SNAPSHOT_TARGET_KEYS = ["haltedCount", "trueAgePct", "psdsrPct", "inventoryAccuracyPct"];

// The "Viewing as of" date picker: every KPI card's value/badge/delta/sparkline switches to a
// stored daily snapshot for any past date (captureSnapshot/fetchSnapshotRange are already
// generic over `scope` -- "national" or a region name both just become the scope column's
// value in kpi_snapshots, no backend change needed). Originally National Overview only;
// `scope` now lets the same picker + card grid live on each Region page too, scoped to that
// region's own depots via overviewStats(data, scope) etc.
export function ViewingAsOfSection({ scope, movements7d }) {
  const { data, auth, openModal } = useApp();
  const stats = overviewStats(data, scope);
  const userIsAdmin = isAdmin(auth.role);
  const haltStatuses = React.useMemo(() => haltStatusesForScope(data, scope), [data, scope]);
  const haltedDepots = haltStatuses.filter((s) => s.halted);
  const haltPhase = haltStatuses[0]?.phase || null;

  const psdsr = psdsrStatsForScope(data, scope);
  const invAcc = inventoryAccuracyStatsForScope(data, scope);
  const clockIn = clockInStatsForScope(data, scope);
  const liveMetrics = React.useMemo(() => ({
    ...snapshotMetricsFromStats(stats, haltedDepots.length),
    psdsrPct: psdsr.pct, psdsrTotal: psdsr.total, psdsrSufficient: psdsr.sufficient, psdsrDepotsReporting: psdsr.depotsReporting,
    inventoryAccuracyPct: invAcc.pct, inventoryAccuracyDepotsReporting: invAcc.depotsReporting,
    clockInOnTime: clockIn.onTime, clockInLate: clockIn.late, clockInTotal: clockIn.totalDepots, clockInOnTimePct: clockIn.pct,
  }), [stats, haltedDepots.length, psdsr, invAcc, clockIn]);
  const [viewDate, setViewDate] = React.useState(todayStr());
  const isToday = viewDate === todayStr();
  const [rangeSnapshots, setRangeSnapshots] = React.useState([]);
  const [rangeLoading, setRangeLoading] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    setRangeLoading(true);
    const fromDate = addDaysStr(viewDate, -(SNAPSHOT_RANGE_DAYS - 1));
    data.fetchSnapshotRange(scope, fromDate, viewDate)
      .then((rows) => { if (!cancelled) setRangeSnapshots(rows); })
      .catch(() => { if (!cancelled) setRangeSnapshots([]); })
      .finally(() => { if (!cancelled) setRangeLoading(false); });
    return () => { cancelled = true; };
  }, [data, scope, viewDate]);
  const snapshotByDate = React.useMemo(() => {
    const m = {};
    rangeSnapshots.forEach((r) => { m[r.date] = r.metrics; });
    return m;
  }, [rangeSnapshots]);
  const dm = isToday ? liveMetrics : (snapshotByDate[viewDate] || null);
  const deltaMetrics = snapshotByDate[addDaysStr(viewDate, -SNAPSHOT_DELTA_DAYS)] || null;
  function buildSparkline(key) {
    const fromDate = addDaysStr(viewDate, -(SNAPSHOT_RANGE_DAYS - 1));
    const points = [];
    const dates = [];
    for (let i = 0; i < SNAPSHOT_RANGE_DAYS; i++) {
      const d = addDaysStr(fromDate, i);
      dates.push(d);
      if (isToday && d === viewDate) { points.push(liveMetrics[key] ?? null); continue; }
      const m = snapshotByDate[d];
      points.push(m ? (m[key] ?? null) : null);
    }
    return { points, dates };
  }
  function cardExtras(key) {
    const value = dm ? dm[key] : null;
    const badge = dm ? kpiBadge(key, value) : null;
    const past = deltaMetrics ? deltaMetrics[key] : null;
    const diff = value !== null && value !== undefined && past !== null && past !== undefined ? value - past : null;
    const deltaText = diff !== null ? kpiDeltaText(diff, !!KPI_PCT_METRICS[key], SNAPSHOT_DELTA_DAYS) : null;
    const spark = buildSparkline(key);
    return { badge, deltaText, sparkPoints: spark.points, sparkDates: spark.dates, isPct: !!KPI_PCT_METRICS[key] };
  }
  const onTargetCount = dm ? SNAPSHOT_TARGET_KEYS.filter((k) => kpiBadge(k, dm[k]).cls === "pill-success").length : 0;
  const offTargetCount = dm ? SNAPSHOT_TARGET_KEYS.filter((k) => kpiBadge(k, dm[k]).cls === "pill-critical").length : 0;
  // Opportunistic capture -- once per page mount, after live data has actually loaded, this
  // upserts today's snapshot for this scope so tomorrow (and every day after) has a "3 days
  // ago" and a growing sparkline to look back on. Re-fires if `scope` itself changes (e.g.
  // navigating from one region's page to another), since that's really a different page.
  const capturedForScope = React.useRef(null);
  React.useEffect(() => {
    if (capturedForScope.current === scope || !data.loaded) return;
    capturedForScope.current = scope;
    data.captureSnapshot(scope, liveMetrics).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loaded, scope]);

  const wh = stats.warehousePendingCounts;
  const allRegionsSuffix = scope === "national" ? ", all regions" : "";

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "kpi-datebar" },
      React.createElement("span", { style: { fontSize: 12.5, color: "var(--text-muted)" } }, "Viewing as of"),
      React.createElement("input", { type: "date", className: "field-input", style: { width: "auto" }, value: viewDate, max: todayStr(), onChange: (e) => setViewDate(e.target.value || todayStr()) }),
      !isToday && React.createElement("button", { className: "btn btn-sm", onClick: () => setViewDate(todayStr()) }, "Latest"),
      React.createElement("div", { className: "kpi-datebar-summary" },
        dm ? (onTargetCount + offTargetCount) + " KPIs tracked · " + onTargetCount + " on target · " + offTargetCount + " off target" : (rangeLoading ? "Loading…" : "")),
      !isToday && !dm && !rangeLoading && React.createElement("div", { className: "kpi-datebar-note" }, "No snapshot recorded for " + viewDate + " yet — history accumulates day by day from when this was switched on.")),
    React.createElement("div", { className: "kpi-grid" },
      React.createElement(KpiCard, { label: "Total Stock", value: dm ? fmtNum(dm.totalStock) : "—", foot: "at depots + with DSRs", ...cardExtras("totalStock") }),
      React.createElement(KpiCard, { label: "Devices at Depots", value: dm ? fmtNum(dm.deviceTotal) : "—", foot: "from daily submissions" + allRegionsSuffix, ...cardExtras("deviceTotal") }),
      React.createElement(KpiCard, { label: "Devices with DSRs", value: dm ? fmtNum(dm.dsrTotal) : "—", foot: "serial-level" + allRegionsSuffix, ...cardExtras("dsrTotal") }),
      WAREHOUSE_PENDING_ENABLED && React.createElement(KpiTile, { label: "In Warehouse (Pending)", value: fmtNum(wh.total), foot: fmtNum(wh.urgent) + " aged 14d+ · not yet at depot" }),
      STOCK_MOVEMENT_ENABLED && React.createElement(KpiTile, { label: "Stock Movement", value: movements7d === null || movements7d === undefined ? "—" : fmtNum(movements7d), foot: "movements in last 7 days" }),
      React.createElement(KpiCard, { label: "Daily Submission Status", value: dm ? dm.submittedToday + "/" + dm.expectedSubmissions : "—", foot: "depots with today's entry", ...cardExtras("submissionPct") }),
      React.createElement(KpiCard, {
        label: "Clock-In", value: dm ? dm.clockInOnTime + "/" + dm.clockInTotal : "—",
        foot: dm ? dm.clockInLate + " late · tap for details" : "",
        onClick: () => openModal("clockInDetail", { scope }), ...cardExtras("clockInOnTimePct"),
      }),
      userIsAdmin && React.createElement(KpiCard, { label: "Stock Aging", value: dm && dm.agedPct !== null ? dm.agedPct + "%" : "—", foot: dm ? fmtNum(dm.agedTotal) + " devices 10d+" : "", ...cardExtras("agedPct") }),
      React.createElement(KpiCard, {
        label: "Aged 14d+", value: dm ? fmtNum(dm.aged14Total) : "—",
        foot: "halt-policy threshold",
        ...cardExtras("aged14Total"),
      }),
      React.createElement(KpiCard, { label: "True Age", value: dm && dm.trueAgePct !== null ? dm.trueAgePct + "%" : "—", foot: "14d+ share of active (in-trade) stock", ...cardExtras("trueAgePct") }),
      React.createElement(KpiCard, { label: "PSDSR", value: dm && dm.psdsrPct !== null ? dm.psdsrPct + "%" : "—", foot: dm ? fmtNum(dm.psdsrDepotsReporting) + "/" + fmtNum(stats.activeDepots) + " depots reporting" : "", ...cardExtras("psdsrPct") }),
      React.createElement(KpiCard, { label: "Inventory Accuracy", value: dm && dm.inventoryAccuracyPct !== null ? dm.inventoryAccuracyPct + "%" : "—", foot: dm ? fmtNum(dm.inventoryAccuracyDepotsReporting) + "/" + fmtNum(stats.activeDepots) + " depots reporting" : "", ...cardExtras("inventoryAccuracyPct") }),
      React.createElement(KpiCard, { label: "FIFO Compliance", value: dm && dm.fifoPct !== null ? dm.fifoPct + "%" : "—", foot: dm ? fmtNum(dm.fifoSold) + "/" + fmtNum(dm.fifoCohort) + " aged stock sold today (of stock aged since yesterday)" : "", ...cardExtras("fifoPct") }),
      React.createElement(KpiCard, { label: "Active Depots", value: dm ? fmtNum(dm.activeDepots) : "—", foot: dm ? (dm.totalDepots - dm.activeDepots) + " closed" : "", ...cardExtras("activeDepots") }),
      React.createElement(KpiCard, { label: "SC Coverage", value: dm ? dm.scFilled + "/" + dm.activeDepots : "—", foot: dm ? dm.scVacant + " vacant" : "", ...cardExtras("scCoveragePct") }),
      React.createElement(KpiCard, { label: "Allocation Halts", value: dm ? fmtNum(dm.haltedCount) : "—", foot: haltPhase ? haltPhase.label + " active" : "policy not started", ...cardExtras("haltedCount") })));
}
