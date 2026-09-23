"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal } from "../components/ui.js";
import { depotsForScope } from "../lib/selectors.js";
import { parsePastedWarehouseStock, splitPasteLines, downloadCsv } from "../lib/domain.js";
import { readWorkbook, guessWarehouseStockSheet, readWarehouseStockSheet } from "../lib/xlsxImport.js";

const LARGE_PASTE_LINE_THRESHOLD = 400;
export function BulkWarehouseStockModal() {
  const { data, closeModal, toast, runAction } = useApp();
  const depots = depotsForScope(data.depots, "national");
  const depotsLoaded = depots.length > 0;
  const textareaRef = React.useRef(null);
  const rawTextRef = React.useRef("");
  const suppressNextInputRef = React.useRef(false);
  const summaryTimerRef = React.useRef(null);
  const [summary, setSummary] = React.useState(null);
  const [parsing, setParsing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [workbook, setWorkbook] = React.useState(null);
  const [sheetName, setSheetName] = React.useState("");
  const [fileInfo, setFileInfo] = React.useState(null); // { totalRows }
  const [fileError, setFileError] = React.useState(null);
  const [readingFile, setReadingFile] = React.useState(false);
  const fileInputRef = React.useRef(null);
  function getPasteText() { return rawTextRef.current || (textareaRef.current ? textareaRef.current.value : ""); }
  function scheduleSummary() {
    setParsing(true);
    clearTimeout(summaryTimerRef.current);
    summaryTimerRef.current = setTimeout(() => {
      const raw = getPasteText();
      if (!raw.trim()) { setSummary(null); setParsing(false); return; }
      setSummary({ parsed: parsePastedWarehouseStock(raw, depots) });
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
      textareaRef.current.value = `[Large paste loaded: ${lineCount} rows — too many to display here, but ready to process. Click "Save Warehouse Stock" below, or clear this box and paste a smaller batch to review inline.]`;
    }
    scheduleSummary();
  }
  function onInput() {
    if (suppressNextInputRef.current) { suppressNextInputRef.current = false; return; }
    rawTextRef.current = "";
    setWorkbook(null); setSheetName(""); setFileInfo(null); setFileError(null);
    scheduleSummary();
  }
  function loadSheet(wb, name) {
    try {
      const result = readWarehouseStockSheet(wb, name);
      rawTextRef.current = result.textRows.join("\n");
      suppressNextInputRef.current = true;
      if (textareaRef.current) {
        textareaRef.current.value = `[File loaded: ${result.totalRows} rows from sheet "${name}" — too many to display here, but ready to process. Click "Save Warehouse Stock" below.]`;
      }
      setFileInfo({ totalRows: result.totalRows });
      setFileError(null);
      scheduleSummary();
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
      const guessed = guessWarehouseStockSheet(wb);
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
    const raw = getPasteText();
    setSaving(true);
    setTimeout(() => {
      const parsed = parsePastedWarehouseStock(raw, depots);
      runAction(() => data.saveWarehousePendingBulk(parsed.byDepot), null).then((total) => {
        toast("Warehouse stock saved — " + total + " device" + (total === 1 ? "" : "s") + " across " + Object.keys(parsed.byDepot).length + " depot" + (Object.keys(parsed.byDepot).length === 1 ? "" : "s"));
        closeModal();
      }).catch(() => {}).finally(() => setSaving(false));
    }, 0);
  }
  function bucketDownload(rows, filename) {
    const out = [["Serial Number", "Owner Code", "Owner Name", "Model"]];
    rows.forEach((r) => out.push([r.serial, r.ownerCode, r.ownerName, r.model]));
    downloadCsv(filename, out);
  }
  const parsed = summary ? summary.parsed : null;
  const depotCodes = parsed ? Object.keys(parsed.byDepot) : [];
  const totalMatched = parsed ? depotCodes.reduce((s, c) => s + parsed.byDepot[c].length, 0) : 0;
  const totalPasted = totalMatched + (parsed ? parsed.skipped : 0);
  return React.createElement(Modal, { open: true, onClose: closeModal, xwide: true, title: "Upload Warehouse Stock", footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel") },
    !depotsLoaded && React.createElement("div", { className: "banner", style: { marginBottom: 10 } },
      React.createElement("span", null, "⚠"),
      React.createElement("div", null, "The depot list hasn't finished loading yet — uploading now would match nothing. Close this, wait a couple seconds, then reopen.")),
    React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 } }, "Upload a \"WH STOCKS\" export directly — devices earmarked for a depot but still physically sitting in a warehouse, not yet on hand there. It auto-picks the right sheet out of the workbook and matches each row's Current Owner Code (and, if that doesn't match, Current Owner name) to a real depot — including a code with an extra leading zero (SC092 for SC92) and the Warehouse / Refurb / Reverse Logistics / Indirect Channel buckets. Anything it can't place goes to \"Unrecognised\", not dropped. Depots present in this upload have their warehouse-pending list replaced; others are left untouched. This can be tens of thousands of rows — the preview may take a little while to appear."),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Upload Excel file (.xlsx)"),
      React.createElement("input", { ref: fileInputRef, type: "file", accept: ".xlsx,.xls", onChange: onFileChange, disabled: readingFile }),
      workbook && workbook.SheetNames.length > 1 && React.createElement("select", { className: "field-input", style: { marginTop: 6, maxWidth: 320 }, value: sheetName, onChange: onSheetChange },
        workbook.SheetNames.map((n) => React.createElement("option", { key: n, value: n }, n))),
      readingFile && React.createElement("div", { style: { fontSize: 12, color: "var(--text-faint)", marginTop: 4 } }, "Reading file… this can take a while for a large export."),
      fileError && React.createElement("div", { style: { fontSize: 12, color: "var(--danger, #c0392b)", marginTop: 4 } }, fileError),
      fileInfo && React.createElement("div", { style: { fontSize: 12, marginTop: 4, color: "var(--success)" } }, fileInfo.totalRows, " rows read from the file.")),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "…or paste rows (with header row)"),
      React.createElement("textarea", { ref: textareaRef, className: "field-input", rows: 8, placeholder: "SerialNumber\tCurrentOwnerCode\tCurrentOwner\tDevice\tManifestDate\tDateCurrentStateAttained", defaultValue: "", onPaste, onInput })),
    React.createElement("div", { style: { fontSize: 12, margin: "4px 0 14px" } },
      parsing && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Matching to depots…"),
      !parsing && !parsed && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Upload or paste rows above to see a preview."),
      !parsing && parsed && totalPasted === 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Upload or paste rows above to see a preview."),
      !parsing && parsed && totalPasted > 0 && React.createElement(React.Fragment, null,
        React.createElement("div", { style: { color: "var(--success)", fontWeight: 600, marginBottom: 4 } },
          totalMatched, " of ", totalPasted, " row", totalPasted === 1 ? "" : "s", " ready to save, across ", depotCodes.length, " depot", depotCodes.length === 1 ? "" : "s", " (including Warehouse / Refurb / Reverse Logistics / Indirect Channel where they apply)."),
        Object.keys(parsed.indirectCounts).length > 0 && React.createElement("div", { style: { color: "var(--warning)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 } },
          React.createElement("span", null, parsed.indirectRows.length, " row", parsed.indirectRows.length === 1 ? "" : "s", " classified as Indirect Channel — owner", Object.keys(parsed.indirectCounts).length === 1 ? "" : "s", ": ", Object.keys(parsed.indirectCounts).slice(0, 8).join(", "), Object.keys(parsed.indirectCounts).length > 8 ? ", …" : "", "."),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => bucketDownload(parsed.indirectRows, "indirect-warehouse-rows.csv") }, "📥 Download")),
        Object.keys(parsed.unrecognisedCounts).length > 0 && React.createElement("div", { style: { color: "var(--warning)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 } },
          React.createElement("span", null, parsed.unrecognisedRows.length, " row", parsed.unrecognisedRows.length === 1 ? "" : "s", " classified as Unrecognised — owner", Object.keys(parsed.unrecognisedCounts).length === 1 ? "" : "s", ": ", Object.keys(parsed.unrecognisedCounts).slice(0, 8).join(", "), Object.keys(parsed.unrecognisedCounts).length > 8 ? ", …" : "", "."),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => bucketDownload(parsed.unrecognisedRows, "unrecognised-warehouse-rows.csv") }, "📥 Download")),
        parsed.skipped > 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, parsed.skipped, " row(s) skipped (missing serial number).")),
    ),
    React.createElement("div", null,
      React.createElement("button", { className: "btn btn-primary btn-sm", disabled: saving || totalMatched === 0, onClick: save }, saving ? "Saving…" : "Save Warehouse Stock")));
}
