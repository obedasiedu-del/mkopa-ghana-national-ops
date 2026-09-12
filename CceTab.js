"use strict";
function CceTab() {
    const { data, scope, search, openModal, openDrawer, runAction } = useApp();
    let cces = ccesForScope(data.cces, data.depots, scope);
    const q = search.trim().toLowerCase();
    if (q)
        cces = cces.filter((c) => ((c.name || "") + " " + (c.depotName || "")).toLowerCase().includes(q));
    cces = [...cces].sort((a, b) => (a.depotName || "").localeCompare(b.depotName || "") || (a.name || "").localeCompare(b.name || ""));
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } },
            React.createElement("div", { style: { fontSize: 13, color: "var(--text-muted)" } },
                cces.length,
                " CCE",
                cces.length === 1 ? "" : "s",
                " in ",
                scope === "national" ? "all territories" : scope),
            React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => openModal("cce", { existing: null }) }, "+ Add CCE")),
        React.createElement("div", { className: "table-wrap" },
            React.createElement("table", null,
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Name"),
                        React.createElement("th", null, "Depot"),
                        React.createElement("th", null, "Territory"),
                        React.createElement("th", null, "Status"),
                        React.createElement("th", null, "Score"),
                        React.createElement("th", null, "Phone"),
                        React.createElement("th", null))),
                React.createElement("tbody", null,
                    cces.length === 0 && React.createElement(EmptyRow, { colSpan: 7 }, "No CCEs recorded yet. Use \"Add CCE\" to start."),
                    cces.map((c) => (React.createElement("tr", { key: c.id, className: "clickable" },
                        React.createElement("td", { onClick: () => openModal("cce", { existing: c }) }, c.name || "—"),
                        React.createElement("td", { onClick: () => openDrawer(c.depotCode) }, c.depotName || "—"),
                        React.createElement("td", { onClick: () => openDrawer(c.depotCode) }, c.territory || "—"),
                        React.createElement("td", { onClick: () => openModal("cce", { existing: c }) },
                            React.createElement(CceStatusPill, { status: c.status })),
                        React.createElement("td", { onClick: () => openModal("cce", { existing: c }) },
                            React.createElement(ScoreCell, { score: typeof c.score === "number" ? c.score : null })),
                        React.createElement("td", { className: "mono", onClick: () => openModal("cce", { existing: c }) }, c.phone || "—"),
                        React.createElement("td", null,
                            React.createElement("button", { className: "icon-btn", title: "Remove", onClick: (e) => {
                                    e.stopPropagation();
                                    if (confirm("Remove " + (c.name || "this CCE") + "?"))
                                        runAction(() => data.deleteCce(c.id), "Removed");
                                } }, "\u2715"))))))))));
}
