"use strict";
// Clickable Ghana territory map for the Overview tab. Boundary + depot-pin data lives
// in ghana-map-data.js (loaded before this file). Colors are a validated categorical
// palette (dataviz skill) chosen so every pair of territories that actually border each
// other on this map stays distinguishable.
const GHANA_MAP_COLORS = {
    "Northern & Upper": "#2a78d6",
    "Bono": "#eb6834",
    "Ashanti West": "#1baf7a",
    "Ashanti East": "#4a3aa7",
    "Volta/Oti": "#eda100",
    "Western": "#e87ba4",
    "Eastern": "#e34948",
    "Central": "#008300",
    "Accra West": "#0e948f",
    "Accra East": "#8a3a5c",
};
// Trim the generic "Depot" suffix so pin labels stay short on the map.
function shortDepotName(name) {
    return name.replace(/\s*Depot\s*$/i, "");
}
function GhanaMap() {
    const { data, setScope, openDrawer } = useApp();
    const [hovered, setHovered] = React.useState(null);
    const [selected, setSelected] = React.useState(null);
    const [pointer, setPointer] = React.useState({ x: 0, y: 0 });
    const statsFor = React.useCallback((t) => {
        const depots = depotsForScope(data.depots, t);
        const active = activeDepots(depots);
        const filled = active.filter((d) => d.scStatus === "active");
        const cces = ccesForScope(data.cces, data.depots, t);
        const activeCces = cces.filter((c) => c.status !== "inactive");
        let deviceTotal = 0;
        depots.forEach((d) => { deviceTotal += deviceTotals(data.depotStock[d.code]).total; });
        return { depots: active.length, scFilled: filled.length, cceCount: activeCces.length, deviceTotal };
    }, [data]);
    const selectedDepots = selected ? depotsForScope(data.depots, selected) : [];
    const handleTerritoryClick = (t) => {
        setSelected((s) => (s === t ? null : t));
    };
    return (React.createElement("div", { className: "ghana-map-wrap" },
        selected && (React.createElement("div", { className: "ghana-map-banner" },
            React.createElement("div", null,
                React.createElement("strong", null, selected),
                React.createElement("span", { className: "ghana-map-banner-count" },
                    selectedDepots.length,
                    " depot",
                    selectedDepots.length === 1 ? "" : "s")),
            React.createElement("div", { className: "ghana-map-banner-actions" },
                React.createElement("button", { className: "btn-primary", onClick: () => setScope(selected) }, "View full list \u2192"),
                React.createElement("button", { className: "ghana-map-banner-close", onClick: () => setSelected(null) }, "\u2715")))),
        React.createElement("svg", { className: "ghana-map-svg", viewBox: GHANA_MAP_VIEWBOX, onMouseMove: (e) => setPointer({ x: e.clientX, y: e.clientY }) },
            TERRITORY_ORDER.map((t) => (React.createElement("g", { key: t, className: selected && selected !== t ? "ghana-dim" : "" }, (GHANA_TERRITORY_PATHS[t] || []).map((d, i) => (React.createElement("path", { key: i, className: "ghana-tile" + (hovered === t ? " hovered" : "") + (selected === t ? " selected" : ""), style: { fill: GHANA_MAP_COLORS[t] }, d: d, onMouseEnter: () => setHovered(t), onMouseLeave: () => setHovered((h) => (h === t ? null : h)), onClick: () => handleTerritoryClick(t) })))))),
            TERRITORY_ORDER.map((t) => {
                const p = GHANA_LABEL_POINTS[t];
                if (!p || selected === t)
                    return null;
                return (React.createElement("text", { key: t, className: "ghana-map-label" + (selected && selected !== t ? " ghana-dim" : ""), x: p[0], y: p[1], textAnchor: "middle", dominantBaseline: "middle", onMouseEnter: () => setHovered(t), onMouseLeave: () => setHovered((h) => (h === t ? null : h)), onClick: () => handleTerritoryClick(t) }, t));
            }),
            selected && selectedDepots.map((d) => {
                const p = GHANA_DEPOT_PINS[d.code] || GHANA_LABEL_POINTS[selected];
                if (!p)
                    return null;
                return (React.createElement("g", { key: d.code, className: "ghana-pin", onClick: (e) => { e.stopPropagation(); openDrawer(d.code); } },
                    React.createElement("circle", { cx: p[0], cy: p[1], r: "4" }),
                    React.createElement("text", { x: p[0] + 6, y: p[1], dominantBaseline: "middle" }, shortDepotName(d.name))));
            })),
        hovered && !selected && (React.createElement("div", { className: "ghana-map-tooltip", style: { left: pointer.x + 14, top: pointer.y + 14 } }, (() => {
            const s = statsFor(hovered);
            return (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "ghana-map-tooltip-title" }, hovered),
                React.createElement("div", { className: "ghana-map-tooltip-row" },
                    React.createElement("span", null, "Depots"),
                    React.createElement("span", null, s.depots)),
                React.createElement("div", { className: "ghana-map-tooltip-row" },
                    React.createElement("span", null, "SC filled"),
                    React.createElement("span", null,
                        s.scFilled,
                        "/",
                        s.depots)),
                React.createElement("div", { className: "ghana-map-tooltip-row" },
                    React.createElement("span", null, "Active CCEs"),
                    React.createElement("span", null, s.cceCount)),
                React.createElement("div", { className: "ghana-map-tooltip-row" },
                    React.createElement("span", null, "Devices tracked"),
                    React.createElement("span", null, s.deviceTotal)),
                React.createElement("div", { className: "ghana-map-tooltip-hint" }, "Click to see depots on the map \u2192")));
        })()))));
}
