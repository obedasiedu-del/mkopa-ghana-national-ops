"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { EmptyRow, LedgerAgingBadge } from "../components/ui.js";
import { ledgerDevicesForScope, depotsForScope, depotRecordForLedger } from "../lib/selectors.js";
import { canWriteDepot } from "../data/useAuth.js";

export function SearchPage() {
  const { data, auth, route, goDepot, runAction } = useApp();
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

  const setBy = (auth.user && auth.user.email) || "—";
  function setStatus(dv, newStatus, msg) {
    runAction(() => data.updateDeviceStatus(dv.depotCode, dv.serial, newStatus, setBy), msg);
  }

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
          React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Serial"), React.createElement("th", null, "Depot"), React.createElement("th", null, "DSR"), React.createElement("th", null, "Aging / Status"), React.createElement("th", null, "Actions"))),
          React.createElement("tbody", null,
            deviceMatches.length === 0 && React.createElement(EmptyRow, { colSpan: 5 }, "No devices match."),
            deviceMatches.map((dv) => {
              const depotRegion = depotRecordForLedger(data.depots, dv.depotCode)?.region;
              const canWrite = canWriteDepot(auth.role, dv.depotCode, depotRegion);
              return React.createElement("tr", { key: dv.depotCode + dv.serial },
                React.createElement("td", { className: "mono clickable", onClick: () => goDepot(dv.depotCode, "devices") }, dv.serial),
                React.createElement("td", { className: "clickable", onClick: () => goDepot(dv.depotCode, "devices") }, dv.depotName || dv.depotCode),
                React.createElement("td", null, dv.dsrName || "—"),
                React.createElement("td", null, React.createElement(LedgerAgingBadge, { device: dv })),
                React.createElement("td", null,
                  canWrite && React.createElement("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } },
                    dv.status !== "reallocated" && React.createElement("button", { className: "btn btn-sm", onClick: () => setStatus(dv, "reallocated", "Device marked reallocated") }, "Reallocated"),
                    dv.status !== "returned" && React.createElement("button", { className: "btn btn-sm", onClick: () => setStatus(dv, "returned", "Device marked returned") }, "Returned"),
                    dv.status !== "sold" && React.createElement("button", { className: "btn btn-sm", onClick: () => setStatus(dv, "sold", "Device marked sold") }, "Sold"),
                    dv.status !== "in_stock" && React.createElement("button", { className: "btn btn-sm", onClick: () => setStatus(dv, "in_stock", "Device reinstated") }, "Reinstate"))));
            })))),
      React.createElement("div", { className: "section-heading" }, "DSRs (", dsrMatches.length, ")"),
      React.createElement("div", { className: "table-wrap" },
        React.createElement("table", null,
          React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "DSR"), React.createElement("th", null, "Depot"))),
          React.createElement("tbody", null,
            dsrMatches.length === 0 && React.createElement(EmptyRow, { colSpan: 2 }, "No DSRs match."),
            dsrMatches.map((dv) => React.createElement("tr", { key: dv.depotCode + dv.dsrName, className: "clickable", onClick: () => goDepot(dv.depotCode, "devices") },
              React.createElement("td", null, dv.dsrName), React.createElement("td", null, dv.depotName || dv.depotCode))))))));
}
