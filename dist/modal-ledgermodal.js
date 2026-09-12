"use strict";
const LEDGER_MODAL_CHIP_DEFS = [
    { key: "all", label: "All" }, { key: "fresh", label: "Fresh" }, { key: "projected", label: "Projected" },
    { key: "aged", label: "Aged" }, { key: "urgent", label: "Urgent" }, { key: "highrisk", label: "High Risk" },
    { key: "reallocated", label: "Reallocated" }, { key: "returned", label: "Returned" },
];
function LedgerModal({ depotCode: initialCode }) {
    const { data, scope, closeModal, toast, runAction } = useApp();
    const depotOptions = React.useMemo(() => {
        const real = depotsForScope(data.depots, "national").filter((d) => d.status === "active");
        return real.concat(PSEUDO_DEPOTS);
    }, [data.depots]);
    const defaultCode = initialCode || (() => {
        const scoped = scope !== "national" ? depotOptions.filter((d) => d.territory === scope) : depotOptions;
        return (scoped[0] || depotOptions[0] || {}).code || "";
    })();
    const [depotCode, setDepotCode] = React.useState(defaultCode);
    const [pasteText, setPasteText] = React.useState("");
    const [setBy, setSetBy] = React.useState("");
    const [filter, setFilter] = React.useState("all");
    const [search, setSearch] = React.useState("");
    const rec = data.ledgerBaseline[depotCode];
    const devices = ledgerDevices(data.deviceLedger, depotCode);
    const counts = countsForDevices(devices);
    function onDepotChange(code) {
        setDepotCode(code);
        setSetBy("");
        setPasteText("");
        setFilter("all");
        setSearch("");
    }
    function saveBaseline() {
        const parsed = parsePastedDevices(pasteText);
        if (parsed.rows.length === 0) {
            toast("No valid rows found — check the pasted data.");
            return;
        }
        runAction(() => data.saveLedgerBaseline(depotCode, setBy, parsed.rows), "Baseline saved — " + parsed.rows.length + " device" + (parsed.rows.length === 1 ? "" : "s"))
            .then(() => { if (parsed.skipped > 0)
            toast(parsed.skipped + " row(s) skipped (missing serial number)"); setPasteText(""); });
    }
    function matchesFilter(dv, tier) {
        if (filter === "all")
            return true;
        if (filter === "reallocated")
            return dv.status === "reallocated";
        if (filter === "returned")
            return dv.status === "returned";
        return dv.status !== "reallocated" && tier && tier.key === filter;
    }
    const q = search.trim().toLowerCase();
    const rows = [...devices]
        .sort((a, b) => (daysAllocated(b.allocatedDate) || 0) - (daysAllocated(a.allocatedDate) || 0))
        .filter((dv) => {
        const tier = dv.status === "reallocated" ? null : ledgerTierFor(daysAllocated(dv.allocatedDate));
        if (!matchesFilter(dv, tier))
            return false;
        if (q && !(dv.serial || "").toLowerCase().includes(q) && !(dv.dsrName || "").toLowerCase().includes(q))
            return false;
        return true;
    });
    function exportDepotCsv() {
        const out = [["Serial Number", "Product", "Shop Name", "DSR Name", "Date Allocated", "Days", "Aging Tier", "Status"]];
        devices.forEach((dv) => {
            const days = daysAllocated(dv.allocatedDate);
            const tier = dv.status === "reallocated" ? null : ledgerTierFor(days);
            out.push([dv.serial, dv.model, dv.shopName || "", dv.dsrName, dv.allocatedDate, days === null ? "" : days, tier ? tier.label : (dv.status === "reallocated" ? "" : "—"), dv.status]);
        });
        downloadCsv(depotCode + "-device-allocation-analysis.csv", out);
    }
    return (React.createElement(Modal, { open: true, onClose: closeModal, xwide: true, title: "Device Allocation Analysis", footer: React.createElement("button", { className: "btn", onClick: closeModal }, "Close") },
        React.createElement("div", { className: "field-row" },
            React.createElement("div", { className: "field-label" }, "Depot"),
            React.createElement("select", { className: "field-input", value: depotCode, onChange: (e) => onDepotChange(e.target.value) }, depotOptions.map((d) => React.createElement("option", { key: d.code, value: d.code },
                d.name,
                " (",
                d.code,
                ")")))),
        React.createElement("div", { style: { fontSize: 11.5, color: "var(--text-muted)", margin: "-4px 0 4px" } }, rec ? `Baseline last set ${fmtDateShort(rec.baselineSetAt.slice(0, 10))} by ${rec.baselineSetBy} · ${devices.length} device(s) on file.` : "No baseline uploaded yet for this depot."),
        rec && (React.createElement("div", { style: { display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 } }, [
            ["Fresh (0–5d)", counts.fresh, "var(--success)"], ["Projected (6–10d)", counts.projected, "var(--warning)"],
            ["Aged (11–13d)", counts.aged, "var(--critical)"], ["Urgent Sale (14–29d)", counts.urgent, "var(--urgent)"],
            ["High Risk (30d+)", counts.highrisk, "var(--severe)"], ["Reallocated", counts.reallocated, "var(--text-muted)"],
            ["Returned", counts.returned, "var(--text-muted)"],
        ].map((row) => (React.createElement("div", { key: row[0] },
            React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--text-muted)" } }, row[0]),
            React.createElement("div", { className: "mono", style: { fontSize: 15, fontWeight: 600, color: row[2] } }, row[1])))))),
        React.createElement("div", { className: "drawer-section-title", style: { marginTop: 4 } }, "Upload Baseline"),
        React.createElement("div", { style: { fontSize: 11, color: "var(--text-faint)", marginBottom: 6 } }, "Paste from Excel \u2014 one device per row, columns in this order: Serial Number, Product, Shop Name, DSR Name, Device Age (days). Every device starts \"In Stock\" \u2014 mark one Reallocated from the table below once it's recovered. Uploading a new baseline replaces this depot's current device list."),
        React.createElement("div", { className: "field-row" },
            React.createElement("textarea", { className: "field-input", rows: 5, placeholder: "SN12345\tA07/64\tKasoa Main Shop\tKwame Mensah\t12", value: pasteText, onChange: (e) => setPasteText(e.target.value) })),
        React.createElement("div", { className: "field-row" },
            React.createElement("div", { className: "field-label" }, "Set by (your name)"),
            React.createElement("input", { className: "field-input", value: setBy, onChange: (e) => setSetBy(e.target.value) })),
        React.createElement("div", { style: { marginBottom: 16 } },
            React.createElement("button", { className: "btn btn-primary btn-sm", onClick: saveBaseline }, "Save Baseline")),
        React.createElement("div", { className: "drawer-section-title" }, "Devices \u2014 search or mark Reallocated / Returned"),
        React.createElement("div", { className: "field-row" },
            React.createElement("input", { className: "field-input", placeholder: "Search serial number or DSR name", value: search, onChange: (e) => setSearch(e.target.value) })),
        React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 10px" } }, LEDGER_MODAL_CHIP_DEFS.map((c) => (React.createElement("button", { key: c.key, className: "btn btn-sm" + (filter === c.key ? " btn-primary" : ""), onClick: () => setFilter(c.key) }, c.label)))),
        rows.length === 0 ? (React.createElement("div", { style: { padding: "16px 0", color: "var(--text-faint)", fontSize: 12.5 } }, "No devices match.")) : (React.createElement("div", { style: { overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8, maxHeight: 320, overflowY: "auto" } },
            React.createElement("table", null,
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Serial"),
                        React.createElement("th", null, "Product"),
                        React.createElement("th", null, "Shop"),
                        React.createElement("th", null, "DSR"),
                        React.createElement("th", null, "Aging / Status"),
                        React.createElement("th", null, "Actions"))),
                React.createElement("tbody", null, rows.map((dv) => (React.createElement("tr", { key: dv.serial },
                    React.createElement("td", { className: "mono" }, dv.serial),
                    React.createElement("td", null, dv.model || "—"),
                    React.createElement("td", null, dv.shopName || "—"),
                    React.createElement("td", null, dv.dsrName || "—"),
                    React.createElement("td", null, ledgerAgingBadge(dv)),
                    React.createElement("td", null,
                        React.createElement("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } },
                            dv.status !== "reallocated" && React.createElement("button", { className: "btn btn-sm", onClick: () => runAction(() => data.updateDeviceStatus(depotCode, dv.serial, "reallocated", setBy || "—"), "Device marked reallocated") }, "Mark Reallocated"),
                            dv.status !== "returned" && React.createElement("button", { className: "btn btn-sm", onClick: () => runAction(() => data.updateDeviceStatus(depotCode, dv.serial, "returned", setBy || "—"), "Device marked returned") }, "Mark Returned"),
                            dv.status !== "in_stock" && React.createElement("button", { className: "btn btn-sm", onClick: () => runAction(() => data.updateDeviceStatus(depotCode, dv.serial, "in_stock", setBy || "—"), "Device reinstated") }, "Reinstate")))))))))),
        React.createElement("div", { style: { marginTop: 10 } },
            React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: exportDepotCsv }, "\uD83D\uDCE5 Export this depot (CSV)"))));
}
