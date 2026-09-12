"use strict";
// Clickable Ghana territory map for the Overview tab. Boundary data lives in
// ghana-map-data.js (loaded before this file). Colors are a validated
// categorical palette (dataviz skill) chosen so every pair of territories
// that actually border each other on this map stays distinguishable.
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
function GhanaMap() {
    const { data, setScope } = useApp();
    const [hovered, setHovered] = React.useState(null);
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
    return (React.createElement("div", { className: "ghana-map-wrap" },
        React.createElement("svg", { className: "ghana-map-svg", viewBox: GHANA_MAP_VIEWBOX, onMouseMove: (e) => setPointer({ x: e.clientX, y: e.clientY }) },
            TERRITORY_ORDER.map((t) => (React.createElement("g", { key: t }, (GHANA_TERRITORY_PATHS[t] || []).map((d, i) => (React.createElement("path", { key: i, className: "ghana-tile" + (hovered === t ? " hovered" : ""), style: { fill: GHANA_MAP_COLORS[t] }, d: d, onMouseEnter: () => setHovered(t), onMouseLeave: () => setHovered((h) => (h === t ? null : h)), onClick: () => setScope(t) })))))),
            TERRITORY_ORDER.map((t) => {
                const p = GHANA_LABEL_POINTS[t];
                if (!p)
                    return null;
                return (React.createElement("text", { key: t, className: "ghana-map-label", x: p[0], y: p[1], textAnchor: "middle", dominantBaseline: "middle", onMouseEnter: () => setHovered(t), onMouseLeave: () => setHovered((h) => (h === t ? null : h)), onClick: () => setScope(t) }, t));
            })),
        hovered && (React.createElement("div", { className: "ghana-map-tooltip", style: { left: pointer.x + 14, top: pointer.y + 14 } }, (() => {
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
                React.createElement("div", { className: "ghana-map-tooltip-hint" }, "Click to open \u2192")));
        })()))));
}
