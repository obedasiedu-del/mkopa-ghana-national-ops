"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { EmptyRow, LedgerAgingBadge } from "../components/ui.js";
import { ledgerDevicesForScope, depotsForScope } from "../lib/selectors.js";

export function SearchPage() {
  const { data, route, goDepot } = useApp();
  const q = (route.query.q || "").trim().toLowerCase();

  const depotMatches = q ? depotsForScope(data.depots, "national").filter((d) =>
    (d.name + " " + d.code + " " + (d.scName || "")).toLowerCase().includes(q)) : [];
  const allDevices = q ? ledgerDevicesForScope(data.deviceLedger, data.depots, "national") : [];
  const deviceMatches = q ? allDevices.filter((dv) => (dv.serial || "").toLowerCase().includes(q)).slice(0, 100) : [];
  const dsrSet = new Set();
  const dsrMatches = q ? allDevices.filter((dv) => {
    const name = (dv.dsrName || "").toLowerCase();
    if (!name.includes(q) || dsrSet.has(name)) return false;
    dsrSet.add(name);
    return true;
  }).slice(0, 50) : [];

  return React.createElement("div", { className: "content" },
    React.createElement("div", { className: "scope-title" }, "Search results"),
    React.createElement("div", { className: "scope-sub", style: { marginBottom: 16 } }, q ? `"${route.query.q}"` : "Type in the search box above to look across depots, device serials and DSR names."),
    q && React.createElement(React.Fragment, null,
      React.createElement("div", { className: "section-heading" }, "Depots (", depotMatches.length, ")"),
      React.createElement("div", { className: "table-wrap", style: { marginBottom: 20 } },
        React.createElement("table", null,
          React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Depot"), React.createElement("th", null, "Region"), React.createElement("th", null, "Stock Controller"))),
          React.createElement("tbody", null,
            depotMatches.length === 0 && React.createElement(EmptyRow, { colSpan: 3 }, "No depots match."),
            depotMatches.slice(0, 30).map((d) => React.createElement("tr", { key: d.code, className: "clickable", onClick: () => goDepot(d.code) },
              React.createElement("td", null, d.name, " ", React.createElement("span", { className: "code" }, d.code)),
              React.createElement("td", null, d.region),
              React.createElement("td", null, d.scName || "—")))))),
      React.createElement("div", { className: "section-heading" }, "Devices by serial (", deviceMatches.length, ")"),
      React.createElement("div", { className: "table-wrap", style: { marginBottom: 20 } },
        React.createElement("table", null,
          React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Serial"), React.createElement("th", null, "Depot"), React.createElement("th", null, "DSR"), React.createElement("th", null, "Aging / Status"))),
          React.createElement("tbody", null,
            deviceMatches.length === 0 && React.createElement(EmptyRow, { colSpan: 4 }, "No devices match."),
            deviceMatches.map((dv) => React.createElement("tr", { key: dv.depotCode + dv.serial, className: "clickable", onClick: () => goDepot(dv.depotCode, "devices") },
              React.createElement("td", { className: "mono" }, dv.serial),
              React.createElement("td", null, dv.depotName || dv.depotCode),
              React.createElement("td", null, dv.dsrName || "—"),
              React.createElement("td", null, React.createElement(LedgerAgingBadge, { device: dv }))))))),
      React.createElement("div", { className: "section-heading" }, "DSRs (", dsrMatches.length, ")"),
      React.createElement("div", { className: "table-wrap" },
        React.createElement("table", null,
          React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "DSR"), React.createElement("th", null, "Depot"))),
          React.createElement("tbody", null,
            dsrMatches.length === 0 && React.createElement(EmptyRow, { colSpan: 2 }, "No DSRs match."),
            dsrMatches.map((dv) => React.createElement("tr", { key: dv.depotCode + dv.dsrName, className: "clickable", onClick: () => goDepot(dv.depotCode, "devices") },
              React.createElement("td", null, dv.dsrName), React.createElement("td", null, dv.depotName || dv.depotCode))))))));
}
