"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal } from "../components/ui.js";
import { depotsForScope } from "../lib/selectors.js";
import { parsePastedDevicesMultiDepot, splitPasteLines, downloadCsv } from "../lib/domain.js";

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
    scheduleSummary();
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
    React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 } }, "Paste your full device export — every depot at once, straight from Excel. Include the header row and it auto-detects columns by name (Serial Number / SerialNumber, Product / Model / ItemTypeCode, Shop Name / ShopName, DSR Name / DSRName, and either an Allocation Date or a Device Age column) in whatever order your sheet has them — no need to reorder first. No header row falls back to a fixed order: Serial Number, Product, Shop Name, DSR Name, Device Age (days). Each row is matched to a depot by Shop Name; a shop name from a known indirect-channel partner (MTN, Telecel, Franko, izone, MCS, etc.) goes to the \"Indirect Channel\" bucket, and anything else unrecognised goes to the \"Unrecognised Shops\" bucket — nothing is dropped. Depots present in this paste have their device list replaced; others are left untouched. Every device starts \"In Stock\" — mark one Reallocated from its device table once it's recovered."),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Paste device rows (all depots)"),
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
