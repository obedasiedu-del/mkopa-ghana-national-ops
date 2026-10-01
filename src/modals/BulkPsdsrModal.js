"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal, FieldInput } from "../components/ui.js";
import { depotsForScope } from "../lib/selectors.js";
import { parsePsdsrDailyPaste, downloadCsv, todayStr, PSDSR_PRODUCTIVE_MIN_SALES, PSDSR_SUFFICIENT_MIN_STOCK } from "../lib/domain.js";
import { readWorkbook, guessPsdsrSheet, readPsdsrSheet } from "../lib/xlsxImport.js";

// Daily PSDSR bulk upload -- one row per DSR (the real "Last_7_Days" export): SalesAgentId,
// FullName, PhoneNumber, AcquisitionSalesL7, QoSOnDay, ShopName, Stock Yesterday. Productive
// and sufficient-stock status aren't in the source file -- they're computed here from agreed
// thresholds (see domain.js). Re-uploading for the same day replaces each touched depot's
// whole DSR roster for that day, it does not add to it.
export function BulkPsdsrModal() {
  const { data, closeModal, toast, runAction } = useApp();
  const depots = depotsForScope(data.depots, "national");
  const depotsLoaded = depots.length > 0;
  const [text, setText] = React.useState("");
  const [enteredBy, setEnteredBy] = React.useState("");
  const [uploadDate, setUploadDate] = React.useState(todayStr());
  const [summary, setSummary] = React.useState(null);
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
      setSummary(parsePsdsrDailyPaste(value, depots));
      setParsing(false);
    }, 200);
  }
  function onChange(e) {
    const value = e.target.value;
    setText(value); scheduleParse(value);
    setWorkbook(null); setSheetName(""); setFileInfo(null); setFileError(null);
  }
  function loadSheet(wb, name) {
    try {
      const result = readPsdsrSheet(wb, name);
      const joined = result.textRows.join("\n");
      setText(joined); scheduleParse(joined);
      setFileInfo({ totalRows: result.totalRows });
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
      const guessed = guessPsdsrSheet(wb);
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
    if (!uploadDate) { toast("A date is required"); return; }
    setSaving(true);
    setTimeout(() => {
      const parsed = parsePsdsrDailyPaste(text, depots);
      runAction(() => data.savePsdsrDailyBulk(parsed.byDepot, enteredBy.trim(), uploadDate), null)
        .then((count) => { toast("Saved PSDSR for " + count + " depot" + (count === 1 ? "" : "s")); closeModal(); })
        .catch(() => {})
        .finally(() => setSaving(false));
    }, 0);
  }
  function unmatchedDownload() {
    const rows = [["Shop (as pasted)", "DSR Name", "Phone", "Sales L7", "QoS", "Stock Yesterday", "Reason"]];
    summary.unmatchedRows.forEach((r) => rows.push([r.shopName, r.fullName, r.phoneNumber, r.acquisitionSalesL7, r.qosOnDay, r.stockYesterday, r.reason]));
    downloadCsv("unmatched-psdsr-rows.csv", rows);
  }
  const depotCodes = summary ? Object.keys(summary.byDepot) : [];
  const dsrCount = summary ? depotCodes.reduce((sum, c) => sum + summary.byDepot[c].length, 0) : 0;
  const productiveCount = summary ? depotCodes.reduce((sum, c) => sum + summary.byDepot[c].filter((r) => r.isProductive).length, 0) : 0;
  const sufficientCount = summary ? depotCodes.reduce((sum, c) => sum + summary.byDepot[c].filter((r) => r.isProductive && r.isSufficient).length, 0) : 0;
  const totalRows = summary ? dsrCount + summary.unmatchedRows.length : 0;
  const indirectRows = summary ? summary.unmatchedRows.filter((r) => r.reason.startsWith("Indirect")) : [];
  const trulyUnmatchedRows = summary ? summary.unmatchedRows.filter((r) => !r.reason.startsWith("Indirect")) : [];
  const trulyUnmatchedCounts = {};
  trulyUnmatchedRows.forEach((r) => { const key = r.shopName || "(blank shop name)"; trulyUnmatchedCounts[key] = (trulyUnmatchedCounts[key] || 0) + 1; });
  return React.createElement(Modal, { open: true, onClose: closeModal, xwide: true, title: "Upload PSDSR — All Depots", footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel") },
    !depotsLoaded && React.createElement("div", { className: "banner", style: { marginBottom: 10 } },
      React.createElement("span", null, "⚠"),
      React.createElement("div", null, "The depot list hasn't finished loading yet — pasting now would match nothing. Close this, wait a couple seconds, then reopen.")),
    React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 } },
      "Upload the daily PSDSR export directly (one row per DSR). A DSR counts as Productive at ", PSDSR_PRODUCTIVE_MIN_SALES, "+ sales in the last 7 days, and Sufficient Stock at ", PSDSR_SUFFICIENT_MIN_STOCK, "+ devices as of yesterday. Re-uploading for the same date below replaces that depot's DSR list for the day, it does not add to it."),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Upload Excel file (.xlsx)"),
      React.createElement("input", { type: "file", accept: ".xlsx,.xls", onChange: onFileChange, disabled: readingFile }),
      workbook && workbook.SheetNames.length > 1 && React.createElement("select", { className: "field-input", style: { marginTop: 6, maxWidth: 320 }, value: sheetName, onChange: onSheetChange },
        workbook.SheetNames.map((n) => React.createElement("option", { key: n, value: n }, n))),
      readingFile && React.createElement("div", { style: { fontSize: 12, color: "var(--text-faint)", marginTop: 4 } }, "Reading file…"),
      fileError && React.createElement("div", { style: { fontSize: 12, color: "var(--critical)", marginTop: 4 } }, fileError),
      fileInfo && React.createElement("div", { style: { fontSize: 12, marginTop: 4, color: "var(--success)" } }, fileInfo.totalRows, " DSR rows read from the file.")),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "…or paste rows (SalesAgentId, Full Name, Phone, Sales L7, QoS, Shop, Stock Yesterday)"),
      React.createElement("textarea", { className: "field-input", rows: 10, value: text, onChange })),
    React.createElement("div", { className: "field-grid" },
      React.createElement(FieldInput, { label: "Entered by (your name)", value: enteredBy, onChange: setEnteredBy }),
      React.createElement(FieldInput, { label: "Date", value: uploadDate, onChange: setUploadDate, type: "date" })),
    React.createElement("div", { style: { fontSize: 12, margin: "4px 0 14px" } },
      parsing && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Parsing…"),
      !parsing && !summary && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Upload or paste rows above to see a preview."),
      !parsing && summary && totalRows === 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, "Upload or paste rows above to see a preview."),
      !parsing && summary && totalRows > 0 && React.createElement(React.Fragment, null,
        React.createElement("div", { style: { color: "var(--success)", fontWeight: 600, marginBottom: 4 } },
          dsrCount, " of ", totalRows, " DSR row", totalRows === 1 ? "" : "s", " matched to ", depotCodes.length, " depot", depotCodes.length === 1 ? "" : "s",
          " — ", productiveCount, " productive, ", sufficientCount, " of those with sufficient stock."),
        indirectRows.length > 0 && React.createElement("div", { style: { color: "var(--text-muted)", marginTop: 2 } },
          indirectRows.length, " indirect-channel/partner-shop row", indirectRows.length === 1 ? "" : "s", " excluded (not a depot) — expected, not an error."),
        trulyUnmatchedRows.length > 0 && React.createElement("div", { style: { color: "var(--warning)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 } },
          React.createElement("span", null, trulyUnmatchedRows.length, " row", trulyUnmatchedRows.length === 1 ? "" : "s", " didn't match a depot — shop", Object.keys(trulyUnmatchedCounts).length === 1 ? "" : "s", ": ", Object.keys(trulyUnmatchedCounts).slice(0, 8).join(", "), Object.keys(trulyUnmatchedCounts).length > 8 ? ", …" : "", "."),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: unmatchedDownload }, "📥 Download")),
        summary.skipped > 0 && React.createElement("div", { style: { color: "var(--text-faint)" } }, summary.skipped, " row(s) skipped (no valid SalesAgentId / name — stray junk rows the export sometimes carries).")),
    ),
    React.createElement("div", null,
      React.createElement("button", { className: "btn btn-primary btn-sm", disabled: saving || !depotCodes.length, onClick: save }, saving ? "Saving…" : "Save PSDSR — All Depots")));
}
