"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, FieldInput } from "../components/ui.js";
import { parseAgedSoldPaste, classifyAgedSoldSerials, downloadCsv } from "../lib/domain.js";
import { readWorkbook, guessAgedSoldSheet, readAgedSoldSheet } from "../lib/xlsxImport.js";

// Daily "Aged Sold" upload -- the Device Aging Control Report's own "AGED SOLD" sheet: a
// flat list of serials a real external sales system says have sold, independent of whether
// anyone ever taps "Mark Sold" inside this app (in practice nobody does -- every device in
// production sits at status='in_stock' until something like this flips it). Only the serial
// number is trusted; the sheet's SaleDate column is a stale constant, not read at all -- see
// classifyAgedSoldSerials / saveAgedSoldBulk for why the upload's own timestamp is used
// instead. This is what FIFO Compliance actually needs to read a real number.
export function BulkAgedSoldModal() {
  const { data, closeModal, toast, runAction } = useApp();
  const [text, setText] = React.useState("");
  const [enteredBy, setEnteredBy] = React.useState("");
  const [summary, setSummary] = React.useState(null);
  const [agedCount, setAgedCount] = React.useState(null);
  const [parsing, setParsing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [workbook, setWorkbook] = React.useState(null);
  const [sheetName, setSheetName] = React.useState("");
  const [fileInfo, setFileInfo] = React.useState(null);
  const [fileError, setFileError] = React.useState(null);
  const [readingFile, setReadingFile] = React.useState(false);
  const parseTimerRef = React.useRef(null);

  function scheduleParse(value) {
    setParsing(true);
    clearTimeout(parseTimerRef.current);
    parseTimerRef.current = setTimeout(() => {
      if (!value.trim()) { setSummary(null); setParsing(false); return; }
      const serials = parseAgedSoldPaste(value);
      setSummary(classifyAgedSoldSerials(serials, data.deviceLedger));
      setParsing(false);
    }, 200);
  }
  function onChange(e) {
    const value = e.target.value;
    setText(value); scheduleParse(value);
    setWorkbook(null); setSheetName(""); setFileInfo(null); setFileError(null); setAgedCount(null);
  }
  function loadSheet(wb, name) {
    try {
      const result = readAgedSoldSheet(wb, name);
      const joined = result.serials.join("\n");
      setText(joined); scheduleParse(joined);
      setFileInfo({ totalRows: result.totalRows });
      setAgedCount(result.agedCount);
      setFileError(null);
    } catch (e) {
      setFileError(e.message || String(e));
      setFileInfo(null);
    }
  }
  async function onFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setReadingFile(true);
    setFileError(null);
    try {
      const wb = await readWorkbook(file);
      const guessed = guessAgedSoldSheet(wb);
      setWorkbook(wb);
      setSheetName(guessed);
      loadSheet(wb, guessed);
    } catch (err) {
      setFileError("Couldn't read that file: " + (err.message || String(err)));
      setWorkbook(null);
    } finally {
      setReadingFile(false);
    }
  }
  function onSheetChange(e) {
    const name = e.target.value;
    setSheetName(name);
    if (workbook) loadSheet(workbook, name);
  }
  function save() {
    if (!enteredBy.trim()) { toast("Your name is required"); return; }
    setSaving(true);
    setTimeout(() => {
      const serials = parseAgedSoldPaste(text);
      const parsed = classifyAgedSoldSerials(serials, data.deviceLedger);
      runAction(() => data.saveAgedSoldBulk(parsed.matched, enteredBy.trim()), null)
        .then((count) => { toast("Marked " + count + " device" + (count === 1 ? "" : "s") + " sold"); closeModal(); })
        .catch(() => {})
        .finally(() => setSaving(false));
    }, 0);
  }
  function notFoundDownload() {
    downloadCsv("aged-sold-not-found.csv", [["Serial"], ...summary.notFound.map((s) => [s])]);
  }

  const totalParsed = summary ? summary.matched.length + summary.alreadySold.length + summary.notFound.length : 0;

  return React.createElement(Modal, { open: true, onClose: closeModal, xwide: true, title: "Upload Aged Sold — All Depots", footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel") },
    React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 } },
      "Upload the Device Aging Control Report as-is (the full workbook) — this reads only its \"AGED SOLD\" sheet's SerialNumber column; every other sheet and column is ignored. Matched devices get marked sold, timestamped with this upload's own time (the sheet's own SaleDate column is not reliable and is never used)."),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Upload Excel file (.xlsx)"),
      React.createElement("input", { type: "file", accept: ".xlsx,.xls", onChange: onFileChange, disabled: readingFile }),
      workbook && workbook.SheetNames.length > 1 && React.createElement("select", { className: "field-input", style: { marginTop: 6, maxWidth: 320 }, value: sheetName, onChange: onSheetChange },
        workbook.SheetNames.map((n) => React.createElement("option", { key: n, value: n }, n))),
      readingFile && React.createElement("div", { style: { fontSize: 12, color: "var(--text-faint)", marginTop: 4 } }, "Reading file…"),
      fileError && React.createElement("div", { style: { fontSize: 12, color: "var(--critical)", marginTop: 4 } }, fileError),
      fileInfo && React.createElement("div", { style: { fontSize: 12, marginTop: 4, color: "var(--success)" } },
        fileInfo.totalRows, " serial", fileInfo.totalRows === 1 ? "" : "s", " read from the file", agedCount !== null ? " (" + agedCount + " were already aged at sale)" : "", ".")),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "…or paste a list of serial numbers (one per line)"),
      React.createElement("textarea", { className: "field-input", rows: 8, value: text, onChange })),
    React.createElement(FieldInput, { label: "Entered by (your name)", value: enteredBy, onChange: setEnteredBy }),
    React.createElement("div", { style: { fontSize: 12, margin: "4px 0 14px" } },
      parsing && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Parsing…"),
      !parsing && !summary && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Upload or paste serials above to see a preview."),
      !parsing && summary && totalParsed === 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Upload or paste serials above to see a preview."),
      !parsing && summary && totalParsed > 0 && React.createElement(React.Fragment, null,
        React.createElement("div", { style: { color: "var(--success)", fontWeight: 600, marginBottom: 4 } },
          summary.matched.length, " of ", totalParsed, " serial", totalParsed === 1 ? "" : "s", " will be marked sold."),
        summary.alreadySold.length > 0 && React.createElement("div", { style: { color: "var(--text-muted)", marginTop: 2 } },
          summary.alreadySold.length, " already sold in this app — no change."),
        summary.notFound.length > 0 && React.createElement("div", { style: { color: "var(--warning)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 } },
          React.createElement("span", null, summary.notFound.length, " serial", summary.notFound.length === 1 ? "" : "s", " not found in the device ledger (dealer/other-channel devices this app doesn't track) — expected, not an error."),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: notFoundDownload }, "📥 Download")))),
    React.createElement("div", null,
      React.createElement("button", { className: "btn btn-primary btn-sm", disabled: saving || !summary || !summary.matched.length, onClick: save }, saving ? "Saving…" : "Save — Mark Sold")));
}
