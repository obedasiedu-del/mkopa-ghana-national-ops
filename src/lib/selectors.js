"use strict";
import { INDIRECT_DEPOT, UNRECOGNISED_DEPOT, countsForDevices, countsAtDayThreshold, fifoComplianceStats, submissionTotals, todayStr, trueAgePct } from "./domain.js";
import { activeHaltPhase, haltStatusForDepot } from "./haltPolicy.js";

export const PSEUDO_DEPOTS = [INDIRECT_DEPOT, UNRECOGNISED_DEPOT];

// Real (non-synthetic) depots, optionally filtered to one region, sorted by name.
export function depotsForScope(depots, scope) {
  let list = Object.values(depots).filter((d) => !d.isSynthetic);
  if (scope !== "national") list = list.filter((d) => d.region === scope);
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}
export function activeDepots(list) {
  return list.filter((d) => d.status === "active");
}
// Ledger scope includes the two pseudo buckets, but only at national scope.
export function ledgerDepotsForScope(depots, scope) {
  const list = depotsForScope(depots, scope);
  return scope === "national" ? list.concat(PSEUDO_DEPOTS) : list;
}
export function depotRecordForLedger(depots, code) {
  const pseudo = PSEUDO_DEPOTS.find((p) => p.code === code);
  return pseudo || depots[code] || null;
}
export function ledgerDevices(deviceLedger, depotCode) {
  return deviceLedger[depotCode] || [];
}
// All devices in scope, each tagged with its depot code/name -- used by the by-agent view.
export function ledgerDevicesForScope(deviceLedger, depots, scope) {
  const out = [];
  ledgerDepotsForScope(depots, scope).forEach((d) => {
    ledgerDevices(deviceLedger, d.code).forEach((dv) => out.push({ ...dv, depotCode: d.code, depotName: d.name }));
  });
  return out;
}
export function movementsForScope(movements, depots, scope) {
  const codes = new Set(depotsForScope(depots, scope).map((d) => d.code));
  if (scope === "national") return movements;
  return movements.filter((m) => codes.has(m.depotCode) || codes.has(m.toDepotCode));
}
// Most recent Daily Submission entry for one depot (submissionsByDepot[code] is sorted
// ascending by date), or null if the depot has never submitted. "Devices at Depot" is driven
// by this -- an opening-stock snapshot the depot reports each day -- rather than by recorded
// stock movements; a depot that hasn't submitted yet today keeps showing its last submitted
// count rather than dropping to zero.
export function latestSubmissionForDepot(submissionsByDepot, depotCode) {
  const days = submissionsByDepot[depotCode] || [];
  return days.length ? days[days.length - 1] : null;
}
// Devices at Depot totals for one depot, from movement history: { received, issued,
// remaining } summed across models. No longer used for the "current stock" figure (see
// latestSubmissionForDepot) -- kept for the separate movement-history view.
export function depotStockTotals(stockBalances, depotCode) {
  const models = stockBalances[depotCode] || {};
  const totals = { received: 0, issued: 0, remaining: 0 };
  Object.values(models).forEach((m) => {
    totals.received += m.received || 0;
    totals.issued += m.issued || 0;
    totals.remaining += m.remaining || 0;
  });
  return totals;
}
// Rolled-up KPIs for a scope (national or one region): active depots, SC coverage, devices
// tracked at depot, device-ledger aging counts, and today's daily-submission coverage.
export function overviewStats(data, scope) {
  const depots = depotsForScope(data.depots, scope);
  const active = activeDepots(depots);
  const filled = active.filter((d) => d.scStatus === "active");
  let deviceTotal = 0;
  depots.forEach((d) => {
    const latest = latestSubmissionForDepot(data.submissionsByDepot, d.code);
    deviceTotal += latest ? submissionTotals(latest).totalStock : 0;
  });
  const ledgerDepots = ledgerDepotsForScope(data.depots, scope);
  let ledgerCounts = { total: 0, inTrade: 0, fresh: 0, aged: 0, urgent: 0, reallocated: 0, returned: 0, sold: 0 };
  let aged10Plus = 0;
  let fifoCohort = 0, fifoSold = 0;
  ledgerDepots.forEach((d) => {
    const devices = ledgerDevices(data.deviceLedger, d.code);
    const c = countsForDevices(devices);
    Object.keys(ledgerCounts).forEach((k) => { ledgerCounts[k] += c[k]; });
    aged10Plus += countsAtDayThreshold(devices, 10);
    const fifo = fifoComplianceStats(devices);
    fifoCohort += fifo.cohort;
    fifoSold += fifo.sold;
  });
  const fifoCompliance = { cohort: fifoCohort, sold: fifoSold, pct: fifoCohort ? Math.round((fifoSold / fifoCohort) * 1000) / 10 : null };
  const today = todayStr();
  let submittedToday = 0;
  active.forEach((d) => {
    const days = data.submissionsByDepot[d.code] || [];
    if (days.some((s) => s.date === today)) submittedToday++;
  });
  let warehousePendingCounts = { total: 0, fresh: 0, aged: 0, urgent: 0, reallocated: 0, returned: 0, sold: 0 };
  depots.forEach((d) => {
    const c = countsForDevices(data.warehousePending[d.code] || []);
    Object.keys(warehousePendingCounts).forEach((k) => { warehousePendingCounts[k] += c[k]; });
  });
  return {
    activeDepots: active.length, totalDepots: depots.length,
    scFilled: filled.length, scVacant: active.length - filled.length,
    deviceTotal, ledgerCounts, aged10Plus, warehousePendingCounts, fifoCompliance,
    submittedToday, expectedSubmissions: active.length,
  };
}

// Flattens overviewStats() into the plain numeric shape stored in kpi_snapshots.metrics --
// exactly the fields the National page's KPI cards need for their value/badge/delta/
// sparkline, nothing else. haltedCount is passed in separately since overviewStats() doesn't
// compute halt status itself (haltStatusesForScope does, from a different code path).
export function snapshotMetricsFromStats(stats, haltedCount) {
  const c = stats.ledgerCounts;
  // Both % against in-trade devices only (sold/returned/reallocated excluded from the
  // denominator, same as they're excluded from the aged count itself) -- see
  // domain.js:countsForDevices / trueAgePct.
  const agedPct = c.inTrade ? Math.round((stats.aged10Plus / c.inTrade) * 1000) / 10 : null;
  const submissionPct = stats.expectedSubmissions ? Math.round((stats.submittedToday / stats.expectedSubmissions) * 1000) / 10 : null;
  const scCoveragePct = stats.activeDepots ? Math.round((stats.scFilled / stats.activeDepots) * 1000) / 10 : null;
  return {
    totalStock: stats.deviceTotal + c.total, deviceTotal: stats.deviceTotal, dsrTotal: c.total,
    agedPct, agedTotal: stats.aged10Plus, aged14Total: c.urgent, trueAgePct: trueAgePct(c),
    fifoPct: stats.fifoCompliance.pct, fifoCohort: stats.fifoCompliance.cohort, fifoSold: stats.fifoCompliance.sold,
    activeDepots: stats.activeDepots, totalDepots: stats.totalDepots,
    scFilled: stats.scFilled, scVacant: stats.scVacant, scCoveragePct,
    submittedToday: stats.submittedToday, expectedSubmissions: stats.expectedSubmissions, submissionPct,
    haltedCount: haltedCount || 0,
  };
}

// Daily movement counts for the last `days` days (today inclusive), zero-filled so a
// quiet day still shows as a point rather than a gap. `rows` is whatever fetchMovements
// returned for the same window.
export function bucketMovementsByDay(rows, days) {
  const counts = {};
  rows.forEach((m) => {
    const day = String(m.movedAt).slice(0, 10);
    counts[day] = (counts[day] || 0) + 1;
  });
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: counts[key] || 0 });
  }
  return out;
}

// Halt-of-allocation status for every depot in scope (active AND closed -- a closed depot
// can still be sitting on aged stock that needs recovering, so it stays visible here even
// though it's excluded from active-depot KPIs elsewhere), against the currently active phase
// of the agreed aged-stock policy (see lib/haltPolicy.js). Returns [] before the policy's
// first phase has started.
export function haltStatusesForScope(data, scope) {
  const phase = activeHaltPhase();
  if (!phase) return [];
  return depotsForScope(data.depots, scope).map((d) => {
    const counts = countsForDevices(ledgerDevices(data.deviceLedger, d.code));
    return { depot: d, ...haltStatusForDepot(counts, phase) };
  });
}

export function auditForScope(auditLog, depots, scope) {
  const codes = new Set(depotsForScope(depots, scope).map((d) => d.code));
  if (scope === "national") return auditLog;
  return auditLog.filter((a) => codes.has(a.depotCode));
}
