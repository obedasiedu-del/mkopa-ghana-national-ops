"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { KpiCard } from "./ui.js";
import { ReallocationTile } from "./ReallocationTile.js";
import { fmtNum, fmtDateTime, todayStr, addDaysStr, kpiBadge, kpiDeltaText, KPI_PCT_METRICS, clockInIsLate } from "../lib/domain.js";
import { ledgerDevices, latestSubmissionForDepot } from "../lib/selectors.js";
import { countsForDevices, trueAgePct, submissionTotals, psdsrPct, fifoComplianceStats } from "../lib/domain.js";

const SNAPSHOT_RANGE_DAYS = 14;
const SNAPSHOT_DELTA_DAYS = 3;
const SNAPSHOT_TARGET_KEYS = ["trueAgePct", "psdsrPct", "inventoryAccuracyPct"];

// Same "Viewing as of" picker as National/Region (ViewingAsOfSection.js), scoped to one
// depot instead. kpi_snapshots.scope is a plain text column -- using the depot's own code
// as the scope value needs no schema change, it's just one more value alongside "national"
// and the 9 region names. Keeps its own smaller metric set (no SC Coverage/Active
// Depots/Allocation Halts -- those genuinely only mean something across multiple depots, and
// the halt banner above already covers this depot's own halt status). FIFO Compliance *does*
// apply to a single depot (it's this depot's own aged-device cohort, not an aggregate), so it
// gets the same card National/Region show -- a daily reading (devices aged as of yesterday,
// sold since), not smoothed into a week.
export function DepotViewingAsOfSection({ rec }) {
  const { data, openModal } = useApp();
  const ledgerDvs = ledgerDevices(data.deviceLedger, rec.code);
  const counts = countsForDevices(ledgerDvs);
  const latestSubmission = latestSubmissionForDepot(data.submissionsByDepot, rec.code);
  const subTotals = latestSubmission ? submissionTotals(latestSubmission) : null;
  const invAcc = data.inventoryAccuracyByDepot[rec.code] || null;
  const psdsrRow = data.psdsrByDepot[rec.code] || null;
  // Today's clock-in only -- not part of the snapshot/sparkline system below (it's a single
  // daily fact, not a trend worth charting), always reads live regardless of the "Viewing as
  // of" date picker, same as the PSDSR detail pop-up's "tap for names" always means today's.
  const clockInEntry = data.clockInsByDepot[rec.code] || null;
  const clockInLate = clockInEntry ? clockInIsLate(clockInEntry.clockedInAt) : null;

  // 7-day rolling clearance rate, same as National/Region -- devices already aged at the
  // start of the window, how many have sold since. See selectors.js's overviewStats for why
  // this isn't a 1-day window.
  const fifo = React.useMemo(() => fifoComplianceStats(ledgerDvs, 7), [ledgerDvs]);

  const liveMetrics = React.useMemo(() => ({
    deviceTotal: subTotals ? subTotals.totalStock : 0,
    dsrTotal: counts.total,
    aged14Total: counts.urgent,
    trueAgePct: trueAgePct(counts),
    psdsrPct: psdsrPct(psdsrRow),
    inventoryAccuracyPct: invAcc ? invAcc.pct : null,
    fifoPct: fifo.pct, fifoCohort: fifo.cohort, fifoSold: fifo.sold,
  }), [subTotals, counts, psdsrRow, invAcc, fifo]);

  const scope = rec.code;
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

  const capturedForScope = React.useRef(null);
  React.useEffect(() => {
    if (capturedForScope.current === scope || !data.loaded) return;
    capturedForScope.current = scope;
    data.captureSnapshot(scope, liveMetrics).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loaded, scope]);

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "kpi-datebar" },
      React.createElement("span", { style: { fontSize: 12.5, color: "var(--text-muted)" } }, "Viewing as of"),
      React.createElement("input", { type: "date", className: "field-input", style: { width: "auto" }, value: viewDate, max: todayStr(), onChange: (e) => setViewDate(e.target.value || todayStr()) }),
      !isToday && React.createElement("button", { className: "btn btn-sm", onClick: () => setViewDate(todayStr()) }, "Latest"),
      React.createElement("div", { className: "kpi-datebar-summary" },
        dm ? (onTargetCount + offTargetCount) + " KPIs tracked · " + onTargetCount + " on target · " + offTargetCount + " off target" : (rangeLoading ? "Loading…" : "")),
      !isToday && !dm && !rangeLoading && React.createElement("div", { className: "kpi-datebar-note" }, "No snapshot recorded for " + viewDate + " yet — history accumulates day by day from when this was switched on.")),
    React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
      React.createElement(KpiCard, { label: "Devices at Depot", value: dm ? fmtNum(dm.deviceTotal) : "—", foot: "from daily submission", ...cardExtras("deviceTotal") }),
      React.createElement(KpiCard, { label: "Devices with DSRs", value: dm ? fmtNum(dm.dsrTotal) : "—", foot: "serial-level", ...cardExtras("dsrTotal") }),
      React.createElement(KpiCard, {
        label: "Aged 14d+", value: dm ? fmtNum(dm.aged14Total) : "—",
        foot: "halt-policy threshold",
        ...cardExtras("aged14Total"),
      }),
      React.createElement(KpiCard, { label: "True Age", value: dm && dm.trueAgePct !== null ? dm.trueAgePct + "%" : "—", foot: "14d+ share of active (in-trade) stock", ...cardExtras("trueAgePct") }),
      React.createElement(KpiCard, {
        label: "Clock-In", value: !clockInEntry ? "Not yet" : (clockInLate ? "Late" : "On time"),
        foot: clockInEntry ? "at " + fmtDateTime(clockInEntry.clockedInAt) + " · tap for details" : "no entry yet today",
        badge: !clockInEntry ? { label: "NOT YET", cls: "pill-muted" } : (clockInLate ? { label: "LATE", cls: "pill-warning" } : { label: "ON TIME", cls: "pill-success" }),
        onClick: () => openModal("clockInDetail", { scope: rec.code }),
      }),
      React.createElement(KpiCard, { label: "PSDSR", value: dm && dm.psdsrPct !== null ? dm.psdsrPct + "%" : "—", foot: psdsrRow ? "latest entry · tap for names" : "no entry yet", onClick: () => openModal("psdsrDetail", { depotCode: rec.code }), ...cardExtras("psdsrPct") }),
      React.createElement(KpiCard, { label: "Inventory Accuracy", value: dm && dm.inventoryAccuracyPct !== null ? dm.inventoryAccuracyPct + "%" : "—", foot: invAcc ? "latest entry" : "no entry yet", ...cardExtras("inventoryAccuracyPct") }),
      React.createElement(KpiCard, { label: "FIFO Compliance", value: dm && dm.fifoPct !== null ? dm.fifoPct + "%" : "—", foot: dm ? fmtNum(dm.fifoSold) + "/" + fmtNum(dm.fifoCohort) + " aged stock sold in the last 7 days" : "", ...cardExtras("fifoPct") }),
      React.createElement(ReallocationTile, { scope: rec.code, singleDepotCode: rec.code })));
}
