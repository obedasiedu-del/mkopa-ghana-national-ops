"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, FieldInput } from "../components/ui.js";
import { parseMovementPaste, splitPasteLines, downloadCsv } from "../lib/domain.js";

// A textarea holding several thousand pasted lines is slow for the browser to lay out on
// its own, before any of our code runs -- same uncontrolled-textarea trick as
// BulkLedgerModal: a large paste is intercepted and kept in a ref instead of being pushed
// through React on every keystroke.
const LARGE_PASTE_LINE_THRESHOLD = 400;
export function BulkMovementModal({ onSaved }) {
  const { data, closeModal, toast, runAction } = useApp();
  const depots = React.useMemo(() => Object.values(data.depots), [data.depots]);
  const depotsLoaded = depots.length > 0;
  const textareaRef = React.useRef(null);
  const rawTextRef = React.useRef("");
  const suppressNextInputRef = React.useRef(false);
  const summaryTimerRef = React.useRef(null);
  const [recordedBy, setRecordedBy] = React.useState("");
  const [summary, setSummary] = React.useState(null);
  const [parsing, setParsing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  function getPasteText() { return rawTextRef.current || (textareaRef.current ? textareaRef.current.value : ""); }
  function scheduleSummary() {
    setParsing(true);
    clearTimeout(summaryTimerRef.current);
    summaryTimerRef.current = setTimeout(() => {
      const raw = getPasteText();
      if (!raw.trim()) { setSummary(null); setParsing(false); return; }
      setSummary(parseMovementPaste(raw, depots));
      setParsing(false);
    }, 250);
  }
  function onPaste(e) {
    const text = e.clipboardData ? e.clipboardData.getData("text") : "";
    if (!text) return;
    const lineCount = splitPasteLines(text).length;
    if (lineCount <= LARGE_PASTE_LINE_THRESHOLD) { rawTextRef.current = ""; return; }
    e.preventDefault();
    rawTextRef.current = text;
    suppressNextInputRef.current = true;
    if (textareaRef.current) {
      textareaRef.current.value = `[Large paste loaded: ${lineCount} rows — too many to display here, but ready to process. Click "Save Movements" below, or clear this box and paste a smaller batch to review inline.]`;
    }
    scheduleSummary();
  }
  function onInput() {
    if (suppressNextInputRef.current) { suppressNextInputRef.current = false; return; }
    rawTextRef.current = "";
    scheduleSummary();
  }
  function save() {
    const raw = getPasteText();
    setSaving(true);
    setTimeout(() => {
      const parsed = parseMovementPaste(raw, depots);
      runAction(() => data.recordMovementsBulk(parsed.rows, recordedBy.trim()), null).then((count) => {
        toast("Recorded " + count + " movement" + (count === 1 ? "" : "s"));
        closeModal();
        if (onSaved) onSaved();
      }).catch(() => {}).finally(() => setSaving(false));
    }, 0);
  }
  function unmatchedDownload() {
    const rows = [["From (as pasted)", "To (as pasted)", "Serial", "Model", "Quantity", "Reference", "Reason"]];
    summary.unmatchedRows.forEach((r) => rows.push([r.fromText, r.toText, r.serial, r.model, r.quantity, r.reference, r.reason]));
    downloadCsv("unmatched-movement-rows.csv", rows);
  }
  const totalMatched = summary ? summary.rows.length : 0;
  const totalPasted = summary ? totalMatched + summary.skipped + summary.unmatchedRows.length : 0;
  return React.createElement(Modal, { open: true, onClose: closeModal, xwide: true, title: "Upload Stock Movements", footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel") },
    !depotsLoaded && React.createElement("div", { className: "banner", style: { marginBottom: 10 } },
      React.createElement("span", null, "⚠"),
      React.createElement("div", null, "The depot list hasn't finished loading yet — pasting now would match nothing. Close this, wait a couple seconds, then reopen.")),
    React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 } },
      "Paste rows straight from a waybill/transit export — one row per device or line item, and it writes directly to the database itself, no need to send it to be typed in by hand. Include a header row and it auto-detects columns by name (From/Source, To/Destination, Serial, Model, Quantity, Reference/Waybill, Date, Recorded By) in whatever order your sheet has them. No header row falls back to a fixed order: From, To, Serial, Model, Quantity, Reference, Date, Recorded By. From/To are matched by depot name or code — including the Warehouse, Refurb/Repair, Reverse Logistics and Indirect Channel buckets, not just retail depots. A row with only a From becomes an Issue, only a To becomes a Receipt, and both becomes a Transfer. Quantity defaults to 1 if left blank. The database rejects any Issue or Transfer that would take a depot's balance below zero — if that happens partway through a large paste, fix the rejected rows and re-paste just those."),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Paste movement rows"),
      React.createElement("textarea", { ref: textareaRef, className: "field-input", rows: 10, placeholder: "Warehouse\tSC181\t350522362341868\tE005-375-NA-R00\t1\tWaybill T068463\t2026-09-18\tBernard Quainoo", defaultValue: "", onPaste, onInput })),
    React.createElement(FieldInput, { label: "Recorded by (default, if a row doesn't list one)", value: recordedBy, onChange: setRecordedBy }),
    React.createElement("div", { style: { fontSize: 12, margin: "4px 0 14px" } },
      parsing && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Parsing…"),
      !parsing && !summary && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Paste rows above to see a preview."),
      !parsing && summary && totalPasted === 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Paste rows above to see a preview."),
      !parsing && summary && totalPasted > 0 && React.createElement(React.Fragment, null,
        React.createElement("div", { style: { color: "var(--success)", fontWeight: 600, marginBottom: 4 } },
          totalMatched, " of ", totalPasted, " pasted row", totalPasted === 1 ? "" : "s", " ready to save — ",
          summary.typeCounts.transfer, " transfer", summary.typeCounts.transfer === 1 ? "" : "s", ", ",
          summary.typeCounts.receipt, " receipt", summary.typeCounts.receipt === 1 ? "" : "s", ", ",
          summary.typeCounts.issue, " issue", summary.typeCounts.issue === 1 ? "" : "s", "."),
        summary.unmatchedRows.length > 0 && React.createElement("div", { style: { color: "var(--warning)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 } },
          React.createElement("span", null, summary.unmatchedRows.length, " row", summary.unmatchedRows.length === 1 ? "" : "s", " didn't match a depot — name", Object.keys(summary.unmatchedCounts).length === 1 ? "" : "s", ": ", Object.keys(summary.unmatchedCounts).slice(0, 8).join(", "), Object.keys(summary.unmatchedCounts).length > 8 ? ", …" : "", "."),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: unmatchedDownload }, "📥 Download")),
        summary.skipped > 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, summary.skipped, " row(s) skipped (missing model, quantity, or no From/To at all).")),
    ),
    React.createElement("div", null,
      React.createElement("button", { className: "btn btn-primary btn-sm", disabled: saving || totalMatched === 0, onClick: save }, saving ? "Saving…" : "Save Movements")));
}
