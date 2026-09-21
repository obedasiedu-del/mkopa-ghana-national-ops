"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { ScStatusPill, ScoreCell } from "./ui.js";
import { DataTable } from "./DataTable.js";

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
  { key: "scScore", label: "Score", sortable: true, numeric: true, sortValue: (d) => d.scScore ?? -1, render: (d) => React.createElement(ScoreCell, { score: d.scScore }) },
];

export function DepotTable({ depots }) {
  const { search, goDepot } = useApp();
  const q = search.trim().toLowerCase();
  const filtered = depots.filter((d) => !q || (d.name + " " + d.code + " " + d.scName).toLowerCase().includes(q));
  return React.createElement(DataTable, {
    columns: COLUMNS, rows: filtered, rowKey: (d) => d.code, onRowClick: (d) => goDepot(d.code),
    emptyMessage: "No depots match your search.", defaultSortKey: "name",
  });
}
