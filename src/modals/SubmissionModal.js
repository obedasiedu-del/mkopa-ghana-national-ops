"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { Modal } from "../components/ui.js";
import { depotsForScope } from "../lib/selectors.js";
import { SUBMISSION_MODELS, todayStr, fmtDateShort, submissionTotals, agedPctColor, downloadCsv } from "../lib/domain.js";

export function SubmissionModal({ depotCode: initialCode }) {
  const { data, closeModal, runAction, toast } = useApp();
  const depotOptions = React.useMemo(() => depotsForScope(data.depots, "national").filter((d) => d.status === "active"), [data.depots]);
  const defaultCode = initialCode || (depotOptions[0] || {}).code || "";
  const [depotCode, setDepotCode] = React.useState(defaultCode);
  const today = todayStr();
  const todayEntry = (data.submissionsByDepot[depotCode] || []).find((d) => d.date === today) || null;
  const [name, setName] = React.useState(todayEntry ? todayEntry.submittedBy : "");
  const [totals, setTotals] = React.useState(() => {
    const o = {};
    SUBMISSION_MODELS.forEach((m) => { o[m] = (todayEntry && todayEntry.models[m]) ? todayEntry.models[m].totalStock : 0; });
    return o;
  });
  const [ageds, setAgeds] = React.useState(() => {
    const o = {};
    SUBMISSION_MODELS.forEach((m) => { o[m] = (todayEntry && todayEntry.models[m]) ? todayEntry.models[m].agedStock : 0; });
    return o;
  });
  function onDepotChange(code) {
    setDepotCode(code);
    const entry = (data.submissionsByDepot[code] || []).find((d) => d.date === today) || null;
    setName(entry ? entry.submittedBy : "");
    const t = {}, a = {};
    SUBMISSION_MODELS.forEach((m) => { t[m] = (entry && entry.models[m]) ? entry.models[m].totalStock : 0; a[m] = (entry && entry.models[m]) ? entry.models[m].agedStock : 0; });
    setTotals(t);
    setAgeds(a);
  }
  function submit() {
    if (!name.trim()) { toast("Your name is required"); return; }
    const modelsObj = {};
    for (const m of SUBMISSION_MODELS) {
      const totalStock = Math.max(0, Number(totals[m]) || 0);
      const agedStock = Math.max(0, Number(ageds[m]) || 0);
      if (agedStock > totalStock) {
        toast(`${m}: aged stock (${agedStock}) can't exceed total stock (${totalStock})`);
        return;
      }
      modelsObj[m] = { totalStock, agedStock };
    }
    runAction(() => data.saveSubmission(depotCode, today, name, modelsObj), "Submission saved").then(closeModal);
  }
  function exportHistory() {
    const days = (data.submissionsByDepot[depotCode] || []).slice().reverse();
    const rows = [["Date", "Submitted By"].concat(SUBMISSION_MODELS.flatMap((m) => [m + " Total", m + " Aged"])).concat(["Total", "Aged", "% Aged"])];
    days.forEach((h) => {
      const t = submissionTotals(h);
      const pct = t.totalStock > 0 ? Math.round((t.agedStock / t.totalStock) * 1000) / 10 : 0;
      const row = [h.date, h.submittedBy];
      SUBMISSION_MODELS.forEach((m) => { const r = h.models && h.models[m]; row.push(r ? r.totalStock : 0, r ? r.agedStock : 0); });
      row.push(t.totalStock, t.agedStock, pct);
      rows.push(row);
    });
    downloadCsv((data.depots[depotCode] ? data.depots[depotCode].name : depotCode) + "-daily-submission-history.csv", rows);
  }
  const allDays = (data.submissionsByDepot[depotCode] || []).slice().reverse();
  const historyDays = allDays.slice(0, 10);
  return React.createElement(Modal, { open: true, onClose: closeModal, wide: true, title: "Daily Submission", footer: React.createElement(React.Fragment, null,
    React.createElement("button", { className: "btn", onClick: closeModal }, "Cancel"),
    React.createElement("button", { className: "btn btn-primary", onClick: submit }, "Submit")) },
    React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", marginTop: -6, marginBottom: 10 } },
      "Collects daily stock updates from each depot. For ", fmtDateShort(today), todayEntry ? " (editing today's entry)" : "", "."),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Depot"),
      React.createElement("select", { className: "field-input", value: depotCode, onChange: (e) => onDepotChange(e.target.value) },
        depotOptions.map((d) => React.createElement("option", { key: d.code, value: d.code }, d.name, " (", d.code, ")")))),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field-label" }, "Your Name"),
      React.createElement("input", { className: "field-input", value: name, onChange: (e) => setName(e.target.value) })),
    React.createElement("div", { className: "drawer-section-title", style: { color: "var(--success)", marginTop: 6 } }, "Total Stock"),
    React.createElement("div", { className: "model-grid" }, SUBMISSION_MODELS.map((m) => React.createElement("div", { className: "field-row", key: m },
      React.createElement("div", { className: "field-label" }, m),
      React.createElement("input", { className: "field-input", type: "number", min: "0", value: totals[m], onChange: (e) => setTotals({ ...totals, [m]: e.target.value }) })))),
    React.createElement("div", { className: "drawer-section-title", style: { color: "var(--warning)", marginTop: 10 } }, "Aged Stock"),
    React.createElement("div", { className: "model-grid" }, SUBMISSION_MODELS.map((m) => React.createElement("div", { className: "field-row", key: m },
      React.createElement("div", { className: "field-label" }, m),
      React.createElement("input", { className: "field-input", type: "number", min: "0", value: ageds[m], onChange: (e) => setAgeds({ ...ageds, [m]: e.target.value }) })))),
    historyDays.length > 0 && React.createElement("div", { style: { marginTop: 16 } },
      React.createElement("div", { className: "drawer-section-title" },
        "Daily totals — ", data.depots[depotCode] ? data.depots[depotCode].name : depotCode,
        React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: exportHistory }, "📥 Export")),
      React.createElement("div", { style: { fontSize: 11, color: "var(--text-faint)", marginBottom: 8, marginTop: -4 } }, "Each SKU cell shows total stock, with aged count in brackets where any exist."),
      React.createElement("div", { style: { overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 } },
        React.createElement("table", null,
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", null, "Date"), React.createElement("th", null, "By"),
              SUBMISSION_MODELS.map((m) => React.createElement("th", { className: "num", key: m }, m)),
              React.createElement("th", { className: "num" }, "Total"), React.createElement("th", { className: "num" }, "Aged"), React.createElement("th", { className: "num" }, "% Aged"))),
          React.createElement("tbody", null, historyDays.map((h) => {
            const tt = submissionTotals(h);
            const pct = tt.totalStock > 0 ? Math.round((tt.agedStock / tt.totalStock) * 1000) / 10 : 0;
            return React.createElement("tr", { key: h.date },
              React.createElement("td", null, fmtDateShort(h.date)),
              React.createElement("td", null, h.submittedBy),
              SUBMISSION_MODELS.map((m) => {
                const row = h.models && h.models[m];
                const tot = row ? Number(row.totalStock) || 0 : 0;
                const aged = row ? Number(row.agedStock) || 0 : 0;
                return React.createElement("td", { className: "num mono", style: { whiteSpace: "nowrap" }, key: m },
                  tot, aged > 0 && React.createElement("span", { style: { color: "var(--warning)", fontSize: 11, marginLeft: 4 } }, "(", aged, " aged)"));
              }),
              React.createElement("td", { className: "num mono", style: { fontWeight: 600 } }, tt.totalStock),
              React.createElement("td", { className: "num mono" }, tt.agedStock),
              React.createElement("td", { className: "num mono", style: { color: agedPctColor(pct), fontWeight: 600 } }, pct, "%"));
          })))),
      allDays.length > historyDays.length && React.createElement("div", { style: { fontSize: 11, color: "var(--text-faint)", marginTop: 6 } },
        "+", allDays.length - historyDays.length, " earlier entries — use Export for the full history.")));
}
