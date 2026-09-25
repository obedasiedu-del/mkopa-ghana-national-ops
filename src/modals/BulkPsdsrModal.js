"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, FieldInput } from "../components/ui.js";
import { depotsForScope } from "../lib/selectors.js";
import { parsePsdsrPaste, downloadCsv, todayStr } from "../lib/domain.js";

// Weekly PSDSR bulk paste -- one row per depot: Depot, Total PDSR, Sufficient Stocks. This
// is deliberately the exact shape the source system's own weekly export already produces
// (Depot | Total PDSR | Sufficient Stocks), so it can be pasted in as-is. Re-pasting for the
// same period date overwrites that depot's entry for the week rather than duplicating it.
export function BulkPsdsrModal() {
  const { data, closeModal, toast, runAction } = useApp();
  const depots = depotsForScope(data.depots, "national");
  const depotsLoaded = depots.length > 0;
  const [text, setText] = React.useState("");
  const [enteredBy, setEnteredBy] = React.useState("");
  const [periodDate, setPeriodDate] = React.useState(todayStr());
  const [summary, setSummary] = React.useState(null);
  const [parsing, setParsing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const parseTimerRef = React.useRef(null);
  function scheduleParse(value) {
    setParsing(true);
    clearTimeout(parseTimerRef.current);
    parseTimerRef.current = setTimeout(() => {
      if (!value.trim()) { setSummary(null); setParsing(false); return; }
      setSummary(parsePsdsrPaste(value, depots));
      setParsing(false);
    }, 200);
  }
  function onChange(e) { const value = e.target.value; setText(value); scheduleParse(value); }
  function save() {
    if (!enteredBy.trim()) { toast("Your name is required"); return; }
    if (!periodDate) { toast("A week/period date is required"); return; }
    setSaving(true);
    setTimeout(() => {
      const parsed = parsePsdsrPaste(text, depots);
      runAction(() => data.savePsdsrBulk(parsed.byDepot, enteredBy.trim(), periodDate), null)
        .then((count) => { toast("Saved PSDSR for " + count + " depot" + (count === 1 ? "" : "s")); closeModal(); })
        .catch(() => {})
        .finally(() => setSaving(false));
    }, 0);
  }
  function unmatchedDownload() {
    const rows = [["Depot (as pasted)", "Total PDSR", "Sufficient Stocks"]];
    summary.unmatchedRows.forEach((r) => rows.push([r.depotText, r.total, r.sufficient]));
    downloadCsv("unmatched-psdsr-rows.csv", rows);
  }
  const depotCodes = summary ? Object.keys(summary.byDepot) : [];
  const totalRows = summary ? depotCodes.length + summary.unmatchedRows.length : 0;
  const indirectRows = summary ? summary.unmatchedRows.filter((r) => r.reason.startsWith("Indirect")) : [];
  const trulyUnmatchedRows = summary ? summary.unmatchedRows.filter((r) => !r.reason.startsWith("Indirect")) : [];
  const trulyUnmatchedCounts = {};
  trulyUnmatchedRows.forEach((r) => { trulyUnmatchedCounts[r.depotText] = (trulyUnmatchedCounts[r.depotText] || 0) + 1; });
  return React.createElement(Modal, { open: true, onClose: closeModal, xwide: true, title: "Upload PSDSR — All Depots", footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel") },
    !depotsLoaded && React.createElement("div", { className: "banner", style: { marginBottom: 10 } },
      React.createElement("span", null, "⚠"),
      React.createElement("div", null, "The depot list hasn't finished loading yet — pasting now would match nothing. Close this, wait a couple seconds, then reopen.")),
    React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 } }, "Paste one row per depot — Depot (name or code), Total PDSR, Sufficient Stocks. Matches the weekly export exactly, so it can be pasted straight in. Re-pasting the same period below overwrites that depot's entry for the week, it does not add to it."),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Paste PSDSR rows (all depots)"),
      React.createElement("textarea", { className: "field-input", rows: 10, placeholder: "Kasoa Depot\t11\t3\nLapaz Depot\t23\t11", value: text, onChange })),
    React.createElement("div", { className: "field-grid" },
      React.createElement(FieldInput, { label: "Entered by (your name)", value: enteredBy, onChange: setEnteredBy }),
      React.createElement(FieldInput, { label: "Week / period date", value: periodDate, onChange: setPeriodDate, type: "date" })),
    React.createElement("div", { style: { fontSize: 12, margin: "4px 0 14px" } },
      parsing && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Parsing…"),
      !parsing && !summary && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Paste rows above to see a preview."),
      !parsing && summary && totalRows === 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Paste rows above to see a preview."),
      !parsing && summary && totalRows > 0 && React.createElement(React.Fragment, null,
        React.createElement("div", { style: { color: "var(--success)", fontWeight: 600, marginBottom: 4 } },
          depotCodes.length, " of ", totalRows, " pasted row", totalRows === 1 ? "" : "s", " matched to a depot."),
        indirectRows.length > 0 && React.createElement("div", { style: { color: "var(--text-muted)", marginTop: 2 } },
          indirectRows.length, " indirect-channel/partner-shop row", indirectRows.length === 1 ? "" : "s", " excluded (not a depot) — expected, not an error."),
        trulyUnmatchedRows.length > 0 && React.createElement("div", { style: { color: "var(--warning)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 } },
          React.createElement("span", null, trulyUnmatchedRows.length, " row", trulyUnmatchedRows.length === 1 ? "" : "s", " didn't match a depot — name", Object.keys(trulyUnmatchedCounts).length === 1 ? "" : "s", ": ", Object.keys(trulyUnmatchedCounts).slice(0, 8).join(", "), Object.keys(trulyUnmatchedCounts).length > 8 ? ", …" : "", "."),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: unmatchedDownload }, "📥 Download")),
        summary.skipped > 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, summary.skipped, " row(s) skipped (missing depot or a non-numeric Total PDSR).")),
    ),
    React.createElement("div", null,
      React.createElement("button", { className: "btn btn-primary btn-sm", disabled: saving || !depotCodes.length, onClick: save }, saving ? "Saving…" : "Save PSDSR — All Depots")));
}
