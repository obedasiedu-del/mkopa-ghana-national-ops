"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, LedgerAgingBadge } from "../components/ui.js";
import { ledgerDevicesForScope } from "../lib/selectors.js";
import { daysAllocated, agingDate } from "../lib/domain.js";

export function AgentLedgerModal({ group, scope = "national" }) {
  const { data, closeModal, runAction } = useApp();
  const [setBy, setSetBy] = React.useState("");
  const devices = ledgerDevicesForScope(data.deviceLedger, data.depots, scope)
    .filter((dv) => ((dv.dsrName || "").trim() || "(No DSR listed)") === group.name)
    .sort((a, b) => (daysAllocated(agingDate(b)) || 0) - (daysAllocated(agingDate(a)) || 0));
  return React.createElement(Modal, { open: true, onClose: closeModal, wide: true, title: group.name, footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Close") },
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Set by (your name)"),
      React.createElement("input", { className: "field-input", value: setBy, onChange: (e) => setSetBy(e.target.value) })),
    devices.length === 0
      ? React.createElement("div", { style: { padding: "16px 0", color: "var(--text-faint)", fontSize: 12.5 } }, "No devices found for this agent in the current scope.")
      : React.createElement("div", { style: { overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8, maxHeight: 360, overflowY: "auto" } },
        React.createElement("table", null,
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", null, "Serial"), React.createElement("th", null, "Product"), React.createElement("th", null, "Depot"),
              React.createElement("th", null, "Shop"), React.createElement("th", null, "Aging / Status"), React.createElement("th", null, "Actions"))),
          React.createElement("tbody", null, devices.map((dv) => React.createElement("tr", { key: dv.depotCode + dv.serial },
            React.createElement("td", { className: "mono" }, dv.serial),
            React.createElement("td", null, dv.model || "—"),
            React.createElement("td", null, dv.depotName || dv.depotCode || "—"),
            React.createElement("td", null, dv.shopName || "—"),
            React.createElement("td", null, React.createElement(LedgerAgingBadge, { device: dv })),
            React.createElement("td", null,
              React.createElement("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } },
                dv.status !== "reallocated" && React.createElement("button", { className: "btn btn-sm", onClick: () => runAction(() => data.updateDeviceStatus(dv.depotCode, dv.serial, "reallocated", setBy || "—"), "Device marked reallocated") }, "Mark Reallocated"),
                dv.status !== "returned" && React.createElement("button", { className: "btn btn-sm", onClick: () => runAction(() => data.updateDeviceStatus(dv.depotCode, dv.serial, "returned", setBy || "—"), "Device marked returned") }, "Mark Returned"),
                dv.status !== "sold" && React.createElement("button", { className: "btn btn-sm", onClick: () => runAction(() => data.updateDeviceStatus(dv.depotCode, dv.serial, "sold", setBy || "—"), "Device marked sold") }, "Mark Sold"),
                dv.status !== "in_stock" && React.createElement("button", { className: "btn btn-sm", onClick: () => runAction(() => data.updateDeviceStatus(dv.depotCode, dv.serial, "in_stock", setBy || "—"), "Device reinstated") }, "Reinstate")))))))));
}
