"use strict";
import { INDIRECT_DEPOT, UNRECOGNISED_DEPOT, deviceTotals, countsForDevices, submissionTotals, todayStr } from "./domain.js";

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
// Rolled-up KPIs for a scope (national or one region): active depots, SC coverage, devices
// tracked at depot, device-ledger aging counts, and today's daily-submission coverage.
export function overviewStats(data, scope) {
  const depots = depotsForScope(data.depots, scope);
  const active = activeDepots(depots);
  const filled = active.filter((d) => d.scStatus === "active");
  let deviceTotal = 0;
  depots.forEach((d) => { deviceTotal += deviceTotals(data.depotStock[d.code]).total; });
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

export function auditForScope(auditLog, depots, scope) {
  const codes = new Set(depotsForScope(depots, scope).map((d) => d.code));
  if (scope === "national") return auditLog;
  return auditLog.filter((a) => codes.has(a.depotCode));
}
