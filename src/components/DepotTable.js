"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { EmptyRow, ScStatusPill, ScoreCell } from "./ui.js";

export function DepotTable({ depots }) {
  const { search, goDepot } = useApp();
  const q = search.trim().toLowerCase();
  const filtered = depots.filter((d) => !q || (d.name + " " + d.code + " " + d.scName).toLowerCase().includes(q));
  return React.createElement("div", { className: "table-wrap" },
    React.createElement("table", null,
      React.createElement("thead", null,
        React.createElement("tr", null,
          React.createElement("th", null, "Depot"),
          React.createElement("th", null, "Region"),
          React.createElement("th", null, "Stock Controller"),
          React.createElement("th", null, "Status"),
          React.createElement("th", null, "Score"))),
      React.createElement("tbody", null,
        filtered.length === 0 && React.createElement(EmptyRow, { colSpan: 5 }, "No depots match your search."),
        filtered.map((d) => React.createElement("tr", { key: d.code, className: "clickable", onClick: () => goDepot(d.code) },
          React.createElement("td", null,
            React.createElement("div", { className: "depot-name-cell" },
              React.createElement("span", null, d.name),
              React.createElement("span", { className: "code" }, d.code, d.status === "closed" ? " · closed" : ""))),
          React.createElement("td", null, d.region),
          React.createElement("td", null, d.scName || React.createElement("span", { style: { color: "var(--text-faint)" } }, "Unassigned")),
          React.createElement("td", null, React.createElement(ScStatusPill, { status: d.scStatus })),
          React.createElement("td", null, React.createElement(ScoreCell, { score: d.scScore })))))));
}
