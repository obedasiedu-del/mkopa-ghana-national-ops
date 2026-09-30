"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { DepotTable } from "../components/DepotTable.js";
import { KpiTile, Breadcrumb } from "../components/ui.js";
import { AgingBarChart } from "../components/charts/AgingBarChart.js";
import { MovementTrendChart } from "../components/charts/MovementTrendChart.js";
import { AgingBreakdown } from "../components/AgingBreakdown.js";
import { DailySubmissionOverview } from "../components/DailySubmissionOverview.js";
import { DataTable } from "../components/DataTable.js";
import { DirectAccuracySection } from "../components/DirectAccuracySection.js";
import { ViewingAsOfSection } from "../components/ViewingAsOfSection.js";
import { fmtDateShort, REGION_ORDER, OTHER_SCOPES, STOCK_MOVEMENT_ENABLED } from "../lib/domain.js";
import { depotsForScope, ledgerDevicesForScope, overviewStats, bucketMovementsByDay, haltStatusesForScope, indirectAccuracyStats } from "../lib/selectors.js";
import { isAdmin } from "../data/useAuth.js";

const INDIRECT_ACCURACY_COLUMNS = [
  { key: "name", label: "Shop", sortable: true },
  { key: "region", label: "Territory", sortable: true },
  { key: "pct", label: "Accuracy (range avg)", numeric: true, sortable: true, sortValue: (r) => (r.pct === null ? -1 : r.pct), render: (r) => (r.pct === null ? "—" : r.pct + "%") },
  { key: "entries", label: "Entries", numeric: true, sortable: true },
  { key: "periodDate", label: "Latest in range", sortable: true, render: (r) => (r.periodDate ? fmtDateShort(r.periodDate) : "—") },
];
function IndirectAccuracySection() {
  const { data, auth, openModal } = useApp();
  const userIsAdmin = isAdmin(auth.role);
  const stats = indirectAccuracyStats(data);
  const history = data.indirectAccuracyHistory;
  const sortedDates = React.useMemo(() => history.map((r) => r.periodDate).sort(), [history]);
  const minDate = sortedDates[0] || null;
  const maxDate = sortedDates[sortedDates.length - 1] || null;
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const effFrom = fromDate || minDate;
  const effTo = toDate || maxDate;
  const isCustomRange = !!(fromDate || toDate);

  const rangeRows = React.useMemo(() => {
    if (!effFrom || !effTo) return [];
    return history.filter((r) => r.periodDate >= effFrom && r.periodDate <= effTo);
  }, [history, effFrom, effTo]);
  const perShop = React.useMemo(() => {
    const map = {};
    rangeRows.forEach((r) => {
      if (!map[r.shopCode]) map[r.shopCode] = { sum: 0, count: 0, latestDate: null };
      const m = map[r.shopCode];
      m.sum += r.pct; m.count++;
      if (!m.latestDate || r.periodDate > m.latestDate) m.latestDate = r.periodDate;
    });
    return map;
  }, [rangeRows]);
  const rangeAvg = rangeRows.length ? Math.round((rangeRows.reduce((s, r) => s + r.pct, 0) / rangeRows.length) * 10) / 10 : null;
  const shopsInRange = Object.keys(perShop).length;
  const shopRows = React.useMemo(() => Object.values(data.indirectShops).map((s) => {
    const agg = perShop[s.code];
    return {
      code: s.code, name: s.name, region: s.region,
      pct: agg ? Math.round((agg.sum / agg.count) * 10) / 10 : null,
      periodDate: agg ? agg.latestDate : null,
      entries: agg ? agg.count : 0,
    };
  }), [data.indirectShops, perShop]);

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "section-heading-row", style: { marginTop: 22 } },
      React.createElement("div", { className: "section-heading" }, "Indirect Stock Accuracy"),
      userIsAdmin && React.createElement("button", { className: "btn btn-sm", onClick: () => openModal("bulkIndirectAccuracy") }, "Upload Indirect Accuracy (All Shops)")),
    stats.latestDate && stats.stale && React.createElement("div", { className: "banner", style: { marginBottom: 14 } },
      React.createElement("span", null, "⚠"),
      React.createElement("div", null,
        React.createElement("strong", null, "Stale — "), "last updated ", fmtDateShort(stats.latestDate), " (", stats.daysStale, " days ago). This figure may no longer reflect reality.")),
    !stats.latestDate && React.createElement("div", { className: "banner", style: { marginBottom: 14 } },
      React.createElement("span", null, "⚠"),
      React.createElement("div", null, "No Indirect Stock Accuracy entries on file yet.")),
    minDate && React.createElement("div", { className: "kpi-datebar", style: { marginBottom: 14 } },
      React.createElement("span", { style: { fontSize: 12.5, color: "var(--text-muted)" } }, "From"),
      React.createElement("input", { type: "date", className: "field-input", style: { width: "auto" }, value: effFrom || "", min: minDate, max: effTo || maxDate, onChange: (e) => setFromDate(e.target.value) }),
      React.createElement("span", { style: { fontSize: 12.5, color: "var(--text-muted)" } }, "to"),
      React.createElement("input", { type: "date", className: "field-input", style: { width: "auto" }, value: effTo || "", min: effFrom || minDate, max: maxDate, onChange: (e) => setToDate(e.target.value) }),
      isCustomRange && React.createElement("button", { className: "btn btn-sm", onClick: () => { setFromDate(""); setToDate(""); } }, "Reset to all data"),
      React.createElement("div", { className: "kpi-datebar-summary" },
        rangeRows.length ? rangeRows.length + " entr" + (rangeRows.length === 1 ? "y" : "ies") + " · " + shopsInRange + " shop" + (shopsInRange === 1 ? "" : "s") + " in range" : "No entries in this range")),
    React.createElement("div", { className: "kpi-grid", style: { marginBottom: 16 } },
      React.createElement(KpiTile, { label: "Indirect Stock Accuracy", value: rangeAvg === null ? "—" : rangeAvg + "%", foot: effFrom && effTo ? fmtDateShort(effFrom) + " – " + fmtDateShort(effTo) : "no entries yet" }),
      React.createElement(KpiTile, { label: "Shops Reporting", value: shopsInRange + "/" + stats.totalShops, foot: "in selected range" })),
    React.createElement(DataTable, {
      columns: INDIRECT_ACCURACY_COLUMNS, rows: shopRows, rowKey: (r) => r.code, defaultSortKey: "pct", defaultSortDir: "asc",
      emptyMessage: "No indirect shops on file yet.",
    }));
}

export function RegionPage() {
  const { data, auth, route, search, goNational, goMovements, goAudit, goHalts } = useApp();
  const region = route.region;
  if (!REGION_ORDER.includes(region) && !OTHER_SCOPES.includes(region)) {
    return React.createElement("div", { className: "content" },
      React.createElement("div", { className: "banner" }, React.createElement("span", null, "⚠"), React.createElement("div", null, "Unknown region \"" + region + "\".")));
  }
  const stats = overviewStats(data, region);
  const c = stats.ledgerCounts;
  const userIsAdmin = isAdmin(auth.role);
  const depots = depotsForScope(data.depots, region);
  const regionDevices = React.useMemo(() => ledgerDevicesForScope(data.deviceLedger, data.depots, region), [data.deviceLedger, data.depots, region]);

  const haltStatuses = React.useMemo(() => haltStatusesForScope(data, region), [data, region]);
  const haltedDepots = haltStatuses.filter((s) => s.halted);
  const haltPhase = haltStatuses[0]?.phase || null;

  const [movements7d, setMovements7d] = React.useState(null);
  React.useEffect(() => {
    if (!STOCK_MOVEMENT_ENABLED) return;
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    data.fetchMovementCount({ depotCodes: depots.map((d) => d.code), sinceIso: since }).then(setMovements7d).catch(() => setMovements7d(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, data]);

  const TREND_DAYS = 14;
  const [trendPoints, setTrendPoints] = React.useState(null);
  React.useEffect(() => {
    if (!STOCK_MOVEMENT_ENABLED) return;
    const since = new Date(Date.now() - TREND_DAYS * 86400000).toISOString();
    data.fetchMovements({ depotCodes: depots.map((d) => d.code), sinceIso: since, limit: 2000 }).then((rows) => setTrendPoints(bucketMovementsByDay(rows, TREND_DAYS))).catch(() => setTrendPoints([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, data]);

  return React.createElement("div", { className: "content" },
    React.createElement(Breadcrumb, { items: [{ label: "National", onClick: goNational }, { label: region }] }),
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 14 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, region),
        React.createElement("div", { className: "scope-sub" }, stats.activeDepots, " active depots"))),
    haltedDepots.length > 0 && React.createElement("div", { className: "banner banner-critical" },
      React.createElement("span", null, "⛔"),
      React.createElement("div", null,
        React.createElement("strong", null, haltedDepots.length, " depot", haltedDepots.length === 1 ? "" : "s", " on allocation halt"),
        " in ", region, " under ", haltPhase.label, " — aged stock (14d+) above the phase limit. ",
        React.createElement("button", { className: "btn btn-sm", style: { marginLeft: 6 }, onClick: () => goHalts(region) }, "View Halt Status Report →"))),
    React.createElement(ViewingAsOfSection, { scope: region, movements7d }),
    React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16 } },
      STOCK_MOVEMENT_ENABLED && React.createElement("button", { className: "btn btn-sm", onClick: () => goMovements(region) }, "View Stock Movement Log →"),
      userIsAdmin && React.createElement("button", { className: "btn btn-sm", onClick: () => goAudit(region) }, "View Audit History →"),
      React.createElement("button", { className: "btn btn-sm", onClick: () => goHalts(region) }, "View Halt Status Report →")),
    (userIsAdmin || STOCK_MOVEMENT_ENABLED) && React.createElement("div", { className: "chart-grid", style: { marginBottom: 22 } },
      userIsAdmin && React.createElement("div", null,
        React.createElement("div", { className: "section-heading" }, "Stock Aging Distribution"),
        React.createElement(AgingBarChart, { counts: c })),
      STOCK_MOVEMENT_ENABLED && React.createElement("div", null,
        React.createElement("div", { className: "section-heading" }, "Stock Movement — last ", TREND_DAYS, " days"),
        React.createElement(MovementTrendChart, { points: trendPoints }))),
    region === "Indirect" && React.createElement(IndirectAccuracySection, null),
    REGION_ORDER.includes(region) && React.createElement(DirectAccuracySection, { scope: region }),
    React.createElement("div", { className: "section-heading", style: { marginTop: 14 } }, "Daily Submission — ", region),
    React.createElement(DailySubmissionOverview, { scope: region }),
    React.createElement("div", { className: "section-heading", style: { marginTop: 22 } }, "Devices with DSRs — by age, ", region),
    React.createElement(AgingBreakdown, { devices: regionDevices, showDepotColumn: true }),
    React.createElement("div", { className: "section-heading", style: { marginTop: 22 } }, "Depots in ", region),
    React.createElement(DepotTable, { depots }));
}
