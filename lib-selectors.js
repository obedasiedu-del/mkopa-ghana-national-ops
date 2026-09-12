"use strict";
const PSEUDO_DEPOTS = [INDIRECT_DEPOT, UNRECOGNISED_DEPOT];
// Real (non-synthetic) depots, optionally filtered to one territory, sorted by name.
function depotsForScope(depots, scope) {
    let list = Object.values(depots).filter((d) => !d.isSynthetic);
    if (scope !== "national")
        list = list.filter((d) => d.territory === scope);
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
}
function activeDepots(list) {
    return list.filter((d) => d.status === "active");
}
function ccesForScope(cces, depots, scope) {
    let list = Object.values(cces).map((c) => {
        const d = depots[c.depotCode];
        return { ...c, depotName: d ? d.name : c.depotCode, territory: d ? d.territory : "" };
    });
    if (scope !== "national")
        list = list.filter((c) => c.territory === scope);
    return list;
}
// Ledger scope includes the two pseudo buckets, but only at national scope.
function ledgerDepotsForScope(depots, scope) {
    const list = depotsForScope(depots, scope);
    return scope === "national" ? list.concat(PSEUDO_DEPOTS) : list;
}
function depotRecordForLedger(depots, code) {
    const pseudo = PSEUDO_DEPOTS.find((p) => p.code === code);
    return pseudo || depots[code] || null;
}
function ledgerDevices(deviceLedger, depotCode) {
    return deviceLedger[depotCode] || [];
}
// All devices in scope, each tagged with its depot code/name — used by the by-agent view.
function ledgerDevicesForScope(deviceLedger, depots, scope) {
    const out = [];
    ledgerDepotsForScope(depots, scope).forEach((d) => {
        ledgerDevices(deviceLedger, d.code).forEach((dv) => out.push({ ...dv, depotCode: d.code, depotName: d.name }));
    });
    return out;
}
