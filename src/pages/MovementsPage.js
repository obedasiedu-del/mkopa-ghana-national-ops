"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { FilterBar, Pill, Breadcrumb } from "../components/ui.js";
import { DataTable } from "../components/DataTable.js";
import { REGION_ORDER, SUBMISSION_MODELS, fmtDateTime } from "../lib/domain.js";
import { depotsForScope } from "../lib/selectors.js";

export function MovementsPage() {
  const { data, auth, route, goNational, goRegion, openModal } = useApp();
  const [region, setRegion] = React.useState(route.region);
  const [depotCode, setDepotCode] = React.useState(null);
  const [model, setModel] = React.useState(null);
  const [dateFrom, setDateFrom] = React.useState(null);
  const [dateTo, setDateTo] = React.useState(null);
  const [rows, setRows] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const scopedDepots = React.useMemo(() => (region ? depotsForScope(data.depots, region) : depotsForScope(data.depots, "national")), [data.depots, region]);
  const modelOptions = React.useMemo(() => {
    const set = new Set(SUBMISSION_MODELS);
    Object.values(data.stockBalances).forEach((byModel) => Object.keys(byModel).forEach((m) => set.add(m)));
    return Array.from(set).sort();
  }, [data.stockBalances]);

  const load = React.useCallback(() => {
    setLoading(true);
    const depotCodes = depotCode ? [depotCode] : (region ? scopedDepots.map((d) => d.code) : undefined);
    data.fetchMovements({
      depotCodes, model: model || undefined,
      sinceIso: dateFrom ? dateFrom + "T00:00:00Z" : undefined,
      untilIso: dateTo ? dateTo + "T23:59:59Z" : undefined,
      limit: 300,
    }).then(setRows).finally(() => setLoading(false));
  }, [data, region, depotCode, model, dateFrom, dateTo, scopedDepots]);
  React.useEffect(() => { load(); }, [load]);

  const columns = React.useMemo(() => [
    { key: "movedAt", label: "When", sortable: true, render: (m) => fmtDateTime(m.movedAt) },
    { key: "depotCode", label: "Depot", sortable: true, render: (m) => data.depots[m.depotCode]?.name || m.depotCode || "—" },
    { key: "movementType", label: "Type", sortable: true, render: (m) => React.createElement(Pill, { cls: "pill-muted" }, m.movementType.replace(/_/g, " ")) },
    { key: "model", label: "Model / Serial", render: (m) => [m.model, m.serial].filter(Boolean).join(" · ") || "—" },
    { key: "quantity", label: "Qty", numeric: true, sortable: true },
    { key: "toDepotCode", label: "To / From", render: (m) => (m.toDepotCode ? (data.depots[m.toDepotCode]?.name || m.toDepotCode) : "—") },
    { key: "reference", label: "Note", render: (m) => m.reference || "—" },
    { key: "recordedBy", label: "By", sortable: true, render: (m) => m.recordedBy || "—" },
  ], [data.depots]);

  const canRecord = !!auth.role && auth.role.role !== "viewer";
  const breadcrumbItems = region
    ? [{ label: "National", onClick: goNational }, { label: region, onClick: () => goRegion(region) }, { label: "Stock Movement" }]
    : [{ label: "National", onClick: goNational }, { label: "Stock Movement" }];

  return React.createElement("div", { className: "content" },
    React.createElement(Breadcrumb, { items: breadcrumbItems }),
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 14 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, "Stock Movement", region ? " — " + region : " — National"),
        React.createElement("div", { className: "scope-sub" }, "Transfers, receipts, issues, returns and status changes")),
      canRecord && React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => openModal("recordMovement", { depotCode: depotCode || (scopedDepots[0] || {}).code, onSaved: load }) }, "+ Record Movement")),
    React.createElement(FilterBar, {
      regionOptions: REGION_ORDER, region, onRegionChange: (r) => { setRegion(r); setDepotCode(null); },
      depotOptions: scopedDepots, depotCode, onDepotChange: setDepotCode,
      modelOptions, model, onModelChange: setModel,
      dateFrom, onDateFromChange: setDateFrom, dateTo, onDateToChange: setDateTo,
      onClear: () => { setRegion(null); setDepotCode(null); setModel(null); setDateFrom(null); setDateTo(null); },
    }),
    loading ? React.createElement("div", { style: { padding: 20, color: "var(--text-faint)" } }, "Loading…")
      : React.createElement(DataTable, {
        columns, rows: rows || [], rowKey: (m) => m.id, defaultSortKey: "movedAt", defaultSortDir: "desc",
        emptyMessage: "No movements match these filters.",
      }));
}
