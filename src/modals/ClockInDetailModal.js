"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, Pill, KpiTile } from "../components/ui.js";
import { fmtDateTime, clockInIsLate, mapsLinkForCoords, downloadCsv, todayStr } from "../lib/domain.js";
import { depotsForScope, activeDepots } from "../lib/selectors.js";

// Read-only: which Stock Controllers clocked in on a given day, and when -- behind the
// Clock-In KPI card, same "tap the tile, see the names" pattern as PsdsrDetailModal. `scope`
// is either "national"/a region name (roll-up view) or a single depot's own code (the Clock-In
// card on DepotViewingAsOfSection uses rec.code directly, since depotsForScope has no notion
// of a single-depot scope).
//
// Defaults to today (the live, realtime-synced data already held in clockInsByDepot); picking
// a past date fetches that one day on demand via fetchClockInsForDate instead -- this is the
// permanent record a Stock Controller's clock-in writes (exact time + GPS), which already
// exists in the database for every past day, this just gives it a way to be looked back at.
// depots.sc_status (On Leave/Vacant) is a live field, not date-stamped, so that distinction
// only applies to today -- a past date with no entry just reads "No entry", not "On Leave".
export function ClockInDetailModal({ scope }) {
  const { data, closeModal } = useApp();
  const singleDepot = data.depots[scope] || null;
  const depots = singleDepot ? [singleDepot] : activeDepots(depotsForScope(data.depots, scope));

  const [viewDate, setViewDate] = React.useState(todayStr());
  const isToday = viewDate === todayStr();
  const [pastEntries, setPastEntries] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (isToday) { setPastEntries(null); return; }
    let cancelled = false;
    setLoading(true);
    data.fetchClockInsForDate(viewDate, singleDepot ? { depotCode: singleDepot.code } : { depotCodes: depots.map((d) => d.code) })
      .then((map) => { if (!cancelled) setPastEntries(map); })
      .catch(() => { if (!cancelled) setPastEntries({}); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, viewDate, isToday, singleDepot, depots.map((d) => d.code).join(",")]);
  const entriesMap = isToday ? data.clockInsByDepot : (pastEntries || {});

  const rows = depots
    .map((d) => {
      const entry = entriesMap[d.code] || null;
      const away = isToday && !entry && (d.scStatus === "leave" || d.scStatus === "vacant");
      return {
        depot: d, entry, late: entry ? clockInIsLate(entry.clockedInAt) : null, away,
        awayLabel: d.scStatus === "leave" ? "On Leave" : "Vacant",
        noEntryLabel: isToday ? "Not yet" : "No entry",
      };
    })
    .sort((a, b) => a.depot.name.localeCompare(b.depot.name));
  const clockedIn = rows.filter((r) => r.entry);
  const onTime = clockedIn.filter((r) => !r.late);
  const late = clockedIn.filter((r) => r.late);
  const onLeave = rows.filter((r) => r.away);
  const expected = rows.length - onLeave.length;

  function exportCsv() {
    const out = [["Depot", "Stock Controller", "Time", "Status", "Latitude", "Longitude", "Accuracy (m)"]];
    rows.forEach((r) => out.push([
      r.depot.name, r.depot.scName || "", r.entry ? fmtDateTime(r.entry.clockedInAt) : "",
      r.entry ? (r.late ? "Late" : "On time") : (r.away ? r.awayLabel : r.noEntryLabel),
      r.entry && r.entry.lat !== null ? r.entry.lat : "", r.entry && r.entry.lng !== null ? r.entry.lng : "",
      r.entry && r.entry.accuracyM !== null ? Math.round(r.entry.accuracyM) : "",
    ]));
    downloadCsv((singleDepot ? singleDepot.name : scope) + "-clock-ins-" + viewDate + ".csv", out);
  }

  function renderRow(r) {
    let statusCell;
    if (r.entry) statusCell = React.createElement(Pill, { cls: r.late ? "pill-warning" : "pill-success" }, r.late ? "Late" : "On time");
    else if (r.away) statusCell = React.createElement(Pill, { cls: "pill-muted" }, r.awayLabel);
    else statusCell = React.createElement(Pill, { cls: "pill-muted" }, r.noEntryLabel);
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

  const dateBar = React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 } },
    React.createElement("span", { style: { fontSize: 12.5, color: "var(--text-muted)" } }, "Viewing"),
    React.createElement("input", { type: "date", className: "field-input", style: { width: "auto" }, value: viewDate, max: todayStr(), onChange: (e) => setViewDate(e.target.value || todayStr()) }),
    !isToday && React.createElement("button", { className: "btn btn-sm", onClick: () => setViewDate(todayStr()) }, "Latest"),
    loading && React.createElement("span", { style: { fontSize: 12, color: "var(--text-faint)" } }, "Loading…"));

  const body = rows.length === 0
    ? React.createElement(React.Fragment, null, dateBar, React.createElement("div", { style: { padding: 10, color: "var(--text-faint)", fontSize: 12.5 } }, "No active depots in scope."))
    : React.createElement(React.Fragment, null,
      dateBar,
      React.createElement("div", { className: "kpi-grid", style: { marginBottom: 14 } },
        React.createElement(KpiTile, { label: "Depots", value: rows.length }),
        React.createElement(KpiTile, { label: "Clocked in", value: clockedIn.length + " / " + expected, foot: onLeave.length ? onLeave.length + " on leave/vacant, excluded" : undefined }),
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
