"use strict";
import React from "react";
import { useApp } from "../context/AppContext.js";
import { DepotTable } from "../components/DepotTable.js";
import { KpiTile, Breadcrumb } from "../components/ui.js";
import { fmtNum, REGION_ORDER } from "../lib/domain.js";
import { depotsForScope, overviewStats } from "../lib/selectors.js";

export function RegionPage() {
  const { data, route, search, goNational } = useApp();
  const region = route.region;
  if (!REGION_ORDER.includes(region)) {
    return React.createElement("div", { className: "content" },
      React.createElement("div", { className: "banner" }, React.createElement("span", null, "⚠"), React.createElement("div", null, "Unknown region \"" + region + "\".")));
  }
  const stats = overviewStats(data, region);
  const c = stats.ledgerCounts;
  const agedTotal = c.aged + c.urgent + c.highrisk;
  const agedPct = c.total ? Math.round((agedTotal / c.total) * 1000) / 10 : null;
  const depots = depotsForScope(data.depots, region);

  return React.createElement("div", { className: "content" },
    React.createElement(Breadcrumb, { items: [{ label: "National", onClick: goNational }, { label: region }] }),
    React.createElement("div", { className: "topbar-row", style: { marginBottom: 14 } },
      React.createElement("div", null,
        React.createElement("div", { className: "scope-title" }, region),
        React.createElement("div", { className: "scope-sub" }, stats.activeDepots, " active depots"))),
    React.createElement("div", { className: "kpi-grid" },
      React.createElement(KpiTile, { label: "Devices tracked", value: fmtNum(stats.deviceTotal), foot: "at depot" }),
      React.createElement(KpiTile, { label: "Active depots", value: fmtNum(stats.activeDepots), foot: (stats.totalDepots - stats.activeDepots) + " closed" }),
      React.createElement(KpiTile, { label: "SC coverage", value: stats.scFilled + "/" + stats.activeDepots, foot: stats.scVacant + " vacant" }),
      React.createElement(KpiTile, { label: "Submitted today", value: stats.submittedToday + "/" + stats.expectedSubmissions, foot: "depots with today's entry" }),
      React.createElement(KpiTile, { label: "Aged stock (11d+)", value: agedPct === null ? "—" : agedPct + "%", foot: fmtNum(agedTotal) + " devices" }),
      React.createElement(KpiTile, { label: "High risk (30d+)", value: fmtNum(c.highrisk), foot: "escalate now" })),
    React.createElement("div", { className: "section-heading", style: { marginTop: 14 } }, "Depots in ", region),
    React.createElement(DepotTable, { depots }));
}
