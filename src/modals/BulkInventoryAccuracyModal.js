"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, FieldInput } from "../components/ui.js";
import { depotsForScope } from "../lib/selectors.js";
import { parseInventoryAccuracyPaste, downloadCsv, todayStr } from "../lib/domain.js";

// Weekly Inventory Accuracy bulk paste -- one row per depot, depot text followed by any
// number of columns; the LAST cell on each row is read as the period's accuracy %. This
// matches the source tracker's own multi-week rollup (Depot | Week1 | Week2 | Week3 |
// Week4 | Total Avg) as-is, verified against a real export, as well as a plain
// Depot+Percent pair for a future single-week paste. Re-pasting the same period below
// overwrites that depot's entry for the week rather than duplicating it.
export function BulkInventoryAccuracyModal() {
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
      setSummary(parseInventoryAccuracyPaste(value, depots));
      setParsing(false);
    }, 200);
  }
  function onChange(e) { const value = e.target.value; setText(value); scheduleParse(value); }
  function save() {
    if (!enteredBy.trim()) { toast("Your name is required"); return; }
    if (!periodDate) { toast("A week/period date is required"); return; }
    setSaving(true);
    setTimeout(() => {
      const parsed = parseInventoryAccuracyPaste(text, depots);
      runAction(() => data.saveInventoryAccuracyBulk(parsed.byDepot, enteredBy.trim(), periodDate), null)
        .then((count) => { toast("Saved Inventory Accuracy for " + count + " depot" + (count === 1 ? "" : "s")); closeModal(); })
        .catch(() => {})
        .finally(() => setSaving(false));
    }, 0);
  }
  function unmatchedDownload() {
    const rows = [["Depot (as pasted)", "Accuracy %"]];
    summary.unmatchedRows.forEach((r) => rows.push([r.depotText, r.pct]));
    downloadCsv("unmatched-inventory-accuracy-rows.csv", rows);
  }
  const depotCodes = summary ? Object.keys(summary.byDepot) : [];
  const totalRows = summary ? depotCodes.length + summary.unmatchedRows.length : 0;
  const indirectRows = summary ? summary.unmatchedRows.filter((r) => r.reason.startsWith("Indirect")) : [];
  const trulyUnmatchedRows = summary ? summary.unmatchedRows.filter((r) => !r.reason.startsWith("Indirect")) : [];
  const trulyUnmatchedCounts = {};
  trulyUnmatchedRows.forEach((r) => { trulyUnmatchedCounts[r.depotText] = (trulyUnmatchedCounts[r.depotText] || 0) + 1; });
  return React.createElement(Modal, { open: true, onClose: closeModal, xwide: true, title: "Upload Inventory Accuracy — All Depots", footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel") },
    !depotsLoaded && React.createElement("div", { className: "banner", style: { marginBottom: 10 } },
      React.createElement("span", null, "⚠"),
      React.createElement("div", null, "The depot list hasn't finished loading yet — pasting now would match nothing. Close this, wait a couple seconds, then reopen.")),
    React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 } }, "Paste rows straight from the weekly tracker — Depot, then any number of columns; the LAST column on each row is read as this period's accuracy %. Works with the full multi-week export (Depot | Week1 | Week2 | Week3 | Week4 | Total Avg) as-is, or a simple Depot + Percent pair. Re-pasting the same period below overwrites that depot's entry for the week, it does not add to it."),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Paste Inventory Accuracy rows (all depots)"),
      React.createElement("textarea", { className: "field-input", rows: 10, placeholder: "Kasoa Depot\t100%\nLapaz Depot\t100%\t100%\t100.00%\t100.00%\t100.00%", value: text, onChange })),
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
        summary.skipped > 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, summary.skipped, " row(s) skipped (missing depot or a non-numeric percentage).")),
    ),
    React.createElement("div", null,
      React.createElement("button", { className: "btn btn-primary btn-sm", disabled: saving || !depotCodes.length, onClick: save }, saving ? "Saving…" : "Save Inventory Accuracy — All Depots")));
}
