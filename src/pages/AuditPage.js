"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { FilterBar, Pill, Breadcrumb } from "../components/ui.js";
import { DataTable } from "../components/DataTable.js";
import { REGION_ORDER, fmtDateTime } from "../lib/domain.js";
import { depotsForScope } from "../lib/selectors.js";

function summarize(row) {
  if (row.action === "insert") return "Created";
  if (row.action === "delete") return "Deleted";
  if (!row.oldValue || !row.newValue) return "Updated";
  const changed = Object.keys(row.newValue).filter((k) => JSON.stringify(row.oldValue[k]) !== JSON.stringify(row.newValue[k]));
  return changed.length ? changed.map((k) => k + ": " + String(row.oldValue[k]) + " → " + String(row.newValue[k])).join(", ") : "No field changes";
}

export function AuditPage() {
  const { data, route, goNational, goRegion } = useApp();
  const [region, setRegion] = React.useState(route.region);
  const [depotCode, setDepotCode] = React.useState(null);
  const [dateFrom, setDateFrom] = React.useState(null);
  const [dateTo, setDateTo] = React.useState(null);
  const [rows, setRows] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const scopedDepots = React.useMemo(() => (region ? depotsForScope(data.depots, region) : depotsForScope(data.depots, "national")), [data.depots, region]);

  React.useEffect(() => {
    setLoading(true);
    const depotCodes = depotCode ? [depotCode] : (region ? scopedDepots.map((d) => d.code) : undefined);
    data.fetchAuditLog({
      depotCodes,
      sinceIso: dateFrom ? dateFrom + "T00:00:00Z" : undefined,
      untilIso: dateTo ? dateTo + "T23:59:59Z" : undefined,
      limit: 300,
    }).then(setRows).finally(() => setLoading(false));
  }, [data, region, depotCode, dateFrom, dateTo, scopedDepots]);

  const columns = React.useMemo(() => [
    { key: "occurredAt", label: "When", sortable: true, render: (r) => fmtDateTime(r.occurredAt) },
    { key: "depotCode", label: "Depot", sortable: true, render: (r) => data.depots[r.depotCode]?.name || r.depotCode || "—" },
    { key: "tableName", label: "Table", sortable: true },
    { key: "action", label: "Action", sortable: true, render: (r) => React.createElement(Pill, { cls: r.action === "insert" ? "pill-success" : r.action === "delete" ? "pill-critical" : "pill-warning" }, r.action) },
    { key: "actor", label: "By", sortable: true, render: (r) => r.actor || "—" },
    { key: "change", label: "Change", render: (r) => React.createElement("span", { style: { fontSize: 12, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }, title: summarize(r) }, summarize(r)) },
  ], [data.depots]);

  const breadcrumbItems = region
    ? [{ label: "National", onClick: goNational }, { label: region, onClick: () => goRegion(region) }, { label: "Audit History" }]
    : [{ label: "National", onClick: goNational }, { label: "Audit History" }];

  return React.createElement("div", { className: "content" },
    React.createElement(Breadcrumb, { items: breadcrumbItems }),
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 14 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, "Audit History", region ? " — " + region : " — National"),
        React.createElement("div", { className: "scope-sub" }, "Who changed what, and when — captured automatically for every depot, stock, submission and device-ledger change"))),
    React.createElement(FilterBar, {
      regionOptions: REGION_ORDER, region, onRegionChange: (r) => { setRegion(r); setDepotCode(null); },
      depotOptions: scopedDepots, depotCode, onDepotChange: setDepotCode,
      dateFrom, onDateFromChange: setDateFrom, dateTo, onDateToChange: setDateTo,
      onClear: () => { setRegion(null); setDepotCode(null); setDateFrom(null); setDateTo(null); },
    }),
    loading ? React.createElement("div", { style: { padding: 20, color: "var(--text-faint)" } }, "Loading…")
      : React.createElement(DataTable, {
        columns, rows: rows || [], rowKey: (r) => r.id, defaultSortKey: "occurredAt", defaultSortDir: "desc",
        emptyMessage: "No audit history matches these filters.",
      }));
}
