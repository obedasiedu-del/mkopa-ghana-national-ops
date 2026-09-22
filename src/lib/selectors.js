"use strict";
import { INDIRECT_DEPOT, UNRECOGNISED_DEPOT, countsForDevices, submissionTotals, todayStr } from "./domain.js";
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
// Devices at Depot totals for one depot: { received, issued, remaining } summed across models.
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
  depots.forEach((d) => { deviceTotal += depotStockTotals(data.stockBalances, d.code).remaining; });
  const ledgerDepots = ledgerDepotsForScope(data.depots, scope);
  let ledgerCounts = { total: 0, fresh: 0, projected: 0, aged: 0, urgent: 0, highrisk: 0, reallocated: 0, returned: 0 };
  ledgerDepots.forEach((d) => {
    const c = countsForDevices(ledgerDevices(data.deviceLedger, d.code));
    Object.keys(ledgerCounts).forEach((k) => { ledgerCounts[k] += c[k]; });
  });
  const today = todayStr();
  let submittedToday = 0;
  active.forEach((d) => {
    const days = data.submissionsByDepot[d.code] || [];
    if (days.some((s) => s.date === today)) submittedToday++;
  });
  return {
    activeDepots: active.length, totalDepots: depots.length,
    scFilled: filled.length, scVacant: active.length - filled.length,
    deviceTotal, ledgerCounts,
    submittedToday, expectedSubmissions: active.length,
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
