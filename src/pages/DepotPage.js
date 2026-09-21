"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { canWriteDepot } from "../data/useAuth.js";
import { KpiTile, Pill, ScStatusPill, ScoreCell, FieldInput, FieldSelect, FieldTextarea, EmptyRow, Tabs, Breadcrumb, LedgerAgingBadge } from "../components/ui.js";
import { ledgerDevices } from "../lib/selectors.js";
import {
  DEVICE_MODEL_SUGGESTIONS, SUBMISSION_MODELS, LEDGER_TIERS, deviceTotals, submissionTotals, todayStr,
  fmtDateShort, fmtDateTime, fmtNum, agedPctColor, daysAllocated, ledgerTierFor, countsForDevices,
  groupDevicesByTier, downloadCsv,
} from "../lib/domain.js";

const DEPOT_TABS = [
  { id: "devices", label: "Devices" },
  { id: "submission", label: "Daily Submission" },
  { id: "movement", label: "Stock Movement" },
  { id: "aging", label: "Stock Aging" },
  { id: "audit", label: "Audit History" },
];

export function DepotPage() {
  const { data, auth, route, goNational, goRegion, openModal, runAction } = useApp();
  const rec = data.depots[route.depotCode];
  const tab = DEPOT_TABS.some((t) => t.id === route.tab) ? route.tab : "devices";

  if (data.loaded && !rec) {
    return React.createElement("div", { className: "content" },
      React.createElement("div", { className: "banner" }, React.createElement("span", null, "⚠"), React.createElement("div", null, "Depot \"" + route.depotCode + "\" was not found.")));
  }
  if (!rec) return React.createElement("div", { className: "content" }, "Loading…");

  const canWrite = canWriteDepot(auth.role, rec.code, rec.region);

  return React.createElement("div", { className: "content" },
    React.createElement(Breadcrumb, {
      items: [
        { label: "National", onClick: goNational },
        { label: rec.region, onClick: () => goRegion(rec.region) },
        { label: rec.name },
      ],
    }),
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 4 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, rec.name),
        React.createElement("div", { className: "scope-sub" }, rec.code, " · ", rec.region, rec.status === "closed" ? " · Closed" : "")),
      React.createElement(ScStatusPill, { status: rec.scStatus })),
    React.createElement(Tabs, { tabs: DEPOT_TABS, active: tab, onChange: (id) => window.location.hash = "#/depot/" + encodeURIComponent(rec.code) + "/" + id }),
    React.createElement("div", { style: { marginTop: 16 } },
      tab === "devices" && React.createElement(DevicesTab, { rec, canWrite }),
      tab === "submission" && React.createElement(SubmissionTab, { rec, canWrite }),
      tab === "movement" && React.createElement(MovementTab, { rec, canWrite }),
      tab === "aging" && React.createElement(AgingTab, { rec }),
      tab === "audit" && React.createElement(AuditTab, { rec })));
}

/* ============ Devices: At Depot / With DSRs + Stock Controller ============ */
function DevicesTab({ rec, canWrite }) {
  const { data, openModal, runAction } = useApp();
  const [sub, setSub] = React.useState("depot");
  const [scName, setScName] = React.useState(rec.scName);
  const [scPhone, setScPhone] = React.useState(rec.scPhone);
  const [scStatus, setScStatus] = React.useState(rec.scStatus);
  const [scScore, setScScore] = React.useState(rec.scScore === null ? "" : String(rec.scScore));
  const [scNotes, setScNotes] = React.useState(rec.scNotes);
  function saveSc() {
    const scoreVal = scScore.trim() === "" ? null : Math.max(0, Math.min(100, Number(scScore)));
    runAction(() => data.saveDepotField(rec.code, { scName: scName.trim(), scPhone: scPhone.trim(), scStatus, scScore: scoreVal, scNotes: scNotes.trim() }), "Saved");
  }
  const models = { ...(data.depotStock[rec.code] || {}) };
  DEVICE_MODEL_SUGGESTIONS.forEach((m) => { if (!models[m]) models[m] = { inStock: 0, returned: 0 }; });
  const [modelState, setModelState] = React.useState(models);
  React.useEffect(() => { setModelState({ ...(data.depotStock[rec.code] || {}) }); }, [data.depotStock, rec.code]);
  const [newModel, setNewModel] = React.useState("");
  function saveModels() { runAction(() => data.saveDeviceModels(rec.code, modelState), "Stock updated"); }

  const ledgerDvs = ledgerDevices(data.deviceLedger, rec.code);
  const counts = countsForDevices(ledgerDvs);

  return React.createElement(React.Fragment, null,
    React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16 } },
      React.createElement("button", { className: "btn btn-sm" + (sub === "depot" ? " btn-primary" : ""), onClick: () => setSub("depot") }, "Devices at Depot"),
      React.createElement("button", { className: "btn btn-sm" + (sub === "dsr" ? " btn-primary" : ""), onClick: () => setSub("dsr") }, "Devices with DSRs")),
    sub === "depot" ? React.createElement(React.Fragment, null,
      React.createElement("div", { className: "table-wrap", style: { padding: "14px 16px", marginBottom: 16 } },
        React.createElement("div", { className: "drawer-section-title" }, "Stock Controller"),
        React.createElement("div", { className: "field-grid" },
          React.createElement(FieldInput, { label: "Name", value: scName, onChange: setScName }),
          React.createElement(FieldInput, { label: "Phone", value: scPhone, onChange: setScPhone })),
        React.createElement("div", { className: "field-grid" },
          React.createElement(FieldSelect, { label: "Status", value: scStatus, onChange: setScStatus, options: [["active", "Active"], ["leave", "On Leave"], ["vacant", "Vacant"]] }),
          React.createElement(FieldInput, { label: "Score (0–100)", value: scScore, onChange: setScScore, type: "number" })),
        React.createElement(FieldTextarea, { label: "Notes", value: scNotes, onChange: setScNotes }),
        canWrite && React.createElement("button", { className: "btn btn-primary btn-sm", onClick: saveSc }, "Save Stock Controller")),
      React.createElement("div", { className: "table-wrap", style: { padding: "14px 16px" } },
        React.createElement("div", { className: "drawer-section-title" }, "Device stock by model"),
        React.createElement("div", { className: "device-model-head" },
          React.createElement("div", null, "Model"), React.createElement("div", null, "In stock"), React.createElement("div", null, "Returned"), React.createElement("div", null)),
        React.createElement("div", null, Object.keys(modelState).map((m) => React.createElement("div", { className: "device-model-row", key: m },
          React.createElement("input", { className: "field-input mono", value: m, disabled: true }),
          React.createElement("input", { className: "field-input mono", type: "number", min: "0", value: modelState[m].inStock || 0, disabled: !canWrite, onChange: (e) => setModelState({ ...modelState, [m]: { ...modelState[m], inStock: Number(e.target.value) || 0 } }) }),
          React.createElement("input", { className: "field-input mono", type: "number", min: "0", value: modelState[m].returned || 0, disabled: !canWrite, onChange: (e) => setModelState({ ...modelState, [m]: { ...modelState[m], returned: Number(e.target.value) || 0 } }) }),
          canWrite && React.createElement("button", { className: "icon-btn", title: "Remove model", onClick: () => { const m2 = { ...modelState }; delete m2[m]; setModelState(m2); } }, "✕")))),
        canWrite && React.createElement(React.Fragment, null,
          React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 8 } },
            React.createElement("input", { className: "field-input", placeholder: "Add model (e.g. A26)", list: "model-suggestions", value: newModel, onChange: (e) => setNewModel(e.target.value) }),
            React.createElement("datalist", { id: "model-suggestions" }, DEVICE_MODEL_SUGGESTIONS.map((m) => React.createElement("option", { value: m, key: m }))),
            React.createElement("button", { className: "btn btn-sm", onClick: () => { const m = newModel.trim(); if (!m) return; if (!modelState[m]) setModelState({ ...modelState, [m]: { inStock: 0, returned: 0 } }); setNewModel(""); } }, "Add")),
          React.createElement("button", { className: "btn btn-primary btn-sm", style: { marginTop: 12 }, onClick: saveModels }, "Save device stock"))))
      : React.createElement(React.Fragment, null,
        React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
          React.createElement(KpiTile, { label: "Devices tracked", value: fmtNum(counts.total), foot: "with a DSR or resolved" }),
          React.createElement(KpiTile, { label: "Fresh (0–5d)", value: fmtNum(counts.fresh), foot: "on track" }),
          React.createElement(KpiTile, { label: "Aged (11+d)", value: fmtNum(counts.aged + counts.urgent + counts.highrisk), foot: "needs attention" }),
          React.createElement(KpiTile, { label: "High Risk (30+d)", value: fmtNum(counts.highrisk), foot: "escalate now" })),
        React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 10, gap: 8 } },
          React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("ledger", { depotCode: rec.code }) }, "Open device ledger →")),
        ledgerDvs.length === 0
          ? React.createElement("div", { className: "table-wrap" }, React.createElement("div", { style: { padding: 20, color: "var(--text-faint)", fontSize: 12.5 } }, "No devices with DSRs on file for this depot yet. Use \"Open device ledger\" to paste a baseline."))
          : React.createElement("div", { className: "table-wrap" },
            React.createElement("table", null,
              React.createElement("thead", null, React.createElement("tr", null,
                React.createElement("th", null, "Serial"), React.createElement("th", null, "Product"), React.createElement("th", null, "DSR"), React.createElement("th", null, "Aging / Status"))),
              React.createElement("tbody", null, ledgerDvs.slice(0, 50).map((dv) => React.createElement("tr", { key: dv.serial },
                React.createElement("td", { className: "mono" }, dv.serial), React.createElement("td", null, dv.model || "—"),
                React.createElement("td", null, dv.dsrName || "—"), React.createElement("td", null, React.createElement(LedgerAgingBadge, { device: dv }))))))),
        ledgerDvs.length > 50 && React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 } }, "Showing 50 of ", ledgerDvs.length, " — open the full device ledger to see the rest.")));
}

/* ============ Daily Submission ============ */
function SubmissionTab({ rec, canWrite }) {
  const { data, openModal, runAction } = useApp();
  const today = todayStr();
  const days = (data.submissionsByDepot[rec.code] || []).slice().reverse();
  const todayEntry = days.find((d) => d.date === today) || null;
  const latest = days[0] || null;
  const latestTotals = latest ? submissionTotals(latest) : null;
  const pct = latestTotals && latestTotals.totalStock > 0 ? Math.round((latestTotals.agedStock / latestTotals.totalStock) * 1000) / 10 : null;

  function exportCsv() {
    const rows = [["Date", "Submitted By"].concat(SUBMISSION_MODELS.flatMap((m) => [m + " Total", m + " Aged"])).concat(["Total", "Aged", "% Aged"])];
    days.slice().reverse().forEach((h) => {
      const t = submissionTotals(h);
      const p = t.totalStock > 0 ? Math.round((t.agedStock / t.totalStock) * 1000) / 10 : 0;
      const row = [h.date, h.submittedBy];
      SUBMISSION_MODELS.forEach((m) => { const r = h.models && h.models[m]; row.push(r ? r.totalStock : 0, r ? r.agedStock : 0); });
      row.push(t.totalStock, t.agedStock, p);
      rows.push(row);
    });
    downloadCsv(rec.code + "-daily-submission-history.csv", rows);
  }

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "kpi-grid", style: { marginBottom: 14 } },
      React.createElement(KpiTile, { label: "Today's entry", value: todayEntry ? "Submitted" : "Missing", foot: fmtDateShort(today) }),
      React.createElement(KpiTile, { label: "Total stock (latest)", value: latestTotals ? fmtNum(latestTotals.totalStock) : "—", foot: latest ? fmtDateShort(latest.date) : "no entries yet" }),
      React.createElement(KpiTile, { label: "Aged stock (latest)", value: latestTotals ? fmtNum(latestTotals.agedStock) : "—", foot: "of total stock" }),
      React.createElement(KpiTile, { label: "% aged", value: pct === null ? "—" : pct + "%", foot: pct !== null && pct >= 30 ? "high aging" : "on track" })),
    React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 14 } },
      canWrite && React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => openModal("submission", { depotCode: rec.code }) }, todayEntry ? "Edit Today's Submission" : "+ New Submission"),
      days.length > 0 && React.createElement("button", { className: "btn btn-sm", onClick: exportCsv }, "📥 Export history (CSV)")),
    days.length === 0
      ? React.createElement("div", { className: "table-wrap" }, React.createElement("div", { style: { padding: 20, color: "var(--text-faint)", fontSize: 12.5 } }, "No submissions recorded for this depot yet."))
      : React.createElement("div", { className: "table-wrap" },
        React.createElement("table", null,
          React.createElement("thead", null, React.createElement("tr", null,
            React.createElement("th", null, "Date"), React.createElement("th", null, "Submitted by"),
            React.createElement("th", { className: "num" }, "Total"), React.createElement("th", { className: "num" }, "Aged"), React.createElement("th", { className: "num" }, "% Aged"))),
          React.createElement("tbody", null, days.slice(0, 20).map((h) => {
            const t = submissionTotals(h);
            const p = t.totalStock > 0 ? Math.round((t.agedStock / t.totalStock) * 1000) / 10 : 0;
            return React.createElement("tr", { key: h.date },
              React.createElement("td", null, React.createElement(Pill, { cls: h.date === today ? "pill-success" : "pill-muted" }, fmtDateShort(h.date))),
              React.createElement("td", null, h.submittedBy),
              React.createElement("td", { className: "num mono", style: { fontWeight: 600 } }, t.totalStock),
              React.createElement("td", { className: "num mono" }, t.agedStock),
              React.createElement("td", { className: "num mono", style: { color: agedPctColor(p), fontWeight: 600 } }, p, "%"));
          })))));
}

/* ============ Stock Movement ============ */
function MovementTab({ rec, canWrite }) {
  const { data, openModal } = useApp();
  const [rows, setRows] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const load = React.useCallback(() => {
    setLoading(true);
    data.fetchMovements({ depotCode: rec.code }).then(setRows).finally(() => setLoading(false));
  }, [data, rec.code]);
  React.useEffect(() => { load(); }, [load]);

  return React.createElement(React.Fragment, null,
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } },
      React.createElement("div", { style: { fontSize: 12.8, color: "var(--text-muted)" } }, "Transfers, allocations, returns and other stock-moving events for this depot."),
      canWrite && React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => openModal("recordMovement", { depotCode: rec.code, onSaved: load }) }, "+ Record Movement")),
    loading ? React.createElement("div", { style: { padding: 20, color: "var(--text-faint)" } }, "Loading…")
      : (!rows || rows.length === 0)
        ? React.createElement("div", { className: "table-wrap" }, React.createElement("div", { style: { padding: 20, color: "var(--text-faint)", fontSize: 12.5 } }, "No movements recorded yet for this depot."))
        : React.createElement("div", { className: "table-wrap" },
          React.createElement("table", null,
            React.createElement("thead", null, React.createElement("tr", null,
              React.createElement("th", null, "When"), React.createElement("th", null, "Type"), React.createElement("th", null, "Model / Serial"),
              React.createElement("th", { className: "num" }, "Qty"), React.createElement("th", null, "To / From"), React.createElement("th", null, "Note"), React.createElement("th", null, "By"))),
            React.createElement("tbody", null, rows.map((m) => React.createElement("tr", { key: m.id },
              React.createElement("td", null, fmtDateTime(m.movedAt)),
              React.createElement("td", null, React.createElement(Pill, { cls: "pill-muted" }, m.movementType.replace(/_/g, " "))),
              React.createElement("td", null, [m.model, m.serial].filter(Boolean).join(" · ") || "—"),
              React.createElement("td", { className: "num" }, m.quantity ?? "—"),
              React.createElement("td", null, m.toDepotCode ? (data.depots[m.toDepotCode]?.name || m.toDepotCode) : "—"),
              React.createElement("td", null, m.reference || "—"),
              React.createElement("td", null, m.recordedBy || "—")))))));
}

/* ============ Stock Aging ============ */
function AgingTab({ rec }) {
  const { data } = useApp();
  const devices = ledgerDevices(data.deviceLedger, rec.code);
  const groups = groupDevicesByTier(devices);
  const [activeTier, setActiveTier] = React.useState(null);
  const shown = activeTier ? groups[activeTier] : [];
  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
      LEDGER_TIERS.map((t) => React.createElement("button", { key: t.key, className: "kpi-tile", style: { textAlign: "left", cursor: "pointer", outline: activeTier === t.key ? "2px solid var(--accent, #2a78d6)" : "none" }, onClick: () => setActiveTier((a) => (a === t.key ? null : t.key)) },
        React.createElement("div", { className: "kpi-label" }, t.label),
        React.createElement("div", { className: "kpi-value" }, fmtNum(groups[t.key].length)),
        React.createElement("div", { className: "kpi-foot" }, t.min === undefined ? "0–" + t.max + " days" : t.max === undefined ? t.min + "+ days" : t.min + "–" + t.max + " days")))),
    activeTier && React.createElement(React.Fragment, null,
      React.createElement("div", { className: "drawer-section-title" }, LEDGER_TIERS.find((t) => t.key === activeTier).label, " devices"),
      shown.length === 0
        ? React.createElement("div", { className: "table-wrap" }, React.createElement("div", { style: { padding: 20, color: "var(--text-faint)", fontSize: 12.5 } }, "No devices in this tier."))
        : React.createElement("div", { className: "table-wrap" },
          React.createElement("table", null,
            React.createElement("thead", null, React.createElement("tr", null,
              React.createElement("th", null, "Serial"), React.createElement("th", null, "Product"), React.createElement("th", null, "DSR"), React.createElement("th", null, "Allocated"), React.createElement("th", null, "Days"))),
            React.createElement("tbody", null, shown.map((dv) => React.createElement("tr", { key: dv.serial },
              React.createElement("td", { className: "mono" }, dv.serial), React.createElement("td", null, dv.model || "—"),
              React.createElement("td", null, dv.dsrName || "—"), React.createElement("td", null, fmtDateShort(dv.allocatedDate)),
              React.createElement("td", null, daysAllocated(dv.allocatedDate)))))))),
    !activeTier && React.createElement("div", { style: { fontSize: 12.5, color: "var(--text-faint)" } }, "Click a tier above to see its devices."));
}

/* ============ Audit History ============ */
function AuditTab({ rec }) {
  const { data } = useApp();
  const [rows, setRows] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    setLoading(true);
    data.fetchAuditLog({ depotCode: rec.code }).then(setRows).finally(() => setLoading(false));
  }, [data, rec.code]);

  function summarize(row) {
    if (row.action === "insert") return "Created";
    if (row.action === "delete") return "Deleted";
    if (!row.oldValue || !row.newValue) return "Updated";
    const changed = Object.keys(row.newValue).filter((k) => JSON.stringify(row.oldValue[k]) !== JSON.stringify(row.newValue[k]));
    return changed.length ? changed.map((k) => k + ": " + String(row.oldValue[k]) + " → " + String(row.newValue[k])).join(", ") : "No field changes";
  }

  return React.createElement(React.Fragment, null,
    React.createElement("div", { style: { fontSize: 12.8, color: "var(--text-muted)", marginBottom: 14 } }, "Every change to this depot's stock controller, stock, submissions and device ledger, captured automatically."),
    loading ? React.createElement("div", { style: { padding: 20, color: "var(--text-faint)" } }, "Loading…")
      : (!rows || rows.length === 0)
        ? React.createElement("div", { className: "table-wrap" }, React.createElement("div", { style: { padding: 20, color: "var(--text-faint)", fontSize: 12.5 } }, "No audit history yet."))
        : React.createElement("div", { className: "table-wrap" },
          React.createElement("table", null,
            React.createElement("thead", null, React.createElement("tr", null,
              React.createElement("th", null, "When"), React.createElement("th", null, "Table"), React.createElement("th", null, "Action"), React.createElement("th", null, "By"), React.createElement("th", null, "Change"))),
            React.createElement("tbody", null, rows.map((r) => React.createElement("tr", { key: r.id },
              React.createElement("td", null, fmtDateTime(r.occurredAt)),
              React.createElement("td", null, r.tableName),
              React.createElement("td", null, React.createElement(Pill, { cls: r.action === "insert" ? "pill-success" : r.action === "delete" ? "pill-critical" : "pill-warning" }, r.action)),
              React.createElement("td", null, r.actor || "—"),
              React.createElement("td", { style: { fontSize: 12, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: summarize(r) }, summarize(r))))))));
}
