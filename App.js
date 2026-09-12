"use strict";
const TABS = [
    { id: "overview", label: "Overview" },
    { id: "sc", label: "Stock Controllers" },
    { id: "cce", label: "CCs" },
    { id: "devices", label: "Devices" },
];
function Sidebar() {
    const { data, scope, setScope } = useApp();
    const allDepots = depotsForScope(data.depots, "national");
    return (React.createElement("aside", { className: "sidebar" },
        React.createElement("div", { className: "brand" },
            React.createElement("div", { className: "brand-mark" },
                React.createElement("div", { className: "brand-icon" }, "GH"),
                React.createElement("div", null,
                    React.createElement("div", { className: "brand-title" }, "M-KOPA Ghana Field Ops (Retail)"),
                    React.createElement("div", { className: "brand-sub" }, "National depot network")))),
        React.createElement("div", { className: "nav-section" },
            React.createElement("div", { className: "nav-label" }, "Scope"),
            React.createElement("button", { className: "nav-item" + (scope === "national" ? " active" : ""), onClick: () => setScope("national") },
                "National ",
                React.createElement("span", { className: "count" }, activeDepots(allDepots).length))),
        React.createElement("div", { className: "nav-section", style: { flex: 1 } },
            React.createElement("div", { className: "nav-label" }, "Territories"),
            TERRITORY_ORDER.map((t) => {
                const list = depotsForScope(data.depots, t);
                return (React.createElement("button", { key: t, className: "nav-item" + (scope === t ? " active" : ""), onClick: () => setScope(t) },
                    t,
                    " ",
                    React.createElement("span", { className: "count" }, activeDepots(list).length)));
            })),
        React.createElement("div", { className: "sidebar-footer" }, data.loaded ? "Synced" : (data.dbError ? "Connection error" : "Connecting…"))));
}
function Topbar() {
    const { data, scope, tab, setTab, search, setSearch } = useApp();
    let title, sub;
    if (scope === "national") {
        const d = depotsForScope(data.depots, "national");
        title = "National Overview";
        sub = `${TERRITORY_ORDER.length} territories · ${activeDepots(d).length} active depots`;
    }
    else {
        const d = depotsForScope(data.depots, scope);
        title = scope;
        sub = `${activeDepots(d).length} active depots`;
    }
    return (React.createElement("div", { className: "topbar" },
        React.createElement("div", { className: "topbar-row" },
            React.createElement("div", null,
                React.createElement("div", { className: "scope-title" }, title),
                React.createElement("div", { className: "scope-sub" }, sub)),
            React.createElement("div", { className: "topbar-actions" },
                React.createElement("div", { className: "search-box" },
                    React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
                        React.createElement("circle", { cx: "11", cy: "11", r: "7" }),
                        React.createElement("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })),
                    React.createElement("input", { placeholder: "Search depot, SC or CCE\u2026", value: search, onChange: (e) => setSearch(e.target.value) })))),
        React.createElement("div", { className: "tabs" }, TABS.map((t) => (React.createElement("button", { key: t.id, className: "tab-btn" + (tab === t.id ? " active" : ""), onClick: () => setTab(t.id) }, t.label))))));
}
function Content() {
    const { data, tab, scope } = useApp();
    const depots = depotsForScope(data.depots, scope);
    const active = activeDepots(depots);
    return (React.createElement("div", { className: "content" },
        data.dbError && (React.createElement("div", { className: "banner" },
            React.createElement("span", null, "\u26A0"),
            React.createElement("div", null, "Can't reach live storage right now \u2014 edits here won't be saved until the connection recovers."))),
        tab === "overview" && React.createElement(OverviewTab, null),
        tab === "sc" && (React.createElement(React.Fragment, null,
            React.createElement("div", { style: { marginBottom: 14, fontSize: 13, color: "var(--text-muted)" } },
                active.length,
                " active depot",
                active.length === 1 ? "" : "s",
                " in ",
                scope === "national" ? "all territories" : scope),
            React.createElement(DepotTable, { depots: depots }))),
        tab === "cce" && React.createElement(CceTab, null),
        tab === "devices" && React.createElement(DevicesTab, null)));
}
function Shell() {
    const { toasts } = useApp();
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { id: "app" },
            React.createElement(Sidebar, null),
            React.createElement("div", { className: "main" },
                React.createElement(Topbar, null),
                React.createElement(Content, null))),
        React.createElement(DepotDrawer, null),
        React.createElement(ModalHost, null),
        React.createElement(ToastStack, { toasts: toasts })));
}
function App() {
    return (React.createElement(AppProvider, null,
        React.createElement(Shell, null)));
}
