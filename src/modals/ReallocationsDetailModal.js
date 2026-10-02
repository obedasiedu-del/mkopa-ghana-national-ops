"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, Pill } from "../components/ui.js";
import { isDsrReassignmentRow, downloadCsv, fmtDateTime } from "../lib/domain.js";
import { ledgerDepotsForScope } from "../lib/selectors.js";

// Read-only drill-down behind the Reallocated (DSR) tile: which serials moved to a different
// DSR today, from whom, to whom, when. `scope` is "national"/a region name, or a single
// depot's own code (same dual-mode trick as ClockInDetailModal/PsdsrDetailModal). Fetches
// its own slice of audit_log on open rather than reading from global state -- see
// ReallocationTile's comment for why.
export function ReallocationsDetailModal({ scope }) {
  const { data, closeModal } = useApp();
  const singleDepot = data.depots[scope] || null;
  const depotCodes = React.useMemo(
    () => (singleDepot ? [singleDepot.code] : ledgerDepotsForScope(data.depots, scope).map((d) => d.code)),
    [data.depots, scope, singleDepot],
  );
  const [rows, setRows] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    data.fetchAuditLog({ depotCodes, sinceIso: since.toISOString(), limit: 3000 })
      .then((all) => { if (!cancelled) setRows(all.filter(isDsrReassignmentRow)); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, depotCodes.join(",")]);

  function exportCsv() {
    const out = [["Depot", "Serial", "From DSR", "To DSR", "Time"]];
    (rows || []).forEach((r) => out.push([
      (data.depots[r.depotCode] || {}).name || r.depotCode, r.newValue.serial,
      r.oldValue.dsr_name, r.newValue.dsr_name, fmtDateTime(r.occurredAt),
    ]));
    downloadCsv((singleDepot ? singleDepot.name : scope) + "-reallocations.csv", out);
  }

  function renderRow(r) {
    return React.createElement("tr", { key: r.id },
      !singleDepot && React.createElement("td", null, (data.depots[r.depotCode] || {}).name || r.depotCode),
      React.createElement("td", { className: "mono", style: { fontSize: 12 } }, r.newValue.serial),
      React.createElement("td", null, r.oldValue.dsr_name),
      React.createElement("td", null, React.createElement(Pill, { cls: "pill-warning" }, r.newValue.dsr_name)),
      React.createElement("td", { className: "mono", style: { fontSize: 12 } }, fmtDateTime(r.occurredAt)));
  }

  let body;
  if (loading) {
    body = React.createElement("div", { style: { padding: 10, color: "var(--text-faint)", fontSize: 12.5 } }, "Loading…");
  } else if (!rows || rows.length === 0) {
    body = React.createElement("div", { style: { padding: 10, color: "var(--text-faint)", fontSize: 12.5 } }, "No devices have moved to a different DSR today.");
  } else {
    body = React.createElement(React.Fragment, null,
      React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 12 } },
        rows.length, " device", rows.length === 1 ? "" : "s", " moved to a different DSR today — still active stock, aging continues as before."),
      React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 } },
        React.createElement("button", { className: "btn btn-sm", onClick: exportCsv }, "📥 Export (CSV)")),
      React.createElement("div", { className: "table-wrap", style: { maxHeight: 420, overflowY: "auto" } },
        React.createElement("table", null,
          React.createElement("thead", null,
            React.createElement("tr", null,
              !singleDepot && React.createElement("th", null, "Depot"),
              React.createElement("th", null, "Serial"),
              React.createElement("th", null, "From"),
              React.createElement("th", null, "To"),
              React.createElement("th", null, "Time"))),
          React.createElement("tbody", null, rows.map(renderRow)))));
  }

  return React.createElement(Modal, {
    open: true, onClose: closeModal, xwide: true,
    title: "Reallocated to Another DSR — " + (singleDepot ? singleDepot.name : (scope === "national" ? "National" : scope)),
    footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Close"),
  }, body);
}
