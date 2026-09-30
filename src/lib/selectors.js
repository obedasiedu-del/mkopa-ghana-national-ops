"use strict";
import { INDIRECT_DEPOT, UNRECOGNISED_DEPOT, REGION_ORDER, countsForDevices, countsAtDayThreshold, fifoComplianceStats, submissionTotals, todayStr, trueAgePct, SUBMISSION_MODELS } from "./domain.js";
import { activeHaltPhase, haltStatusForDepot } from "./haltPolicy.js";

export const PSEUDO_DEPOTS = [INDIRECT_DEPOT, UNRECOGNISED_DEPOT];

// Depots for a scope, sorted by name. "national" and the 9 real geographic regions exclude
// synthetic depots (Indirect Sales, Unrecognised Shops, etc.) same as always. Any other scope
// value -- currently just "Indirect", its own single-depot region -- is a synthetic depot's
// own `region` column, so the exclusion is skipped there instead of it matching nothing.
export function depotsForScope(depots, scope) {
  let list = Object.values(depots);
  if (scope === "national" || REGION_ORDER.includes(scope)) list = list.filter((d) => !d.isSynthetic);
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

// Daily Submission = depot-held stock the Stock Controller reports each day, by model, that
// has NOT yet been handed to a DSR (that's what "Devices at Depot" is, as distinct from the
// device ledger's "Devices with DSRs"). This rolls up each active depot's *latest* on-file
// submission for a scope: totals, a by-model breakdown, and one row per depot for a
// "Depot Performance" table -- the same shape as the standalone Central Region tracker.
export function submissionLatestStatsForScope(data, scope) {
  const depots = activeDepots(depotsForScope(data.depots, scope));
  const bySku = {};
  SUBMISSION_MODELS.forEach((m) => { bySku[m] = { total: 0, aged: 0 }; });
  let total = 0, aged = 0, depotsReported = 0;
  const perDepot = depots.map((d) => {
    const latest = latestSubmissionForDepot(data.submissionsByDepot, d.code);
    if (!latest) return { depot: d, latest: null, totals: null, pctAged: null };
    depotsReported++;
    const t = submissionTotals(latest);
    total += t.totalStock;
    aged += t.agedStock;
    SUBMISSION_MODELS.forEach((m) => {
      const row = latest.models && latest.models[m];
      bySku[m].total += row ? Number(row.totalStock) || 0 : 0;
      bySku[m].aged += row ? Number(row.agedStock) || 0 : 0;
    });
    return { depot: d, latest, totals: t, pctAged: t.totalStock > 0 ? Math.round((t.agedStock / t.totalStock) * 1000) / 10 : 0 };
  });
  return {
    total, aged, pctAged: total > 0 ? Math.round((aged / total) * 1000) / 10 : null,
    depotsReported, totalDepots: depots.length, bySku, perDepot,
  };
}
// Daily Submission history for a scope, one row per calendar date that has at least one
// depot's entry -- each row sums every depot that reported that day (by model, and overall),
// mirroring the Central Region tracker's "Daily Totals" table. Most recent date first.
export function submissionDailyTotalsForScope(data, scope, maxDays) {
  const depots = activeDepots(depotsForScope(data.depots, scope));
  const byDate = {};
  depots.forEach((d) => {
    (data.submissionsByDepot[d.code] || []).forEach((entry) => {
      const bucket = byDate[entry.date] || (byDate[entry.date] = { depotCodes: new Set(), models: {}, total: 0, aged: 0 });
      bucket.depotCodes.add(d.code);
      const t = submissionTotals(entry);
      bucket.total += t.totalStock;
      bucket.aged += t.agedStock;
      SUBMISSION_MODELS.forEach((m) => {
        const row = entry.models && entry.models[m];
        const cur = bucket.models[m] || (bucket.models[m] = { total: 0, aged: 0 });
        cur.total += row ? Number(row.totalStock) || 0 : 0;
        cur.aged += row ? Number(row.agedStock) || 0 : 0;
      });
    });
  });
  let dates = Object.keys(byDate).sort().reverse();
  if (maxDays) dates = dates.slice(0, maxDays);
  return dates.map((date) => {
    const b = byDate[date];
    return {
      date, depotsReporting: b.depotCodes.size, totalDepots: depots.length,
      models: b.models, total: b.total, aged: b.aged,
      pctAged: b.total > 0 ? Math.round((b.aged / b.total) * 1000) / 10 : 0,
    };
  });
}

// Rolls up the latest weekly PSDSR entries (data.psdsrByDepot) across a scope's depots --
// depotsReporting/totalDepots lets a caller show "X of Y depots reporting" rather than
// silently treating a depot with no entry yet as 0%.
export function psdsrStatsForScope(data, scope) {
  const depots = depotsForScope(data.depots, scope);
  let total = 0, sufficient = 0, depotsReporting = 0;
  depots.forEach((d) => {
    const row = data.psdsrByDepot[d.code];
    if (!row) return;
    total += row.total;
    sufficient += row.sufficient;
    depotsReporting++;
  });
  return { total, sufficient, depotsReporting, totalDepots: depots.length, pct: total ? Math.round((sufficient / total) * 1000) / 10 : null };
}

// Inventory Accuracy has no underlying counted/matched totals to weight by (the source
// tracker only carries the already-computed percentage) -- the scope figure is a plain
// average across the depots that have an entry, not a weighted rollup like PSDSR's.
export function inventoryAccuracyStatsForScope(data, scope) {
  const depots = depotsForScope(data.depots, scope);
  let sum = 0, depotsReporting = 0;
  depots.forEach((d) => {
    const row = data.inventoryAccuracyByDepot[d.code];
    if (!row) return;
    sum += row.pct;
    depotsReporting++;
  });
  return { depotsReporting, totalDepots: depots.length, pct: depotsReporting ? Math.round((sum / depotsReporting) * 10) / 10 : null };
}

// Indirect Stock Accuracy -- same "plain average across whoever has an entry" rule as
// Inventory Accuracy above, but over the indirect_shops registry (partner shops have no
// depot_code, so they aren't part of depotsForScope at all) plus a staleness flag: the
// underlying tracker has a history of going dark for months at a time (see the
// indirect_accuracy_tracking migration's seed data), so callers need to know not just the
// number but how old it is before presenting it as current.
const INDIRECT_STALE_DAYS = 30;
export function indirectAccuracyStats(data) {
  const shops = Object.values(data.indirectShops || {});
  let sum = 0, shopsReporting = 0, latestDate = null;
  shops.forEach((s) => {
    const row = data.indirectAccuracyByShop[s.code];
    if (!row) return;
    sum += row.pct;
    shopsReporting++;
    if (!latestDate || row.periodDate > latestDate) latestDate = row.periodDate;
  });
  const pct = shopsReporting ? Math.round((sum / shopsReporting) * 10) / 10 : null;
  let daysStale = null;
  if (latestDate) {
    const diffMs = new Date(todayStr() + "T00:00:00") - new Date(latestDate + "T00:00:00");
    daysStale = Math.round(diffMs / 86400000);
  }
  return { shopsReporting, totalShops: shops.length, pct, latestDate, daysStale, stale: daysStale === null || daysStale > INDIRECT_STALE_DAYS };
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
