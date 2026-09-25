"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal } from "../components/ui.js";
import { depotsForScope } from "../lib/selectors.js";
import { parsePastedDevicesMultiDepot, splitPasteLines, downloadCsv } from "../lib/domain.js";
import { readWorkbook, guessDeviceRegisterSheet, readDeviceRegisterSheet } from "../lib/xlsxImport.js";

// A textarea holding several thousand pasted lines is slow for the browser to lay out on its
// own, before any of our code runs. So the textarea here is uncontrolled (a plain ref, not React
// state): a large paste is intercepted, the raw text is kept in a ref instead of being pushed
// through React on every keystroke, and only a short placeholder is shown in the box. A
// normal-sized paste still displays and edits inline.
const LARGE_PASTE_LINE_THRESHOLD = 400;
export function BulkLedgerModal() {
  const { data, closeModal, toast, runAction } = useApp();
  const depots = depotsForScope(data.depots, "national");
  const depotsLoaded = depots.length > 0;
  const textareaRef = React.useRef(null);
  const rawTextRef = React.useRef("");
  const suppressNextInputRef = React.useRef(false);
  const summaryTimerRef = React.useRef(null);
  const [setBy, setSetBy] = React.useState("");
  const [summary, setSummary] = React.useState(null);
  const [parsing, setParsing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [workbook, setWorkbook] = React.useState(null);
  const [sheetName, setSheetName] = React.useState("");
  const [fileInfo, setFileInfo] = React.useState(null); // { fileName, totalRows, correctedDates, dateAnomalies, refDateUsed }
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
      setSummary({ parsed: parsePastedDevicesMultiDepot(raw, depots) });
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
      textareaRef.current.value = `[Large paste loaded: ${lineCount} rows — too many to display here, but ready to process. Click "Save Baseline" below, or clear this box and paste a smaller batch to review inline.]`;
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
      const result = readDeviceRegisterSheet(wb, name);
      rawTextRef.current = result.textRows.join("\n");
      suppressNextInputRef.current = true;
      if (textareaRef.current) {
        textareaRef.current.value = `[File loaded: ${result.totalRows} rows from sheet "${name}" — too many to display here, but ready to process. Click "Save Baseline" below.]`;
      }
      setFileInfo({ totalRows: result.totalRows, correctedDates: result.correctedDates, dateAnomalies: result.dateAnomalies, refDateUsed: result.refDateUsed });
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
      const guessed = guessDeviceRegisterSheet(wb);
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
  function anomalyDownload() {
    const rows = [["Serial Number", "Initial Allocation Date (as read)", "Device Age (from sheet)", "Days implied by date"]];
    fileInfo.dateAnomalies.forEach((a) => rows.push([a.serial, a.initialAllocatedDate, a.deviceAge, a.impliedAge]));
    downloadCsv("date-anomalies.csv", rows);
  }
  function saveBaseline() {
    const raw = getPasteText();
    setSaving(true);
    setTimeout(() => {
      const parsed = parsePastedDevicesMultiDepot(raw, depots);
      runAction(() => data.saveLedgerBaselineBulk(setBy, parsed.byDepot), null).then((total) => {
        toast("Baseline saved — " + total + " device" + (total === 1 ? "" : "s") + " across " + Object.keys(parsed.byDepot).length + " depot" + (Object.keys(parsed.byDepot).length === 1 ? "" : "s"));
        closeModal();
      }).catch(() => {}).finally(() => setSaving(false));
    }, 0);
  }
  function bucketDownload(rows, filename) {
    const out = [["Serial Number", "Product", "Shop Name (as pasted)", "DSR Name"]];
    rows.forEach((r) => out.push([r.serial, r.model, r.shopName, r.dsrName]));
    downloadCsv(filename, out);
  }
  const parsed = summary ? summary.parsed : null;
  const depotCodes = parsed ? Object.keys(parsed.byDepot) : [];
  const totalMatched = parsed ? depotCodes.reduce((s, c) => s + parsed.byDepot[c].length, 0) : 0;
  const totalPasted = totalMatched + (parsed ? parsed.skipped : 0);
  return React.createElement(Modal, { open: true, onClose: closeModal, xwide: true, title: "Upload Baseline — All Depots", footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel") },
    !depotsLoaded && React.createElement("div", { className: "banner", style: { marginBottom: 10 } },
      React.createElement("span", null, "⚠"),
      React.createElement("div", null, "The depot list hasn't finished loading yet — pasting now would match nothing and dump every device into \"Unrecognised Shops\". Close this, wait a couple seconds, then reopen.")),
    React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 } }, "Upload the device export file directly, or paste rows below — every depot at once, straight from Excel. It auto-detects columns by name (Serial Number / SerialNumber, Product / Model / ItemTypeCode, Shop Name / ShopName, DSR Name / DSRName, Initial/Current Allocation Date, Device Age) in whatever order your sheet has them. A file upload also cross-checks each row's Initial Allocation Date against the sheet's own Device Age column and auto-corrects a known export defect (some date cells come through with month and day swapped) — anything it can't resolve is flagged, not silently trusted. Each row is matched to a depot by Shop Name; a shop name from a known indirect-channel partner (MTN, Telecel, Franko, izone, MCS, etc.) goes to the \"Indirect Channel\" bucket, and anything else unrecognised goes to the \"Unrecognised Shops\" bucket — nothing is dropped. Depots present in this upload have their device list replaced; others are left untouched. Every device starts \"In Stock\" — mark one Reallocated from its device table once it's recovered."),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Upload Excel file (.xlsx)"),
      React.createElement("input", { ref: fileInputRef, type: "file", accept: ".xlsx,.xls", onChange: onFileChange, disabled: readingFile }),
      workbook && workbook.SheetNames.length > 1 && React.createElement("select", { className: "field-input", style: { marginTop: 6, maxWidth: 320 }, value: sheetName, onChange: onSheetChange },
        workbook.SheetNames.map((n) => React.createElement("option", { key: n, value: n }, n))),
      readingFile && React.createElement("div", { style: { fontSize: 12, color: "var(--text-faint)", marginTop: 4 } }, "Reading file…"),
      fileError && React.createElement("div", { style: { fontSize: 12, color: "var(--danger, #c0392b)", marginTop: 4 } }, fileError),
      fileInfo && React.createElement("div", { style: { fontSize: 12, marginTop: 4 } },
        React.createElement("div", { style: { color: "var(--success)" } }, fileInfo.totalRows, " rows read from the file", fileInfo.refDateUsed ? " (reference date " + fileInfo.refDateUsed + ")" : "", "."),
        fileInfo.correctedDates > 0 && React.createElement("div", { style: { color: "var(--text-muted)" } }, fileInfo.correctedDates, " date", fileInfo.correctedDates === 1 ? "" : "s", " auto-corrected (month/day swap matched against Device Age)."),
        fileInfo.dateAnomalies.length > 0 && React.createElement("div", { style: { color: "var(--warning)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" } },
          React.createElement("span", null, fileInfo.dateAnomalies.length, " row", fileInfo.dateAnomalies.length === 1 ? "" : "s", " have a date that still doesn't match the sheet's Device Age — kept as read, review before trusting their aging."),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: anomalyDownload }, "📥 Download")))),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "…or paste device rows (all depots)"),
      React.createElement("textarea", { ref: textareaRef, className: "field-input", rows: 10, placeholder: "SN12345\tA07/64\tKasoa Main Shop\tKwame Mensah\t12\nSN67890\tA16/128\tCape Coast Shop\tAma Boateng\t3", defaultValue: "", onPaste, onInput })),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Set by (your name)"),
      React.createElement("input", { className: "field-input", value: setBy, onChange: (e) => setSetBy(e.target.value) })),
    React.createElement("div", { style: { fontSize: 12, margin: "4px 0 14px" } },
      parsing && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Parsing…"),
      !parsing && !parsed && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Paste rows above to see a preview."),
      !parsing && parsed && totalPasted === 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Paste rows above to see a preview."),
      !parsing && parsed && totalPasted > 0 && React.createElement(React.Fragment, null,
        React.createElement("div", { style: { color: "var(--success)", fontWeight: 600, marginBottom: 4 } },
          totalMatched, " of ", totalPasted, " pasted device", totalPasted === 1 ? "" : "s", " ready to save, across ", depotCodes.length, " depot", depotCodes.length === 1 ? "" : "s", " (including Indirect Channel / Unrecognised where they apply)."),
        Object.keys(parsed.indirectCounts).length > 0 && React.createElement("div", { style: { color: "var(--warning)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 } },
          React.createElement("span", null, parsed.indirectRows.length, " device", parsed.indirectRows.length === 1 ? "" : "s", " classified as Indirect Channel — shop name", Object.keys(parsed.indirectCounts).length === 1 ? "" : "s", ": ", Object.keys(parsed.indirectCounts).slice(0, 8).join(", "), Object.keys(parsed.indirectCounts).length > 8 ? ", …" : "", "."),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => bucketDownload(parsed.indirectRows, "indirect-channel-rows.csv") }, "📥 Download")),
        Object.keys(parsed.unrecognisedCounts).length > 0 && React.createElement("div", { style: { color: "var(--warning)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 } },
          React.createElement("span", null, parsed.unrecognisedRows.length, " device", parsed.unrecognisedRows.length === 1 ? "" : "s", " classified as Unrecognised — shop name", Object.keys(parsed.unrecognisedCounts).length === 1 ? "" : "s", ": ", Object.keys(parsed.unrecognisedCounts).slice(0, 8).join(", "), Object.keys(parsed.unrecognisedCounts).length > 8 ? ", …" : "", "."),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => bucketDownload(parsed.unrecognisedRows, "unrecognised-rows.csv") }, "📥 Download")),
        parsed.skipped > 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, parsed.skipped, " row(s) skipped (missing serial number).")),
    ),
    React.createElement("div", null,
      React.createElement("button", { className: "btn btn-primary btn-sm", disabled: saving, onClick: saveBaseline }, saving ? "Saving…" : "Save Baseline — All Depots")));
}
