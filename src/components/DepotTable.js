"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { ScStatusPill, ScoreCell } from "./ui.js";
import { DataTable } from "./DataTable.js";
import { ledgerDevices, latestSubmissionForDepot } from "../lib/selectors.js";
import { countsForDevices, submissionTotals, fmtNum, trueAgePct, psdsrPct, computeScScore } from "../lib/domain.js";

// Region-level view of the same per-depot device/aging figures the depot page itself shows
// (Devices at Depot from the daily submission, 14+ Days from the device ledger) -- without
// these columns, seeing which depots are actually carrying aged stock meant clicking into
// each one individually.
const COLUMNS = [
  {
    key: "name", label: "Depot", sortable: true,
    render: (d) => React.createElement("div", { className: "depot-name-cell" },
      React.createElement("span", null, d.name),
      React.createElement("span", { className: "code" }, d.code, d.status === "closed" ? " · closed" : "")),
  },
  { key: "region", label: "Region", sortable: true },
  {
    key: "scName", label: "Stock Controller", sortable: true,
    render: (d) => d.scName || React.createElement("span", { style: { color: "var(--text-faint)" } }, "Unassigned"),
  },
  { key: "scStatus", label: "Status", sortable: true, render: (d) => React.createElement(ScStatusPill, { status: d.scStatus }) },
  { key: "scScore", label: "SC Score", sortable: true, numeric: true, sortValue: (d) => d._scScore ?? -1, render: (d) => React.createElement(ScoreCell, { score: d._scScore }) },
  {
    key: "devicesAtDepot", label: "Devices at Depot", sortable: true, numeric: true,
    sortValue: (d) => d._devicesAtDepot ?? -1, render: (d) => d._devicesAtDepot === null ? "—" : fmtNum(d._devicesAtDepot),
  },
  {
    key: "aged14", label: "Aged (14+d)", sortable: true, numeric: true,
    sortValue: (d) => d._aged14, render: (d) => React.createElement("span", { style: d._aged14 > 0 ? { color: "var(--critical)", fontWeight: 600 } : undefined }, fmtNum(d._aged14)),
  },
  {
    key: "trueAge", label: "True Age", sortable: true, numeric: true,
    sortValue: (d) => d._trueAge ?? -1, render: (d) => (d._trueAge === null ? "—" : d._trueAge + "%"),
  },
  {
    key: "psdsr", label: "PSDSR", sortable: true, numeric: true,
    sortValue: (d) => d._psdsr ?? -1, render: (d) => (d._psdsr === null ? "—" : d._psdsr + "%"),
  },
  {
    key: "inventoryAccuracy", label: "Inventory Accuracy", sortable: true, numeric: true,
    sortValue: (d) => d._inventoryAccuracy ?? -1, render: (d) => (d._inventoryAccuracy === null ? "—" : d._inventoryAccuracy + "%"),
  },
];

export function DepotTable({ depots }) {
  const { data, search, goDepot } = useApp();
  const q = search.trim().toLowerCase();
  const enriched = React.useMemo(() => depots.map((d) => {
    const latest = latestSubmissionForDepot(data.submissionsByDepot, d.code);
    const ledgerCounts = countsForDevices(ledgerDevices(data.deviceLedger, d.code));
    const invAccRow = data.inventoryAccuracyByDepot[d.code];
    const trueAge = trueAgePct(ledgerCounts);
    const psdsrRow = data.psdsrByDepot[d.code];
    return {
      ...d, _devicesAtDepot: latest ? submissionTotals(latest).totalStock : null, _aged14: ledgerCounts.urgent,
      _trueAge: trueAge, _psdsr: psdsrPct(psdsrRow),
      _inventoryAccuracy: invAccRow ? invAccRow.pct : null,
      _scScore: computeScScore({ trueAgePctVal: trueAge, psdsrRow, inventoryAccuracyRow: invAccRow }),
    };
  }), [depots, data.submissionsByDepot, data.deviceLedger, data.psdsrByDepot, data.inventoryAccuracyByDepot]);
  const filtered = enriched.filter((d) => !q || (d.name + " " + d.code + " " + d.scName).toLowerCase().includes(q));
  return React.createElement(DataTable, {
    columns: COLUMNS, rows: filtered, rowKey: (d) => d.code, onRowClick: (d) => goDepot(d.code),
    emptyMessage: "No depots match your search.", defaultSortKey: "name",
  });
}
