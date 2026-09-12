"use strict";
function TerritoryCard({ t }) {
    const { data, setScope, setTab } = useApp();
    const depots = depotsForScope(data.depots, t);
    const active = activeDepots(depots);
    const filled = active.filter((d) => d.scStatus === "active");
    const pct = active.length ? Math.round((filled.length / active.length) * 100) : 0;
    return (React.createElement("button", { className: "territory-card", onClick: () => { setScope(t); setTab("overview"); } },
        React.createElement("div", { className: "territory-name" },
            t,
            React.createElement("span", { className: "arrow" }, "\u2192")),
        React.createElement("div", { className: "territory-stats" },
            React.createElement("div", null,
                React.createElement("div", { className: "territory-stat-num" }, active.length),
                React.createElement("div", { className: "territory-stat-label" }, "Depots")),
            React.createElement("div", null,
                React.createElement("div", { className: "territory-stat-num" },
                    filled.length,
                    "/",
                    active.length),
                React.createElement("div", { className: "territory-stat-label" }, "SC filled"))),
        React.createElement("div", { className: "territory-bar" },
            React.createElement("div", { className: "territory-bar-fill", style: { width: pct + "%" } }))));
}
function OverviewTab() {
    const { data, scope } = useApp();
    const [territoryView, setTerritoryView] = React.useState("map");
    const depots = depotsForScope(data.depots, scope);
    const active = activeDepots(depots);
    const filled = active.filter((d) => d.scStatus === "active");
    const vacant = active.filter((d) => d.scStatus === "vacant");
    const cces = ccesForScope(data.cces, data.depots, scope);
    const activeCces = cces.filter((c) => c.status !== "inactive");
    const scoredDepots = active.filter((d) => typeof d.scScore === "number");
    const avgScore = scoredDepots.length ? Math.round(scoredDepots.reduce((s, d) => s + d.scScore, 0) / scoredDepots.length) : null;
    let deviceTotal = 0;
    depots.forEach((d) => { deviceTotal += deviceTotals(data.depotStock[d.code]).total; });
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "kpi-grid" },
            React.createElement(KpiTile, { label: "Active depots", value: String(active.length), foot: (depots.length - active.length) + " closed" }),
            React.createElement(KpiTile, { label: "SC coverage", value: filled.length + "/" + active.length, foot: vacant.length + " vacant" }),
            React.createElement(KpiTile, { label: "Active CCEs", value: String(activeCces.length), foot: cces.length !== activeCces.length ? (cces.length - activeCces.length) + " inactive" : "across " + active.length + " depots" }),
            React.createElement(KpiTile, { label: "Avg SC score", value: avgScore === null ? "—" : String(avgScore), foot: scoredDepots.length + " scored" }),
            React.createElement(KpiTile, { label: "Devices tracked", value: String(deviceTotal), foot: "in current stock ledger" })),
        scope === "national" ? (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "section-heading-row" },
                React.createElement("div", { className: "section-heading" }, "Territories"),
                React.createElement("div", { className: "view-toggle" },
                    React.createElement("button", { className: territoryView === "map" ? "active" : "", onClick: () => setTerritoryView("map") }, "Map"),
                    React.createElement("button", { className: territoryView === "cards" ? "active" : "", onClick: () => setTerritoryView("cards") }, "Cards"))),
            territoryView === "map" ? (React.createElement(GhanaMap, null)) : (React.createElement("div", { className: "territory-grid" }, TERRITORY_ORDER.map((t) => React.createElement(TerritoryCard, { key: t, t: t })))))) : (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "section-heading" },
                "Depots in ",
                scope),
            React.createElement(DepotTable, { depots: depots })))));
}
