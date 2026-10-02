"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, Pill, KpiTile } from "../components/ui.js";
import { fmtDateTime, clockInIsLate, mapsLinkForCoords, downloadCsv } from "../lib/domain.js";
import { depotsForScope, activeDepots } from "../lib/selectors.js";

// Read-only: which Stock Controllers have clocked in today, and when, behind the Clock-In
// KPI card -- same "tap the tile, see the names" pattern as PsdsrDetailModal. `scope` is
// either "national"/a region name (roll-up view) or a single depot's own code (the Clock-In
// card on DepotViewingAsOfSection uses rec.code directly, since depotsForScope has no notion
// of a single-depot scope).
export function ClockInDetailModal({ scope }) {
  const { data, closeModal } = useApp();
  const singleDepot = data.depots[scope] || null;
  const depots = singleDepot ? [singleDepot] : activeDepots(depotsForScope(data.depots, scope));
  const rows = depots
    .map((d) => {
      const entry = data.clockInsByDepot[d.code] || null;
      return { depot: d, entry, late: entry ? clockInIsLate(entry.clockedInAt) : null };
    })
    .sort((a, b) => a.depot.name.localeCompare(b.depot.name));
  const clockedIn = rows.filter((r) => r.entry);
  const onTime = clockedIn.filter((r) => !r.late);
  const late = clockedIn.filter((r) => r.late);

  function exportCsv() {
    const out = [["Depot", "Stock Controller", "Time", "Status", "Latitude", "Longitude", "Accuracy (m)"]];
    rows.forEach((r) => out.push([
      r.depot.name, r.depot.scName || "", r.entry ? fmtDateTime(r.entry.clockedInAt) : "",
      !r.entry ? "Not yet" : (r.late ? "Late" : "On time"),
      r.entry && r.entry.lat !== null ? r.entry.lat : "", r.entry && r.entry.lng !== null ? r.entry.lng : "",
      r.entry && r.entry.accuracyM !== null ? Math.round(r.entry.accuracyM) : "",
    ]));
    downloadCsv((singleDepot ? singleDepot.name : scope) + "-clock-ins.csv", out);
  }

  function renderRow(r) {
    let statusCell;
    if (!r.entry) statusCell = React.createElement(Pill, { cls: "pill-muted" }, "Not yet");
    else if (r.late) statusCell = React.createElement(Pill, { cls: "pill-warning" }, "Late");
    else statusCell = React.createElement(Pill, { cls: "pill-success" }, "On time");
    const mapsLink = r.entry ? mapsLinkForCoords(r.entry.lat, r.entry.lng) : null;
    let locationCell;
    if (!r.entry) locationCell = React.createElement("span", { style: { color: "var(--text-faint)" } }, "—");
    else if (mapsLink) locationCell = React.createElement("a", { href: mapsLink, target: "_blank", rel: "noreferrer" }, "📍 View");
    else locationCell = React.createElement("span", { style: { color: "var(--text-faint)" } }, "No location shared");
    return React.createElement("tr", { key: r.depot.code },
      React.createElement("td", null, r.depot.name),
      React.createElement("td", null, r.depot.scName || "—"),
      React.createElement("td", { className: "mono", style: { fontSize: 12 } }, r.entry ? fmtDateTime(r.entry.clockedInAt) : "—"),
      React.createElement("td", null, statusCell),
      React.createElement("td", null, locationCell));
  }

  const body = rows.length === 0
    ? React.createElement("div", { style: { padding: 10, color: "var(--text-faint)", fontSize: 12.5 } }, "No active depots in scope.")
    : React.createElement(React.Fragment, null,
      React.createElement("div", { className: "kpi-grid", style: { marginBottom: 14 } },
        React.createElement(KpiTile, { label: "Depots", value: rows.length }),
        React.createElement(KpiTile, { label: "Clocked in", value: clockedIn.length + " / " + rows.length }),
        React.createElement(KpiTile, { label: "On time / Late", value: onTime.length + " / " + late.length })),
      React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 } },
        React.createElement("button", { className: "btn btn-sm", onClick: exportCsv }, "📥 Export (CSV)")),
      React.createElement("div", { className: "table-wrap", style: { maxHeight: 420, overflowY: "auto" } },
        React.createElement("table", null,
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", null, "Depot"),
              React.createElement("th", null, "Stock Controller"),
              React.createElement("th", null, "Time"),
              React.createElement("th", null, "Status"),
              React.createElement("th", null, "Location"))),
          React.createElement("tbody", null, rows.map(renderRow)))));

  return React.createElement(Modal, {
    open: true, onClose: closeModal, xwide: true,
    title: "Clock-In — " + (singleDepot ? singleDepot.name : (scope === "national" ? "National" : scope)),
    footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Close"),
  }, body);
}
