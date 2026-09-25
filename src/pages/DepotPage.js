"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { canWriteDepot } from "../data/useAuth.js";
import { KpiTile, Pill, ScStatusPill, ScoreCell, FieldInput, FieldSelect, FieldTextarea, Tabs, Breadcrumb, LedgerAgingBadge, HaltBanner } from "../components/ui.js";
import { DataTable } from "../components/DataTable.js";
import { ledgerDevices, depotStockTotals, latestSubmissionForDepot } from "../lib/selectors.js";
import { activeHaltPhase, haltStatusForDepot } from "../lib/haltPolicy.js";
import {
  SUBMISSION_MODELS, LEDGER_TIERS, submissionTotals, todayStr,
  fmtDateShort, fmtDateTime, fmtNum, agedPctColor, daysAllocated, agingDate, ledgerTierFor, countsForDevices, trueAgePct, psdsrPct, computeScScore,
  groupDevicesByTier, downloadCsv, WAREHOUSE_PENDING_ENABLED, STOCK_MOVEMENT_ENABLED,
} from "../lib/domain.js";

const DEPOT_TABS = [
  { id: "devices", label: "Devices" },
  { id: "submission", label: "Daily Submission" },
  ...(STOCK_MOVEMENT_ENABLED ? [{ id: "movement", label: "Stock Movement" }] : []),
  { id: "aging", label: "Stock Aging" },
  ...(WAREHOUSE_PENDING_ENABLED ? [{ id: "warehouse", label: "Warehouse Stock" }] : []),
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
  const haltPhase = activeHaltPhase();
  const haltStatus = haltPhase ? haltStatusForDepot(countsForDevices(ledgerDevices(data.deviceLedger, rec.code)), haltPhase) : null;

  return React.createElement("div", { className: "content" },
    React.createElement(Breadcrumb, {
      // A synthetic bucket (Indirect Channel, Warehouse, etc.) isn't tied to any real
      // region -- its "region" is just the literal string "National" -- so a middle crumb
      // for it would link to a region page that doesn't exist.
      items: rec.isSynthetic
        ? [{ label: "National", onClick: goNational }, { label: rec.name }]
        : [
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
    React.createElement(HaltBanner, { status: haltStatus }),
    React.createElement(Tabs, { tabs: DEPOT_TABS, active: tab, onChange: (id) => window.location.hash = "#/depot/" + encodeURIComponent(rec.code) + "/" + id }),
    React.createElement("div", { style: { marginTop: 16 } },
      tab === "devices" && React.createElement(DevicesTab, { rec, canWrite }),
      tab === "submission" && React.createElement(SubmissionTab, { rec, canWrite }),
      tab === "movement" && React.createElement(MovementTab, { rec, canWrite }),
      tab === "aging" && React.createElement(AgingTab, { rec }),
      tab === "warehouse" && React.createElement(WarehouseTab, { rec }),
      tab === "audit" && React.createElement(AuditTab, { rec })));
}

/* ============ Devices: At Depot / With DSRs + Stock Controller ============ */
function DevicesTab({ rec, canWrite }) {
  const { data, openModal, runAction } = useApp();
  const [sub, setSub] = React.useState("depot");
  const [scName, setScName] = React.useState(rec.scName);
  const [scPhone, setScPhone] = React.useState(rec.scPhone);
  const [scStatus, setScStatus] = React.useState(rec.scStatus);
  const [scNotes, setScNotes] = React.useState(rec.scNotes);
  function saveSc() {
    runAction(() => data.saveDepotField(rec.code, { scName: scName.trim(), scPhone: scPhone.trim(), scStatus, scNotes: scNotes.trim() }), "Saved");
  }

  const balances = data.stockBalances[rec.code] || {};
  const models = Object.keys(balances).sort();
  const depotTotals = depotStockTotals(data.stockBalances, rec.code);
  const latestSubmission = latestSubmissionForDepot(data.submissionsByDepot, rec.code);
  const subTotals = latestSubmission ? submissionTotals(latestSubmission) : null;

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
        React.createElement(FieldSelect, { label: "Status", value: scStatus, onChange: setScStatus, options: [["active", "Active"], ["leave", "On Leave"], ["vacant", "Vacant"]] }),
        React.createElement(FieldTextarea, { label: "Notes", value: scNotes, onChange: setScNotes }),
        canWrite && React.createElement("button", { className: "btn btn-primary btn-sm", onClick: saveSc }, "Save Stock Controller")),
      React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
        React.createElement(KpiTile, { label: "Devices at Depot", value: subTotals ? fmtNum(subTotals.totalStock) : "—", foot: latestSubmission ? "from daily submission · " + fmtDateShort(latestSubmission.date) : "no daily submission yet" }),
        React.createElement(KpiTile, { label: "Aged (11d+, reported)", value: subTotals ? fmtNum(subTotals.agedStock) : "—", foot: "self-reported in submission" }),
        React.createElement(KpiTile, { label: "Received (movements)", value: fmtNum(depotTotals.received), foot: "all-time transfer history" }),
        React.createElement(KpiTile, { label: "Issued (movements)", value: fmtNum(depotTotals.issued), foot: "all-time transfer history" })),
      React.createElement("div", { className: "table-wrap", style: { marginBottom: 16 } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 0" } },
          React.createElement("div", { className: "drawer-section-title", style: { marginBottom: 0 } }, "Devices at Depot by model"),
          canWrite && React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("submission", { depotCode: rec.code }) }, latestSubmission ? "Edit today's submission" : "+ New Submission")),
        !latestSubmission
          ? React.createElement("div", { style: { padding: 20, color: "var(--text-faint)", fontSize: 12.5 } }, "No daily submission on file for this depot yet. Use \"New Submission\" to enter today's opening stock.")
          : React.createElement("table", null,
            React.createElement("thead", null, React.createElement("tr", null,
              React.createElement("th", null, "Model"), React.createElement("th", { className: "num" }, "Total Stock"), React.createElement("th", { className: "num" }, "Aged Stock"))),
            React.createElement("tbody", null, SUBMISSION_MODELS.map((m) => {
              const r = latestSubmission.models && latestSubmission.models[m];
              return React.createElement("tr", { key: m },
                React.createElement("td", { className: "mono" }, m),
                React.createElement("td", { className: "num", style: { fontWeight: 600 } }, fmtNum(r ? r.totalStock : 0)),
                React.createElement("td", { className: "num" }, fmtNum(r ? r.agedStock : 0)));
            })))),
      React.createElement("div", { className: "table-wrap" },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 0" } },
          React.createElement("div", { className: "drawer-section-title", style: { marginBottom: 0 } }, "Movement History by Model (all-time)"),
          canWrite && React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => openModal("recordMovement", { depotCode: rec.code }) }, "+ Record Movement")),
        models.length === 0
          ? React.createElement("div", { style: { padding: 20, color: "var(--text-faint)", fontSize: 12.5 } }, "No stock movements recorded yet for this depot. Use \"Record Movement\" to log a receipt.")
          : React.createElement("table", null,
            React.createElement("thead", null, React.createElement("tr", null,
              React.createElement("th", null, "Model"), React.createElement("th", { className: "num" }, "Received"), React.createElement("th", { className: "num" }, "Issued"))),
            React.createElement("tbody", null, models.map((m) => React.createElement("tr", { key: m },
              React.createElement("td", { className: "mono" }, m),
              React.createElement("td", { className: "num" }, fmtNum(balances[m].received)),
              React.createElement("td", { className: "num" }, fmtNum(balances[m].issued))))))))
      : React.createElement(React.Fragment, null,
        React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
          React.createElement(KpiTile, { label: "Devices tracked", value: fmtNum(counts.total), foot: "with a DSR or resolved" }),
          React.createElement(KpiTile, { label: "Fresh (0–9d)", value: fmtNum(counts.fresh), foot: "on track" }),
          React.createElement(KpiTile, { label: "Aged (10+d)", value: fmtNum(counts.aged + counts.urgent), foot: "needs attention" }),
          React.createElement(KpiTile, { label: "14+ Days", value: fmtNum(counts.urgent), foot: "escalate now" }),
          React.createElement(KpiTile, { label: "True Age", value: trueAgePct(counts) === null ? "—" : trueAgePct(counts) + "%", foot: "14d+ share of active (in-trade) stock" }),
          React.createElement(KpiTile, {
            label: "PSDSR", value: psdsrPct(data.psdsrByDepot[rec.code]) === null ? "—" : psdsrPct(data.psdsrByDepot[rec.code]) + "%",
            foot: data.psdsrByDepot[rec.code] ? fmtDateShort(data.psdsrByDepot[rec.code].periodDate) : "no entry yet",
          }),
          React.createElement(KpiTile, {
            label: "Inventory Accuracy", value: data.inventoryAccuracyByDepot[rec.code] ? data.inventoryAccuracyByDepot[rec.code].pct + "%" : "—",
            foot: data.inventoryAccuracyByDepot[rec.code] ? fmtDateShort(data.inventoryAccuracyByDepot[rec.code].periodDate) : "no entry yet",
          }),
          React.createElement(KpiTile, {
            label: "SC Score", value: computeScScore({ trueAgePctVal: trueAgePct(counts), psdsrRow: data.psdsrByDepot[rec.code], inventoryAccuracyRow: data.inventoryAccuracyByDepot[rec.code] }) ?? "—",
            foot: "True Age 30 + PSDSR 35 + Inventory 20 + Quiz 15",
          })),
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

  const columns = React.useMemo(() => [
    { key: "movedAt", label: "When", sortable: true, render: (m) => fmtDateTime(m.movedAt) },
    { key: "movementType", label: "Type", sortable: true, render: (m) => React.createElement(Pill, { cls: "pill-muted" }, m.movementType.replace(/_/g, " ")) },
    { key: "model", label: "Model / Serial", render: (m) => [m.model, m.serial].filter(Boolean).join(" · ") || "—" },
    { key: "quantity", label: "Qty", numeric: true, sortable: true },
    { key: "toDepotCode", label: "To / From", render: (m) => (m.toDepotCode ? (data.depots[m.toDepotCode]?.name || m.toDepotCode) : "—") },
    { key: "reference", label: "Note", render: (m) => m.reference || "—" },
    { key: "recordedBy", label: "By", sortable: true, render: (m) => m.recordedBy || "—" },
  ], [data.depots]);

  return React.createElement(React.Fragment, null,
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } },
      React.createElement("div", { style: { fontSize: 12.8, color: "var(--text-muted)" } }, "Transfers, receipts, issues, returns and status changes for this depot."),
      canWrite && React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => openModal("recordMovement", { depotCode: rec.code, onSaved: load }) }, "+ Record Movement")),
    loading ? React.createElement("div", { style: { padding: 20, color: "var(--text-faint)" } }, "Loading…")
      : React.createElement(DataTable, {
        columns, rows: rows || [], rowKey: (m) => m.id, defaultSortKey: "movedAt", defaultSortDir: "desc",
        emptyMessage: "No movements recorded yet for this depot.",
      }));
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
      React.createElement(DataTable, {
        columns: AGING_COLUMNS, rows: shown, rowKey: (dv) => dv.serial, defaultSortKey: "allocatedDate",
        emptyMessage: "No devices in this tier.",
      })),
    !activeTier && React.createElement("div", { style: { fontSize: 12.5, color: "var(--text-faint)" } }, "Click a tier above to see its devices."));
}
const AGING_COLUMNS = [
  { key: "serial", label: "Serial", sortable: true, render: (dv) => React.createElement("span", { className: "mono" }, dv.serial) },
  { key: "model", label: "Product", sortable: true, render: (dv) => dv.model || "—" },
  { key: "dsrName", label: "DSR", sortable: true, render: (dv) => dv.dsrName || "—" },
  { key: "allocatedDate", label: "In Channel Since", sortable: true, sortValue: (dv) => agingDate(dv), render: (dv) => fmtDateShort(agingDate(dv)) },
  { key: "days", label: "Days", numeric: true, sortable: true, sortValue: (dv) => daysAllocated(agingDate(dv)), render: (dv) => daysAllocated(agingDate(dv)) },
];

/* ============ Warehouse Stock ============ */
// Same tier breakdown as Stock Aging (FIFO days since the export's own "date current state
// attained"), but for devices earmarked for this depot that are still physically sitting in
// a warehouse -- see the "In Warehouse (Pending)" KPI and the Upload Warehouse Stock import.
function WarehouseTab({ rec }) {
  const { data } = useApp();
  const devices = ledgerDevices(data.warehousePending, rec.code);
  const groups = groupDevicesByTier(devices);
  const [activeTier, setActiveTier] = React.useState(null);
  const shown = activeTier ? groups[activeTier] : [];
  return React.createElement(React.Fragment, null,
    React.createElement("div", { style: { fontSize: 12.8, color: "var(--text-muted)", marginBottom: 14 } }, "Devices allocated to this depot but not yet physically here — still sitting in a warehouse. How long each one has been waiting, from the last warehouse-stock upload."),
    devices.length === 0 && React.createElement("div", { className: "table-wrap" }, React.createElement("div", { style: { padding: 20, color: "var(--text-faint)", fontSize: 12.5 } }, "No warehouse-pending devices on file for this depot.")),
    devices.length > 0 && React.createElement(React.Fragment, null,
      React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
        LEDGER_TIERS.map((t) => React.createElement("button", { key: t.key, className: "kpi-tile", style: { textAlign: "left", cursor: "pointer", outline: activeTier === t.key ? "2px solid var(--accent, #2a78d6)" : "none" }, onClick: () => setActiveTier((a) => (a === t.key ? null : t.key)) },
          React.createElement("div", { className: "kpi-label" }, t.label),
          React.createElement("div", { className: "kpi-value" }, fmtNum(groups[t.key].length)),
          React.createElement("div", { className: "kpi-foot" }, t.min === undefined ? "0–" + t.max + " days" : t.max === undefined ? t.min + "+ days" : t.min + "–" + t.max + " days")))),
      activeTier && React.createElement(React.Fragment, null,
        React.createElement("div", { className: "drawer-section-title" }, LEDGER_TIERS.find((t) => t.key === activeTier).label, " devices"),
        React.createElement(DataTable, {
          columns: WAREHOUSE_COLUMNS, rows: shown, rowKey: (dv) => dv.serial, defaultSortKey: "allocatedDate",
          emptyMessage: "No devices in this tier.",
        })),
      !activeTier && React.createElement("div", { style: { fontSize: 12.5, color: "var(--text-faint)" } }, "Click a tier above to see its devices.")));
}
const WAREHOUSE_COLUMNS = [
  { key: "serial", label: "Serial", sortable: true, render: (dv) => React.createElement("span", { className: "mono" }, dv.serial) },
  { key: "model", label: "Product", sortable: true, render: (dv) => dv.model || "—" },
  { key: "shopName", label: "Owner (as on file)", sortable: true, render: (dv) => dv.shopName || "—" },
  { key: "allocatedDate", label: "In Warehouse Since", sortable: true, sortValue: (dv) => agingDate(dv), render: (dv) => fmtDateShort(agingDate(dv)) },
  { key: "days", label: "Days", numeric: true, sortable: true, sortValue: (dv) => daysAllocated(agingDate(dv)), render: (dv) => daysAllocated(agingDate(dv)) },
];

/* ============ Audit History ============ */
function AuditTab({ rec }) {
  const { data } = useApp();
  const [rows, setRows] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    setLoading(true);
    data.fetchAuditLog({ depotCode: rec.code }).then(setRows).finally(() => setLoading(false));
  }, [data, rec.code]);

  const columns = React.useMemo(() => [
    { key: "occurredAt", label: "When", sortable: true, render: (r) => fmtDateTime(r.occurredAt) },
    { key: "tableName", label: "Table", sortable: true },
    { key: "action", label: "Action", sortable: true, render: (r) => React.createElement(Pill, { cls: r.action === "insert" ? "pill-success" : r.action === "delete" ? "pill-critical" : "pill-warning" }, r.action) },
    { key: "actor", label: "By", sortable: true, render: (r) => r.actor || "—" },
    { key: "change", label: "Change", render: (r) => React.createElement("span", { style: { fontSize: 12, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }, title: summarizeAudit(r) }, summarizeAudit(r)) },
  ], []);

  return React.createElement(React.Fragment, null,
    React.createElement("div", { style: { fontSize: 12.8, color: "var(--text-muted)", marginBottom: 14 } }, "Every change to this depot's stock controller, stock, submissions and device ledger, captured automatically."),
    loading ? React.createElement("div", { style: { padding: 20, color: "var(--text-faint)" } }, "Loading…")
      : React.createElement(DataTable, {
        columns, rows: rows || [], rowKey: (r) => r.id, defaultSortKey: "occurredAt", defaultSortDir: "desc",
        emptyMessage: "No audit history yet.",
      }));
}
function summarizeAudit(row) {
  if (row.action === "insert") return "Created";
  if (row.action === "delete") return "Deleted";
  if (!row.oldValue || !row.newValue) return "Updated";
  const changed = Object.keys(row.newValue).filter((k) => JSON.stringify(row.oldValue[k]) !== JSON.stringify(row.newValue[k]));
  return changed.length ? changed.map((k) => k + ": " + String(row.oldValue[k]) + " → " + String(row.newValue[k])).join(", ") : "No field changes";
}
