"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, Pill, KpiTile } from "../components/ui.js";
import { fmtDateShort, downloadCsv } from "../lib/domain.js";

// Read-only: the per-DSR names + status behind one depot's PSDSR number, from the most
// recent daily upload. Non-productive DSRs are shown too (greyed status) so a manager can
// see who's missing from the ratio entirely, not just who's short on stock.
export function PsdsrDetailModal({ depotCode }) {
  const { data, closeModal } = useApp();
  const rec = data.depots[depotCode];
  const rows = (data.psdsrDsrsByDepot[depotCode] || []).slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
  const psdsrRow = data.psdsrByDepot[depotCode];
  const productive = rows.filter((r) => r.isProductive);
  const sufficient = productive.filter((r) => r.isSufficient);

  function exportCsv() {
    const out = [["Name", "Phone", "Sales (L7)", "QoS", "Stock Yesterday", "Productive", "Sufficient Stock"]];
    rows.forEach((r) => out.push([r.fullName, r.phoneNumber, r.acquisitionSalesL7, r.qosOnDay ?? "", r.stockYesterday, r.isProductive ? "Yes" : "No", r.isProductive ? (r.isSufficient ? "Yes" : "No") : "—"]));
    downloadCsv((rec ? rec.name : depotCode) + "-psdsr-dsrs.csv", out);
  }

  function renderRow(r) {
    const productiveCell = r.isProductive
      ? React.createElement(Pill, { cls: "pill-success" }, "Productive")
      : React.createElement(Pill, { cls: "pill-muted" }, "Not productive");
    let sufficientCell;
    if (!r.isProductive) sufficientCell = React.createElement("span", { style: { color: "var(--text-faint)" } }, "—");
    else if (r.isSufficient) sufficientCell = React.createElement(Pill, { cls: "pill-success" }, "Sufficient");
    else sufficientCell = React.createElement(Pill, { cls: "pill-critical" }, "Insufficient");
    return React.createElement("tr", { key: r.salesAgentId },
      React.createElement("td", null, r.fullName),
      React.createElement("td", { className: "mono", style: { fontSize: 12 } }, r.phoneNumber || "—"),
      React.createElement("td", { className: "num mono" }, r.acquisitionSalesL7),
      React.createElement("td", { className: "num mono" }, r.stockYesterday),
      React.createElement("td", null, productiveCell),
      React.createElement("td", null, sufficientCell));
  }

  const body = rows.length === 0
    ? React.createElement("div", { style: { padding: 10, color: "var(--text-faint)", fontSize: 12.5 } }, "No PSDSR upload on file for this depot yet.")
    : React.createElement(React.Fragment, null,
      React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 12 } },
        psdsrRow ? "As of " + fmtDateShort(psdsrRow.periodDate) + (psdsrRow.enteredBy ? " · entered by " + psdsrRow.enteredBy : "") : ""),
      React.createElement("div", { className: "kpi-grid", style: { marginBottom: 14 } },
        React.createElement(KpiTile, { label: "DSRs on roster", value: rows.length }),
        React.createElement(KpiTile, { label: "Productive", value: productive.length }),
        React.createElement(KpiTile, { label: "Sufficient stock", value: sufficient.length + " / " + productive.length })),
      React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 } },
        React.createElement("button", { className: "btn btn-sm", onClick: exportCsv }, "📥 Export (CSV)")),
      React.createElement("div", { className: "table-wrap", style: { maxHeight: 420, overflowY: "auto" } },
        React.createElement("table", null,
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", null, "Name"),
              React.createElement("th", null, "Phone"),
              React.createElement("th", { className: "num" }, "Sales (L7)"),
              React.createElement("th", { className: "num" }, "Stock (Yday)"),
              React.createElement("th", null, "Productive"),
              React.createElement("th", null, "Sufficient Stock"))),
          React.createElement("tbody", null, rows.map(renderRow)))));

  return React.createElement(Modal, {
    open: true, onClose: closeModal, xwide: true,
    title: "PSDSR — " + (rec ? rec.name : depotCode),
    footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Close"),
  }, body);
}
