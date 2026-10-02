"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { canWriteDepot } from "../data/useAuth.js";
import { KpiTile, Pill, ScStatusPill, FieldInput, FieldSelect, FieldTextarea, Tabs, Breadcrumb, HaltBanner } from "../components/ui.js";
import { DataTable } from "../components/DataTable.js";
import { AgingBreakdown } from "../components/AgingBreakdown.js";
import { DepotViewingAsOfSection } from "../components/DepotViewingAsOfSection.js";
import { ledgerDevices, depotStockTotals, latestSubmissionForDepot } from "../lib/selectors.js";
import { activeHaltPhase, haltStatusForDepot } from "../lib/haltPolicy.js";
import {
  SUBMISSION_MODELS, LEDGER_TIERS, LEDGER_TIER_COLOR_VAR, submissionTotals, todayStr,
  fmtDateShort, fmtDateTime, fmtNum, agedPctColor, daysAllocated, agingDate, ledgerTierFor, countsForDevices, trueAgePct, psdsrPct,
  groupDevicesByTier, downloadCsv, WAREHOUSE_PENDING_ENABLED, STOCK_MOVEMENT_ENABLED, kpiBadge,
  clockInIsLate, mapsLinkForCoords,
} from "../lib/domain.js";

const DEPOT_TABS_BASE = [
  { id: "devices", label: "Devices" },
  { id: "submission", label: "Daily Submission" },
  ...(STOCK_MOVEMENT_ENABLED ? [{ id: "movement", label: "Stock Movement" }] : []),
  ...(WAREHOUSE_PENDING_ENABLED ? [{ id: "warehouse", label: "Warehouse Stock" }] : []),
  { id: "audit", label: "Audit History" },
];

export function DepotPage() {
  const { data, auth, route, goNational, goRegion, openModal, runAction } = useApp();
  const rec = data.depots[route.depotCode];
  // A CCE login is confined to her own Service Centre just like a Stock Controller (isSC,
  // below) is confined to her own depot -- but her page only ever shows CCE things: no
  // Stock Controller panel, no device/DSR tables, no Stock Movement/Daily Submission tabs,
  // none of which are hers to see or touch (she gets CceSection instead of DEPOT_TABS
  // entirely, further down). An admin/regional manager/SC looking at the same depot still
  // sees all of those.
  const isCceUser = auth.role && auth.role.role === "cce";
  // Symmetric to isCceUser: a plain Stock Controller login sees only SC things -- the
  // Customer Care Executive panel and CCE KPI tiles are someone else's job, same reasoning
  // as above. An admin/regional manager still sees both, for oversight.
  const isScUser = auth.role && auth.role.role === "depot_controller";
  const isSC = isScUser || isCceUser;
  // Audit History is a raw change log (who edited what, when, old value vs. new) -- an
  // internal accountability tool for the people overseeing a depot, not something the
  // depot's own Stock Controller has any use for seeing about her own record. Admins and
  // regional managers still get it; this only trims it for isScUser.
  const DEPOT_TABS = isScUser ? DEPOT_TABS_BASE.filter((t) => t.id !== "audit") : DEPOT_TABS_BASE;
  const tab = DEPOT_TABS.some((t) => t.id === route.tab) ? route.tab : "devices";

  if (data.loaded && !rec) {
    return React.createElement("div", { className: "content" },
      React.createElement("div", { className: "banner" }, React.createElement("span", null, "⚠"), React.createElement("div", null, "Depot \"" + route.depotCode + "\" was not found.")));
  }
  if (!rec) return React.createElement("div", { className: "content" }, "Loading…");

  const canWrite = canWriteDepot(auth.role, rec.code, rec.region);
  const haltPhase = activeHaltPhase();
  const haltStatus = haltPhase ? haltStatusForDepot(countsForDevices(ledgerDevices(data.deviceLedger, rec.code)), haltPhase) : null;
  // A Stock Controller who hasn't clocked in today sees nothing but the gate below -- not
  // even a collapsed version of her stock data -- so clocking in isn't something she can
  // just scroll past. The one exception is a live-storage outage (data.dbError): she can't
  // clock in without a connection either, and trapping her behind a gate she has no way to
  // clear would be strictly worse than just letting her see whatever's already loaded.
  const clockInEntry = isScUser ? (data.clockInsByDepot[rec.code] || null) : null;
  const needsClockIn = isScUser && !rec.isSynthetic && !clockInEntry && !data.dbError;

  if (needsClockIn) {
    return React.createElement("div", { className: "content" },
      React.createElement("div", { className: "topbar-row", style: { marginBottom: 4 } },
        React.createElement("div", null,
          React.createElement("div", { className: "scope-title" }, rec.name),
          React.createElement("div", { className: "scope-sub" }, rec.code, " · ", rec.region))),
      React.createElement(ClockInGate, { rec }));
  }

  return React.createElement("div", { className: "content" },
    React.createElement(Breadcrumb, {
      // A synthetic bucket (Indirect Channel, Warehouse, etc.) isn't tied to any real
      // region -- its "region" is just the literal string "National" -- so a middle crumb
      // for it would link to a region page that doesn't exist.
      items: rec.isSynthetic
        ? [{ label: "National", onClick: isSC ? undefined : goNational }, { label: rec.name }]
        : [
            { label: "National", onClick: isSC ? undefined : goNational },
            { label: rec.region, onClick: isSC ? undefined : () => goRegion(rec.region) },
            { label: rec.name },
          ],
    }),
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 4 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, rec.name),
        React.createElement("div", { className: "scope-sub" }, rec.code, " · ", rec.region, rec.status === "closed" ? " · Closed" : "")),
      !isCceUser && React.createElement(ScStatusPill, { status: rec.scStatus })),
    isScUser && !rec.isSynthetic && React.createElement(ClockInBox, { rec }),
    React.createElement(HaltBanner, { status: haltStatus }),
    isCceUser
      ? React.createElement("div", { style: { marginTop: 16 } }, React.createElement(CceSection, { rec, canWrite }))
      : React.createElement(React.Fragment, null,
          !rec.isSynthetic && React.createElement(DepotViewingAsOfSection, { rec }),
          React.createElement(Tabs, { tabs: DEPOT_TABS, active: tab, onChange: (id) => window.location.hash = "#/depot/" + encodeURIComponent(rec.code) + "/" + id }),
          React.createElement("div", { style: { marginTop: 16 } },
            tab === "devices" && React.createElement(DevicesTab, { rec, canWrite, isScUser }),
            tab === "submission" && React.createElement(SubmissionTab, { rec, canWrite }),
            tab === "movement" && React.createElement(MovementTab, { rec, canWrite }),
            tab === "warehouse" && React.createElement(WarehouseTab, { rec }),
            tab === "audit" && !isScUser && React.createElement(AuditTab, { rec }))));
}

/* ============ Stock Controller clock-in ============ */
// Browser Geolocation API, tied to the user's own tap of the button (a user gesture, which
// is what most browsers require before they'll even show the permission prompt). Resolves
// null -- never rejects -- on denial, timeout, or an unsupported browser, so the caller
// always gets a clean "no location" case to fall back to rather than a thrown error.
function captureGeolocation(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    let settled = false;
    const finish = (v) => { if (settled) return; settled = true; resolve(v); };
    const timer = setTimeout(() => finish(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timer); finish({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }); },
      () => { clearTimeout(timer); finish(null); },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
// Shown only to the depot's own Stock Controller login (isScUser) -- Admins/Regional
// Managers see the roll-up via the Clock-In KPI card in DepotViewingAsOfSection instead,
// never this button; clocking in isn't theirs to do on someone else's behalf.
function ClockInBox({ rec }) {
  const { data, runAction } = useApp();
  const [working, setWorking] = React.useState(false);
  const entry = data.clockInsByDepot[rec.code] || null;

  async function handleClockIn() {
    setWorking(true);
    try {
      const location = await captureGeolocation();
      await runAction(
        () => data.saveClockIn(rec.code, rec.scName, location),
        location ? "Clocked in" : "Clocked in (no location shared)",
      );
    } finally {
      setWorking(false);
    }
  }

  if (!entry) {
    return React.createElement("div", { className: "clock-in-box" },
      React.createElement("div", { style: { flex: 1 } }, "You haven't clocked in today yet."),
      React.createElement("button", { className: "btn btn-sm", onClick: handleClockIn, disabled: working }, working ? "Clocking in…" : "Clock In"));
  }
  const late = clockInIsLate(entry.clockedInAt);
  const mapsLink = mapsLinkForCoords(entry.lat, entry.lng);
  return React.createElement("div", { className: "clock-in-box" },
    React.createElement(Pill, { cls: late ? "pill-warning" : "pill-success" }, late ? "Clocked in late" : "Clocked in on time"),
    React.createElement("div", { style: { flex: 1 } }, "at " + fmtDateTime(entry.clockedInAt)),
    mapsLink
      ? React.createElement("a", { href: mapsLink, target: "_blank", rel: "noreferrer" }, "📍 View location")
      : React.createElement("span", { style: { color: "var(--text-faint)" } }, "No location shared"));
}

// The full-page blockade shown instead of the depot page's own content when the SC hasn't
// clocked in yet (see needsClockIn above) -- same clock-in action as ClockInBox, just with
// nothing else on the page to see until it succeeds.
function ClockInGate({ rec }) {
  const { data, runAction } = useApp();
  const [working, setWorking] = React.useState(false);

  async function handleClockIn() {
    setWorking(true);
    try {
      const location = await captureGeolocation();
      await runAction(
        () => data.saveClockIn(rec.code, rec.scName, location),
        location ? "Clocked in" : "Clocked in (no location shared)",
      );
    } finally {
      setWorking(false);
    }
  }

  return React.createElement("div", { className: "clock-in-gate-shell" },
    React.createElement("div", { className: "clock-in-gate-card" },
      React.createElement("div", { className: "clock-in-gate-icon" }, "⏰"),
      React.createElement("div", { className: "clock-in-gate-title" }, "Clock in to start"),
      React.createElement("div", { className: "clock-in-gate-body" },
        "You haven't clocked in at " + rec.name + " yet today. Clock in to see your stock, submissions and aging."),
      React.createElement("button", { className: "btn btn-primary", onClick: handleClockIn, disabled: working }, working ? "Clocking in…" : "Clock In Now")));
}

/* ============ Customer Care Executive panel + CCE KPI tiles ============ */
// Shared by DevicesTab (shown to admins/regional managers, hidden from a plain Stock
// Controller login) and CceSection (the whole of what a CCE login sees on her own page).
function CceCard({ rec, canWrite }) {
  const { data, runAction } = useApp();
  const [cceName, setCceName] = React.useState(rec.cceName);
  const [ccePhone, setCcePhone] = React.useState(rec.ccePhone);
  const [cceStatus, setCceStatus] = React.useState(rec.cceStatus);
  const [cceNotes, setCceNotes] = React.useState(rec.cceNotes);
  function saveCce() {
    runAction(() => data.saveDepotField(rec.code, { cceName: cceName.trim(), ccePhone: ccePhone.trim(), cceStatus, cceNotes: cceNotes.trim() }), "Saved");
  }
  const cceRow = data.cceByDepot[rec.code];

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "table-wrap", style: { padding: "14px 16px", marginBottom: 16 } },
      React.createElement("div", { className: "drawer-section-title" }, "Customer Care Executive"),
      React.createElement("div", { className: "field-grid" },
        React.createElement(FieldInput, { label: "Name", value: cceName, onChange: setCceName }),
        React.createElement(FieldInput, { label: "Phone", value: ccePhone, onChange: setCcePhone })),
      React.createElement(FieldSelect, { label: "Status", value: cceStatus, onChange: setCceStatus, options: [["active", "Active"], ["leave", "On Leave"], ["vacant", "Vacant"]] }),
      React.createElement(FieldTextarea, { label: "Notes", value: cceNotes, onChange: setCceNotes }),
      canWrite && React.createElement("button", { className: "btn btn-primary btn-sm", onClick: saveCce }, "Save Customer Care Executive")),
    React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
      React.createElement(KpiTile, { label: "Quality", value: cceRow && cceRow.qualityPct !== null ? cceRow.qualityPct + "%" : "—", foot: cceRow ? "latest, " + fmtDateShort(cceRow.periodDate) : "no entry yet", badge: kpiBadge("qualityPct", cceRow ? cceRow.qualityPct : null) }),
      React.createElement(KpiTile, { label: "SLA Compliance", value: cceRow && cceRow.slaPct !== null ? cceRow.slaPct + "%" : "—", foot: cceRow ? "latest, " + fmtDateShort(cceRow.periodDate) : "no entry yet", badge: kpiBadge("slaPct", cceRow ? cceRow.slaPct : null) }),
      React.createElement(KpiTile, { label: "Footfall", value: cceRow && cceRow.footfall !== null ? fmtNum(cceRow.footfall) : "—", foot: cceRow ? "latest week, " + fmtDateShort(cceRow.periodDate) : "no entry yet" }),
      React.createElement(KpiTile, {
        label: "Inventory Accuracy", value: data.inventoryAccuracyByDepot[rec.code] ? data.inventoryAccuracyByDepot[rec.code].pct + "%" : "—",
        foot: data.inventoryAccuracyByDepot[rec.code] ? "latest, " + fmtDateShort(data.inventoryAccuracyByDepot[rec.code].periodDate) : "no entry yet",
        badge: kpiBadge("inventoryAccuracyPct", data.inventoryAccuracyByDepot[rec.code] ? data.inventoryAccuracyByDepot[rec.code].pct : null),
      })));
}

/* ============ A CCE login's whole page: just her own panel + KPIs ============ */
function CceSection({ rec, canWrite }) {
  return React.createElement(CceCard, { rec, canWrite });
}

/* ============ Devices: At Depot / With DSRs + Stock Controller ============ */
function DevicesTab({ rec, canWrite, isScUser }) {
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
      !isScUser && React.createElement(CceCard, { rec, canWrite }),
      React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
        React.createElement(KpiTile, { label: "Devices at Depot", value: subTotals ? fmtNum(subTotals.totalStock) : "—", foot: latestSubmission ? "from daily submission · " + fmtDateTime(latestSubmission.updatedAt) : "no daily submission yet" }),
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
          React.createElement(KpiTile, { label: "True Age", value: trueAgePct(counts) === null ? "—" : trueAgePct(counts) + "%", foot: "14d+ share of active (in-trade) stock" }),
          React.createElement(KpiTile, {
            label: "PSDSR", value: psdsrPct(data.psdsrByDepot[rec.code]) === null ? "—" : psdsrPct(data.psdsrByDepot[rec.code]) + "%",
            foot: data.psdsrByDepot[rec.code] ? fmtDateShort(data.psdsrByDepot[rec.code].periodDate) + " · tap for names" : "no entry yet",
            onClick: () => openModal("psdsrDetail", { depotCode: rec.code }),
          }),
          React.createElement(KpiTile, {
            label: "Inventory Accuracy", value: data.inventoryAccuracyByDepot[rec.code] ? data.inventoryAccuracyByDepot[rec.code].pct + "%" : "—",
            foot: data.inventoryAccuracyByDepot[rec.code] ? fmtDateShort(data.inventoryAccuracyByDepot[rec.code].periodDate) : "no entry yet",
          })),
        React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 10, gap: 8 } },
          React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("ledger", { depotCode: rec.code }) }, "Open device ledger →")),
        ledgerDvs.length === 0
          ? React.createElement("div", { className: "table-wrap" }, React.createElement("div", { style: { padding: 20, color: "var(--text-faint)", fontSize: 12.5 } }, "No devices with DSRs on file for this depot yet. Use \"Open device ledger\" to paste a baseline."))
          : React.createElement(React.Fragment, null,
            React.createElement("div", { className: "section-heading" }, "Devices with DSRs — by age"),
            React.createElement(AgingBreakdown, { devices: ledgerDvs, tiers: LEDGER_TIERS }))));
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
    const rows = [["Date", "Submitted At", "Submitted By"].concat(SUBMISSION_MODELS.flatMap((m) => [m + " Total", m + " Aged"])).concat(["Total", "Aged", "% Aged"])];
    days.slice().reverse().forEach((h) => {
      const t = submissionTotals(h);
      const p = t.totalStock > 0 ? Math.round((t.agedStock / t.totalStock) * 1000) / 10 : 0;
      const row = [h.date, fmtDateTime(h.updatedAt), h.submittedBy];
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
            React.createElement("th", null, "Date"), React.createElement("th", null, "Submitted at"), React.createElement("th", null, "Submitted by"),
            React.createElement("th", { className: "num" }, "Total"), React.createElement("th", { className: "num" }, "Aged"), React.createElement("th", { className: "num" }, "% Aged"))),
          React.createElement("tbody", null, days.slice(0, 20).map((h) => {
            const t = submissionTotals(h);
            const p = t.totalStock > 0 ? Math.round((t.agedStock / t.totalStock) * 1000) / 10 : 0;
            return React.createElement("tr", { key: h.date },
              React.createElement("td", null, React.createElement(Pill, { cls: h.date === today ? "pill-success" : "pill-muted" }, fmtDateShort(h.date))),
              React.createElement("td", { className: "mono", style: { fontSize: 12 } }, fmtDateTime(h.updatedAt)),
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
          React.createElement("div", { className: "kpi-value", style: { color: `var(${LEDGER_TIER_COLOR_VAR[t.cls]})` } }, fmtNum(groups[t.key].length)),
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
